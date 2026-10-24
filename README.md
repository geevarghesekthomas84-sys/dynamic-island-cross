# Dynamic Island

A Dynamic Island for the desktop, built with Tauri 2, Rust, React and TypeScript.

## Run

```
npm install
npm run tauri dev
```

## Build an installer (Windows)

```
npm run tauri build
```

The installer is written to `src-tauri/target/release/bundle/nsis/`.

## What works

Real on Windows: system media (title, artwork, controls, seeking), system notifications, system volume and mute,
charger plug and unplug, microphone and camera status, CPU / RAM / battery, timer and stopwatch.

Shown with sample data only: calls, file transfers, screen recording, navigation and the AI panel.

macOS and Linux build, but media, notifications, volume and charging detection are Windows-only for now.

Settings are saved to `%APPDATA%\com.dynamicisland.cross\settings.json` and edited from the settings window
(right-click the island, or use the tray icon).
