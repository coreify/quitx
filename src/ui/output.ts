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

export function renderResults(results: readonly QuitResult[]): void {
  for (const res of results) {
    if (res.success) {
      const label = res.forced ? `Force quit ${res.app.name}` : res.app.name;
      log.success(label);
    } else {
      const reason = res.error ? ` (${res.error})` : "";
      log.error(`Could not quit ${res.app.name}${reason}`);
    }
  }
}

export function renderList(apps: readonly AppInfo[], json = false): void {
  if (json) {
    console.log(JSON.stringify(apps, null, 2));
    return;
  }

  for (const app of apps) {
    console.log(app.name);
  }
}

export function renderHelp(): void {
  console.log(
    `
quitx - Quit running macOS apps from your terminal.

USAGE:
  $ quitx [options] [app-names...]

OPTIONS:
  -a, --all               Quit all running GUI apps
  -y, --yes               Skip confirmation prompts
  -l, --list              List running GUI apps and exit
  -f, --force             Force quit apps (SIGKILL) if normal quit fails
      --json              Output data in JSON format
      --include-finder    Include Finder in app list
      --include-terminal  Include current terminal in app list
      --exclude <app>     Exclude specific apps by name or bundle ID
  -h, --help              Show help information
  -v, --version           Show version number

EXAMPLES:
  $ quitx                         Interactive app selector
  $ quitx --all                   Quit all running apps (with confirmation)
  $ quitx --all --yes             Quit all running apps immediately
  $ quitx --list                  List currently running GUI apps
  $ quitx --exclude Spotify       Launch selector excluding Spotify
  $ quitx Slack Discord           Quit specific apps directly
`.trim(),
  );
}

export function renderVersion(version = "0.1.0"): void {
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
