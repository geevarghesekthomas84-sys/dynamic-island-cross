//! System media session integration.
//!
//! Windows: reads the current Global System Media Transport Controls session (Spotify, browsers,
//! most players) and controls it. Every WinRT call happens on one dedicated thread, which also
//! owns the change detection, so the UI only hears about real changes via the `media-changed` event.
//! Other platforms: no session is reported and controls fall back to media keys.

use serde::Serialize;
use std::sync::mpsc::Sender;
use std::sync::Mutex;
use tauri::{AppHandle, Emitter};

#[derive(Serialize, Clone, Default, Debug)]
#[serde(rename_all = "camelCase")]
pub struct MediaInfo {
    pub title: String,
    pub artist: String,
    pub album: String,
    pub app: String,
    pub playing: bool,
    pub position_sec: f64,
    pub duration_sec: f64,
    pub thumbnail: Option<String>,
}

pub enum MediaCmd {
    PlayPause,
    Next,
    Prev,
    Seek(f64),
}

#[derive(Default)]
pub struct MediaHandle {
    pub tx: Mutex<Option<Sender<MediaCmd>>>,
    pub last: Mutex<Option<MediaInfo>>,
}

impl MediaHandle {
    pub fn send(&self, cmd: MediaCmd) -> bool {
        self.tx
            .lock()
            .unwrap()
            .as_ref()
            .map(|tx| tx.send(cmd).is_ok())
            .unwrap_or(false)
    }
}

#[cfg(windows)]
pub fn start(app: AppHandle, handle: &MediaHandle) {
    let (tx, rx) = std::sync::mpsc::channel();
    *handle.tx.lock().unwrap() = Some(tx);
    std::thread::Builder::new()
        .name("media-session".into())
        .spawn(move || win::run(app, rx))
        .ok();
}

#[cfg(not(windows))]
pub fn start(_app: AppHandle, _handle: &MediaHandle) {}

pub fn publish(app: &AppHandle, info: Option<MediaInfo>) {
    if let Some(state) = tauri::Manager::try_state::<crate::AppState>(app) {
        *state.media.last.lock().unwrap() = info.clone();
    }
    let _ = app.emit("media-changed", info);
}

#[cfg(windows)]
mod win {
    use super::*;
    use base64::Engine;
    use std::sync::mpsc::{Receiver, RecvTimeoutError};
    use std::time::{Duration, SystemTime, UNIX_EPOCH};
    use windows::Media::Control::{
        GlobalSystemMediaTransportControlsSession as Session,
        GlobalSystemMediaTransportControlsSessionManager as Manager,
        GlobalSystemMediaTransportControlsSessionPlaybackStatus as Status,
    };
    use windows::Storage::Streams::DataReader;
    use windows::Win32::System::WinRT::{RoInitialize, RO_INIT_MULTITHREADED};

    const POLL: Duration = Duration::from_millis(1000);
    /// Seconds between the Windows FILETIME epoch (1601) and the Unix epoch.
    const EPOCH_GAP: f64 = 11_644_473_600.0;

    pub fn run(app: AppHandle, rx: Receiver<MediaCmd>) {
        unsafe {
            let _ = RoInitialize(RO_INIT_MULTITHREADED);
        }
        let mut last: Option<MediaInfo> = None;
        let mut emitted_at = std::time::Instant::now();
        let mut thumb_key = String::new();
        let mut thumb: Option<String> = None;

        loop {
            match rx.recv_timeout(POLL) {
                Ok(cmd) => handle_cmd(cmd),
                Err(RecvTimeoutError::Timeout) => {}
                Err(RecvTimeoutError::Disconnected) => return,
            }
            let next = read(&mut thumb_key, &mut thumb);
            if changed(&last, &next, emitted_at.elapsed().as_secs_f64()) {
                last = next.clone();
                emitted_at = std::time::Instant::now();
                publish(&app, next);
            }
        }
    }

    fn session() -> Option<Session> {
        Manager::RequestAsync().ok()?.get().ok()?.GetCurrentSession().ok()
    }

