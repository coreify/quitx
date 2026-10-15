# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 1.3.2

### Added

- System-protected app safeguard: Dock, SystemUIServer, Control Center, NotificationCenter, Spotlight, loginwindow, WindowManager, and Dock Extra are hidden from lists and hard-blocked from quitting (no force override). Toggle with the new `protectSystemApps` config key (default `true`).
- New config options: `protectSystemApps` (bool), `quitTimeoutMs` (1000–60000, default `8000`) controlling how long quit waits before reporting failure, and `confirmThreshold` (1–50, default `4`) controlling how many selected apps trigger the confirmation prompt. All three editable via the config menu and `quitx config set <key> <value>`.
- `--music-apps <apps>` CLI flag to add apps to the music-protect list for a single run.
- AppleScript quit fallback is also attempted when the JXA terminate call returns non-`true` (previously only on JXA errors), improving quit reliability for apps with save prompts.
- Undo recently quit apps (`quitx undo`): quitx now records successfully quit apps (up to 5, excluding Finder/Trash) in `~/.quitx/recently-quit.json` and the new `undo` command reopens them in reverse order. Supports `--yes`, `--dry-run`, `--json`, and `--quiet`.
- CPU usage metrics & sorting: per-app CPU sampling from `ps`, shown in lists and `--sort cpu` / `sortBy: "cpu"` to sort running apps descending by CPU usage.
- Self-protection: quitx can no longer quit or list itself (bundle ids `io.coreify.quitx`, `com.coreify.quitx`, `com.kiron.quitx`, `com.quitx.quitx`, or the app name `QuitX`), matching the desktop app behavior.
- Path-based system protection: apps under `/System/Library/PrivateFrameworks/` and `/usr/` are always protected; apps under `/System/Library/`, `/System/Volumes/Preboot/`, or `/Library/Apple/System/` are protected when running as background processes. `com.apple.screensaver.engine` added to the protected bundle id list.
- Quitting Finder now closes all Finder windows (instead of no-op / error), matching the desktop app; Finder window-close failures are reported per-app.
- Quitting an app now also terminates helper processes bundled inside the app (same bundle id prefix under `<app>/Contents/`), not just the root process.
- New config keys: `confirmQuitAll` (default `true`) to require confirmation before `quitx --all`, and `disableQuitTips` (default `false`) to suppress the thank-you message. Both editable via the config menu and `quitx config set <key> <value>`.
- Seed music apps: new installs default to `Music`, `Spotify`, `Deezer`, `Tidal`, `Doppler` instead of an empty music-protect list (an empty saved list is still respected).

### Fixed

- Force-quit failure handling now verifies the process actually exited after `SIGKILL` instead of assuming success.
- `isAppRunning` treats script execution failures conservatively (reports running) so an osascript error can no longer produce a false "quit succeeded" result.
- Restore no longer discards the stash when one or more apps fail to reopen: failed apps are kept in the stash so `quitx restore` can be retried.
- Non-zero exit codes on partial failures: `quitx`, `quitx --all`, `quitx restart`, `quitx stash`, and `quitx restore` now exit with code `1` when any targeted app fails to quit/restart/restore, enabling script and CI detection.
- `--quiet` now fully suppresses informational chrome (intro banner, spinners, progress/outro messages) as documented, while still printing per-app results and JSON output.
- Unknown `-`-prefixed arguments now throw a clear `Unknown option: "..."` error instead of being silently ignored, matching the behavior of `--sort` and `--on-quit-failure`.
- `restart` now respects the termination wait: if an app does not exit within the timeout it is force-quit before reopening, or reported as failed instead of falsely reporting a restart.
- AppleScript fallback quit path escapes embedded quotes/backslashes in app names and bundle IDs, preventing script syntax errors for adversarially named apps.
- Update checks only query the scoped `@coreify/quitx` registry endpoint; the unscoped `quitx` fallback (a typosquat/version-confusion vector) was removed.

### Removed

- Dead `handleQuitAllToggle` / `attachQuitAllBehavior` selector helpers that were never wired into the interactive selector UI.

## 1.3.1

### Fixed

- Windowless app filter accuracy: Ensure applications with unknown or unverified window counts (`undefined`) are never falsely matched as windowless apps.
- CoreGraphics window enumeration: Safely handle window query exceptions and unwrap failures without reporting false zero-window counts.

### Added

- Shorthand `-m` and `--memory` CLI flags to quickly sort running apps by memory footprint (alias for `--sort memory`).
- Missing `-q` and `--quiet` CLI flags to suppress non-essential output and greetings.
- Case-insensitive parsing for `--sort` and `--on-quit-failure` flag values.
- Documentation and interactive simulator support for `--windowless`, `--keep`, `restart`, `stash`, and `restore`.

## 1.3.0

### Added

