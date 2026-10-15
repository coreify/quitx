import { describe, expect, it, vi } from "vitest";
import { filterApps } from "../src/macos/apps";
import { quitApp, quitApps } from "../src/macos/quit";
import {
  isQuitxSelf,
  isSystemProtectedApp,
  SYSTEM_PROTECTED_BUNDLE_IDS,
} from "../src/macos/system-apps";
import type { AppInfo } from "../src/types";

describe("system protected apps", () => {
  it("matches protected bundle ids case-insensitively", () => {
    expect(
      isSystemProtectedApp({ name: "Dock", bundleId: "com.apple.Dock" }),
    ).toBe(true);
    expect(
      isSystemProtectedApp({
        name: "Control Center",
        bundleId: "com.apple.controlcenter",
      }),
    ).toBe(true);
  });

  it("matches protected app names and compacted names", () => {
    expect(isSystemProtectedApp({ name: "Dock" })).toBe(true);
    expect(isSystemProtectedApp({ name: " Control Center " })).toBe(true);
    expect(isSystemProtectedApp({ name: "SystemUIServer" })).toBe(true);
    expect(isSystemProtectedApp({ name: "systemuiserver" })).toBe(true);
    expect(isSystemProtectedApp({ name: "LoginWindow" })).toBe(true);
  });

  it("does not match normal apps", () => {
    expect(
      isSystemProtectedApp({ name: "Finder", bundleId: "com.apple.finder" }),
    ).toBe(false);
    expect(
      isSystemProtectedApp({
        name: "Slack",
        bundleId: "com.tinyspeck.slackmacgap",
      }),
    ).toBe(false);
    expect(isSystemProtectedApp({ name: "System Info" })).toBe(false);
  });

  it("does not match empty or missing names", () => {
    expect(isSystemProtectedApp({ name: "", bundleId: undefined })).toBe(false);
  });

  it("exposes a non-empty bundle id set", () => {
    expect(SYSTEM_PROTECTED_BUNDLE_IDS.size).toBeGreaterThan(0);
    expect(SYSTEM_PROTECTED_BUNDLE_IDS.has("com.apple.dock")).toBe(true);
  });
});

describe("filterApps protectSystemApps", () => {
  const raw: AppInfo[] = [
    { name: "Dock", bundleId: "com.apple.dock", pid: 100 },
    { name: "Control Center", bundleId: "com.apple.controlcenter", pid: 101 },
    { name: "Slack", bundleId: "com.tinyspeck.slackmacgap", pid: 102 },
    { name: "Finder", bundleId: "com.apple.finder", pid: 103 },
  ];

  it("filters protected apps when enabled (default)", () => {
    const result = filterApps(raw, {});
    expect(result.map((a) => a.name)).toEqual(["Slack"]);
  });

  it("keeps protected apps when disabled", () => {
    const result = filterApps(raw, { protectSystemApps: false });
    expect(result.map((a) => a.name)).toEqual([
      "Control Center",
      "Dock",
      "Slack",
    ]);
  });

  it("keeps Finder alongside protected apps when both are enabled", () => {
    const result = filterApps(raw, {
      protectSystemApps: false,
      includeFinder: true,
    });
    expect(result.map((a) => a.name)).toEqual([
      "Control Center",
      "Dock",
      "Finder",
      "Slack",
    ]);
  });
});

describe("quit layer protection", () => {
  it("quitApp refuses to quit a protected app", async () => {
    const res = await quitApp({
      name: "Dock",
      bundleId: "com.apple.dock",
      pid: 1,
    });
    expect(res.success).toBe(false);
    expect(res.error).toContain("System-protected");
  });

  it("quitApp refuses even with force and dryRun off", async () => {
    const res = await quitApp(
      { name: "Control Center", bundleId: "com.apple.controlcenter", pid: 2 },
      { force: true },
    );
    expect(res.success).toBe(false);
    expect(res.forced).toBe(false);
  });

  it("quitApps skips protected apps and quits the rest", async () => {
    const executor = vi.fn().mockResolvedValue({ stdout: "true" });
    const results = await quitApps(
      [
        { name: "Dock", bundleId: "com.apple.dock", pid: 10 },
        { name: "GhostApp", bundleId: "com.ghost.app", pid: 9999999 },
      ],
      { dryRun: true },
      executor as never,
    );
    expect(results).toHaveLength(2);
    const dock = results.find((r) => r.app.name === "Dock");
    expect(dock?.success).toBe(false);
    expect(dock?.error).toContain("System-protected");
    const ghost = results.find((r) => r.app.name === "GhostApp");
    expect(ghost?.success).toBe(true);
    expect(executor).not.toHaveBeenCalled();
  });

  it("quitApps returns only protected failures when all are protected", async () => {
    const results = await quitApps([
      { name: "Dock", bundleId: "com.apple.dock", pid: 10 },
      { name: "Spotlight", bundleId: "com.apple.spotlight", pid: 11 },
    ]);
    expect(results).toHaveLength(2);
    expect(results.every((r) => !r.success)).toBe(true);
    expect(results.every((r) => r.error?.includes("System-protected"))).toBe(
      true,
    );
  });
});

describe("isQuitxSelf", () => {
  it("matches all known quitx bundle ids case-insensitively", () => {
    for (const bid of [
      "io.coreify.quitx",
      "com.coreify.quitx",
      "com.kiron.quitx",
      "com.quitx.QuitX",
    ]) {
      expect(isQuitxSelf({ name: "X", bundleId: bid.toUpperCase() })).toBe(
        true,
      );
    }
  });

  it("matches the quitx app name", () => {
    expect(isQuitxSelf({ name: " QuitX " })).toBe(true);
    expect(isQuitxSelf({ name: "Slack" })).toBe(false);
  });

  it("treats quitx itself as system-protected", () => {
    expect(
      isSystemProtectedApp({ name: "QuitX", bundleId: "io.coreify.quitx" }),
    ).toBe(true);
  });
});

describe("path based protection", () => {
  it("protects private framework and /usr paths", () => {
    expect(
      isSystemProtectedApp({
        name: "SomeHelper",
        path: "/System/Library/PrivateFrameworks/Foo.framework/Versions/A/X",
      }),
    ).toBe(true);
    expect(
      isSystemProtectedApp({ name: "Python", path: "/usr/bin/python3" }),
    ).toBe(true);
  });

  it("protects background system paths only when isBackground", () => {
    const app = {
      name: "sysd",
      path: "/System/Library/CoreServices/foo",
    };
    expect(isSystemProtectedApp(app)).toBe(false);
    expect(isSystemProtectedApp({ ...app, isBackground: true })).toBe(true);
    expect(
      isSystemProtectedApp({
        name: "pb",
        path: "/System/Volumes/Preboot/whatever",
        isBackground: true,
      }),
    ).toBe(true);
    expect(
      isSystemProtectedApp({
        name: "ota",
        path: "/Library/Apple/System/Support",
        isBackground: true,
      }),
    ).toBe(true);
  });

  it("does not protect regular app paths", () => {
    expect(
      isSystemProtectedApp({
        name: "Chrome",
        path: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      }),
    ).toBe(false);
  });

  it("protects the screensaver engine bundle id", () => {
    expect(
      isSystemProtectedApp({
        name: "ScreenSaverEngine",
        bundleId: "com.apple.screensaver.engine",
      }),
    ).toBe(true);
  });
});
