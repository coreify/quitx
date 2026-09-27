import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { QuitxConfig } from "../types";

export const CONFIG_DIR = join(homedir(), ".quitx");
export const CONFIG_FILE = join(CONFIG_DIR, "config.json");

export const DEFAULT_CONFIG: QuitxConfig = {
  exclude: [],
  force: "normal",
  includeFinder: false,
  includeBackground: false,
  groupBackground: true,
  defaultSelectAll: true,
  neverQuitMusic: false,
};

export function loadConfig(filePath = CONFIG_FILE): QuitxConfig {
  try {
    if (!existsSync(filePath)) {
      return { ...DEFAULT_CONFIG, exclude: [] };
    }
    const raw = readFileSync(filePath, "utf-8");
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) {
      return { ...DEFAULT_CONFIG, exclude: [] };
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

    return {
      exclude: Array.isArray(obj.exclude) ? (obj.exclude as string[]) : [],
      force:
        obj.force === "force" || obj.force === "normal"
          ? obj.force
          : DEFAULT_CONFIG.force,
      includeFinder:
        typeof obj.includeFinder === "boolean"
          ? obj.includeFinder
          : DEFAULT_CONFIG.includeFinder,
      includeBackground:
        typeof obj.includeBackground === "boolean"
          ? obj.includeBackground
          : DEFAULT_CONFIG.includeBackground,
      groupBackground: groupBgVal,
      defaultSelectAll: defaultSelectVal,
      neverQuitMusic: neverQuitMusicVal,
    };
  } catch {
    return { ...DEFAULT_CONFIG, exclude: [] };
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
