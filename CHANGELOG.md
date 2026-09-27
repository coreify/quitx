# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
