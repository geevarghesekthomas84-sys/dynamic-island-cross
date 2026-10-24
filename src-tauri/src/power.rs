//! Power source and battery level.
//!
//! Reports `power-changed` to the island whenever the power source, charge state or battery
//! percentage changes, so the UI can show charger connect / disconnect / fully-charged moments.
//! Windows uses `GetSystemPowerStatus` (authoritative AC-line state); other platforms fall back
//! to the `battery` crate.

use serde::Serialize;
use std::sync::Mutex;
use std::time::Duration;
use tauri::{AppHandle, Emitter};

#[derive(Serialize, Clone, PartialEq, Debug)]
pub struct PowerState {
    /// 0-100, or None when the machine has no battery.
    pub percent: Option<u8>,
    /// "charging" | "full" (plugged in, not charging) | "discharging" | "none"
    pub state: String,
}

impl Default for PowerState {
    fn default() -> Self {
        Self { percent: None, state: "none".into() }
    }
}

static LAST: Mutex<Option<PowerState>> = Mutex::new(None);

pub fn last() -> PowerState {
    LAST.lock().unwrap().clone().unwrap_or_default()
}

pub fn start(app: AppHandle) {
    std::thread::Builder::new()
        .name("power-watch".into())
        .spawn(move || loop {
            let now = read();
            let changed = LAST.lock().unwrap().as_ref() != Some(&now);
            if changed {
                *LAST.lock().unwrap() = Some(now.clone());
                let _ = app.emit_to("island", "power-changed", now);
            }
            std::thread::sleep(Duration::from_millis(2000));
        })
        .ok();
}

#[cfg(windows)]
fn read() -> PowerState {
    use windows::Win32::System::Power::{GetSystemPowerStatus, SYSTEM_POWER_STATUS};
    let mut s = SYSTEM_POWER_STATUS::default();
    if unsafe { GetSystemPowerStatus(&mut s) }.is_err() {
        return PowerState::default();
    }
    const NO_BATTERY: u8 = 128;
    const CHARGING: u8 = 8;
    if s.BatteryFlag == 255 || s.BatteryFlag & NO_BATTERY != 0 {
        return PowerState::default();
    }
    let percent = (s.BatteryLifePercent <= 100).then_some(s.BatteryLifePercent);
    let state = match s.ACLineStatus {
        1 if s.BatteryFlag & CHARGING != 0 => "charging",
        1 => "full",
        _ => "discharging",
    };
    PowerState { percent, state: state.into() }
}

#[cfg(not(windows))]
fn read() -> PowerState {
    let Ok(manager) = battery::Manager::new() else { return PowerState::default() };
    let Ok(mut batteries) = manager.batteries() else { return PowerState::default() };
    let Some(Ok(b)) = batteries.next() else { return PowerState::default() };
    let percent = b.state_of_charge().get::<battery::units::ratio::percent>().round().clamp(0.0, 100.0) as u8;
    let state = match b.state() {
        battery::State::Charging => "charging",
        battery::State::Full => "full",
        _ => "discharging",
    };
    PowerState { percent: Some(percent), state: state.into() }
}
