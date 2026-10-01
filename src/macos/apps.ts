import { loadConfig } from "../config";
import type { AppInfo, QuitxConfig } from "../types";
import { APPKIT_PREAMBLE, RUNNING_APPS, buildAppMatcherScript } from "./jxa";
import { enrichAppsWithMemory } from "./memory";
import { runJXA, type ScriptExecutor } from "./osascript";

export function buildDiscoveryScript(includeBackground = false): string {
  const bg = includeBackground ? "true" : "false";
  return `${APPKIT_PREAMBLE}
ObjC.import('CoreGraphics');
function run() {
  const includeBackground = ${bg};
  const Regular = $.NSApplicationActivationPolicyRegular;
  const apps = ${RUNNING_APPS};
  const winCountByPid = {};
  let winInfoSuccess = false;
  try {
    const list = $.CGWindowListCopyWindowInfo($.kCGWindowListOptionAll, 0);
    if (!list.isNil()) {
      const arr = ObjC.castRefToObject(list);
      const unwrapped = ObjC.deepUnwrap(arr);
      if (Array.isArray(unwrapped)) {
        winInfoSuccess = true;
        for (let i = 0; i < unwrapped.length; i++) {
          const w = unwrapped[i];
          if (w.kCGWindowLayer === 0 && w.kCGWindowBounds && w.kCGWindowBounds.Width > 50 && w.kCGWindowBounds.Height > 50 && w.kCGWindowAlpha > 0) {
            const pid = w.kCGWindowOwnerPID;
            winCountByPid[pid] = (winCountByPid[pid] || 0) + 1;
          }
        }
      }
    }
  } catch (e) {}
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
    const winCount = winInfoSuccess ? String(winCountByPid[app.processIdentifier] || 0) : '';
    lines.push(name + '\\t' + bundleId + '\\t' + pid + '\\t' + isBg + '\\t' + isMusic + '\\t' + winCount);
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

      const rawWinCount = parts[5]?.trim();
      const winCountNum =
        rawWinCount !== undefined && rawWinCount.length > 0
          ? parseInt(rawWinCount, 10)
          : undefined;
      const windowCount =
        !Number.isNaN(winCountNum) &&
        winCountNum !== undefined &&
        winCountNum >= 0
          ? winCountNum
          : undefined;

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
        ...(windowCount !== undefined ? { windowCount } : {}),
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

export function sortApps(
  apps: readonly AppInfo[],
  sortBy: "name" | "memory" = "name",
): AppInfo[] {
  return [...apps].sort((a, b) => {
    if (sortBy === "memory") {
      const memA = a.memoryBytes ?? 0;
      const memB = b.memoryBytes ?? 0;
      if (memB !== memA) {
        return memB - memA;
      }
    }
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });
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
  keep?: readonly string[] | undefined;
  windowless?: boolean | undefined;
  sortBy?: "name" | "memory" | undefined;
  includeFinder?: boolean | undefined;
  includeTrash?: boolean | undefined;
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
  const keep = opts.keep ?? [];
  const windowless = opts.windowless ?? false;
  const includeFinder = opts.includeFinder ?? false;
  const includeTrash = opts.includeTrash ?? false;
  const groupBackground = opts.groupBackground ?? true;
  const neverQuitMusic = opts.neverQuitMusic ?? false;
  const customMusicApps = opts.musicApps ?? [];

  const excludeSet = new Set(exclude.map((e) => e.toLowerCase().trim()));
  const keepSet = new Set(keep.map((k) => k.toLowerCase().trim()));
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

    if (!includeTrash) {
      if (nameLower === "trash" || bundleLower === "com.apple.trash") {
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

    if (keepSet.has(nameLower) || (bundleLower && keepSet.has(bundleLower))) {
      continue;
    }

    if (windowless) {
      if (
        app.isBackground ||
        app.windowCount === undefined ||
        app.windowCount > 0
      ) {
        continue;
      }
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
        if (app.windowCount !== undefined) {
          existing.windowCount = (existing.windowCount ?? 0) + app.windowCount;
        }
        if (app.memoryBytes !== undefined) {
          existing.memoryBytes = (existing.memoryBytes ?? 0) + app.memoryBytes;
        }
      } else {
        const item: AppInfo = { ...app, name: cleanName };
        grouped.set(key, item);
        result.push(item);
      }
    }
  }

  if (
    includeTrash &&
    !excludeSet.has("trash") &&
    !excludeSet.has("com.apple.trash") &&
    !keepSet.has("trash") &&
    !keepSet.has("com.apple.trash") &&
    !windowless
  ) {
    const hasTrash = result.some(
      (a) =>
        a.name.toLowerCase() === "trash" ||
        a.bundleId?.toLowerCase() === "com.apple.trash",
    );
    if (!hasTrash) {
      result.push({ name: "Trash", bundleId: "com.apple.trash" });
    }
  }

  return sortApps(result, opts.sortBy);
}

export interface GetRunningAppsOptions {
  exclude?: readonly string[] | undefined;
  keep?: readonly string[] | undefined;
  windowless?: boolean | undefined;
  sortBy?: "name" | "memory" | undefined;
  includeFinder?: boolean | undefined;
  includeTrash?: boolean | undefined;
  includeBackground?: boolean | undefined;
  groupBackground?: boolean | undefined;
  neverQuitMusic?: boolean | undefined;
  musicApps?: readonly string[] | undefined;
  includeMemory?: boolean | undefined;
}

export async function getRunningApps(
  optionsOrExclude?: GetRunningAppsOptions | readonly string[] | ScriptExecutor,
  executor?: ScriptExecutor,
): Promise<AppInfo[]> {
  let exec: ScriptExecutor | undefined;
  let filterOpts: FilterOptions;
  let includeBackground = false;
  let includeMemory = false;

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
      keep: opts.keep ?? [],
      windowless: opts.windowless ?? false,
      sortBy: opts.sortBy,
      includeFinder: opts.includeFinder ?? false,
      includeTrash: opts.includeTrash ?? false,
      groupBackground: opts.groupBackground ?? true,
      neverQuitMusic: opts.neverQuitMusic ?? false,
      musicApps: opts.musicApps ?? [],
    };
    includeBackground = opts.includeBackground ?? false;
    includeMemory = opts.includeMemory ?? false;
    exec = executor;
  } else {
    const config = loadConfig();
    filterOpts = {
      exclude: config.exclude,
      includeFinder: config.includeFinder,
      includeTrash: config.includeTrash,
      groupBackground: config.groupBackground,
      neverQuitMusic: config.neverQuitMusic,
      musicApps: config.musicApps,
      sortBy: config.sortBy,
    };
    includeBackground = config.includeBackground;
    exec = executor;
  }

  const script = buildDiscoveryScript(includeBackground);
  const stdout = await runJXA(script, [], exec);

  const apps = parseAppListOutput(stdout);
  const filtered = filterApps(apps, filterOpts);

  if (includeMemory || filterOpts.sortBy === "memory") {
    await enrichAppsWithMemory(filtered);
    return sortApps(filtered, filterOpts.sortBy);
  }

  return filtered;
}

export async function getRunningAppsForConfig(
  config: QuitxConfig = loadConfig(),
  options: Partial<GetRunningAppsOptions> = {},
  executor?: ScriptExecutor,
): Promise<AppInfo[]> {
  return getRunningApps(
    {
      exclude: options.exclude ?? config.exclude,
      keep: options.keep,
      windowless: options.windowless,
      sortBy: options.sortBy ?? config.sortBy,
      includeFinder: options.includeFinder ?? config.includeFinder,
      includeTrash: options.includeTrash ?? config.includeTrash,
      includeBackground: options.includeBackground ?? config.includeBackground,
      groupBackground: options.groupBackground ?? config.groupBackground,
      neverQuitMusic: options.neverQuitMusic ?? config.neverQuitMusic,
      musicApps: options.musicApps ?? config.musicApps,
      includeMemory: options.includeMemory,
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
    if (
      target.bundleId === "com.apple.trash" ||
      target.name.toLowerCase() === "trash"
    ) {
      return false;
    }
    if (target.pids && target.pids.length > 0) {
      return target.pids.some((pid) => isProcessAlive(pid));
    }
    if (target.pid !== undefined && target.pid > 0) {
      return isProcessAlive(target.pid);
    }
  }

  if (
    typeof target === "string" &&
    (target.toLowerCase() === "trash" ||
      target.toLowerCase() === "com.apple.trash")
  ) {
    return false;
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
