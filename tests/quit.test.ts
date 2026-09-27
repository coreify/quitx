import { describe, expect, it, vi } from "vitest";
import {
  forceQuitApp,
  getQuitScript,
  quitApp,
  quitApps,
  sendQuitSignal,
} from "../src/macos/quit";
import type { AppInfo } from "../src/types";

describe("quit service", () => {
  it("generates quit script by bundleId when available", () => {
    const app: AppInfo = {
      name: "Spotify",
      bundleId: "com.spotify.client",
    };
    expect(getQuitScript(app)).toBe(
      'tell application id "com.spotify.client" to quit',
    );
  });

  it("generates quit script by name when bundleId missing", () => {
    const app: AppInfo = { name: 'My "Special" App' };
    expect(getQuitScript(app)).toBe(
      'tell application "My \\"Special\\" App" to quit',
    );
  });

  it("sendQuitSignal falls back to app name if bundleId script errors", async () => {
    const mockExecutor = vi
      .fn()
      .mockRejectedValueOnce(new Error("Unknown bundle identifier"))
      .mockResolvedValueOnce({ stdout: "" });

    const app: AppInfo = {
      name: "Spotify",
      bundleId: "invalid.bundle.id",
    };

    await expect(sendQuitSignal(app, mockExecutor)).resolves.not.toThrow();
    expect(mockExecutor).toHaveBeenCalledTimes(2);
    expect(mockExecutor).toHaveBeenLastCalledWith("osascript", [
      "-e",
      'tell application "Spotify" to quit',
    ]);
  });

  it("forceQuitApp calls SIGKILL when pid is present", () => {
    const killSpy = vi.spyOn(process, "kill").mockReturnValue(true as never);
    const app: AppInfo = { name: "TestApp", pid: 98765 };

    const result = forceQuitApp(app);
    expect(result).toBe(true);
    expect(killSpy).toHaveBeenCalledWith(98765, "SIGKILL");
    killSpy.mockRestore();
  });

  it("forceQuitApp returns false when pid is missing", () => {
    const app: AppInfo = { name: "NoPidApp" };
    expect(forceQuitApp(app)).toBe(false);
  });

  it("quitApp succeeds when app exits after quit event", async () => {
    const mockExecutor = vi.fn().mockImplementation((cmd, args) => {
      const script = args[1] as string;
      if (script.includes("return (exists")) {
        return Promise.resolve({ stdout: "false" }); // not running
      }
      return Promise.resolve({ stdout: "" });
    });

    const app: AppInfo = { name: "Slack", bundleId: "com.tinyspeck.slack" };
    const res = await quitApp(app, { timeoutMs: 1 }, mockExecutor);

    expect(res.success).toBe(true);
    expect(res.forced).toBe(false);
  });

  it("quitApp reports error when app remains open and force is false", async () => {
    const mockExecutor = vi.fn().mockImplementation((cmd, args) => {
      const script = args[1] as string;
      if (script.includes("return (exists")) {
        return Promise.resolve({ stdout: "true" }); // still running
      }
      return Promise.resolve({ stdout: "" });
    });

    const app: AppInfo = { name: "TextEdit" };
    const res = await quitApp(app, { timeoutMs: 1, force: false }, mockExecutor);

    expect(res.success).toBe(false);
    expect(res.forced).toBe(false);
    expect(res.error).toContain("App is still running");
  });

  it("quitApp escalates to force quit when requested", async () => {
    let checkCount = 0;
    const mockExecutor = vi.fn().mockImplementation((cmd, args) => {
      const script = args[1] as string;
      if (script.includes("return (exists")) {
        checkCount++;
        // First check: still running; after force quit: dead
        return Promise.resolve({ stdout: checkCount === 1 ? "true" : "false" });
      }
      return Promise.resolve({ stdout: "" });
    });

    const killSpy = vi.spyOn(process, "kill").mockReturnValue(true as never);
    const app: AppInfo = { name: "StubbornApp", pid: 12345 };

    const res = await quitApp(app, { timeoutMs: 1, force: true }, mockExecutor);

    expect(res.success).toBe(true);
    expect(res.forced).toBe(true);
    killSpy.mockRestore();
  });

  it("quitApps quits multiple apps in parallel", async () => {
    const mockExecutor = vi.fn().mockImplementation((cmd, args) => {
      const script = args[1] as string;
      if (script.includes("return (exists")) {
        return Promise.resolve({ stdout: "false" });
      }
      return Promise.resolve({ stdout: "" });
    });

    const apps: AppInfo[] = [
      { name: "AppOne", bundleId: "com.app.one" },
      { name: "AppTwo", bundleId: "com.app.two" },
    ];

    const results = await quitApps(apps, { timeoutMs: 1 }, mockExecutor);
    expect(results).toHaveLength(2);
    expect(results.every((r) => r.success)).toBe(true);
  });

  it("quitApps returns empty array if no apps passed", async () => {
    expect(await quitApps([])).toEqual([]);
  });
});
