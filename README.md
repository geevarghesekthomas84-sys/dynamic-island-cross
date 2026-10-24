# Dynamic Island

A Dynamic Island for the desktop: a small floating pill at the top of your screen that expands to show what
is playing, notifications, volume, charging and system status. Built with Tauri 2, Rust, React and TypeScript.

## Install

Download the file for your system from the [latest release](../../releases/latest).

| System | File |
|---|---|
| Windows 10 / 11 | `Dynamic.Island_x.y.z_x64-setup.exe` |
| macOS, Apple Silicon (M1 and newer) | `Dynamic.Island_x.y.z_aarch64.dmg` |
| macOS, Intel | `Dynamic.Island_x.y.z_x64.dmg` |
| Linux, Debian / Ubuntu | `Dynamic.Island_x.y.z_amd64.deb` |
| Linux, Fedora / RHEL | `Dynamic.Island-x.y.z-1.x86_64.rpm` |
| Linux, any distribution | `Dynamic.Island_x.y.z_amd64.AppImage` |

The installers are **not code-signed**, so your system will warn you the first time:

- **Windows:** SmartScreen says "Windows protected your PC". Choose *More info*, then *Run anyway*.
- **macOS:** if the app is reported as damaged or from an unidentified developer, run
  `xattr -cr "/Applications/Dynamic Island.app"` once, then open it again.
- **Linux (AppImage):** `chmod +x Dynamic.Island_*.AppImage`, then run it.

## What works on each system

| Feature | Windows | macOS | Linux |
|---|:-:|:-:|:-:|
| Island, animations, themes, settings window | yes | built, untested | built, untested |
| CPU, RAM, battery, uptime | yes | built, untested | built, untested |
| Timer, stopwatch, focus timer | yes | built, untested | built, untested |
| Now playing, artwork, play / pause / seek | yes | not yet | not yet |
| System notifications | yes | not yet | not yet |
| System volume and mute, live | yes | not yet | not yet |
| Charger connected / removed / full | yes | basic fallback | basic fallback |
| Microphone and camera in use | yes | not yet | not yet |
| Hover click-through, hide in fullscreen apps | yes | not yet | not yet |

"Built, untested" means the installer builds and the shared code is cross-platform, but nobody has run it on that
system yet. On Linux, transparent windows and global shortcuts depend on your desktop environment and are limited
on Wayland.

Calls, file transfers, screen recording, navigation and the AI panel are shown with **sample data** only; they are
not connected to anything yet.

## Settings

Right-click the island, or use the tray icon, to open settings: theme, accent colour, glow, size, hover or click to
open, auto-hide, which things to show, notification time, display and position, launch at startup and the
show / hide shortcut (default `Ctrl+Shift+D`).

Settings are stored in your user config folder as `settings.json`. Nothing is sent anywhere; notification text and
media information only travel from the system to the island on your own machine.

## Build from source

You need Node.js 22+, Rust (stable) and the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/).

```
npm install
npm run tauri dev      # run with live reload
npm run tauri build    # build an installer for your system
```

Installers are written to `src-tauri/target/release/bundle/`.

Pushing a version tag (`v*`) or running the *Build installers* workflow builds all platforms on GitHub and attaches
the installers to a draft release.

## Project layout

```
src/                 React + TypeScript interface (island, views, settings window)
src-tauri/src/       Rust: media, notifications, volume, power, privacy, window behaviour
.github/workflows/   Cross-platform installer build
```
