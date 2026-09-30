import { cancel, intro, log, outro } from "@clack/prompts";
import type { AppInfo, QuitResult } from "../types";

export function showIntro(): void {
  intro("quitx");
}

export function showOutro(message: string): void {
  outro(message);
}

export function showCancel(message = "Cancelled."): void {
  cancel(message);
}

export function renderResults(
  results: readonly QuitResult[],
  dryRun = false,
): void {
  for (const res of results) {
    if (res.success) {
      const label = dryRun
        ? res.forced
          ? `[dry-run] Would force quit ${res.app.name}`
          : `[dry-run] Would quit ${res.app.name}`
        : res.forced
          ? `Force quit ${res.app.name}`
          : res.app.name;
      log.success(label);
    } else {
      const prefix = dryRun ? "[dry-run] " : "";
      const reason = res.error ? ` (${res.error})` : "";
      log.error(`${prefix}Could not quit ${res.app.name}${reason}`);
    }
  }
}

export function renderList(apps: readonly AppInfo[], json = false): void {
  if (json) {
    console.log(JSON.stringify(apps, null, 2));
    return;
  }

  for (const app of apps) {
    const noWindows =
      app.windowCount === 0 && !app.isBackground ? " (no windows)" : "";
    console.log(`${app.name}${noWindows}`);
  }
}

export function renderHelp(): void {
  console.log(
    `
quitx - Quit running macOS apps from your terminal.

USAGE:
  $ quitx [options] [apps]

OPTIONS:
  -a, --all               Quit all running GUI apps
  -y, --yes               Skip confirmation prompts
  -l, --list              List running GUI apps and exit
  -w, --windowless        Show/quit GUI apps with zero open windows
  -f, --force             Force quit apps (SIGKILL) if normal quit fails
      --dry-run           Simulate quitting without terminating apps
      --keep <apps>       Exclude apps for this run without modifying config
      --except <apps>     Alias for --keep
      --sort <type>       Sort apps by "name" or "memory"
  -b, --background        Include background processes in app list
      --include-finder    Include Finder in the app list
      --include-trash     Include Trash in the app list (empties on quit)
      --exclude <apps>    Add apps to persistent exclude list (comma-separated)
      --check-update      Check for package updates (60s rate limit)
      --no-update-check   Disable automatic update check for this run
      --on-quit-failure <mode> Action on quit failure: prompt, force, or error
      --config            Open interactive config manager
      --json              Output data in JSON format
  -h, --help              Show help information
  -v, --version           Show version number

COMMANDS:
  restart [apps]          Quit and immediately reopen applications
  stash                   Record running applications and quit them
  restore                 Reopen applications from the last stash
  config [action]         Manage configuration (show, get, set, reset)
  exclude                 Manage excluded applications interactively
  check-update            Check for package updates

EXAMPLES:
  $ quitx                         Interactive app selector with memory usage
  $ quitx --windowless            Quit apps running with no open windows
  $ quitx --windowless -y         Clean up closed-window apps immediately
  $ quitx --all --keep Spotify    Quit all apps except Spotify (one-time)
  $ quitx --sort memory           Sort apps by highest RAM consumption
  $ quitx restart Discord         Restart Discord
  $ quitx restart Discord,Slack   Restart Discord and Slack
  $ quitx stash                   Save session and quit running apps
  $ quitx restore                 Reopen previously stashed apps
  $ quitx --all                   Quit all running apps (with confirmation)
  $ quitx --all --dry-run         Preview quitting all apps without killing them
  $ quitx --all --yes             Quit all running apps immediately
  $ quitx --list                  List currently running GUI apps
  $ quitx --list --windowless     List closed-window apps
  $ quitx config                  Open interactive config manager
  $ quitx config set sortBy memory Set default sort to memory
  $ quitx config show             Print current configuration
  $ quitx exclude                 Open interactive menu to manage excluded apps
  $ quitx check-update            Check for package updates
  $ quitx Slack,Discord           Quit specific apps directly
`.trim(),
  );
}

export function renderVersion(version: string): void {
  console.log(`quitx v${version}`);
}

export const THANKS_MESSAGE =
  "\nThanks for using quitx..!\nFor more visit - quitx.js.org";

export function printThanks(options?: {
  json?: boolean | undefined;
  quiet?: boolean | undefined;
}): void {
  if (options?.json || options?.quiet) return;
  console.log(THANKS_MESSAGE);
}
