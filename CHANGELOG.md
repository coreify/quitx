# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
