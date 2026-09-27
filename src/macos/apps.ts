import { loadConfig } from "../config";
import type { AppInfo, QuitxConfig } from "../types";
import { APPKIT_PREAMBLE, RUNNING_APPS, buildAppMatcherScript } from "./jxa";
import { runJXA, type ScriptExecutor } from "./osascript";

export function buildDiscoveryScript(includeBackground = false): string {
  const bg = includeBackground ? "true" : "false";
  return `${APPKIT_PREAMBLE}
function run() {
  const includeBackground = ${bg};
  const Regular = $.NSApplicationActivationPolicyRegular;
  const apps = ${RUNNING_APPS};
  const lines = [];
  for (let i = 0; i < apps.count; i++) {
    const app = apps.objectAtIndex(i);
    if (!includeBackground && app.activationPolicy !== Regular) continue;
    const name = app.localizedName ? app.localizedName.js : '';
    const bundleId = app.bundleIdentifier ? app.bundleIdentifier.js : '';
    const pid = String(app.processIdentifier);
    const isBg = app.activationPolicy !== Regular ? '1' : '0';
    let isMusic = '0';
    if (app.bundleURL) {
      const bundle = $.NSBundle.bundleWithURL(app.bundleURL);
      if (bundle && bundle.infoDictionary) {
        const cat = bundle.infoDictionary.objectForKey('LSApplicationCategoryType');
        if (cat && cat.js === 'public.app-category.music') {
          isMusic = '1';
        }
      }
    }
    lines.push(name + '\\t' + bundleId + '\\t' + pid + '\\t' + isBg + '\\t' + isMusic);
  }
  return lines.join('\\n');
}`.trim();
}

export const APP_DISCOVERY_SCRIPT = buildDiscoveryScript(false);

const IS_APP_RUNNING_SCRIPT = buildAppMatcherScript(`
const name = argv[0] || '';
const bundleId = argv[1] || '';
if (bundleId && app.bundleIdentifier && app.bundleIdentifier.js === bundleId) {
  return 'true';
}
if (name && app.localizedName && app.localizedName.js === name) {
  return 'true';
}
`);

export function formatDynamicName(identifier: string): string {
  const parts = identifier.split(".").filter(Boolean);
  const last = parts[parts.length - 1];
  if (!last || last.length <= 1) {
    return identifier;
  }
  const spaced = last.replace(/[-_]/g, " ").replace(/([a-z])([A-Z])/g, "$1 $2");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

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
      const rawName = parts[0]
        ?.replace(/[\u200B-\u200D\u200E\u200F\uFEFF]/g, "")
        .trim();
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

      const rawIsBg = parts[3]?.trim();
      const isBackground = rawIsBg === "1";

      const rawIsMusic = parts[4]?.trim();
      const isMusic = rawIsMusic === "1";

      let name = rawName;
      if (bundleId && rawName === bundleId) {
        name = formatDynamicName(bundleId);
      }

      results.push({
        name,
        bundleId,
        pid,
        ...(isBackground ? { isBackground: true } : {}),
        ...(isMusic ? { isMusic: true } : {}),
      });
    }

    return results;
  }

  return trimmed
    .split(",")
    .map((name) =>
      name.replace(/[\u200B-\u200D\u200E\u200F\uFEFF]/g, "").trim(),
    )
    .filter(Boolean)
    .map((name) => ({ name }));
}

export function sortApps(apps: readonly AppInfo[]): AppInfo[] {
  return [...apps].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );
}

export const KNOWN_MUSIC_BUNDLE_IDS = new Set([
  "com.apple.music",
  "com.spotify.client",
  "com.tidal.desktop",
  "com.github.th-ch.youtube-music",
  "app.ytmdesktop.ytmdesktop",
  "com.amazon.music",
  "com.deezer.deezer-desktop",
  "com.coppertino.vox",
  "com.audirvana.audirvana-plus",
  "com.audirvana.audirvana",
  "com.swinsian.swinsian",
  "cider.sh",
  "com.cider.cider",
]);

export const KNOWN_MUSIC_APP_NAMES = new Set([
  "music",
  "apple music",
  "spotify",
  "tidal",
  "youtube music",
  "amazon music",
  "deezer",
  "qobuz",
  "soundcloud",
  "pandora",
  "vox",
  "audirvana",
  "foobar2000",
  "swinsian",
  "cider",
]);

export function isMusicApp(
  app: AppInfo,
  customMusicApps: readonly string[] = [],
): boolean {
  if (app.isMusic) {
    return true;
  }
  const nameLower = app.name.toLowerCase().trim();
  const bundleLower = app.bundleId?.toLowerCase().trim();
  if (bundleLower && KNOWN_MUSIC_BUNDLE_IDS.has(bundleLower)) {
    return true;
  }
  if (KNOWN_MUSIC_APP_NAMES.has(nameLower)) {
    return true;
  }
  if (customMusicApps.length > 0) {
    const customSet = new Set(
      customMusicApps.map((a) => a.toLowerCase().trim()),
    );
    if (
      customSet.has(nameLower) ||
      (bundleLower && customSet.has(bundleLower))
    ) {
      return true;
    }
  }
  return false;
}