    fn handle_cmd(cmd: MediaCmd) {
        let Some(s) = session() else { return };
        match cmd {
            MediaCmd::PlayPause => {
                let _ = s.TryTogglePlayPauseAsync().and_then(|a| a.get());
            }
            MediaCmd::Next => {
                let _ = s.TrySkipNextAsync().and_then(|a| a.get());
            }
            MediaCmd::Prev => {
                let _ = s.TrySkipPreviousAsync().and_then(|a| a.get());
            }
            MediaCmd::Seek(sec) => {
                let _ = s
                    .TryChangePlaybackPositionAsync((sec.max(0.0) * 1e7) as i64)
                    .and_then(|a| a.get());
            }
        }
    }

    fn read(thumb_key: &mut String, thumb: &mut Option<String>) -> Option<MediaInfo> {
        let s = session()?;
        let props = s.TryGetMediaPropertiesAsync().ok()?.get().ok()?;
        let title = props.Title().ok()?.to_string();
        if title.is_empty() {
            return None;
        }
        let artist = props.Artist().map(|v| v.to_string()).unwrap_or_default();
        let album = props.AlbumTitle().map(|v| v.to_string()).unwrap_or_default();
        let playing = s.GetPlaybackInfo().ok()?.PlaybackStatus().ok()? == Status::Playing;

        let tl = s.GetTimelineProperties().ok()?;
        let start = tl.StartTime().map(|t| t.Duration as f64 / 1e7).unwrap_or(0.0);
        let end = tl.EndTime().map(|t| t.Duration as f64 / 1e7).unwrap_or(0.0);
        let duration = (end - start).max(0.0);
        let mut position = tl.Position().map(|t| t.Duration as f64 / 1e7).unwrap_or(0.0) - start;
        if playing {
            if let Ok(updated) = tl.LastUpdatedTime() {
                let updated = updated.UniversalTime as f64 / 1e7 - EPOCH_GAP;
                let now = SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs_f64()).unwrap_or(updated);
                position += (now - updated).clamp(0.0, 3600.0);
            }
        }
        if duration > 0.0 {
            position = position.clamp(0.0, duration);
        }

        // Artwork is only fetched when the track changes.
        let key = format!("{title}\u{1}{artist}\u{1}{album}");
        if *thumb_key != key {
            *thumb = props.Thumbnail().ok().and_then(read_thumbnail);
            *thumb_key = key;
        }

        Some(MediaInfo {
            title,
            artist,
            album,
            app: s.SourceAppUserModelId().map(|v| v.to_string()).unwrap_or_default(),
            playing,
            position_sec: position,
            duration_sec: duration,
            thumbnail: thumb.clone(),
        })
    }

    fn read_thumbnail(
        reference: windows::Storage::Streams::IRandomAccessStreamReference,
    ) -> Option<String> {
        let stream = reference.OpenReadAsync().ok()?.get().ok()?;
        let size = u32::try_from(stream.Size().ok()?).ok()?;
        if size == 0 || size > 8 * 1024 * 1024 {
            return None;
        }
        let reader = DataReader::CreateDataReader(&stream).ok()?;
        reader.LoadAsync(size).ok()?.get().ok()?;
        let mut buf = vec![0u8; size as usize];
        reader.ReadBytes(&mut buf).ok()?;
        let mime = stream.ContentType().map(|v| v.to_string()).unwrap_or_default();
        let mime = if mime.is_empty() { "image/jpeg".to_string() } else { mime };
        Some(format!(
            "data:{mime};base64,{}",
            base64::engine::general_purpose::STANDARD.encode(buf)
        ))
    }

    /// True when the UI needs an update. Position is extrapolated by the UI from the last emit,
    /// so only a seek (drift beyond what playback explains) counts as a change.
    fn changed(prev: &Option<MediaInfo>, next: &Option<MediaInfo>, since_emit: f64) -> bool {
        match (prev, next) {
            (None, None) => false,
            (Some(a), Some(b)) => {
                let expected = if a.playing { a.position_sec + since_emit } else { a.position_sec };
                a.title != b.title
                    || a.artist != b.artist
                    || a.album != b.album
                    || a.app != b.app
                    || a.playing != b.playing
                    || a.thumbnail.is_some() != b.thumbnail.is_some()
                    || (a.duration_sec - b.duration_sec).abs() > 0.5
                    || (b.position_sec - expected).abs() > 2.5
            }
            _ => true,
        }
    }
}
