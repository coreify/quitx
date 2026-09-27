import type { AppInfo } from "../types";
import { runAppleScript, type ScriptExecutor } from "./applescript";

export function buildDiscoveryScript(includeBackground = false): string {
  const filter = includeBackground
    ? "every application process"
    : "every application process whose background only is false";
  return `
tell application "System Events"
\tset names to name of ${filter}
\tset bundles to bundle identifier of ${filter}
\tset pids to unix id of ${filter}
\tset outList to {}
\trepeat with i from 1 to count of pids
\t\tset pName to item i of names
\t\tset pBundle to item i of bundles
\t\tset pPid to item i of pids
\t\tset pDisp to ""
\t\ttry
\t\t\tset pDisp to displayed name of (file of (first application process whose unix id is pPid) as alias)
\t\tend try
\t\tset end of outList to (pName as text) & tab & (pBundle as text) & tab & (pPid as text) & tab & (pDisp as text)
\tend repeat
\tset AppleScript's text item delimiters to linefeed
\toutList as text
end tell
`.trim();
}

export const APP_DISCOVERY_SCRIPT = buildDiscoveryScript(false);

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

      if (
        dispName &&
        dispName.length > 0 &&
        dispName.toLowerCase() !== rawName.toLowerCase()
      ) {
        name = dispName;
      } else if (!dispName && bundleId && rawName === bundleId) {
        name = formatDynamicName(bundleId);
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

export interface FilterOptions {
  exclude?: readonly string[] | undefined;
  includeFinder?: boolean | undefined;
}

export function filterApps(
  apps: readonly AppInfo[],
  optionsOrExclude: FilterOptions | readonly string[] = {},
): AppInfo[] {
  const opts: FilterOptions = Array.isArray(optionsOrExclude)
    ? { exclude: optionsOrExclude as readonly string[] }
    : (optionsOrExclude as FilterOptions);

  const exclude = opts.exclude ?? [];
  const includeFinder = opts.includeFinder ?? false;

  const seen = new Set<string>();
  const excludeSet = new Set(exclude.map((e) => e.toLowerCase().trim()));
  const filtered: AppInfo[] = [];

  for (const app of apps) {
    const nameLower = app.name.toLowerCase().trim();
    const bundleLower = app.bundleId?.toLowerCase().trim();

    if (nameLower === "quitx" || bundleLower === "com.kiron.quitx") {
      continue;
    }

    if (!includeFinder) {
      if (nameLower === "finder" || bundleLower === "com.apple.finder") {
        continue;
      }
    }

    if (
      excludeSet.has(nameLower) ||
      (bundleLower && excludeSet.has(bundleLower))
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

export interface GetRunningAppsOptions {
  exclude?: readonly string[];
  includeFinder?: boolean;
  includeBackground?: boolean;
}

export async function getRunningApps(
  optionsOrExclude?: GetRunningAppsOptions | readonly string[] | ScriptExecutor,
  executor?: ScriptExecutor,
): Promise<AppInfo[]> {
  let exec: ScriptExecutor | undefined;
  let filterOpts: FilterOptions = {};
  let includeBackground = false;

  if (typeof optionsOrExclude === "function") {
    exec = optionsOrExclude;
  } else if (Array.isArray(optionsOrExclude)) {
    filterOpts = { exclude: optionsOrExclude };
    exec = executor;
  } else if (optionsOrExclude && typeof optionsOrExclude === "object") {
    const opts = optionsOrExclude as GetRunningAppsOptions;
    filterOpts = {
      exclude: opts.exclude ?? [],
      includeFinder: opts.includeFinder ?? false,
    };
    includeBackground = opts.includeBackground ?? false;
    exec = executor;
  } else {
    exec = executor;
  }

  const script = buildDiscoveryScript(includeBackground);
  let stdout: string;
  try {
    stdout = await runAppleScript(script, exec);
  } catch {
    stdout = await runAppleScript(FALLBACK_APP_DISCOVERY_SCRIPT, exec);
  }

  const apps = parseAppListOutput(stdout);
  return filterApps(apps, filterOpts);
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
