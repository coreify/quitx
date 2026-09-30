import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { QuitxConfig, StashData } from "../types";

export function getConfigDir(): string {
  return process.env.QUITX_DIR || join(homedir(), ".quitx");
}

export const CONFIG_DIR = getConfigDir();
export const CONFIG_FILE = join(CONFIG_DIR, "config.json");
export const STASH_FILE = join(CONFIG_DIR, "stash.json");

export const DEFAULT_CONFIG: QuitxConfig = {
  exclude: [],
  force: "normal",
  includeFinder: false,
  includeTrash: false,
  includeBackground: false,
  groupBackground: true,
  defaultSelectAll: true,
  neverQuitMusic: false,
  musicApps: [],
  autoUpdate: true,
};

export function loadConfig(filePath = CONFIG_FILE): QuitxConfig {
  try {
    if (!existsSync(filePath)) {
      return { ...DEFAULT_CONFIG, exclude: [], musicApps: [] };
    }
    const raw = readFileSync(filePath, "utf-8");
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) {
      return { ...DEFAULT_CONFIG, exclude: [], musicApps: [] };
    }

    const obj = parsed as Record<string, unknown>;
    const defaultSelectVal =
      typeof obj.defaultSelectAll === "boolean"
        ? obj.defaultSelectAll
        : obj.defaultSelect === "deselect-all" ||
            obj.defaultSelection === "deselect-all" ||
            obj.defaultSelect === false
          ? false
          : typeof obj.defaultSelect === "boolean"
            ? obj.defaultSelect
            : DEFAULT_CONFIG.defaultSelectAll;

    const groupBgVal =
      typeof obj.groupBackground === "boolean"
        ? obj.groupBackground
        : typeof obj.groupBackgroundInstances === "boolean"
          ? obj.groupBackgroundInstances
          : DEFAULT_CONFIG.groupBackground;

    const neverQuitMusicVal =
      typeof obj.neverQuitMusic === "boolean"
        ? obj.neverQuitMusic
        : DEFAULT_CONFIG.neverQuitMusic;

    const autoUpdateVal =
      typeof obj.autoUpdate === "boolean"
        ? obj.autoUpdate
        : typeof obj.checkUpdate === "boolean"
          ? obj.checkUpdate
          : DEFAULT_CONFIG.autoUpdate;

    const result: QuitxConfig = {
      exclude: Array.isArray(obj.exclude) ? (obj.exclude as string[]) : [],
      force:
        obj.force === "force" || obj.force === "normal"
          ? obj.force
          : DEFAULT_CONFIG.force,
      includeFinder:
        typeof obj.includeFinder === "boolean"
          ? obj.includeFinder
          : DEFAULT_CONFIG.includeFinder,
      includeTrash:
        typeof obj.includeTrash === "boolean"
          ? obj.includeTrash
          : DEFAULT_CONFIG.includeTrash,
      includeBackground:
        typeof obj.includeBackground === "boolean"
          ? obj.includeBackground
          : DEFAULT_CONFIG.includeBackground,
      groupBackground: groupBgVal,
      defaultSelectAll: defaultSelectVal,
      neverQuitMusic: neverQuitMusicVal,
      musicApps: Array.isArray(obj.musicApps)
        ? (obj.musicApps as string[])
        : DEFAULT_CONFIG.musicApps,
      autoUpdate: autoUpdateVal,
    };

    if (obj.sortBy === "memory" || obj.sortBy === "name") {
      result.sortBy = obj.sortBy;
    }

    return result;
  } catch {
    return { ...DEFAULT_CONFIG, exclude: [], musicApps: [] };
  }
}

export function saveConfig(config: QuitxConfig, filePath = CONFIG_FILE): void {
  try {
    const dir = join(filePath, "..");
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(filePath, JSON.stringify(config, null, 2), "utf-8");
  } catch {
    //
  }
}

export function loadStash(filePath = STASH_FILE): StashData | null {
  try {
    if (!existsSync(filePath)) return null;
    const raw = readFileSync(filePath, "utf-8");
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const obj = parsed as Record<string, unknown>;
    if (!Array.isArray(obj.apps)) return null;
    return obj as unknown as StashData;
  } catch {
    return null;
  }
}

export function saveStash(data: StashData, filePath = STASH_FILE): void {
  try {
    const dir = join(filePath, "..");
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  } catch {
    //
  }
}

export function clearStash(filePath = STASH_FILE): void {
  try {
    if (existsSync(filePath)) {
      rmSync(filePath, { force: true });
    }
  } catch {
    //
  }
}

export function addExcludedApps(
  apps: readonly string[],
  filePath = CONFIG_FILE,
): QuitxConfig {
  const current = loadConfig(filePath);
  const set = new Set(current.exclude.map((a) => a.toLowerCase().trim()));
  const updated = [...current.exclude];

  for (const app of apps) {
    const trimmed = app.trim();
    if (trimmed && !set.has(trimmed.toLowerCase())) {
      set.add(trimmed.toLowerCase());
      updated.push(trimmed);
    }
  }

  const next = { ...current, exclude: updated };
  saveConfig(next, filePath);
  return next;
}

export function removeExcludedApps(
  apps: readonly string[],
  filePath = CONFIG_FILE,
): QuitxConfig {
  const current = loadConfig(filePath);
  const toRemove = new Set(apps.map((a) => a.toLowerCase().trim()));
  const updated = current.exclude.filter(
    (app) => !toRemove.has(app.toLowerCase().trim()),
  );

  const next = { ...current, exclude: updated };
  saveConfig(next, filePath);
  return next;
}

export function addMusicApps(
  apps: readonly string[],
  filePath = CONFIG_FILE,
): QuitxConfig {
  const current = loadConfig(filePath);
  const set = new Set(current.musicApps.map((a) => a.toLowerCase().trim()));
  const updated = [...current.musicApps];

  for (const app of apps) {
    const trimmed = app.trim();
    if (trimmed && !set.has(trimmed.toLowerCase())) {
      set.add(trimmed.toLowerCase());
      updated.push(trimmed);
    }
  }

  const next = { ...current, musicApps: updated };
  saveConfig(next, filePath);
  return next;
}

export function removeMusicApps(
  apps: readonly string[],
  filePath = CONFIG_FILE,
): QuitxConfig {
  const current = loadConfig(filePath);
  const toRemove = new Set(apps.map((a) => a.toLowerCase().trim()));
  const updated = current.musicApps.filter(
    (app) => !toRemove.has(app.toLowerCase().trim()),
  );

  const next = { ...current, musicApps: updated };
  saveConfig(next, filePath);
  return next;
}
