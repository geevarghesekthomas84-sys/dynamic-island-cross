mod media;
mod notifications;
mod power;
mod privacy;
mod volume;
mod window_watch;

use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use sysinfo::System;
use tauri::{AppHandle, Emitter, Manager, State};

struct AppState {
    sys: Mutex<System>,
    settings: Mutex<Settings>,
    island_size: Mutex<(f64, f64)>,
    media: media::MediaHandle,
}

// ── Settings (persisted as JSON in the app config dir) ──────────
#[derive(Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase", default)]
struct Settings {
    theme: String,
    accent: String,
    glow: f64,
    animation_speed: f64,
    reduced_motion: bool,
    monitor: usize,
    offset_x: f64,
    top_margin: f64,
    auto_hide_seconds: f64,
    hide_in_fullscreen: bool,
    shortcut: String,
    notifications_enabled: bool,
    notification_previews: bool,
    island_scale: f64,
    hover_mode: String,
    hover_delay: f64,
    show_music: bool,
    show_mic_status: bool,
    notification_seconds: f64,
    show_charging: bool,
    show_volume: bool,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            theme: "dark".into(),
            accent: "#4cc9f0".into(),
            glow: 0.5,
            animation_speed: 1.0,
            reduced_motion: false,
            monitor: 0,
            offset_x: 0.0,
            top_margin: 4.0,
            auto_hide_seconds: 0.0,
            hide_in_fullscreen: true,
            shortcut: "Ctrl+Shift+D".into(),
            notifications_enabled: true,
            notification_previews: true,
            island_scale: 1.0,
            hover_mode: "hover".into(),
            hover_delay: 0.0,
            show_music: true,
            show_mic_status: true,
            notification_seconds: 7.0,
            show_charging: true,
            show_volume: true,
        }
    }
}

fn settings_path(app: &AppHandle) -> Option<std::path::PathBuf> {
    app.path().app_config_dir().ok().map(|d| d.join("settings.json"))
}

fn load_settings_file(app: &AppHandle) -> Settings {
    settings_path(app)
        .and_then(|p| std::fs::read_to_string(p).ok())
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

#[tauri::command]
fn get_settings(state: State<AppState>) -> Settings {
    state.settings.lock().unwrap().clone()
}

#[tauri::command]
fn save_settings(app: AppHandle, state: State<AppState>, settings: Settings) -> Result<(), String> {
    let mut s = settings;
    s.glow = s.glow.clamp(0.0, 1.0);
    s.animation_speed = s.animation_speed.clamp(0.25, 3.0);
    s.offset_x = s.offset_x.clamp(-2000.0, 2000.0);
    s.top_margin = s.top_margin.clamp(0.0, 400.0);
    s.auto_hide_seconds = s.auto_hide_seconds.clamp(0.0, 600.0);
    s.island_scale = s.island_scale.clamp(0.8, 1.4);
    s.hover_delay = s.hover_delay.clamp(0.0, 1500.0);
    s.notification_seconds = s.notification_seconds.clamp(2.0, 30.0);
    if s.hover_mode != "click" {
        s.hover_mode = "hover".into();
    }

    let previous = state.settings.lock().unwrap().shortcut.clone();
    if previous != s.shortcut {
        register_shortcut(&app, Some(&previous), &s.shortcut)?;
    }

    if let Some(path) = settings_path(&app) {
        if let Some(dir) = path.parent() {
            std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
        }
        let json = serde_json::to_string_pretty(&s).map_err(|e| e.to_string())?;
        std::fs::write(path, json).map_err(|e| e.to_string())?;
    }
    *state.settings.lock().unwrap() = s.clone();

    if let Some(window) = app.get_webview_window("island") {
        let (w, h) = *state.island_size.lock().unwrap();
        place_top_center(&window, w, h, &s);
    }
    app.emit("settings-changed", s).map_err(|e| e.to_string())
}

#[derive(Serialize)]
struct MonitorInfo {
    index: usize,
    name: String,
    width: u32,
    height: u32,
}

#[tauri::command]
fn list_monitors(app: AppHandle) -> Vec<MonitorInfo> {
    app.available_monitors()
        .unwrap_or_default()
        .iter()
        .enumerate()
        .map(|(index, m)| MonitorInfo {
            index,
            name: m.name().cloned().unwrap_or_else(|| format!("Display {}", index + 1)),
            width: m.size().width,
            height: m.size().height,
        })
        .collect()
}

fn toggle_island(app: &AppHandle) {
    if let Some(win) = app.get_webview_window("island") {
        if win.is_visible().unwrap_or(true) {
            let _ = win.hide();
        } else {
            let _ = win.show();
        }
    }
}

/// Registers `next` as the show/hide shortcut, replacing `previous`. Nothing changes on failure.
fn register_shortcut(app: &AppHandle, previous: Option<&str>, next: &str) -> Result<(), String> {
    use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut, ShortcutState};
    let new: Shortcut = next.parse().map_err(|_| format!("'{next}' is not a valid shortcut"))?;
    let gs = app.global_shortcut();
    let old: Option<Shortcut> = previous.and_then(|p| p.parse().ok());
    if let Some(o) = old {
        if o != new {
            let _ = gs.unregister(o);
        }
    }
    if !gs.is_registered(new) {
        let handle = app.clone();
        let registered = gs.on_shortcut(new, move |_app, _sc, event| {
            if event.state() == ShortcutState::Pressed {
                toggle_island(&handle);
            }
        });
        if let Err(e) = registered {
            if let Some(o) = old {
                let h = app.clone();
                let _ = gs.on_shortcut(o, move |_a, _s, ev| {
                    if ev.state() == ShortcutState::Pressed {
                        toggle_island(&h);
                    }
                });
            }
            return Err(format!("Could not register {next}: {e}"));
        }
    }
    Ok(())
}

