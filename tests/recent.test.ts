import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  RECENTLY_QUIT_MAX,
  getRecentlyQuitFile,
  insertRecentlyQuitEntry,
  isSameRecentlyQuitApp,
  loadRecentlyQuit,
  recordQuitResults,
  recordRecentlyQuit,
  removeRecentlyQuitEntries,
  saveRecentlyQuit,
} from "../src/config/recent";
import type { QuitResult, RecentlyQuitEntry } from "../src/types";

let dir: string;
let file: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "quitx-recent-"));
  file = join(dir, "recently-quit.json");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

const entry = (
  name: string,
  bundleId?: string,
  quitAt = "2026-01-01T00:00:00.000Z",
): RecentlyQuitEntry => ({ name, bundleId, quitAt });

describe("recently quit store", () => {
  it("prefers QUITX_RECENTLY_QUIT_FILE over the config dir", () => {
    const original = process.env.QUITX_RECENTLY_QUIT_FILE;
    process.env.QUITX_RECENTLY_QUIT_FILE = "/tmp/custom-recent.json";
    try {
      expect(getRecentlyQuitFile()).toBe("/tmp/custom-recent.json");
    } finally {
      if (original === undefined) {
        delete process.env.QUITX_RECENTLY_QUIT_FILE;
      } else {
        process.env.QUITX_RECENTLY_QUIT_FILE = original;
      }
    }
    expect(getRecentlyQuitFile()).toContain("recently-quit.json");
  });

  it("compares by bundleId when both have one, else by name", () => {
    expect(
      isSameRecentlyQuitApp(entry("A", "com.a"), entry("B", "COM.A")),
    ).toBe(true);
    expect(isSameRecentlyQuitApp(entry("Slack"), entry("slack"))).toBe(true);
    expect(
      isSameRecentlyQuitApp(entry("A", "com.a"), entry("A", "com.b")),
    ).toBe(false);
    expect(isSameRecentlyQuitApp(entry("A"), entry("B"))).toBe(false);
  });

  it("inserts at the front, dedupes, and caps the list", () => {
    let entries: RecentlyQuitEntry[] = [];
    for (const name of ["One", "Two", "Three", "Four", "Five", "Six"]) {
      entries = insertRecentlyQuitEntry(entries, entry(name));
    }
    expect(entries).toHaveLength(RECENTLY_QUIT_MAX);
    expect(entries[0]?.name).toBe("Six");

    const deduped = insertRecentlyQuitEntry(entries, entry("six", "com.six"));
    expect(deduped[0]?.bundleId).toBe("com.six");
    expect(deduped.filter((e) => e.name.toLowerCase() === "six")).toHaveLength(
      1,
    );
  });

  it("loads nothing for missing or invalid files", () => {
    expect(loadRecentlyQuit(file)).toEqual([]);
    writeFileSync(file, "not json", "utf-8");
    expect(loadRecentlyQuit(file)).toEqual([]);
    writeFileSync(file, JSON.stringify({ not: "an array" }), "utf-8");
    expect(loadRecentlyQuit(file)).toEqual([]);
    writeFileSync(file, JSON.stringify([42, null, { name: "Ok" }]), "utf-8");
    const entries = loadRecentlyQuit(file);
    expect(entries).toHaveLength(1);
    expect(entries[0]?.name).toBe("Ok");
  });

  it("trims overlong lists on load and save", () => {
    const many = Array.from({ length: 8 }, (_, i) => entry(`App${i}`));
    writeFileSync(file, JSON.stringify(many), "utf-8");
    expect(loadRecentlyQuit(file)).toHaveLength(RECENTLY_QUIT_MAX);
    saveRecentlyQuit(many, file);
    const saved = JSON.parse(readFileSync(file, "utf-8")) as unknown[];
    expect(saved).toHaveLength(RECENTLY_QUIT_MAX);
  });

  it("creates missing directories when saving", () => {
    const nested = join(dir, "a", "b", "recent.json");
    saveRecentlyQuit([entry("X")], nested);
    expect(loadRecentlyQuit(nested)).toHaveLength(1);
  });

  it("silently ignores unwritable paths", () => {
    expect(() =>
      saveRecentlyQuit([entry("X")], join(dir, "nope", "file.json") + "/x"),
    ).not.toThrow();
  });

  it("recordRecentlyQuit appends and no-ops on empty input", () => {
    expect(recordRecentlyQuit([], file)).toEqual([]);
    const result = recordRecentlyQuit(
      [{ name: "Spotify", bundleId: "com.spotify.client" }],
      file,
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.quitAt).toBeTruthy();
    expect(loadRecentlyQuit(file)).toHaveLength(1);
  });

  it("removeRecentlyQuitEntries drops matching entries only", () => {
    recordRecentlyQuit(
      [{ name: "Spotify" }, { name: "Slack" }, { name: "Arc" }],
      file,
    );
    const remaining = removeRecentlyQuitEntries([entry("slack")], file);
    expect(remaining.map((e) => e.name)).toEqual(["Arc", "Spotify"]);
  });

  it("recordQuitResults keeps successful non-special apps only", () => {
    const results: QuitResult[] = [
      { app: { name: "Spotify" }, success: true, forced: false },
      { app: { name: "Finder" }, success: true, forced: false },
      {
        app: { name: "Trash", bundleId: "com.apple.trash" },
        success: true,
        forced: false,
      },
      { app: { name: "Failing" }, success: false, forced: false },
    ];
    const recorded = recordQuitResults(results, file);
    expect(recorded.map((e) => e.name)).toEqual(["Spotify"]);
  });

  it("recordQuitResults preserves existing entries when nothing succeeded", () => {
    recordRecentlyQuit([{ name: "Arc" }], file);
    const results: QuitResult[] = [
      { app: { name: "Nope" }, success: false, forced: false },
    ];
    const recorded = recordQuitResults(results, file);
    expect(recorded.map((e) => e.name)).toEqual(["Arc"]);
  });
});
