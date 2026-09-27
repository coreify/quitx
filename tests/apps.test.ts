import { describe, expect, it, vi } from "vitest";
import {
  buildDiscoveryScript,
  filterApps,
  formatDynamicName,
  getRunningApps,
  isAppRunning,
  isProcessAlive,
  parseAppListOutput,
  sortApps,
} from "../src/macos/apps";
import type { AppInfo } from "../src/types";

describe("apps parser and filters", () => {
  it("parses tab-delimited output with bundleId and PID", () => {
    const stdout = [
      "Finder\tcom.apple.finder\t101",
      "Spotify\tcom.spotify.client\t202",
      "CustomApp\tmissing value\t303",
      "NoPidApp\tcom.custom.nopid\tinvalid",
    ].join("\n");

    const apps = parseAppListOutput(stdout);
    expect(apps).toEqual([
      { name: "Finder", bundleId: "com.apple.finder", pid: 101 },
      { name: "Spotify", bundleId: "com.spotify.client", pid: 202 },
      { name: "CustomApp", bundleId: undefined, pid: 303 },
      { name: "NoPidApp", bundleId: "com.custom.nopid", pid: undefined },
    ]);
  });

  it("uses process name as display name", () => {
    const stdout = [
      "iTerm2\tcom.googlecode.iterm2\t23236",
      "Electron\tcom.google.antigravity-ide\t82643",
      "Google Chrome\tcom.google.Chrome\t5961",
    ].join("\n");

    const apps = parseAppListOutput(stdout);
    expect(apps).toEqual([
      { name: "iTerm2", bundleId: "com.googlecode.iterm2", pid: 23236 },
      { name: "Electron", bundleId: "com.google.antigravity-ide", pid: 82643 },
      { name: "Google Chrome", bundleId: "com.google.Chrome", pid: 5961 },
    ]);
  });

  it("derives name from bundleId when process name matches bundleId", () => {
    const stdout = "com.openai.chat\tcom.openai.chat\t42";
    const apps = parseAppListOutput(stdout);
    expect(apps).toEqual([
      { name: "Chat", bundleId: "com.openai.chat", pid: 42 },
    ]);
  });

  it("formatDynamicName derives clean title-cased names dynamically without hardcoding", () => {
    expect(formatDynamicName("com.custom.my-app")).toBe("My app");
    expect(formatDynamicName("com.company.GreatTool")).toBe("Great Tool");
    expect(formatDynamicName("single")).toBe("Single");
    expect(formatDynamicName("com.openai.chat")).toBe("Chat");
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

  it("filters out Finder and quitx by default, includes terminals by default", () => {
    const raw: AppInfo[] = [
      { name: "Finder", bundleId: "com.apple.finder" },
      { name: "Terminal", bundleId: "com.apple.terminal" },
      { name: "iTerm", bundleId: "com.googlecode.iterm2" },
      { name: "Spotify", bundleId: "com.spotify.client" },
      { name: "quitx", bundleId: "com.kiron.quitx" },
    ];

    const result = filterApps(raw);
    expect(result).toEqual([
      { name: "iTerm", bundleId: "com.googlecode.iterm2" },
      { name: "Spotify", bundleId: "com.spotify.client" },
      { name: "Terminal", bundleId: "com.apple.terminal" },
    ]);
  });

  it("includes Finder when includeFinder is true", () => {
    const raw: AppInfo[] = [
      { name: "Finder", bundleId: "com.apple.finder" },
      { name: "Spotify", bundleId: "com.spotify.client" },
      { name: "quitx", bundleId: "com.kiron.quitx" },
    ];

    const result = filterApps(raw, { includeFinder: true });
    expect(result.map((a) => a.name)).toEqual(["Finder", "Spotify"]);
  });

  it("excludes Finder when includeFinder is false (default)", () => {
    const raw: AppInfo[] = [
      { name: "Finder", bundleId: "com.apple.finder" },
      { name: "Spotify", bundleId: "com.spotify.client" },
    ];

    const result = filterApps(raw, { includeFinder: false });
    expect(result.map((a) => a.name)).toEqual(["Spotify"]);
  });

  it("filters out apps matching exclude list by name or bundleId", () => {
    const raw: AppInfo[] = [
      { name: "Spotify", bundleId: "com.spotify.client" },
      { name: "Discord", bundleId: "com.discord.app" },
      { name: "Slack", bundleId: "com.tinyspeck.slackmacgap" },
    ];

    const result = filterApps(raw, ["spotify", "com.discord.app"]);
    expect(result.map((a) => a.name)).toEqual(["Slack"]);
  });

  it("filterApps accepts FilterOptions with exclude and includeFinder", () => {
    const raw: AppInfo[] = [
      { name: "Finder", bundleId: "com.apple.finder" },
      { name: "Spotify", bundleId: "com.spotify.client" },
      { name: "Discord", bundleId: "com.discord.app" },
    ];

    const result = filterApps(raw, {
      exclude: ["discord"],
      includeFinder: true,
    });
    expect(result.map((a) => a.name)).toEqual(["Finder", "Spotify"]);
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

  it("buildDiscoveryScript generates foreground-only script by default", () => {
    const script = buildDiscoveryScript(false);
    expect(script).toContain("ObjC.import('AppKit')");
    expect(script).toContain("localizedName");
    expect(script).toContain("app.activationPolicy !== Regular");
  });

  it("buildDiscoveryScript generates all-process script when includeBackground is true", () => {
    const script = buildDiscoveryScript(true);
    expect(script).toContain("const includeBackground = true;");
    expect(script).not.toContain("const includeBackground = false;");
  });

  it("getRunningApps fetches, parses, and filters apps", async () => {
    const mockExecutor = vi.fn().mockResolvedValue({
      stdout: "Finder\tcom.apple.finder\t1\nSpotify\tcom.spotify.client\t2\n",
    });

    const apps = await getRunningApps(mockExecutor);
    expect(apps).toEqual([
      { name: "Spotify", bundleId: "com.spotify.client", pid: 2 },
    ]);
  });

  it("getRunningApps accepts options object with includeFinder", async () => {
    const mockExecutor = vi.fn().mockResolvedValue({
      stdout: "Finder\tcom.apple.finder\t1\nSpotify\tcom.spotify.client\t2\n",
    });

    const apps = await getRunningApps(
      { includeFinder: true, exclude: [] },
      mockExecutor,
    );
    expect(apps.map((a) => a.name)).toEqual(["Finder", "Spotify"]);
  });

  it("getRunningApps propagates errors from the executor", async () => {
    const mockExecutor = vi.fn().mockRejectedValue(new Error("JXA failed"));

    await expect(getRunningApps(mockExecutor)).rejects.toThrow("JXA failed");
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

  it("groups background app instances when groupBackground is true", () => {
    const raw: AppInfo[] = [
      {
        name: "QuickLook",
        bundleId: "com.apple.quicklook",
        pid: 101,
        isBackground: true,
      },
      {
        name: "QuickLook",
        bundleId: "com.apple.quicklook",
        pid: 102,
        isBackground: true,
      },
    ];

    const result = filterApps(raw, { groupBackground: true });
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe("QuickLook");
    expect(result[0]?.count).toBe(2);
    expect(result[0]?.pids).toEqual([101, 102]);
  });

  it("lists background app instances separately when groupBackground is false", () => {
    const raw: AppInfo[] = [
      {
        name: "QuickLook",
        bundleId: "com.apple.quicklook",
        pid: 101,
        isBackground: true,
      },
      {
        name: "QuickLook",
        bundleId: "com.apple.quicklook",
        pid: 102,
        isBackground: true,
      },
    ];

    const result = filterApps(raw, { groupBackground: false });
    expect(result).toHaveLength(2);
    expect(result[0]?.pid).toBe(101);
    expect(result[1]?.pid).toBe(102);
  });

  it("groups background apps with sub-instance suffixes under base name", () => {
    const raw: AppInfo[] = [
      {
        name: "Dock Extra",
        bundleId: "com.apple.dock.extra",
        pid: 36960,
        isBackground: true,
      },
      {
        name: "Dock Extra (Codex.app)",
        bundleId: "com.apple.dock.external.extra.arm64",
        pid: 36962,
        isBackground: true,
      },
      {
        name: "Dock Extra (Setapp.app)",
        bundleId: "com.apple.dock.external.extra.arm64",
        pid: 36961,
        isBackground: true,
      },
    ];

    const result = filterApps(raw, { groupBackground: true });
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe("Dock Extra");
    expect(result[0]?.count).toBe(3);
    expect(result[0]?.pids).toEqual([36960, 36962, 36961]);
  });

  it("isAppRunning checks any alive PID when target has pids array", async () => {
    const appWithMultiPids: AppInfo = {
      name: "MultiProc",
      pids: [9999999, process.pid],
    };
    expect(await isAppRunning(appWithMultiPids)).toBe(true);

    const appWithDeadPids: AppInfo = {
      name: "DeadProc",
      pids: [9999998, 9999999],
    };
    expect(await isAppRunning(appWithDeadPids)).toBe(false);
  });

  it("filters out music apps when neverQuitMusic is true", () => {
    const raw: AppInfo[] = [
      { name: "Spotify", bundleId: "com.spotify.client" },
      { name: "Music", bundleId: "com.apple.Music" },
      { name: "TIDAL", bundleId: "com.tidal.desktop" },
      { name: "Slack", bundleId: "com.tinyspeck.slackmacgap" },
    ];

    const withMusicExcluded = filterApps(raw, { neverQuitMusic: true });
    expect(withMusicExcluded).toEqual([
      { name: "Slack", bundleId: "com.tinyspeck.slackmacgap" },
    ]);

    const withMusicKept = filterApps(raw, { neverQuitMusic: false });
    expect(withMusicKept.map((a) => a.name)).toEqual([
      "Music",
      "Slack",
      "Spotify",
      "TIDAL",
    ]);
  });

  it("filters out apps flagged by OS metadata isMusic or customMusicApps list", () => {
    const raw: AppInfo[] = [
      { name: "CustomSynth", bundleId: "com.vendor.synth", isMusic: true },
      { name: "MyPlayer", bundleId: "com.indie.player" },
      { name: "CodeEditor", bundleId: "com.microsoft.vscode" },
    ];

    const result = filterApps(raw, {
      neverQuitMusic: true,
      musicApps: ["MyPlayer"],
    });

    expect(result).toEqual([
      { name: "CodeEditor", bundleId: "com.microsoft.vscode" },
    ]);
  });

  it("parses 5th column isMusic flag in discovery output", () => {
    const stdout = [
      "MusicPlayer\tcom.music.player\t123\t0\t1",
      "Browser\tcom.browser.app\t456\t0\t0",
    ].join("\n");

    const apps = parseAppListOutput(stdout);
    expect(apps).toEqual([
      {
        name: "MusicPlayer",
        bundleId: "com.music.player",
        pid: 123,
        isMusic: true,
      },
      {
        name: "Browser",
        bundleId: "com.browser.app",
        pid: 456,
      },
    ]);
  });

  it("handles includeTrash option in filterApps and isAppRunning", async () => {
    const raw: AppInfo[] = [
      { name: "Slack", bundleId: "com.tinyspeck.slackmacgap" },
      { name: "Trash", bundleId: "com.apple.trash" },
    ];

    const withoutTrash = filterApps(raw, { includeTrash: false });
    expect(withoutTrash).toEqual([
      { name: "Slack", bundleId: "com.tinyspeck.slackmacgap" },
    ]);

    const withTrash = filterApps(raw, { includeTrash: true });
    expect(withTrash).toEqual([
      { name: "Slack", bundleId: "com.tinyspeck.slackmacgap" },
      { name: "Trash", bundleId: "com.apple.trash" },
    ]);

    expect(
      await isAppRunning({ name: "Trash", bundleId: "com.apple.trash" }),
    ).toBe(false);
  });
});
