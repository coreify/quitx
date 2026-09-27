import { describe, expect, it, vi } from "vitest";
import type { ScriptExecutor } from "../src/macos/osascript";
import {
  forceQuitApp,
  quitApp,
  quitApps,
  sendQuitSignal,
} from "../src/macos/quit";
import type { AppInfo } from "../src/types";

function createScriptMock(
  handler: (script: string) => boolean,
): ScriptExecutor {
  return vi.fn().mockImplementation((_cmd: string, args: readonly string[]) => {
    const script = args[3] ?? "";
    if (script.includes(".terminate()")) {
      return Promise.resolve({ stdout: "true" });
    }
    return Promise.resolve({ stdout: handler(script) ? "true" : "false" });
  });
}

describe("quit service", () => {
  it("sendQuitSignal resolves when terminate returns true", async () => {
    const mockExecutor: ScriptExecutor = vi.fn().mockResolvedValue({
      stdout: "true",
    });

    const app: AppInfo = {
      name: "Spotify",
      bundleId: "com.spotify.client",
    };

    await expect(sendQuitSignal(app, mockExecutor)).resolves.toBeUndefined();
    expect(mockExecutor).toHaveBeenCalledWith("osascript", [
      "-l",
      "JavaScript",
      "-e",
      expect.stringContaining("terminate()"),
      "com.spotify.client",
      "Spotify",
    ]);
  });

  it("sendQuitSignal throws when terminate returns false", async () => {
    const mockExecutor: ScriptExecutor = vi.fn().mockResolvedValue({
      stdout: "false",
    });
    const app: AppInfo = { name: "DirectApp" };

    await expect(sendQuitSignal(app, mockExecutor)).rejects.toThrow(
      'Could not quit "DirectApp"',
    );
  });

  it("forceQuitApp calls SIGKILL when pid is present", () => {
    const killSpy = vi.spyOn(process, "kill").mockReturnValue(true);
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
    const mockExecutor = createScriptMock(() => false);
    const app: AppInfo = { name: "Slack", bundleId: "com.tinyspeck.slack" };
    const res = await quitApp(app, { timeoutMs: 1 }, mockExecutor);

    expect(res.success).toBe(true);
    expect(res.forced).toBe(false);
  });

  it("quitApp reports error when app remains open and force is false", async () => {
    const mockExecutor = createScriptMock(() => true);
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
    const killSpy = vi
      .spyOn(process, "kill")
      .mockImplementation((_pid, sig) => {
        if (sig === "SIGKILL") {
          alive = false;
          return true;
        }
        if (sig === 0) {
          if (!alive) {
            const err = new Error("No such process");
            (err as unknown as { code: string }).code = "ESRCH";
            throw err;
          }
          return true;
        }
        return true;
      });

    const mockExecutor: ScriptExecutor = vi
      .fn()
      .mockRejectedValue(new Error("Send failed"));
    const app: AppInfo = { name: "ErrorApp", pid: 4444 };

    const res = await quitApp(app, { timeoutMs: 1, force: true }, mockExecutor);
    expect(res.success).toBe(true);
    expect(res.forced).toBe(true);
    killSpy.mockRestore();
  });

  it("quitApp handles sendQuitSignal failure without force", async () => {
    const mockExecutor: ScriptExecutor = vi
      .fn()
      .mockRejectedValue(new Error("Send failed"));
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
    const killSpy = vi
      .spyOn(process, "kill")
      .mockImplementation((_pid, sig) => {
        if (sig === "SIGKILL") {
          alive = false;
          return true;
        }
        if (sig === 0) {
          if (!alive) {
            const err = new Error("No such process");
            (err as unknown as { code: string }).code = "ESRCH";
            throw err;
          }
          return true;
        }
        return true;
      });

    const mockExecutor: ScriptExecutor = vi
      .fn()
      .mockResolvedValue({ stdout: "" });
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
    const mockExecutor = createScriptMock(() => true);
    const app: AppInfo = { name: "Unkillable", pid: 9999 };

    const res = await quitApp(app, { timeoutMs: 1, force: true }, mockExecutor);
    expect(res.success).toBe(false);
    expect(res.forced).toBe(true);
    expect(res.error).toContain("Force quit signal sent");
    killSpy.mockRestore();
  });

  it("quitApps quits multiple apps in parallel", async () => {
    const mockExecutor = createScriptMock(() => false);
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
    const killSpy = vi
      .spyOn(process, "kill")
      .mockImplementation((_pid, sig) => {
        if (sig === "SIGKILL") {
          alive = false;
          return true;
        }
        if (sig === 0) {
          if (!alive) {
            const err = new Error("No such process");
            (err as unknown as { code: string }).code = "ESRCH";
            throw err;
          }
          return true;
        }
        return true;
      });

    const mockExecutor: ScriptExecutor = vi.fn().mockImplementation(() => {
      return Promise.resolve({ stdout: alive ? "true" : "false" });
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

  it("quitApps quits other apps first and defers current terminal app", async () => {
    const origTerm = process.env["TERM_PROGRAM"];
    process.env["TERM_PROGRAM"] = "Apple_Terminal";

    try {
      const callOrder: string[] = [];
      const mockExecutor: ScriptExecutor = vi
        .fn()
        .mockImplementation((_cmd: string, args: readonly string[]) => {
          if (args.includes("Google Chrome")) {
            callOrder.push("Chrome");
          }
          return Promise.resolve({ stdout: "false" });
        });

      const deferredCalls: { app: AppInfo; force: boolean }[] = [];
      const mockDeferred = (app: AppInfo, force: boolean) => {
        callOrder.push(app.name);
        deferredCalls.push({ app, force });
      };

      const terminalApp: AppInfo = {
        name: "Terminal",
        bundleId: "com.apple.terminal",
        pid: 1234,
      };
      const chromeApp: AppInfo = {
        name: "Google Chrome",
        bundleId: "com.google.Chrome",
        pid: 2345,
      };

      const results = await quitApps(
        [terminalApp, chromeApp],
        { timeoutMs: 1 },
        mockExecutor,
        mockDeferred,
      );

      expect(callOrder).toEqual(["Chrome", "Terminal"]);
      expect(deferredCalls).toHaveLength(1);
      expect(deferredCalls[0]?.app.name).toBe("Terminal");
      expect(results).toHaveLength(2);
      expect(results.every((r) => r.success)).toBe(true);
    } finally {
      if (origTerm === undefined) {
        delete process.env["TERM_PROGRAM"];
      } else {
        process.env["TERM_PROGRAM"] = origTerm;
      }
    }
  });

  it("quitApp defers current terminal app immediately", async () => {
    const origTerm = process.env["TERM_PROGRAM"];
    process.env["TERM_PROGRAM"] = "Apple_Terminal";

    try {
      const deferredCalls: { app: AppInfo; force: boolean }[] = [];
      const mockDeferred = (app: AppInfo, force: boolean) => {
        deferredCalls.push({ app, force });
      };

      const terminalApp: AppInfo = {
        name: "Terminal",
        bundleId: "com.apple.terminal",
        pid: 1234,
      };

      const res = await quitApp(
        terminalApp,
        { force: true },
        undefined,
        mockDeferred,
      );

      expect(res.success).toBe(true);
      expect(res.forced).toBe(true);
      expect(deferredCalls).toHaveLength(1);
      expect(deferredCalls[0]?.force).toBe(true);
    } finally {
      if (origTerm === undefined) {
        delete process.env["TERM_PROGRAM"];
      } else {
        process.env["TERM_PROGRAM"] = origTerm;
      }
    }
  });

  it("quitApp empties Trash when app is Trash", async () => {
    const mockExecutor: ScriptExecutor = vi
      .fn()
      .mockResolvedValue({ stdout: "" });
    const trashApp: AppInfo = {
      name: "Trash",
      bundleId: "com.apple.trash",
    };

    const res = await quitApp(trashApp, {}, mockExecutor);
    expect(res.success).toBe(true);
    expect(res.forced).toBe(false);
    expect(mockExecutor).toHaveBeenCalledWith(
      "osascript",
      expect.arrayContaining(["-e"]),
    );
  });
});
