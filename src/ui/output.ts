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
  $ quitx [options] [apps]

OPTIONS:
  -a, --all               Quit all running GUI apps
  -y, --yes               Skip confirmation prompts
  -l, --list              List running GUI apps and exit
  -f, --force             Force quit apps (SIGKILL) if normal quit fails
  -b, --background        Include background processes in app list
      --include-finder    Include Finder in the app list
      --exclude <apps>    Add apps to persistent exclude list (comma-separated)
      --config            Open interactive config manager
      --json              Output data in JSON format
  -h, --help              Show help information
  -v, --version           Show version number

COMMANDS:
  config                  Manage configuration interactively
  exclude                 Manage excluded applications interactively

EXAMPLES:
  $ quitx                         Interactive app selector
  $ quitx --all                   Quit all running apps (with confirmation)
  $ quitx --all --yes             Quit all running apps immediately
  $ quitx --list                  List currently running GUI apps
  $ quitx --list --background     List all apps including background processes
  $ quitx --list --include-finder List apps including Finder
  $ quitx config                  Open interactive config manager
  $ quitx exclude                 Open interactive menu to manage excluded apps
  $ quitx --exclude Spotify,Slack Add Spotify and Slack to exclude list
  $ quitx Slack,Discord           Quit specific apps directly
`.trim(),
  );
}

export function renderVersion(version = "0.1.0"): void {
  console.log(`quitx v${version}`);
}

export const THANKS_MESSAGE = "\nThanks for using quitx..!";

export function printThanks(options?: {
  json?: boolean | undefined;
  quiet?: boolean | undefined;
}): void {
  if (options?.json || options?.quiet) return;
  console.log(THANKS_MESSAGE);
}
