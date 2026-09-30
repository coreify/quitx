import { describe, expect, it, vi } from "vitest";
import { parseCliArgs } from "../src/cli";
import {
  restartCommand,
  reopenApp,
  waitForAppTermination,
} from "../src/commands/restart";
import type { AppInfo } from "../src/types";

describe("Restart Command", () => {
  describe("parseCliArgs", () => {
    it("parses restart command and target apps", () => {
      const opts1 = parseCliArgs(["restart", "Discord"]);
      expect(opts1.command).toBe("restart");
      expect(opts1.restart).toBe(true);
      expect(opts1.apps).toEqual(["Discord"]);

      const opts2 = parseCliArgs(["restart", "Discord,Slack", "--force"]);
      expect(opts2.command).toBe("restart");
      expect(opts2.apps).toEqual(["Discord", "Slack"]);
      expect(opts2.force).toBe(true);

      const opts3 = parseCliArgs(["restart"]);
      expect(opts3.command).toBe("restart");
      expect(opts3.apps).toEqual([]);
    });

    it("rejects space-separated app list without commas in restart command", () => {
      expect(() => parseCliArgs(["restart", "Discord", "Slack"])).toThrow(
        /Multiple applications must be comma-separated/,
      );
    });
  });

  describe("reopenApp", () => {
    it("calls open with bundleId when available", async () => {
      const runner = vi.fn().mockResolvedValue(undefined);
      const app: AppInfo = {
        name: "Slack",
        bundleId: "com.tinyspeck.slackmacgap",
      };
      await reopenApp(app, runner);
      expect(runner).toHaveBeenCalledWith("open", [
        "-b",
        "com.tinyspeck.slackmacgap",
      ]);
    });

    it("calls open with -a when bundleId is missing", async () => {
      const runner = vi.fn().mockResolvedValue(undefined);
      const app: AppInfo = { name: "CustomApp" };
      await reopenApp(app, runner);
      expect(runner).toHaveBeenCalledWith("open", ["-a", "CustomApp"]);
    });

    it("handles execution failure during reopen", async () => {
      const runner = vi.fn().mockRejectedValue(new Error("Spawn error"));
      const app: AppInfo = { name: "FailedApp" };
      await expect(reopenApp(app, runner)).rejects.toThrow("Spawn error");
    });
  });

  describe("waitForAppTermination", () => {
    it("returns true when process stops running immediately", async () => {
      const checker = vi.fn().mockResolvedValue(false);
      const result = await waitForAppTermination(
        { name: "Discord" },
        500,
        10,
        checker,
      );
      expect(result).toBe(true);
    });

    it("returns false when process does not terminate within timeout", async () => {
      const checker = vi.fn().mockResolvedValue(true);
      const result = await waitForAppTermination(
        { name: "Discord" },
        50,
        10,
        checker,
      );
      expect(result).toBe(false);
    });
  });

  describe("restart execution flows", () => {
    it("quits and reopens target app", async () => {
      const reopenMock = vi.fn().mockResolvedValue(undefined);
      const waitMock = vi.fn().mockResolvedValue(true);

      const appsModule = await import("../src/macos/apps");
      const quitModule = await import("../src/macos/quit");

      vi.spyOn(appsModule, "getRunningApps").mockResolvedValue([
        { name: "Discord", bundleId: "com.discord.app", pid: 1234 },
      ]);
      const quitSpy = vi.spyOn(quitModule, "quitApp").mockResolvedValue({
        app: { name: "Discord", bundleId: "com.discord.app", pid: 1234 },
        success: true,
        forced: false,
      });

      const exitCode = await restartCommand(
        { apps: ["Discord"], yes: true, quiet: true },
        { reopen: reopenMock, wait: waitMock },
      );

      expect(exitCode).toBe(0);
      expect(quitSpy).toHaveBeenCalled();
      expect(waitMock).toHaveBeenCalled();
      expect(reopenMock).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Discord" }),
      );
    });

    it("supports dry-run mode without terminating or launching apps", async () => {
      const reopenMock = vi.fn().mockResolvedValue(undefined);
      const waitMock = vi.fn().mockResolvedValue(true);
      const appsModule = await import("../src/macos/apps");
      const quitModule = await import("../src/macos/quit");

      vi.spyOn(appsModule, "getRunningApps").mockResolvedValue([
        { name: "Discord", bundleId: "com.discord.app", pid: 1234 },
      ]);
      const quitSpy = vi.spyOn(quitModule, "quitApp");

      const exitCode = await restartCommand(
        { apps: ["Discord"], yes: true, dryRun: true, quiet: true },
        { reopen: reopenMock, wait: waitMock },
      );

      expect(exitCode).toBe(0);
      expect(quitSpy).not.toHaveBeenCalled();
      expect(reopenMock).not.toHaveBeenCalled();
    });

    it("handles no running apps found", async () => {
      const appsModule = await import("../src/macos/apps");
      vi.spyOn(appsModule, "getRunningApps").mockResolvedValue([]);

      const exitCode = await restartCommand({ quiet: true });
      expect(exitCode).toBe(0);

      const exitCodeJson = await restartCommand({ quiet: true, json: true });
      expect(exitCodeJson).toBe(0);
    });

    it("handles no matching target apps", async () => {
      const appsModule = await import("../src/macos/apps");
      vi.spyOn(appsModule, "getRunningApps").mockResolvedValue([
        { name: "Slack", bundleId: "com.tinyspeck.slackmacgap" },
      ]);

      const exitCode = await restartCommand({ apps: ["Discord"], quiet: true });
      expect(exitCode).toBe(0);

      const exitCodeJson = await restartCommand({
        apps: ["Discord"],
        quiet: true,
        json: true,
      });
      expect(exitCodeJson).toBe(0);
    });

    it("handles restart failure when app cannot be quit", async () => {
      const appsModule = await import("../src/macos/apps");
      const quitModule = await import("../src/macos/quit");
      const reopenMock = vi.fn().mockResolvedValue(undefined);
      const waitMock = vi.fn().mockResolvedValue(false);

      vi.spyOn(appsModule, "getRunningApps").mockResolvedValue([
        { name: "Discord", bundleId: "com.discord.app", pid: 1234 },
      ]);
      vi.spyOn(quitModule, "quitApp").mockResolvedValue({
        app: { name: "Discord", bundleId: "com.discord.app", pid: 1234 },
        success: false,
        forced: false,
        error: "Permission denied",
      });

      const exitCode = await restartCommand(
        { apps: ["Discord"], yes: true, quiet: true, json: true },
        { reopen: reopenMock, wait: waitMock },
      );

      expect(exitCode).toBe(0);
      expect(reopenMock).not.toHaveBeenCalled();
    });

    it("force-quits and reopens when quit fails and onQuitFailure is force", async () => {
      const appsModule = await import("../src/macos/apps");
      const quitModule = await import("../src/macos/quit");
      const reopenMock = vi.fn().mockResolvedValue(undefined);
      const waitMock = vi.fn().mockResolvedValue(true);

      vi.spyOn(appsModule, "getRunningApps").mockResolvedValue([
        { name: "Discord", bundleId: "com.discord.app", pid: 1234 },
      ]);
      vi.spyOn(quitModule, "quitApp").mockResolvedValue({
        app: { name: "Discord", bundleId: "com.discord.app", pid: 1234 },
        success: false,
        forced: false,
        error: "Unsaved prompt",
      });
      const forceSpy = vi
        .spyOn(quitModule, "forceQuitApp")
        .mockReturnValue(true);

      const exitCode = await restartCommand(
        {
          apps: ["Discord"],
          onQuitFailure: "force",
          yes: true,
          quiet: true,
          json: true,
        },
        { reopen: reopenMock, wait: waitMock },
      );

      expect(exitCode).toBe(0);
      expect(forceSpy).toHaveBeenCalled();
      expect(reopenMock).toHaveBeenCalled();
      forceSpy.mockRestore();
    });

    it("handles interactive selection cancellation", async () => {
      const appsModule = await import("../src/macos/apps");
      const selectorModule = await import("../src/ui/selector");

      vi.spyOn(appsModule, "getRunningApps").mockResolvedValue([
        { name: "Discord", pid: 101 },
      ]);
      vi.spyOn(selectorModule, "selectApps").mockResolvedValue(
        Symbol("cancel"),
      );

      const exitCode = await restartCommand({ quiet: true });
      expect(exitCode).toBe(0);
    });

    it("handles empty selection in interactive restart", async () => {
      const appsModule = await import("../src/macos/apps");
      const selectorModule = await import("../src/ui/selector");

      vi.spyOn(appsModule, "getRunningApps").mockResolvedValue([
        { name: "Discord", pid: 101 },
      ]);
      vi.spyOn(selectorModule, "selectApps").mockResolvedValue([]);

      const exitCode = await restartCommand({ quiet: true });
      expect(exitCode).toBe(0);
    });

    it("cancels when user rejects confirmation for 4+ apps", async () => {
      const appsModule = await import("../src/macos/apps");
      const selectorModule = await import("../src/ui/selector");

      const apps: AppInfo[] = [
        { name: "App1" },
        { name: "App2" },
        { name: "App3" },
        { name: "App4" },
      ];
      vi.spyOn(appsModule, "getRunningApps").mockResolvedValue(apps);
      vi.spyOn(selectorModule, "shouldConfirmQuit").mockResolvedValue(false);

      const exitCode = await restartCommand({
        apps: ["App1", "App2", "App3", "App4"],
        yes: false,
        quiet: true,
      });
      expect(exitCode).toBe(0);
    });
  });
});