- Closed-window apps target (`--windowless` / `-w`):
  - Identify running GUI applications with zero open visible windows via CoreGraphics window detection.
  - Safely quit dormant background windowless apps to free system resources.
- Memory usage metrics & sorting:
  - Aggregate RSS memory usage per application across all grouped processes.
  - Interactive multi-select menu displays formatted memory footprints (e.g. `2.4 GB`, `612 MB`).
  - `--sort memory` CLI flag and `sortBy: "memory"` configuration option to sort running apps descending by memory footprint.
- One-time exclusions (`--keep <apps>` / `--except <apps>`):
  - Exclude specified applications from a single command run without altering persistent configuration.
- Restart command (`quitx restart [apps...]`):
  - Gracefully terminates targeted applications, waits for process exit, and immediately reopens them.
  - Supports interactive selection, multi-app comma separated lists, `--force`, and `--dry-run`.
- Session stash & restore (`quitx stash` & `quitx restore`):
  - `quitx stash`: Snapshot currently running GUI applications and quit them.
  - `quitx restore`: Reopen all previously stashed applications and clear the saved stash.

## 1.2.0

### Added

- `--dry-run` simulation mode:
  - Simulate quitting applications without sending termination signals or killing processes.
  - Formatted preview output (`[dry-run] Would quit <app>` / `[dry-run] Would force quit <app>`).
  - Supported across interactive selector, targeted app list, and `--all` flag.
- Non-interactive configuration CLI:
  - `quitx config show [--json]` to view current configuration as formatted list or JSON object.
  - `quitx config get <key> [--json]` to retrieve individual configuration value.
  - `quitx config set <key> <value> [--json]` with typed validation for booleans, force mode, and arrays.
  - `quitx config reset [-y|--yes] [--json]` to restore default configuration non-interactively.
- Automatic update toggle:
  - Added `autoUpdate` configuration property (default `true`).
  - Configurable via interactive menu and `quitx config set autoUpdate <bool>`.
  - Automatic background 6-hour update checks honor this setting.
- Package update checking system:
  - Automatic 6-hour interval background check against npm registry (`CHECK_INTERVAL_MS`).
  - Interactive manual update check command `quitx check-update` and `--check-update` flag with 60-second rate-limiting cooldown.
  - `--no-update-check` flag to bypass update checks.
  - Direct global package upgrade via `installUpdate` (`npm install --global @coreify/quitx@latest`).
  - Persistent update cache in `~/.quitx/update.json` storing check timestamp and ignored versions.
  - Full JSON output support for update queries (`quitx check-update --json`).

## 1.1.0

### Added

- Group background instances option (`groupBackground`, default `true`) to aggregate duplicate background helper processes into one entry with count and terminate all PIDs upon quitting.
- Never quit music apps protection (`neverQuitMusic`) with hybrid detection: macOS category `public.app-category.music`, bundle IDs, well-known music apps (Spotify, Apple Music, Tidal, Cider, Vox, etc.), and custom music apps.
- Interactive custom music app management (`musicApps`) in configuration menu.
- Deselect apps by default option (`defaultSelectAll`) to start interactive picker with no apps pre-selected.
- Include Empty Trash in list option (`includeTrash`) with explicit warning that quitting permanently and irreversibly deletes macOS Trash.
- Cleaner, intuitive configuration menu options aligned with native preferences.

### Fixed

- Fixed Windows silent exit: normalized path separators in CLI entry point detection so Windows/Linux platforms cleanly print OS guard error (`✖ quitx only works on macOS. Windows and Linux are not supported.`) with exit code 1.
- Unified running app discovery across home selector and exclude/music add menus.
- Handled multi-PID termination cleanly when quitting grouped background instances.

## 1.0.0

### Added

- Comma-separated application argument targeting (`quitx Slack,Discord`).
- Strict argument validation preventing ambiguous space-separated multi-app input.
- Case-insensitive target app and exclusion resolution.
- Interactive configuration manager (`quitx config`, `--config`) managing quit mode, Finder inclusion, and background scanning.
- Interactive exclusion management (`quitx exclude`) with add, remove, and view options.
- Background process scanning support (`-b`, `--background`).
- Dynamic application process name resolution.

### Changed

- Streamlined and compacted documentation and CLI usage instructions.
- Added comprehensive unit and E2E test coverage across all commands and edge cases.

## 0.1.0

### Added

- Interactive macOS GUI application selector with Clack TUI.
- Graceful application quit using `NSRunningApplication` / JXA (⌘Q behavior).
- Direct app quitting via `--all` (`-a`) and non-interactive `--yes` (`-y`).
- Running GUI applications listing with `--list` (`-l`) and `--json`.
- Fallback force termination (`--force` / `-f`) for non-responsive applications.
- Automatic terminal emulator exclusion to avoid closing current session.
- Exclude Finder by default with `--include-finder` override.
- Custom exclusion via `--exclude <app>`.
- Immediate validation rejecting non-macOS platforms.
