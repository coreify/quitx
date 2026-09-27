import type { AppInfo, FilterOptions } from "../types";
import { runAppleScript, type ScriptExecutor } from "./applescript";
import { getCurrentTerminalApp, isTerminalApp } from "./terminal";

export const APP_DISCOVERY_SCRIPT = `
tell application "System Events"
\tset procs to every application process whose background only is false
\tset outList to {}
\trepeat with p in procs
\t\tset pName to name of p
\t\tset pBundle to ""
\t\ttry
\t\t\tset pBundle to bundle identifier of p
\t\tend try
\t\tset pPid to ""
\t\ttry
\t\t\tset pPid to unix id of p
\t\tend try
\t\tset pDisp to ""
\t\ttry
\t\t\tset pDisp to displayed name of (file of p as alias)
\t\tend try
\t\tset end of outList to pName & tab & pBundle & tab & pPid & tab & pDisp
\tend repeat
\tset AppleScript's text item delimiters to linefeed
\toutList as text
end tell
`.trim();

export const FALLBACK_APP_DISCOVERY_SCRIPT =
  'tell application "System Events" to get name of every application process whose background only is false';

export function formatDynamicName(identifier: string): string {
  const parts = identifier.split(".").filter(Boolean);
  const last = parts[parts.length - 1];
  if (!last || last.length <= 1) {
    return identifier;
  }
  const spaced = last.replace(/[-_]/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

export const resolveNameFromBundleId = formatDynamicName;

export function parseAppListOutput(stdout: string): AppInfo[] {
  const trimmed = stdout.trim();
  if (!trimmed) {
    return [];
  }

  if (trimmed.includes("\t") || trimmed.includes("\n")) {
    const lines = trimmed
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const results: AppInfo[] = [];

    for (const line of lines) {
      const parts = line.split("\t");
      const rawName = parts[0]?.trim();
      if (!rawName) continue;

      const rawBundle = parts[1]?.trim();
      const bundleId =
        rawBundle && rawBundle !== "missing value" && rawBundle.length > 0
          ? rawBundle
          : undefined;

      const rawPid = parts[2]?.trim();
      const pidNum = rawPid ? parseInt(rawPid, 10) : undefined;
      const pid =
        !Number.isNaN(pidNum) && pidNum !== undefined && pidNum > 0
          ? pidNum
          : undefined;

      const rawDisp = parts[3]?.trim();
      const dispName =
        rawDisp && rawDisp !== "missing value" && rawDisp.length > 0
          ? rawDisp.replace(/\.app$/i, "").trim()
          : undefined;

      let name = rawName;
      const lowerRaw = rawName.toLowerCase();

      if (
        dispName &&
        dispName.length > 0 &&
        dispName.toLowerCase() !== "electron"
      ) {
        name = dispName;
      } else if (
        lowerRaw === "electron" ||
        lowerRaw === "app" ||
        lowerRaw === "main"
      ) {
        if (dispName && dispName.length > 0) {
          name = dispName;
        } else if (bundleId) {
          name = formatDynamicName(bundleId);
        }
      }

      results.push({ name, bundleId, pid });
    }

    return results;
  }

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

    if (nameLower === "quitx" || bundleLower === "com.kiron.quitx") {
      continue;
    }

    if (!options.includeFinder) {
      if (nameLower === "finder" || bundleLower === "com.apple.finder") {
        continue;
      }
    }

    if (!options.includeTerminal) {
      if (isTerminalApp(app, currentTerminal)) {
        continue;
      }
    }

    if (
      userExcludes.has(nameLower) ||
      (bundleLower && userExcludes.has(bundleLower))
    ) {
      continue;
    }

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