// Async: these touch COM and must not run on the main (UI) thread.
#[tauri::command]
async fn get_volume() -> Option<volume::VolumeState> {
    volume::get()
}

#[tauri::command]
async fn set_volume(level: f32) -> bool {
    volume::set_level(level)
}

#[tauri::command]
async fn set_muted(muted: bool) -> bool {
    volume::set_muted(muted)
}

#[tauri::command]
fn get_power() -> power::PowerState {
    power::last()
}

#[tauri::command]
fn get_privacy() -> privacy::PrivacyState {
    privacy::last()
}

#[tauri::command]
fn get_notification_access() -> &'static str {
    notifications::access()
}

#[tauri::command]
fn get_autostart(app: AppHandle) -> bool {
    use tauri_plugin_autostart::ManagerExt;
    app.autolaunch().is_enabled().unwrap_or(false)
}

#[tauri::command]
fn set_autostart(app: AppHandle, enabled: bool) -> Result<bool, String> {
    use tauri_plugin_autostart::ManagerExt;
    let m = app.autolaunch();
    if enabled { m.enable() } else { m.disable() }.map_err(|e| e.to_string())?;
    Ok(m.is_enabled().unwrap_or(enabled))
}

fn open_settings_window(app: &AppHandle) {
    use tauri::{WebviewUrl, WebviewWindowBuilder};
    if let Some(w) = app.get_webview_window("settings") {
        let _ = w.show();
        let _ = w.set_focus();
        return;
    }
    let _ = WebviewWindowBuilder::new(app, "settings", WebviewUrl::App("index.html?view=settings".into()))
        .title("Dynamic Island Settings")
        .inner_size(480.0, 640.0)
        .resizable(false)
        .maximizable(false)
        .build();
}

// Async on purpose: creating a window from a sync command deadlocks WebView2 setup on Windows.
#[tauri::command]
async fn open_settings(app: AppHandle) {
    open_settings_window(&app);
}

// ── System Info ─────────────────────────────────────────────────
#[derive(Serialize)]
struct SystemInfo {
    cpu_usage: f32,
    memory_used_gb: f64,
    memory_total_gb: f64,
    memory_percent: f64,
    battery_percent: Option<f32>,
    battery_charging: Option<bool>,
    uptime_secs: u64,
}

#[tauri::command]
fn get_system_info(state: State<AppState>) -> SystemInfo {
    let mut sys = state.sys.lock().unwrap();
    sys.refresh_cpu_usage();
    sys.refresh_memory();

    let cpu_usage = sys.global_cpu_usage();
    let mem_used = sys.used_memory() as f64 / 1_073_741_824.0;
    let mem_total = sys.total_memory() as f64 / 1_073_741_824.0;
    let mem_pct = if mem_total > 0.0 { mem_used / mem_total * 100.0 } else { 0.0 };

    let (batt_pct, batt_charging) = get_battery_info();

    SystemInfo {
        cpu_usage,
        memory_used_gb: (mem_used * 10.0).round() / 10.0,
        memory_total_gb: (mem_total * 10.0).round() / 10.0,
        memory_percent: (mem_pct * 10.0).round() / 10.0,
        battery_percent: batt_pct,
        battery_charging: batt_charging,
        uptime_secs: System::uptime(),
    }
}

fn get_battery_info() -> (Option<f32>, Option<bool>) {
    let Ok(manager) = battery::Manager::new() else { return (None, None) };
    let Ok(mut batteries) = manager.batteries() else { return (None, None) };
    if let Some(Ok(b)) = batteries.next() {
        let pct = b.state_of_charge().get::<battery::units::ratio::percent>();
        let charging = b.state() == battery::State::Charging;
        (Some(pct), Some(charging))
    } else {
        (None, None)
    }
}

// ── Media controls ──────────────────────────────────────────────
#[tauri::command]
fn media_control(action: String) {
    use enigo::{Direction, Enigo, Key, Keyboard, Settings};
    let Ok(mut enigo) = Enigo::new(&Settings::default()) else { return };
    let key = match action.as_str() {
        "play_pause" => Key::MediaPlayPause,
        "next" => Key::MediaNextTrack,
        "prev" => Key::MediaPrevTrack,
        "vol_up" => Key::VolumeUp,
        "vol_down" => Key::VolumeDown,
        "mute" => Key::VolumeMute,
        _ => return,
    };
    let _ = enigo.key(key, Direction::Click);
}

