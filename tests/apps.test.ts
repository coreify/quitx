import { describe, expect, it, vi } from "vitest";
import {
  filterApps,
  getRunningApps,
  isAppRunning,
  isProcessAlive,
  parseAppListOutput,
  resolveNameFromBundleId,
  sortApps,
} from "../src/macos/apps";
import type { AppInfo } from "../src/types";

describe("apps parser and filters", () => {
  it("parses tab-delimited output with bundleId and PID", () => {
    const stdout = [
      "Finder\tcom.apple.finder\t101\tFinder.app",
      "Spotify\tcom.spotify.client\t202\tSpotify.app",
      "CustomApp\tmissing value\t303\t",
      "NoPidApp\tcom.custom.nopid\tinvalid\tNoPidApp.app",
    ].join("\n");

    const apps = parseAppListOutput(stdout);
    expect(apps).toEqual([
      { name: "Finder", bundleId: "com.apple.finder", pid: 101 },
      { name: "Spotify", bundleId: "com.spotify.client", pid: 202 },
      { name: "CustomApp", bundleId: undefined, pid: 303 },
      { name: "NoPidApp", bundleId: "com.custom.nopid", pid: undefined },
    ]);
  });

  it("resolves real app display name for Electron apps", () => {
    const stdout = [
      "Electron\tcom.google.antigravity-ide\t82643\tAntigravity IDE.app",
      "Electron\tcom.github.githubclient\t12345\tGitHub Desktop.app",
      "Electron\tcom.todesktop.230313mzl4w4u92\t67890\tCursor.app",
      "Google Chrome\tcom.google.Chrome\t5961\tGoogle Chrome.app",
    ].join("\n");

    const apps = parseAppListOutput(stdout);
    expect(apps).toEqual([
      {
        name: "Antigravity IDE",
        bundleId: "com.google.antigravity-ide",
        pid: 82643,
      },
      {
        name: "GitHub Desktop",
        bundleId: "com.github.githubclient",
        pid: 12345,
      },
      {
        name: "Cursor",
        bundleId: "com.todesktop.230313mzl4w4u92",
        pid: 67890,
      },
      {
        name: "Google Chrome",
        bundleId: "com.google.Chrome",
        pid: 5961,
      },
    ]);
  });

  it("formatDynamicName derives clean title-cased names dynamically without hardcoding", () => {
    expect(resolveNameFromBundleId("com.custom.my-app")).toBe("My app");
    expect(resolveNameFromBundleId("com.company.GreatTool")).toBe("Great Tool");
    expect(resolveNameFromBundleId("single")).toBe("Single");
    expect(resolveNameFromBundleId("com.openai.chat")).toBe("Chat");
  });

  it("parses fallback comma-separated output", () => {
    const stdout = "Finder, Discord, Spotify, Arc";
    const apps = parseAppListOutput(stdout);
    expect(apps).toEqual([
      { name: "Finder" },
      { name: "Discord" },
      { name: "Spotify" },
      { name: "Arc" },
    ]);
  });

  it("handles empty or whitespace output", () => {
    expect(parseAppListOutput("")).toEqual([]);
    expect(parseAppListOutput("   \n\t ")).toEqual([]);
  });

  it("sorts apps alphabetically by name", () => {
    const unsorted: AppInfo[] = [
      { name: "Spotify" },
      { name: "Arc" },
      { name: "Discord" },
    ];
    const sorted = sortApps(unsorted);
    expect(sorted.map((a) => a.name)).toEqual(["Arc", "Discord", "Spotify"]);
  });

  it("filters out Finder and terminals by default", () => {
    const raw: AppInfo[] = [
      { name: "Finder", bundleId: "com.apple.finder" },
      { name: "Terminal", bundleId: "com.apple.terminal" },
      { name: "iTerm2", bundleId: "com.googlecode.iterm2" },
      { name: "Spotify", bundleId: "com.spotify.client" },
      { name: "quitx", bundleId: "com.kiron.quitx" },
    ];

    const result = filterApps(raw);
    expect(result).toEqual([
      { name: "Spotify", bundleId: "com.spotify.client" },
    ]);
  });

  it("includes Finder when includeFinder is true", () => {
    const raw: AppInfo[] = [
      { name: "Finder", bundleId: "com.apple.finder" },
      { name: "Spotify", bundleId: "com.spotify.client" },
    ];

    const result = filterApps(raw, { includeFinder: true });
    expect(result.map((a) => a.name)).toEqual(["Finder", "Spotify"]);
  });

  it("includes Terminal when includeTerminal is true", () => {
    const raw: AppInfo[] = [
      { name: "Terminal", bundleId: "com.apple.terminal" },
      { name: "Spotify", bundleId: "com.spotify.client" },
    ];

    const result = filterApps(raw, { includeTerminal: true });
    expect(result.map((a) => a.name)).toEqual(["Spotify", "Terminal"]);
  });

  it("excludes user-specified apps by name or bundleId", () => {
    const raw: AppInfo[] = [
      { name: "Spotify", bundleId: "com.spotify.client" },
      { name: "Discord", bundleId: "com.discord.app" },
      { name: "Slack", bundleId: "com.tinyspeck.slackmacgap" },
    ];

    const result = filterApps(raw, {
      exclude: ["spotify", "com.discord.app"],
    });
    expect(result.map((a) => a.name)).toEqual(["Slack"]);
  });

  it("deduplicates applications with identical bundleId or name", () => {
    const raw: AppInfo[] = [
      { name: "Spotify", bundleId: "com.spotify.client", pid: 100 },
      { name: "Spotify", bundleId: "com.spotify.client", pid: 101 },
    ];

    const result = filterApps(raw);
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe("Spotify");
  });

  it("getRunningApps fetches, parses, and filters apps", async () => {
    const mockExecutor = vi.fn().mockResolvedValue({
      stdout:
        "Finder\tcom.apple.finder\t1\tFinder.app\nSpotify\tcom.spotify.client\t2\tSpotify.app\n",
    });

    const apps = await getRunningApps({}, mockExecutor);
    expect(apps).toEqual([
      { name: "Spotify", bundleId: "com.spotify.client", pid: 2 },
    ]);
  });

  it("getRunningApps falls back if primary script fails", async () => {
    const mockExecutor = vi
      .fn()
      .mockRejectedValueOnce(new Error("Primary failed"))
      .mockResolvedValueOnce({
        stdout: "Arc, Spotify",
      });

    const apps = await getRunningApps({}, mockExecutor);
    expect(apps.map((a) => a.name)).toEqual(["Arc", "Spotify"]);
  });

  it("isProcessAlive checks process via kill signal 0", () => {
    expect(isProcessAlive(process.pid)).toBe(true);
    expect(isProcessAlive(9999999)).toBe(false);
  });

  it("isAppRunning checks by PID, AppInfo, and fallback script", async () => {
    expect(await isAppRunning(process.pid)).toBe(true);

    const appWithPid: AppInfo = { name: "CurrentNode", pid: process.pid };
    expect(await isAppRunning(appWithPid)).toBe(true);

    const mockExecutor = vi.fn().mockResolvedValue({ stdout: "true" });
    const appWithoutPid: AppInfo = { name: "SomeApp" };
    expect(await isAppRunning(appWithoutPid, mockExecutor)).toBe(true);

    const mockExecutorFalse = vi.fn().mockResolvedValue({ stdout: "false" });
    expect(await isAppRunning("GhostApp", mockExecutorFalse)).toBe(false);
  });
});
