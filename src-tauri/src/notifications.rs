//! System notifications (Windows).
//!
//! Uses `UserNotificationListener` to notice new toasts in the Action Center and forwards them
//! to the island as `notification-received`. Nothing is stored or sent anywhere; content only
//! travels from this thread to the island window.
//!
//! * Existing notifications at startup are ignored (only new ones appear).
//! * Skipped while Do Not Disturb / Focus Assist or a fullscreen app is active.
//! * With "previews" off, only the app name is forwarded, never the message text.

use serde::Serialize;
use std::sync::atomic::{AtomicU8, Ordering};

#[derive(Serialize, Clone, Debug)]
pub struct ToastInfo {
    pub id: u32,
    pub app: String,
    pub title: String,
    pub body: String,
}

/// 0 = unknown, 1 = allowed, 2 = denied/unavailable
static ACCESS: AtomicU8 = AtomicU8::new(0);

pub fn access() -> &'static str {
    match ACCESS.load(Ordering::Relaxed) {
        1 => "allowed",
        2 => "denied",
        _ => "unknown",
    }
}

#[cfg(windows)]
pub fn start(app: tauri::AppHandle) {
    std::thread::Builder::new()
        .name("notifications".into())
        .spawn(move || win::run(app))
        .ok();
}

#[cfg(not(windows))]
pub fn start(_app: tauri::AppHandle) {}

#[cfg(windows)]
mod win {
    use super::*;
    use std::collections::HashSet;
    use std::time::Duration;
    use tauri::{AppHandle, Emitter, Manager};
    use windows::UI::Notifications::Management::{UserNotificationListener, UserNotificationListenerAccessStatus};
    use windows::UI::Notifications::{KnownNotificationBindings, NotificationKinds, UserNotification};
    use windows::Win32::System::WinRT::{RoInitialize, RO_INIT_MULTITHREADED};

    const POLL: Duration = Duration::from_millis(1500);

    pub fn run(app: AppHandle) {
        unsafe {
            let _ = RoInitialize(RO_INIT_MULTITHREADED);
        }
        let Ok(listener) = UserNotificationListener::Current() else {
            ACCESS.store(2, Ordering::Relaxed);
            return;
        };
        let granted = listener
            .RequestAccessAsync()
            .and_then(|a| a.get())
            .map(|s| s == UserNotificationListenerAccessStatus::Allowed)
            .unwrap_or(false);
        ACCESS.store(if granted { 1 } else { 2 }, Ordering::Relaxed);
        if !granted {
            return;
        }

        let mut seen: HashSet<u32> = HashSet::new();
        let mut primed = false;

        loop {
            std::thread::sleep(POLL);
            let Some(list) = listener
                .GetNotificationsAsync(NotificationKinds::Toast)
                .ok()
                .and_then(|a| a.get().ok())
            else {
                continue;
            };

            let (enabled, previews) = app
                .try_state::<crate::AppState>()
                .map(|s| {
                    let s = s.settings.lock().unwrap();
                    (s.notifications_enabled, s.notification_previews)
                })
                .unwrap_or((false, false));
            let quiet = crate::window_watch::quiet_now();

            let mut current = HashSet::new();
            for n in list {
                let Ok(id) = n.Id() else { continue };
                current.insert(id);
                if !primed || seen.contains(&id) {
                    continue;
                }
                if enabled && !quiet {
                    if let Some(info) = describe(&n, id, previews) {
                        let _ = app.emit_to("island", "notification-received", info);
                    }
                }
            }
            seen = current;
            primed = true;
        }
    }

    fn describe(n: &UserNotification, id: u32, previews: bool) -> Option<ToastInfo> {
        let app = n
            .AppInfo()
            .ok()
            .and_then(|a| a.DisplayInfo().ok())
            .and_then(|d| d.DisplayName().ok())
            .map(|v| v.to_string())
            .unwrap_or_else(|| "Notification".into());
        if !previews {
            return Some(ToastInfo { id, app, title: String::new(), body: String::new() });
        }
        let binding = n
            .Notification()
            .ok()?
            .Visual()
            .ok()?
            .GetBinding(&KnownNotificationBindings::ToastGeneric().ok()?)
            .ok()?;
        let lines: Vec<String> = binding
            .GetTextElements()
            .ok()?
            .into_iter()
            .filter_map(|t| t.Text().ok())
            .map(|t| t.to_string())
            .filter(|t| !t.trim().is_empty())
            .collect();
        let mut it = lines.into_iter();
        let title = it.next().unwrap_or_default();
        let body = it.collect::<Vec<_>>().join("\n");
        Some(ToastInfo { id, app, title, body })
    }
}
