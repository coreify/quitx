import { beforeEach, describe, expect, it, vi } from "vitest";
import { parseCliArgs } from "../src/cli";
import * as configModule from "../src/config";
import { stashCommand } from "../src/commands/stash";
import { restoreCommand, reopenStashedApp } from "../src/commands/restore";
import type { AppInfo, StashAppEntry, StashData } from "../src/types";

const mockConfirm = vi.fn<(...args: unknown[]) => Promise<boolean | symbol>>();

vi.mock("@clack/prompts", () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  cancel: vi.fn(),
  confirm: (...args: unknown[]) => mockConfirm(...args),
  isCancel: (val: unknown): boolean => typeof val === "symbol",
  spinner: () => ({
    start: vi.fn(),
    stop: vi.fn(),
  }),
  log: {
    warn: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe("Stash & Restore Commands", () => {
  let mockStash: StashData | null = null;

  beforeEach(() => {
    mockStash = null;
    mockConfirm.mockReset();
    vi.spyOn(configModule, "saveStash").mockImplementation((data) => {
      mockStash = data;
    });
    vi.spyOn(configModule, "loadStash").mockImplementation(() => mockStash);
    vi.spyOn(configModule, "clearStash").mockImplementation(() => {
      mockStash = null;
    });
  });

  describe("parseCliArgs", () => {
    it("parses stash and restore commands", () => {
      expect(parseCliArgs(["stash"]).command).toBe("stash");
      expect(parseCliArgs(["restore"]).command).toBe("restore");
    });

    it("parses stash with flags", () => {
      const opts = parseCliArgs(["stash", "-y", "--dry-run", "--json"]);
      expect(opts.command).toBe("stash");
      expect(opts.yes).toBe(true);
      expect(opts.dryRun).toBe(true);
      expect(opts.json).toBe(true);
    });
  });

  describe("reopenStashedApp in restore", () => {
    it("calls runner with -b when bundleId is present", async () => {
      const runner = vi.fn().mockResolvedValue(undefined);
      const app: StashAppEntry = { name: "Slack", bundleId: "com.slack" };
      await reopenStashedApp(app, runner);
      expect(runner).toHaveBeenCalledWith("open", ["-b", "com.slack"]);
    });

    it("calls runner with -a when bundleId is missing", async () => {
      const runner = vi.fn().mockResolvedValue(undefined);
      const app: StashAppEntry = { name: "Slack" };
      await reopenStashedApp(app, runner);
      expect(runner).toHaveBeenCalledWith("open", ["-a", "Slack"]);
    });
  });

  describe("stashCommand", () => {
    it("saves running apps to stash and quits them", async () => {
      const appsModule = await import("../src/macos/apps");
      const quitModule = await import("../src/macos/quit");

      const runningApps: AppInfo[] = [
        { name: "Chrome", bundleId: "com.google.Chrome", pid: 101 },
        { name: "Slack", bundleId: "com.tinyspeck.slackmacgap", pid: 102 },
      ];
      vi.spyOn(appsModule, "getRunningApps").mockResolvedValue(runningApps);
      const quitSpy = vi.spyOn(quitModule, "quitApps").mockResolvedValue([
        { app: runningApps[0]!, success: true, forced: false },
        { app: runningApps[1]!, success: true, forced: false },
      ]);

      const exitCode = await stashCommand({ yes: true, quiet: true });
      expect(exitCode).toBe(0);
      expect(mockStash).not.toBeNull();
      expect(mockStash?.apps).toEqual([
        { name: "Chrome", bundleId: "com.google.Chrome" },
        { name: "Slack", bundleId: "com.tinyspeck.slackmacgap" },
      ]);
      expect(quitSpy).toHaveBeenCalledWith(runningApps, expect.anything());
    });

    it("handles dry-run without saving or quitting", async () => {
      const appsModule = await import("../src/macos/apps");
      vi.spyOn(appsModule, "getRunningApps").mockResolvedValue([
        { name: "Chrome", bundleId: "com.google.Chrome", pid: 101 },
      ]);

      const exitCode = await stashCommand({
        dryRun: true,
        yes: true,
        quiet: true,
      });
      expect(exitCode).toBe(0);
      expect(mockStash).toBeNull();
    });

    it("handles no running apps found", async () => {
      const appsModule = await import("../src/macos/apps");
      vi.spyOn(appsModule, "getRunningApps").mockResolvedValue([]);

      const exitCode = await stashCommand({ quiet: true });
      expect(exitCode).toBe(0);

      const exitCodeJson = await stashCommand({ quiet: true, json: true });
      expect(exitCodeJson).toBe(0);
    });

    it("supports json mode output", async () => {
      const appsModule = await import("../src/macos/apps");
      const quitModule = await import("../src/macos/quit");

      const app: AppInfo = {
        name: "Chrome",
        bundleId: "com.google.Chrome",
        pid: 101,
      };
      vi.spyOn(appsModule, "getRunningApps").mockResolvedValue([app]);
      vi.spyOn(quitModule, "quitApps").mockResolvedValue([
        { app, success: true, forced: false },
      ]);

      const exitCode = await stashCommand({
        json: true,
        quiet: true,
        yes: true,
      });
      expect(exitCode).toBe(0);
    });

    it("cancels stash when user rejects confirmation", async () => {
      const appsModule = await import("../src/macos/apps");
      vi.spyOn(appsModule, "getRunningApps").mockResolvedValue([
        { name: "Chrome", pid: 101 },
      ]);
      mockConfirm.mockResolvedValue(false);

      const exitCode = await stashCommand({ quiet: true, yes: false });
      expect(exitCode).toBe(0);
      expect(mockStash).toBeNull();
    });

    it("cancels stash when confirmation is aborted with cancel symbol", async () => {
      const appsModule = await import("../src/macos/apps");
      vi.spyOn(appsModule, "getRunningApps").mockResolvedValue([
        { name: "Chrome", pid: 101 },
      ]);
      mockConfirm.mockResolvedValue(Symbol("cancel"));

      const exitCode = await stashCommand({ quiet: true, yes: false });
      expect(exitCode).toBe(0);
      expect(mockStash).toBeNull();
    });
  });

  describe("restoreCommand", () => {
    it("reopens previously stashed apps and clears stash", async () => {
      mockStash = {
        timestamp: new Date().toISOString(),
        apps: [
          { name: "Chrome", bundleId: "com.google.Chrome" },
          { name: "Slack", bundleId: "com.tinyspeck.slackmacgap" },
        ],
      };

      const reopenMock = vi.fn().mockResolvedValue(undefined);
      const exitCode = await restoreCommand(
        { yes: true, quiet: true },
        { reopen: reopenMock },
      );

      expect(exitCode).toBe(0);
      expect(reopenMock).toHaveBeenCalledTimes(2);
      expect(mockStash).toBeNull();
    });

    it("handles empty or missing stash gracefully", async () => {
      mockStash = null;
      const exitCode = await restoreCommand({ quiet: true });
      expect(exitCode).toBe(0);

      const exitCodeJson = await restoreCommand({ quiet: true, json: true });
      expect(exitCodeJson).toBe(0);
    });

    it("supports json output on restore", async () => {
      mockStash = {
        timestamp: new Date().toISOString(),
        apps: [{ name: "Chrome", bundleId: "com.google.Chrome" }],
      };

      const reopenMock = vi.fn().mockResolvedValue(undefined);
      const exitCode = await restoreCommand(
        { json: true, quiet: true, yes: true },
        { reopen: reopenMock },
      );

      expect(exitCode).toBe(0);
    });

    it("handles app reopen failure gracefully", async () => {
      mockStash = {
        timestamp: new Date().toISOString(),
        apps: [{ name: "FailingApp" }],
      };

      const reopenMock = vi.fn().mockRejectedValue(new Error("Cannot launch"));
      const exitCode = await restoreCommand(
        { json: true, quiet: true, yes: true },
        { reopen: reopenMock },
      );

      expect(exitCode).toBe(0);
    });

    it("cancels restore when user rejects interactive prompt", async () => {
      mockStash = {
        timestamp: new Date().toISOString(),
        apps: [{ name: "Chrome" }],
      };

      mockConfirm.mockResolvedValue(false);

      const exitCode = await restoreCommand({ quiet: true, yes: false });
      expect(exitCode).toBe(0);
      expect(mockStash).not.toBeNull();
    });

    it("handles dry-run restore without clearing stash or launching apps", async () => {
      mockStash = {
        timestamp: new Date().toISOString(),
        apps: [{ name: "Chrome" }],
      };

      const reopenMock = vi.fn().mockResolvedValue(undefined);
      const exitCode = await restoreCommand(
        { dryRun: true, yes: true, quiet: true },
        { reopen: reopenMock },
      );

      expect(exitCode).toBe(0);
      expect(reopenMock).not.toHaveBeenCalled();
      expect(mockStash).not.toBeNull();
    });
  });
});
