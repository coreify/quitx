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

## Quick Start

```bash
quitx                   # Interactive picker with RAM usage
quitx -w                # Clean up closed-window apps (zero open windows)
quitx -w -y             # Immediately quit all windowless apps
quitx -a                # Quit all running apps
quitx -a --keep Spotify # Quit all apps except Spotify (one-time)
quitx --sort memory     # Sort apps by highest RAM consumption
quitx Slack,Discord     # Quit specific apps
quitx restart Discord   # Quit and reopen an app
quitx stash             # Stash running apps and quit
quitx restore           # Restore stashed session
```

## License

[MIT](LICENSE)
