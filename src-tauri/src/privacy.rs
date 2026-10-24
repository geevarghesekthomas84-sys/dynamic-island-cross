//! Microphone / camera activity.
//!
//! Windows records which apps currently use the microphone or webcam under
//! `HKCU\...\CapabilityAccessManager\ConsentStore` (the same data behind the system's tray
//! privacy indicator). An app is "in use" when its last start time is newer than its last stop
//! time. This only reads those timestamps; it never opens the devices.

use serde::Serialize;
use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

#[derive(Serialize, Clone, Default, PartialEq, Debug)]
pub struct PrivacyState {
    pub mic: Option<String>,
    pub camera: Option<String>,
}

static LAST: Mutex<Option<PrivacyState>> = Mutex::new(None);

pub fn last() -> PrivacyState {
    LAST.lock().unwrap().clone().unwrap_or_default()
}

#[cfg(windows)]
pub fn start(app: AppHandle) {
    std::thread::Builder::new()
        .name("privacy-watch".into())
        .spawn(move || loop {
            let now = PrivacyState {
                mic: win::in_use("microphone"),
                camera: win::in_use("webcam"),
            };
            let changed = LAST.lock().unwrap().as_ref() != Some(&now);
            if changed {
                *LAST.lock().unwrap() = Some(now.clone());
                let _ = app.emit_to("island", "privacy-changed", now);
            }
            std::thread::sleep(Duration::from_millis(2000));
        })
        .ok();
}

#[cfg(not(windows))]
pub fn start(_app: AppHandle) {}

#[cfg(windows)]
mod win {
    use winreg::enums::HKEY_CURRENT_USER;
    use winreg::RegKey;

    const BASE: &str = r"Software\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore";

    fn active(key: &RegKey) -> bool {
        let start: u64 = key.get_value("LastUsedTimeStart").unwrap_or(0);
        let stop: u64 = key.get_value("LastUsedTimeStop").unwrap_or(0);
        start > 0 && start > stop
    }

    /// Readable app name from a ConsentStore subkey name.
    fn pretty(name: &str) -> String {
        // Desktop apps: a path with '\' replaced by '#'. Store apps: "Publisher.App_hash".
        let leaf = name.rsplit('#').next().unwrap_or(name);
        let leaf = leaf.trim_end_matches(".exe");
        leaf.split('_').next().unwrap_or(leaf).to_string()
    }

    /// Name of an app currently using `kind` ("microphone" or "webcam"), if any.
    pub fn in_use(kind: &str) -> Option<String> {
        let root = RegKey::predef(HKEY_CURRENT_USER)
            .open_subkey(format!(r"{BASE}\{kind}"))
            .ok()?;
        for name in root.enum_keys().flatten() {
            let Ok(sub) = root.open_subkey(&name) else { continue };
            if name == "NonPackaged" {
                for app in sub.enum_keys().flatten() {
                    if sub.open_subkey(&app).map(|k| active(&k)).unwrap_or(false) {
                        return Some(pretty(&app));
                    }
                }
            } else if active(&sub) {
                return Some(pretty(&name));
            }
        }
        None
    }
}
