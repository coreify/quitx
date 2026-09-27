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

  it("sendQuitSignal rethrows error when app name script errors and no bundleId", async () => {
    const mockExecutor = vi
      .fn()
      .mockRejectedValue(new Error("Generic osascript error"));
    const app: AppInfo = { name: "DirectApp" };

    await expect(sendQuitSignal(app, mockExecutor)).rejects.toThrow(
      "Generic osascript error",
    );
  });

  it("forceQuitApp calls SIGKILL when pid is present", () => {
    const killSpy = vi.spyOn(process, "kill").mockReturnValue(true as never);
    const app: AppInfo = { name: "TestApp", pid: 98765 };

    const result = forceQuitApp(app);
    expect(result).toBe(true);
    expect(killSpy).toHaveBeenCalledWith(98765, "SIGKILL");
    killSpy.mockRestore();
  });

  it("forceQuitApp returns false when pid is missing or <= 0", () => {
    expect(forceQuitApp({ name: "NoPidApp" })).toBe(false);
    expect(forceQuitApp({ name: "InvalidPid", pid: 0 })).toBe(false);
    expect(forceQuitApp({ name: "NegativePid", pid: -1 })).toBe(false);
  });

  it("forceQuitApp catches errors when process.kill fails", () => {
    const killSpy = vi.spyOn(process, "kill").mockImplementation(() => {
      throw new Error("EPERM");
    });
    const app: AppInfo = { name: "PermApp", pid: 1111 };

    expect(forceQuitApp(app)).toBe(false);
    killSpy.mockRestore();
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
    const res = await quitApp(
      app,
      { timeoutMs: 1, force: false },
      mockExecutor,
    );

    expect(res.success).toBe(false);
    expect(res.forced).toBe(false);
    expect(res.error).toContain("App is still running");
  });

  it("quitApp handles sendQuitSignal failure and force quit immediately", async () => {
    let alive = true;
    const killSpy = vi.spyOn(process, "kill").mockImplementation((pid, sig) => {
      if (sig === "SIGKILL") {
        alive = false;
        return true as never;
      }
      if (sig === 0) {
        if (!alive) {
          const err = new Error("No such process");
          (err as unknown as { code: string }).code = "ESRCH";
          throw err;
        }
        return true as never;
      }
      return true as never;
    });

    const mockExecutor = vi.fn().mockRejectedValue(new Error("Send failed"));
    const app: AppInfo = { name: "ErrorApp", pid: 4444 };

    const res = await quitApp(app, { timeoutMs: 1, force: true }, mockExecutor);
    expect(res.success).toBe(true);
    expect(res.forced).toBe(true);
    killSpy.mockRestore();
  });

  it("quitApp handles sendQuitSignal failure without force", async () => {
    const mockExecutor = vi.fn().mockRejectedValue(new Error("Send failed"));
    const app: AppInfo = { name: "ErrorApp" };

    const res = await quitApp(
      app,
      { timeoutMs: 1, force: false },
      mockExecutor,
    );
    expect(res.success).toBe(false);
    expect(res.forced).toBe(false);
    expect(res.error).toBe("Send failed");
  });

  it("quitApp escalates to force quit when requested", async () => {
    let alive = true;
    const killSpy = vi.spyOn(process, "kill").mockImplementation((pid, sig) => {
      if (sig === "SIGKILL") {
        alive = false;
        return true as never;
      }
      if (sig === 0) {
        if (!alive) {
          const err = new Error("No such process");
          (err as unknown as { code: string }).code = "ESRCH";
          throw err;
        }
        return true as never;
      }
      return true as never;
    });

    const mockExecutor = vi.fn().mockResolvedValue({ stdout: "" });
    const app: AppInfo = { name: "StubbornApp", pid: 12345 };

    const res = await quitApp(app, { timeoutMs: 1, force: true }, mockExecutor);

    expect(res.success).toBe(true);
    expect(res.forced).toBe(true);
    killSpy.mockRestore();
  });

  it("quitApp fails when force quit cannot terminate the process", async () => {
    const killSpy = vi.spyOn(process, "kill").mockImplementation(() => {
      const err = new Error("EPERM");
      (err as unknown as { code: string }).code = "EPERM";
      throw err;
    });
    const mockExecutor = vi.fn().mockImplementation((cmd, args) => {
      const script = args[1] as string;
      if (script.includes("return (exists")) {
        return Promise.resolve({ stdout: "true" });
      }
      return Promise.resolve({ stdout: "" });
    });
    const app: AppInfo = { name: "Unkillable", pid: 9999 };

    const res = await quitApp(app, { timeoutMs: 1, force: true }, mockExecutor);
    expect(res.success).toBe(false);
    expect(res.forced).toBe(true);
    expect(res.error).toContain("Force quit signal sent");
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

  it("quitApps handles force quit across multiple apps", async () => {
    let alive = true;
    const killSpy = vi.spyOn(process, "kill").mockImplementation((pid, sig) => {
      if (sig === "SIGKILL") {
        alive = false;
        return true as never;
      }
      if (sig === 0) {
        if (!alive) {
          const err = new Error("No such process");
          (err as unknown as { code: string }).code = "ESRCH";
          throw err;
        }
        return true as never;
      }
      return true as never;
    });

    const mockExecutor = vi.fn().mockImplementation((cmd, args) => {
      const script = args[1] as string;
      if (script.includes("return (exists")) {
        return Promise.resolve({ stdout: alive ? "true" : "false" });
      }
      return Promise.resolve({ stdout: "" });
    });

    const apps: AppInfo[] = [{ name: "ForcedApp", pid: 5555 }];
    const results = await quitApps(
      apps,
      { timeoutMs: 1, force: true },
      mockExecutor,
    );

    expect(results[0]?.success).toBe(true);
    expect(results[0]?.forced).toBe(true);
    killSpy.mockRestore();
  });

  it("quitApps returns empty array if no apps passed", async () => {
    expect(await quitApps([])).toEqual([]);
  });
});
