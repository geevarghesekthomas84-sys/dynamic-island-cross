//! Real system output volume.
//!
//! Windows: Core Audio (`IAudioEndpointVolume`) on the default playback device. Changes made by
//! the volume keys, the Windows volume flyout, apps or the audio device itself arrive as events
//! (`volume-changed`), so nothing is polled for the level. The default device is re-checked every
//! couple of seconds only to follow a switch between speakers and headphones.
//! Other platforms: not implemented yet; the commands report that no volume is available.

use serde::Serialize;

#[derive(Serialize, Clone, Copy, PartialEq, Debug)]
pub struct VolumeState {
    /// 0.0 - 1.0
    pub level: f32,
    pub muted: bool,
}

#[cfg(windows)]
pub use win::{get, set_level, set_muted, start};

#[cfg(not(windows))]
pub fn get() -> Option<VolumeState> {
    None
}
#[cfg(not(windows))]
pub fn set_level(_level: f32) -> bool {
    false
}
#[cfg(not(windows))]
pub fn set_muted(_muted: bool) -> bool {
    false
}
#[cfg(not(windows))]
pub fn start(_app: tauri::AppHandle) {}

#[cfg(windows)]
mod win {
    use super::VolumeState;
    use std::cell::Cell;
    use std::time::Duration;
    use tauri::{AppHandle, Emitter};
    use windows::core::{implement, GUID};
    use windows::Win32::Media::Audio::Endpoints::{
        IAudioEndpointVolume, IAudioEndpointVolumeCallback, IAudioEndpointVolumeCallback_Impl,
    };
    use windows::Win32::Media::Audio::{
        eConsole, eRender, IMMDeviceEnumerator, MMDeviceEnumerator, AUDIO_VOLUME_NOTIFICATION_DATA,
    };
    use windows::Win32::System::Com::{CoCreateInstance, CoInitializeEx, CLSCTX_ALL, COINIT_MULTITHREADED};

    thread_local! {
        static COM_READY: Cell<bool> = const { Cell::new(false) };
    }

    fn init_com() {
        COM_READY.with(|ready| {
            if !ready.get() {
                // Fails harmlessly if the thread already has a (different) COM mode.
                let _ = unsafe { CoInitializeEx(None, COINIT_MULTITHREADED) };
                ready.set(true);
            }
        });
    }

    fn default_endpoint() -> windows::core::Result<(IAudioEndpointVolume, String)> {
        init_com();
        unsafe {
            let enumerator: IMMDeviceEnumerator = CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)?;
            let device = enumerator.GetDefaultAudioEndpoint(eRender, eConsole)?;
            let id = device.GetId()?.to_string().unwrap_or_default();
            let volume: IAudioEndpointVolume = device.Activate(CLSCTX_ALL, None)?;
            Ok((volume, id))
        }
    }

    fn read(ep: &IAudioEndpointVolume) -> Option<VolumeState> {
        unsafe {
            Some(VolumeState {
                level: ep.GetMasterVolumeLevelScalar().ok()?,
                muted: ep.GetMute().ok()?.as_bool(),
            })
        }
    }

    pub fn get() -> Option<VolumeState> {
        read(&default_endpoint().ok()?.0)
    }

    pub fn set_level(level: f32) -> bool {
        let Ok((ep, _)) = default_endpoint() else { return false };
        let level = level.clamp(0.0, 1.0);
        unsafe {
            let ok = ep.SetMasterVolumeLevelScalar(level, &GUID::zeroed()).is_ok();
            if level > 0.0 {
                let _ = ep.SetMute(false, &GUID::zeroed());
            }
            ok
        }
    }

    pub fn set_muted(muted: bool) -> bool {
        let Ok((ep, _)) = default_endpoint() else { return false };
        unsafe { ep.SetMute(muted, &GUID::zeroed()).is_ok() }
    }

    #[implement(IAudioEndpointVolumeCallback)]
    struct Callback {
        app: AppHandle,
    }

    impl IAudioEndpointVolumeCallback_Impl for Callback_Impl {
        fn OnNotify(&self, data: *mut AUDIO_VOLUME_NOTIFICATION_DATA) -> windows::core::Result<()> {
            if let Some(d) = unsafe { data.as_ref() } {
                let state = VolumeState { level: d.fMasterVolume, muted: d.bMuted.as_bool() };
                let _ = self.app.emit_to("island", "volume-changed", state);
            }
            Ok(())
        }
    }

    pub fn start(app: AppHandle) {
        std::thread::Builder::new()
            .name("volume-watch".into())
            .spawn(move || {
                let mut bound: Option<(String, IAudioEndpointVolume, IAudioEndpointVolumeCallback)> = None;
                loop {
                    if let Ok((ep, id)) = default_endpoint() {
                        let stale = bound.as_ref().map(|(bound_id, _, _)| bound_id != &id).unwrap_or(true);
                        if stale {
                            if let Some((_, old_ep, old_cb)) = bound.take() {
                                let _ = unsafe { old_ep.UnregisterControlChangeNotify(&old_cb) };
                            }
                            let cb: IAudioEndpointVolumeCallback = Callback { app: app.clone() }.into();
                            if unsafe { ep.RegisterControlChangeNotify(&cb) }.is_ok() {
                                if let Some(state) = read(&ep) {
                                    let _ = app.emit_to("island", "volume-changed", state);
                                }
                                bound = Some((id, ep, cb));
                            }
                        }
                    }
                    std::thread::sleep(Duration::from_millis(2000));
                }
            })
            .ok();
    }
}
