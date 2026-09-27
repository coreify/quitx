import type { AppInfo, FilterOptions } from "../types";
import { runAppleScript, type ScriptExecutor } from "./applescript";
import { getCurrentTerminalApp, isTerminalApp } from "./terminal";

export const APP_DISCOVERY_SCRIPT = `
tell application "System Events"
\tset appNames to name of every application process whose background only is false
\tset appBundles to bundle identifier of every application process whose background only is false
\tset appPids to unix id of every application process whose background only is false
end tell
set outList to {}
repeat with i from 1 to count of appNames
\tset end of outList to (item i of appNames) & tab & (item i of appBundles) & tab & (item i of appPids)
end repeat
set AppleScript's text item delimiters to linefeed
outList as text
`.trim();

export const FALLBACK_APP_DISCOVERY_SCRIPT =
  'tell application "System Events" to get name of every application process whose background only is false';

export function parseAppListOutput(stdout: string): AppInfo[] {
  const trimmed = stdout.trim();
  if (!trimmed) {
    return [];
  }

  // Check if output is tab-delimited multi-line format
  if (trimmed.includes("\t") || trimmed.includes("\n")) {
    const lines = trimmed
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const results: AppInfo[] = [];

    for (const line of lines) {
      const parts = line.split("\t");
      const name = parts[0]?.trim();
      if (!name) continue;

      const rawBundle = parts[1]?.trim();
      const bundleId =
        rawBundle && rawBundle !== "missing value" ? rawBundle : undefined;

      const rawPid = parts[2]?.trim();
      const pidNum = rawPid ? parseInt(rawPid, 10) : undefined;
      const pid =
        !Number.isNaN(pidNum) && pidNum !== undefined && pidNum > 0
          ? pidNum
          : undefined;

      results.push({ name, bundleId, pid });
    }

    return results;
  }

  // Fallback comma-separated format
  return trimmed
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name) => ({ name }));
}

export function sortApps(apps: readonly AppInfo[]): AppInfo[] {
  return [...apps].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );
}

export function filterApps(
  apps: readonly AppInfo[],
  options: FilterOptions = {},
): AppInfo[] {
  const currentTerminal =
    options.currentTerminal !== undefined
      ? options.currentTerminal
      : getCurrentTerminalApp();

  const userExcludes = new Set(
    (options.exclude ?? []).map((e) => e.toLowerCase().trim()),
  );

  const seen = new Set<string>();
  const filtered: AppInfo[] = [];

  for (const app of apps) {
    const nameLower = app.name.toLowerCase().trim();
    const bundleLower = app.bundleId?.toLowerCase().trim();

    // 1. Exclude quitx itself
    if (nameLower === "quitx" || bundleLower === "com.kiron.quitx") {
      continue;
    }

    // 2. Exclude Finder unless explicitly included
    if (!options.includeFinder) {
      if (nameLower === "finder" || bundleLower === "com.apple.finder") {
        continue;
      }
    }

    // 3. Exclude terminal applications unless explicitly included
    if (!options.includeTerminal) {
      if (isTerminalApp(app, currentTerminal)) {
        continue;
      }
    }

    // 4. Exclude user-specified apps
    if (
      userExcludes.has(nameLower) ||
      (bundleLower && userExcludes.has(bundleLower))
    ) {
      continue;
    }

    // Deduplicate by name and bundleId
    const key = bundleLower ?? nameLower;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    filtered.push(app);
  }

  return sortApps(filtered);
}

export async function getRunningApps(
  options: FilterOptions = {},
  executor?: ScriptExecutor,
): Promise<AppInfo[]> {
  let stdout: string;
  try {
    stdout = await runAppleScript(APP_DISCOVERY_SCRIPT, executor);
  } catch {
    // If detailed query fails (e.g. older system or permissions), use fallback
    stdout = await runAppleScript(FALLBACK_APP_DISCOVERY_SCRIPT, executor);
  }

  const apps = parseAppListOutput(stdout);
  return filterApps(apps, options);
}

export function isProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error: unknown) {
    if (
      typeof error === "object" &&
      error !== null &&
      (("code" in error && (error as { code: string }).code === "EPERM") ||
        ("message" in error && (error as Error).message.includes("EPERM")))
    ) {
      return true;
    }
    return false;
  }
}

export async function isAppRunning(
  target: AppInfo | number | string,
  executor?: ScriptExecutor,
): Promise<boolean> {
  if (typeof target === "number") {
    return isProcessAlive(target);
  }

  if (
    typeof target === "object" &&
    target.pid !== undefined &&
    target.pid > 0
  ) {
    return isProcessAlive(target.pid);
  }

  const name = typeof target === "string" ? target : target.name;
  const escapedName = name.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  try {
    const res = await runAppleScript(
      `tell application "System Events" to return (exists (first application process whose name is "${escapedName}" and background only is false))`,
      executor,
    );
    return res.trim().toLowerCase() === "true";
  } catch {
    return false;
  }
}
