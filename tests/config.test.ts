import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  CONFIG_DIR,
  CONFIG_FILE,
  DEFAULT_CONFIG,
  STASH_FILE,
  addExcludedApps,
  addMusicApps,
  clearStash,
  getConfigDir,
  loadConfig,
  loadStash,
  removeExcludedApps,
  removeMusicApps,
  saveConfig,
  saveStash,
} from "../src/config";

const TEST_DIR = join(process.cwd(), ".tmp-test-config");
const TEST_FILE = join(TEST_DIR, "config.json");

describe("config storage", () => {
  beforeEach(() => {
    try {
      if (existsSync(TEST_DIR)) {
        rmSync(TEST_DIR, { recursive: true, force: true });
      }
      mkdirSync(TEST_DIR, { recursive: true });
    } catch {
      //
    }
  });

  afterAll(() => {
    try {
      if (existsSync(TEST_DIR)) {
        rmSync(TEST_DIR, { recursive: true, force: true });
      }
    } catch {
      //
    }
  });

  it("returns default config when file does not exist", () => {
    const config = loadConfig(join(TEST_DIR, "nonexistent.json"));
    expect(config).toEqual({
      exclude: [],
      force: "normal",
      includeFinder: false,
      includeTrash: false,
      includeBackground: false,
      groupBackground: true,
      defaultSelectAll: true,
      neverQuitMusic: false,
      autoUpdate: true,
      musicApps: [],
      onQuitFailure: "prompt",
    });
  });

  it("saves and loads config correctly", () => {
    saveConfig(
      {
        exclude: ["Spotify", "Slack"],
        force: "normal",
        includeFinder: false,
        includeTrash: false,
        includeBackground: false,
        groupBackground: true,
        defaultSelectAll: true,
        neverQuitMusic: false,
        autoUpdate: true,
        musicApps: ["MyCustomPlayer"],
      },
      TEST_FILE,
    );
    const loaded = loadConfig(TEST_FILE);
    expect(loaded.exclude).toEqual(["Spotify", "Slack"]);
    expect(loaded.groupBackground).toBe(true);
    expect(loaded.defaultSelectAll).toBe(true);
    expect(loaded.neverQuitMusic).toBe(false);
    expect(loaded.includeTrash).toBe(false);
    expect(loaded.musicApps).toEqual(["MyCustomPlayer"]);
  });

  it("adds excluded apps without duplicates", () => {
    addExcludedApps(["Spotify", "Slack"], TEST_FILE);
    addExcludedApps(["spotify", "Discord"], TEST_FILE);

    const loaded = loadConfig(TEST_FILE);
    expect(loaded.exclude).toEqual(["Spotify", "Slack", "Discord"]);
  });

  it("removes excluded apps case-insensitively", () => {
    addExcludedApps(["Spotify", "Slack", "Discord"], TEST_FILE);
    removeExcludedApps(["spotify", "SLACK"], TEST_FILE);

    const loaded = loadConfig(TEST_FILE);
    expect(loaded.exclude).toEqual(["Discord"]);
  });

  it("adds and removes custom music apps without duplicates case-insensitively", () => {
    addMusicApps(["VLC", "Foobar"], TEST_FILE);
    addMusicApps(["vlc", "Audacity"], TEST_FILE);

    let loaded = loadConfig(TEST_FILE);
    expect(loaded.musicApps).toEqual(["VLC", "Foobar", "Audacity"]);

    removeMusicApps(["foobar", "VLC"], TEST_FILE);
    loaded = loadConfig(TEST_FILE);
    expect(loaded.musicApps).toEqual(["Audacity"]);
  });

  it("handles stash save, load, and clear correctly", () => {
    const stashFile = join(TEST_DIR, "stash.json");
    expect(loadStash(stashFile)).toBeNull();

    const data = {
      timestamp: new Date().toISOString(),
      apps: [{ name: "Chrome", bundleId: "com.google.Chrome" }],
    };

    saveStash(data, stashFile);
    expect(loadStash(stashFile)).toEqual(data);

    clearStash(stashFile);
    expect(loadStash(stashFile)).toBeNull();
  });

  it("handles corrupt config file and non-object json gracefully", () => {
    writeFileSync(TEST_FILE, "NOT VALID JSON", "utf-8");
    const corrupted = loadConfig(TEST_FILE);
    expect(corrupted.exclude).toEqual([]);

    writeFileSync(TEST_FILE, "12345", "utf-8");
    const nonObject = loadConfig(TEST_FILE);
    expect(nonObject.exclude).toEqual([]);
  });

  it("parses sortBy and legacy aliases in loadConfig", () => {
    writeFileSync(
      TEST_FILE,
      JSON.stringify({
        sortBy: "memory",
        defaultSelect: "deselect-all",
        groupBackgroundInstances: false,
      }),
      "utf-8",
    );

    const loaded = loadConfig(TEST_FILE);
    expect(loaded.sortBy).toBe("memory");
    expect(loaded.defaultSelectAll).toBe(false);
    expect(loaded.groupBackground).toBe(false);
  });

  it("handles corrupt or non-array stash files gracefully", () => {
    const stashFile = join(TEST_DIR, "stash.json");
    writeFileSync(stashFile, "INVALID JSON", "utf-8");
    expect(loadStash(stashFile)).toBeNull();

    writeFileSync(stashFile, JSON.stringify({ apps: "not-an-array" }), "utf-8");
    expect(loadStash(stashFile)).toBeNull();

    writeFileSync(stashFile, "null", "utf-8");
    expect(loadStash(stashFile)).toBeNull();
  });

  it("getConfigDir respects QUITX_DIR environment variable", () => {
    const original = process.env.QUITX_DIR;
    try {
      process.env.QUITX_DIR = "/custom/quitx/dir";
      expect(getConfigDir()).toBe("/custom/quitx/dir");
    } finally {
      if (original) {
        process.env.QUITX_DIR = original;
      } else {
        delete process.env.QUITX_DIR;
      }
    }
  });

  it("exports valid default configuration and file constants", () => {
    expect(CONFIG_DIR).toBeTruthy();
    expect(CONFIG_FILE).toContain("config.json");
    expect(STASH_FILE).toContain("stash.json");
    expect(DEFAULT_CONFIG.force).toBe("normal");
    expect(DEFAULT_CONFIG.includeFinder).toBe(false);
    expect(DEFAULT_CONFIG.includeTrash).toBe(false);
    expect(DEFAULT_CONFIG.includeBackground).toBe(false);
    expect(DEFAULT_CONFIG.groupBackground).toBe(true);
    expect(DEFAULT_CONFIG.defaultSelectAll).toBe(true);
    expect(DEFAULT_CONFIG.neverQuitMusic).toBe(false);
    expect(DEFAULT_CONFIG.autoUpdate).toBe(true);
    expect(DEFAULT_CONFIG.exclude).toEqual([]);
    expect(DEFAULT_CONFIG.musicApps).toEqual([]);
    expect(DEFAULT_CONFIG.onQuitFailure).toBe("prompt");
  });

  it("falls back to default force when force value is invalid in config", () => {
    writeFileSync(
      TEST_FILE,
      JSON.stringify({ force: "invalid_force_mode" }),
      "utf-8",
    );
    const loaded = loadConfig(TEST_FILE);
    expect(loaded.force).toBe("normal");
  });

  it("falls back to default boolean settings when types are invalid", () => {
    writeFileSync(
      TEST_FILE,
      JSON.stringify({
        includeFinder: "not_a_bool",
        includeTrash: 123,
        includeBackground: {},
        neverQuitMusic: null,
      }),
      "utf-8",
    );
    const loaded = loadConfig(TEST_FILE);
    expect(loaded.includeFinder).toBe(false);
    expect(loaded.includeTrash).toBe(false);
    expect(loaded.includeBackground).toBe(false);
    expect(loaded.neverQuitMusic).toBe(false);
  });

  it("handles legacy checkUpdate and defaultSelection alias variations", () => {
    writeFileSync(
      TEST_FILE,
      JSON.stringify({
        checkUpdate: false,
        defaultSelection: "deselect-all",
      }),
      "utf-8",
    );
    const loaded = loadConfig(TEST_FILE);
    expect(loaded.autoUpdate).toBe(false);
    expect(loaded.defaultSelectAll).toBe(false);
  });

  it("creates nested parent directories recursively when saving config", () => {
    const nestedFile = join(TEST_DIR, "deep", "nested", "dir", "config.json");
    saveConfig(DEFAULT_CONFIG, nestedFile);
    expect(existsSync(nestedFile)).toBe(true);
    const loaded = loadConfig(nestedFile);
    expect(loaded.force).toBe("normal");
  });

  it("creates nested parent directories recursively when saving stash", () => {
    const nestedStash = join(TEST_DIR, "stash", "sub", "stash.json");
    saveStash(
      { timestamp: "2026-01-01", apps: [{ name: "App" }] },
      nestedStash,
    );
    expect(existsSync(nestedStash)).toBe(true);
    const loaded = loadStash(nestedStash);
    expect(loaded?.apps).toHaveLength(1);
  });

  it("addExcludedApps ignores empty and whitespace-only strings", () => {
    addExcludedApps(["", "   ", "Slack"], TEST_FILE);
    const loaded = loadConfig(TEST_FILE);
    expect(loaded.exclude).toEqual(["Slack"]);
  });

  it("addMusicApps ignores empty and whitespace-only strings", () => {
    addMusicApps(["", "\t", "Audacity"], TEST_FILE);
    const loaded = loadConfig(TEST_FILE);
    expect(loaded.musicApps).toEqual(["Audacity"]);
  });

  it("removeExcludedApps leaves list untouched if target apps are not in list", () => {
    addExcludedApps(["Slack", "Discord"], TEST_FILE);
    removeExcludedApps(["NonExistentApp"], TEST_FILE);
    const loaded = loadConfig(TEST_FILE);
    expect(loaded.exclude).toEqual(["Slack", "Discord"]);
  });

  it("removeMusicApps leaves list untouched if target apps are not in list", () => {
    addMusicApps(["Spotify"], TEST_FILE);
    removeMusicApps(["NonExistentPlayer"], TEST_FILE);
    const loaded = loadConfig(TEST_FILE);
    expect(loaded.musicApps).toEqual(["Spotify"]);
  });

  it("handles missing stash file silently in clearStash", () => {
    const nonExistent = join(TEST_DIR, "never_created.json");
    expect(() => clearStash(nonExistent)).not.toThrow();
  });
});
