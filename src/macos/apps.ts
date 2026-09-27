import type { AppInfo } from "../types";
import { runAppleScript, type ScriptExecutor } from "./applescript";

export const APP_DISCOVERY_SCRIPT = `
tell application "System Events"
\tset names to name of every application process whose background only is false
\tset bundles to bundle identifier of every application process whose background only is false
\tset pids to unix id of every application process whose background only is false
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

      if (bundleId === "com.googlecode.iterm2" && rawName === "iTerm2") {
        name = "iTerm2";
      } else if (
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
  exclude: readonly string[] = [],
): AppInfo[] {
  const seen = new Set<string>();
  const excludeSet = new Set(exclude.map((e) => e.toLowerCase().trim()));
  const filtered: AppInfo[] = [];

  for (const app of apps) {
    const nameLower = app.name.toLowerCase().trim();
    const bundleLower = app.bundleId?.toLowerCase().trim();

    if (nameLower === "quitx" || bundleLower === "com.kiron.quitx") {
      continue;
    }

    if (nameLower === "finder" || bundleLower === "com.apple.finder") {
      continue;
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

export async function getRunningApps(
  optionsOrExecutor?: readonly string[] | ScriptExecutor,
  executor?: ScriptExecutor,
): Promise<AppInfo[]> {
  const exec =
    typeof optionsOrExecutor === "function" ? optionsOrExecutor : executor;
  const exclude = Array.isArray(optionsOrExecutor) ? optionsOrExecutor : [];

  let stdout: string;
  try {
    stdout = await runAppleScript(APP_DISCOVERY_SCRIPT, exec);
  } catch {
    stdout = await runAppleScript(FALLBACK_APP_DISCOVERY_SCRIPT, exec);
  }

  const apps = parseAppListOutput(stdout);
  return filterApps(apps, exclude);
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
