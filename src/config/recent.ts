import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { QuitResult, RecentlyQuitEntry } from "../types";
import { getConfigDir } from "./index";

export const RECENTLY_QUIT_MAX = 5;

export function getRecentlyQuitFile(): string {
  return (
    process.env.QUITX_RECENTLY_QUIT_FILE ||
    join(getConfigDir(), "recently-quit.json")
  );
}

export function isSameRecentlyQuitApp(
  lhs: RecentlyQuitEntry,
  rhs: RecentlyQuitEntry,
): boolean {
  if (lhs.bundleId && rhs.bundleId) {
    return lhs.bundleId.toLowerCase() === rhs.bundleId.toLowerCase();
  }
  return lhs.name.toLowerCase() === rhs.name.toLowerCase();
}

export function insertRecentlyQuitEntry(
  entries: readonly RecentlyQuitEntry[],
  entry: RecentlyQuitEntry,
): RecentlyQuitEntry[] {
  const rest = entries.filter((e) => !isSameRecentlyQuitApp(e, entry));
  return [entry, ...rest].slice(0, RECENTLY_QUIT_MAX);
}

export function loadRecentlyQuit(
  filePath = getRecentlyQuitFile(),
): RecentlyQuitEntry[] {
  try {
    if (!existsSync(filePath)) return [];
    const raw = readFileSync(filePath, "utf-8");
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const entries = parsed.filter(
      (e): e is RecentlyQuitEntry =>
        typeof e === "object" &&
        e !== null &&
        typeof (e as RecentlyQuitEntry).name === "string",
    );
    return entries.slice(0, RECENTLY_QUIT_MAX);
  } catch {
    return [];
  }
}

export function saveRecentlyQuit(
  entries: readonly RecentlyQuitEntry[],
  filePath = getRecentlyQuitFile(),
): void {
  try {
    const dir = join(filePath, "..");
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(
      filePath,
      JSON.stringify(entries.slice(0, RECENTLY_QUIT_MAX), null, 2),
      "utf-8",
    );
  } catch {
    //
  }
}

export function recordRecentlyQuit(
  apps: readonly { name: string; bundleId?: string | undefined }[],
  filePath = getRecentlyQuitFile(),
): RecentlyQuitEntry[] {
  if (apps.length === 0) return loadRecentlyQuit(filePath);
  let entries = loadRecentlyQuit(filePath);
  for (const app of apps) {
    entries = insertRecentlyQuitEntry(entries, {
      name: app.name,
      bundleId: app.bundleId,
      quitAt: new Date().toISOString(),
    });
  }
  saveRecentlyQuit(entries, filePath);
  return entries;
}

export function removeRecentlyQuitEntries(
  entriesToRemove: readonly RecentlyQuitEntry[],
  filePath = getRecentlyQuitFile(),
): RecentlyQuitEntry[] {
  const remaining = loadRecentlyQuit(filePath).filter(
    (entry) => !entriesToRemove.some((r) => isSameRecentlyQuitApp(r, entry)),
  );
  saveRecentlyQuit(remaining, filePath);
  return remaining;
}

function isNonQuittableSpecial(name: string, bundleId?: string): boolean {
  const nameLower = name.toLowerCase();
  if (nameLower === "finder" || bundleId === "com.apple.finder") return true;
  if (nameLower === "trash" || bundleId === "com.apple.trash") return true;
  return false;
}

export function recordQuitResults(
  results: readonly QuitResult[],
  filePath = getRecentlyQuitFile(),
): RecentlyQuitEntry[] {
  const recordable = results
    .filter(
      (r) => r.success && !isNonQuittableSpecial(r.app.name, r.app.bundleId),
    )
    .map((r) => ({ name: r.app.name, bundleId: r.app.bundleId }));
  if (recordable.length === 0) {
    return loadRecentlyQuit(filePath);
  }
  return recordRecentlyQuit(recordable, filePath);
}