export interface FilterOptions {
  exclude?: readonly string[] | undefined;
  includeFinder?: boolean | undefined;
  groupBackground?: boolean | undefined;
  neverQuitMusic?: boolean | undefined;
  musicApps?: readonly string[] | undefined;
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
  const groupBackground = opts.groupBackground ?? true;
  const neverQuitMusic = opts.neverQuitMusic ?? false;
  const customMusicApps = opts.musicApps ?? [];

  const excludeSet = new Set(exclude.map((e) => e.toLowerCase().trim()));
  const eligible: AppInfo[] = [];

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

    if (neverQuitMusic && isMusicApp(app, customMusicApps)) {
      continue;
    }

    if (
      excludeSet.has(nameLower) ||
      (bundleLower && excludeSet.has(bundleLower))
    ) {
      continue;
    }

    eligible.push(app);
  }

  const result: AppInfo[] = [];
  const grouped = new Map<string, AppInfo>();

  for (const app of eligible) {
    const nameLower = app.name.toLowerCase().trim();
    const bundleLower = app.bundleId?.toLowerCase().trim();
    const isBg = app.isBackground === true;

    if (isBg && !groupBackground) {
      result.push({ ...app });
    } else {
      let key = bundleLower ?? nameLower;
      let cleanName = app.name;

      if (isBg) {
        const base = app.name.replace(/\s*\([^)]*\)$/, "").trim();
        if (base) {
          key = base.toLowerCase();
          cleanName = base;
        }
      }

      const existing = grouped.get(key);
      if (existing) {
        if (app.pid) {
          if (!existing.pids) {
            existing.pids = existing.pid ? [existing.pid] : [];
          }
          if (!existing.pids.includes(app.pid)) {
            existing.pids.push(app.pid);
          }
          existing.count = existing.pids.length;
        } else {
          existing.count = (existing.count ?? 1) + 1;
        }
      } else {
        const item: AppInfo = { ...app, name: cleanName };
        grouped.set(key, item);
        result.push(item);
      }
    }
  }

  return sortApps(result);
}

export interface GetRunningAppsOptions {
  exclude?: readonly string[];
  includeFinder?: boolean;
  includeBackground?: boolean;
  groupBackground?: boolean;
  neverQuitMusic?: boolean;
  musicApps?: readonly string[];
}

export async function getRunningApps(
  optionsOrExclude?: GetRunningAppsOptions | readonly string[] | ScriptExecutor,
  executor?: ScriptExecutor,
): Promise<AppInfo[]> {
  let exec: ScriptExecutor | undefined;
  let filterOpts: FilterOptions;
  let includeBackground = false;

  if (typeof optionsOrExclude === "function") {
    filterOpts = {};
    exec = optionsOrExclude;
  } else if (Array.isArray(optionsOrExclude)) {
    filterOpts = { exclude: optionsOrExclude };
    exec = executor;
  } else if (optionsOrExclude && typeof optionsOrExclude === "object") {
    const opts = optionsOrExclude as GetRunningAppsOptions;
    filterOpts = {
      exclude: opts.exclude ?? [],
      includeFinder: opts.includeFinder ?? false,
      groupBackground: opts.groupBackground ?? true,
      neverQuitMusic: opts.neverQuitMusic ?? false,
      musicApps: opts.musicApps ?? [],
    };
    includeBackground = opts.includeBackground ?? false;
    exec = executor;
  } else {
    const config = loadConfig();
    filterOpts = {
      exclude: config.exclude,
      includeFinder: config.includeFinder,
      groupBackground: config.groupBackground,
      neverQuitMusic: config.neverQuitMusic,
      musicApps: config.musicApps,
    };
    includeBackground = config.includeBackground;
    exec = executor;
  }

  const script = buildDiscoveryScript(includeBackground);
  const stdout = await runJXA(script, [], exec);

  const apps = parseAppListOutput(stdout);
  return filterApps(apps, filterOpts);
}

export async function getRunningAppsForConfig(
  config: QuitxConfig = loadConfig(),
  options: Partial<GetRunningAppsOptions> = {},
  executor?: ScriptExecutor,
): Promise<AppInfo[]> {
  return getRunningApps(
    {
      exclude: options.exclude ?? config.exclude,
      includeFinder: options.includeFinder ?? config.includeFinder,
      includeBackground: options.includeBackground ?? config.includeBackground,
      groupBackground: options.groupBackground ?? config.groupBackground,
      neverQuitMusic: options.neverQuitMusic ?? config.neverQuitMusic,
      musicApps: options.musicApps ?? config.musicApps,
    },
    executor,
  );
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

  if (typeof target === "object") {
    if (target.pids && target.pids.length > 0) {
      return target.pids.some((pid) => isProcessAlive(pid));
    }
    if (target.pid !== undefined && target.pid > 0) {
      return isProcessAlive(target.pid);
    }
  }

  const name = typeof target === "string" ? target : target.name;
  const bundleId = typeof target === "object" ? (target.bundleId ?? "") : "";
  try {
    const res = await runJXA(IS_APP_RUNNING_SCRIPT, [name, bundleId], executor);
    return res.trim().toLowerCase() === "true";
  } catch {
    return false;
  }
}
