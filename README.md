# quitx

> ⌘Q, but from your terminal.

Quit running macOS GUI applications cleanly without switching windows or reaching for the mouse.

[![npm version](https://img.shields.io/npm/v/quitx.svg)](https://www.npmjs.com/package/quitx)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform: macOS](https://img.shields.io/badge/platform-macOS-lightgrey.svg)](https://apple.com/macos)

---

## Why quitx?

Instead of cycling through your open applications with `⌘ + Tab` and pressing `⌘ + Q` over and over, run:

```bash
quitx
```

Select the apps you want to close, hit Enter, and quit them gracefully from one place.

Unlike `killall` or `pkill`, `quitx` does **not** force-terminate processes by default. It sends native AppleScript quit events, allowing applications to:
- Prompt to save unsaved files
- Persist user preferences and window positions
- Clean up temporary resources and cache files
- Exit cleanly

---

## Install

```bash
npm install -g quitx
# or run directly without install
npx quitx
```

---

## Usage

```bash
# Interactive selection (Clack TUI)
quitx

# Quit all running apps (with confirmation)
quitx --all
quitx -a

# Quit all running apps without confirmation
quitx --all --yes
quitx -a -y

# List running GUI apps
quitx --list
quitx -l

# List running GUI apps as JSON
quitx --list --json

# Force quit apps if they don't exit gracefully
quitx --force
quitx -f

# Include Finder or Terminal apps
quitx --include-finder
quitx --include-terminal

# Exclude specific apps
quitx --exclude Discord --exclude Spotify
```

---

## Interactive Mode

When you run `quitx`, you are presented with an interactive terminal interface:

```text
┌  quitx
│
◇  Found 6 running apps
│
◆  Select apps to quit
│  ◻ Arc
│  ◻ Discord
│  ◼ Spotify
│  ◼ Visual Studio Code
│
◇  Quitting 2 apps...
│
├  ✓ Spotify
├  ✓ Visual Studio Code
│
└  Quit 2 apps.
```

- Use `↑` / `↓` to navigate
- Press `Space` to toggle selection
- Press `Enter` to confirm
- Press `Ctrl + C` or `Esc` to cancel

---

## Options

| Flag | Short | Description |
|------|-------|-------------|
| `--all` | `-a` | Select and quit all running GUI apps |
| `--yes` | `-y` | Skip confirmation prompts (auto-confirm) |
| `--list` | `-l` | List currently running GUI apps and exit |
| `--force` | `-f` | Send SIGKILL if app doesn't quit cleanly after wait |
| `--json` | | Output apps or results in JSON format |
| `--include-finder` | | Include Finder in app list (excluded by default) |
| `--include-terminal`| | Include current terminal emulator in app list |
| `--exclude <app>` | | Exclude specific app names or bundle IDs |
| `--help` | `-h` | Show help and available options |
| `--version` | `-v` | Show version number |

---

## How It Works

1. **Platform Guard**: Validates that the runtime environment is macOS (`process.platform === 'darwin'`). Immediately rejects non-macOS systems.
2. **App Discovery**: Queries `System Events` via `osascript` for non-background application processes (`background only is false`), retrieving app name, bundle identifier, and process ID.
3. **Smart Exclusions**: Automatically filters out:
   - The current active terminal emulator (`Apple_Terminal`, `iTerm2`, `Warp`, `Ghostty`, `Alacritty`, etc.) so your session stays open.
   - `Finder` (which automatically relaunches when quit unless explicitly included).
   - `quitx` itself.
4. **Graceful Quit**: Sends native AppleScript quit commands (`tell application id "<bundleId>" to quit`).
5. **Exit Verification**: Verifies process termination after sending the quit signal. If `--force` is specified and the process remains active, it sends `SIGKILL`.

---

## Requirements

- macOS (OS X)
- Node.js 20+

---

## License

[MIT](LICENSE) © [Toufiq Hasan Kiron](https://github.com/kiron0)
