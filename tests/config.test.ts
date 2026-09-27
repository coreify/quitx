import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import {
  addExcludedApps,
  loadConfig,
  removeExcludedApps,
  saveConfig,
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
    expect(config).toEqual({ exclude: [] });
  });

  it("saves and loads config correctly", () => {
    saveConfig({ exclude: ["Spotify", "Slack"] }, TEST_FILE);
    const loaded = loadConfig(TEST_FILE);
    expect(loaded.exclude).toEqual(["Spotify", "Slack"]);
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
});