#[tauri::command]
fn media_command(state: State<AppState>, action: String, position: Option<f64>) {
    use media::MediaCmd;
    let cmd = match action.as_str() {
        "play_pause" => MediaCmd::PlayPause,
        "next" => MediaCmd::Next,
        "prev" => MediaCmd::Prev,
        "seek" => MediaCmd::Seek(position.unwrap_or(0.0)),
        _ => return,
    };
    if state.media.send(cmd) {
        return;
    }
    // No media session available (non-Windows): fall back to the media keys.
    if action != "seek" {
        media_control(action);
    }
}

#[tauri::command]
fn get_media(state: State<AppState>) -> Option<media::MediaInfo> {
    state.media.last.lock().unwrap().clone()
}

// ── Window sizing ───────────────────────────────────────────────
fn place_top_center(window: &tauri::WebviewWindow, w: f64, h: f64, s: &Settings) {
    use tauri::{LogicalPosition, LogicalSize};
    let _ = window.set_size(LogicalSize::new(w, h));
    let monitors = window.available_monitors().unwrap_or_default();
    let monitor = monitors
        .get(s.monitor)
        .cloned()
        .or_else(|| window.primary_monitor().ok().flatten())
        .or_else(|| window.current_monitor().ok().flatten());
    if let Some(m) = monitor {
        let scale = m.scale_factor();
        let ox = m.position().x as f64 / scale;
        let oy = m.position().y as f64 / scale;
        let sw = m.size().width as f64 / scale;
        let sh = m.size().height as f64 / scale;
        // Keep the whole window on this display whatever the offset, size or scaling.
        let x = (ox + (sw - w) / 2.0 + s.offset_x).clamp(ox, (ox + sw - w).max(ox));
        let y = (oy + s.top_margin).clamp(oy, (oy + sh - h).max(oy));
        let _ = window.set_position(LogicalPosition::new(x, y));
    }
}

#[tauri::command]
fn set_island_size(window: tauri::WebviewWindow, state: State<AppState>, width: f64, height: f64) {
    let (w, h) = (width.clamp(40.0, 900.0), height.clamp(20.0, 600.0));
    *state.island_size.lock().unwrap() = (w, h);
    let s = state.settings.lock().unwrap().clone();
    place_top_center(&window, w, h, &s);
}

// ── App entry ───────────────────────────────────────────────────
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let sys = System::new_all();
    tauri::Builder::default()
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            None,
        ))
        .manage(AppState {
            sys: Mutex::new(sys),
            settings: Mutex::new(Settings::default()),
            island_size: Mutex::new((160.0, 64.0)),
            media: media::MediaHandle::default(),
        })
        .invoke_handler(tauri::generate_handler![
            get_system_info,
            media_control,
            set_island_size,
            get_settings,
            save_settings,
            list_monitors,
            open_settings,
            media_command,
            get_media,
            get_autostart,
            set_autostart,
            get_privacy,
            get_power,
            get_volume,
            set_volume,
            set_muted,
            get_notification_access,
        ])
        .setup(|app| {
            let window = app.get_webview_window("island").unwrap();
            media::start(app.handle().clone(), &app.state::<AppState>().media);

            let loaded = load_settings_file(app.handle());
            place_top_center(&window, 160.0, 64.0, &loaded);
            let shortcut = loaded.shortcut.clone();
            *app.state::<AppState>().settings.lock().unwrap() = loaded;
            if let Err(e) = register_shortcut(app.handle(), None, &shortcut) {
                eprintln!("shortcut: {e}");
            }
            window_watch::start(app.handle().clone());
            privacy::start(app.handle().clone());
            power::start(app.handle().clone());
            volume::start(app.handle().clone());
            notifications::start(app.handle().clone());

            // System tray
            use tauri::menu::{MenuBuilder, MenuItemBuilder};
            use tauri::tray::TrayIconBuilder;

            let show_item = MenuItemBuilder::with_id("show", "Show / Hide").build(app)?;
            let settings_item = MenuItemBuilder::with_id("settings", "Settings…").build(app)?;
            let quit_item = MenuItemBuilder::with_id("quit", "Quit").build(app)?;
            let tray_menu = MenuBuilder::new(app)
                .item(&show_item)
                .item(&settings_item)
                .separator()
                .item(&quit_item)
                .build()?;

            TrayIconBuilder::new()
                .icon(app.default_window_icon().cloned().unwrap())
                .tooltip("Dynamic Island")
                .menu(&tray_menu)
                .on_menu_event(move |app, event| {
                    match event.id().as_ref() {
                        "show" => toggle_island(app),
                        "settings" => open_settings_window(app),
                        "quit" => { app.exit(0); }
                        _ => {}
                    }
                })
                .build(app)?;

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
