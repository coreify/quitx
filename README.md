# quitx

> ⌘Q, but from your terminal.

A macOS CLI for viewing running GUI applications and quitting them properly.

[![npm version](https://img.shields.io/npm/v/@coreify/quitx.svg)](https://www.npmjs.com/package/@coreify/quitx)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform: macOS](https://img.shields.io/badge/platform-macOS-lightgrey.svg)](https://apple.com/macos)

## Install

```bash
npm install -g @coreify/quitx
# or run directly
npx @coreify/quitx
```

## Usage

```bash
quitx                       # Interactive multi-select menu with RAM usage
quitx --windowless [-y]     # Quit apps running without open windows
quitx -a --keep Slack       # Quit all apps except Slack (one-time)
quitx --sort memory         # Sort apps by memory usage
quitx restart Discord       # Gracefully quit and reopen Discord
quitx stash                 # Stash currently running apps and quit them
quitx restore               # Reopen previously stashed apps
quitx Slack,Discord         # Quit specific apps directly
quitx -a [-y]               # Quit all running apps (-y skips confirm)
quitx -l [--json]           # List running GUI apps
quitx -f                    # Force quit (SIGKILL) if graceful exit fails
quitx config                # Interactive configuration manager
quitx exclude [apps...]     # View, add, or remove excluded apps
quitx --exclude Spotify     # Add apps to persistent exclude list
```

## Options

| Option             | Description                                     |
| ------------------ | ----------------------------------------------- |
| `<apps>`           | Quit specific applications (comma-separated)    |
| `-a, --all`        | Quit all running GUI apps                       |
| `-w, --windowless` | Target apps running with zero open windows      |
| `--keep <apps>`    | Exclude apps for this run without saving config |
| `--except <apps>`  | Alias for `--keep`                              |
| `--sort <type>`    | Sort apps by `name` or `memory`                 |
| `-y, --yes`        | Skip confirmation prompts (auto-confirm)        |
| `-l, --list`       | List running GUI apps and exit                  |
| `-f, --force`      | Force quit (`SIGKILL`) if graceful quit fails   |
| `-b, --background` | Include background processes in app list        |
| `--include-finder` | Include Finder in app list                      |
| `--exclude <apps>` | Comma-separated apps to add to exclude list     |
| `--config`         | Open interactive config manager                 |
| `--json`           | Output data in JSON format                      |
| `-h, --help`       | Show help information                           |
| `-v, --version`    | Show version number                             |

## Commands

| Command             | Description                                            |
| ------------------- | ------------------------------------------------------ |
| `restart [apps...]` | Gracefully quit and immediately reopen applications    |
| `stash`             | Record running applications and quit them              |
| `restore`           | Reopen applications from the last session stash        |
| `config`            | Open interactive configuration manager                 |
| `exclude [apps...]` | Manage excluded applications interactively or add apps |

## License

[MIT](LICENSE)
