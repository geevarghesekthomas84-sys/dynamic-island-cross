//! Window behavior that needs the OS rather than the webview:
//!
//! * Click-through: the island window has a transparent margin for its glow. While the cursor is
//!   outside the island itself the window ignores the mouse, so clicks reach the app underneath.
//!   Because an ignoring window gets no DOM events, this thread is also the source of truth for
//!   hover and reports it to the UI as `island-hover`.
//! * Fullscreen awareness: hides the island while a fullscreen app or game is in the foreground.

use std::time::{Duration, Instant};
use tauri::{AppHandle, Emitter, Manager};

/// Transparent margin around the island, in logical px. Must match `PAD` in the UI.
const PAD: f64 = 14.0;
const TICK: Duration = Duration::from_millis(50);
const FULLSCREEN_EVERY: Duration = Duration::from_millis(1000);

pub fn start(app: AppHandle) {
    std::thread::Builder::new()
        .name("window-watch".into())
        .spawn(move || run(app))
        .ok();
}

fn run(app: AppHandle) {
    let mut inside = false;
    let mut ignoring: Option<bool> = None;
    let mut hidden_for_fullscreen = false;
    let mut last_fs_check = Instant::now() - FULLSCREEN_EVERY;

    loop {
        std::thread::sleep(TICK);
        let Some(win) = app.get_webview_window("island") else { continue };

        if last_fs_check.elapsed() >= FULLSCREEN_EVERY {
            last_fs_check = Instant::now();
            let wanted = app
                .try_state::<crate::AppState>()
                .map(|s| s.settings.lock().unwrap().hide_in_fullscreen)
                .unwrap_or(false);
            let fullscreen = wanted && fullscreen_app_active();
            if fullscreen && !hidden_for_fullscreen && win.is_visible().unwrap_or(false) {
                let _ = win.hide();
                hidden_for_fullscreen = true;
            } else if !fullscreen && hidden_for_fullscreen {
                let _ = win.show();
                hidden_for_fullscreen = false;
            }
        }

        if !win.is_visible().unwrap_or(false) {
            continue;
        }
        let (Ok(cursor), Ok(pos), Ok(size)) =
            (win.cursor_position(), win.outer_position(), win.outer_size())
        else {
            continue;
        };
        let pad = PAD * win.scale_factor().unwrap_or(1.0);
        let (left, right) = (pos.x as f64 + pad, pos.x as f64 + size.width as f64 - pad);
        let (top, bottom) = (pos.y as f64 + pad, pos.y as f64 + size.height as f64 - pad);
        let now_inside = cursor.x >= left && cursor.x <= right && cursor.y >= top && cursor.y <= bottom;

        if ignoring != Some(!now_inside) {
            ignoring = Some(!now_inside);
            let _ = win.set_ignore_cursor_events(!now_inside);
        }
        if now_inside != inside {
            inside = now_inside;
            let _ = app.emit_to("island", "island-hover", inside);
        }
    }
}

#[cfg(windows)]
fn fullscreen_app_active() -> bool {
    use windows::Win32::UI::Shell::{
        SHQueryUserNotificationState, QUNS_BUSY, QUNS_PRESENTATION_MODE, QUNS_RUNNING_D3D_FULL_SCREEN,
    };
    match unsafe { SHQueryUserNotificationState() } {
        Ok(state) => state == QUNS_BUSY || state == QUNS_RUNNING_D3D_FULL_SCREEN || state == QUNS_PRESENTATION_MODE,
        Err(_) => false,
    }
}

#[cfg(not(windows))]
fn fullscreen_app_active() -> bool {
    false
}

/// True when Windows is asking not to be disturbed: Focus Assist / Do Not Disturb, a
/// presentation, or a fullscreen app.
#[cfg(windows)]
pub fn quiet_now() -> bool {
    use windows::Win32::UI::Shell::{SHQueryUserNotificationState, QUNS_ACCEPTS_NOTIFICATIONS, QUNS_APP};
    match unsafe { SHQueryUserNotificationState() } {
        Ok(state) => state != QUNS_ACCEPTS_NOTIFICATIONS && state != QUNS_APP,
        Err(_) => false,
    }
}

#[cfg(not(windows))]
pub fn quiet_now() -> bool {
    false
}
