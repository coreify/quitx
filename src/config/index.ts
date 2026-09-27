import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { QuitxConfig } from "../types";

export const CONFIG_DIR = join(homedir(), ".quitx");
export const CONFIG_FILE = join(CONFIG_DIR, "config.json");

export const DEFAULT_CONFIG: QuitxConfig = {
  exclude: [],
};

export function loadConfig(filePath = CONFIG_FILE): QuitxConfig {
  try {
    if (!existsSync(filePath)) {
      return { ...DEFAULT_CONFIG, exclude: [] };
    }
    const raw = readFileSync(filePath, "utf-8");
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === "object" && parsed !== null && "exclude" in parsed) {
      const exclude = Array.isArray((parsed as QuitxConfig).exclude)
        ? (parsed as QuitxConfig).exclude
        : [];
      return { exclude };
    }
    return { ...DEFAULT_CONFIG, exclude: [] };
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
