import { beforeEach, describe, expect, it, vi } from "vitest";
import { main } from "../src/cli";
import * as configModule from "../src/config";
import * as appsModule from "../src/macos/apps";
import * as quitModule from "../src/macos/quit";
import type { AppInfo, QuitxConfig } from "../src/types";

describe("E2E Integration: Features 1, 2 & 3", () => {
  let mockConfigState: QuitxConfig;

  beforeEach(() => {
    vi.clearAllMocks();
    mockConfigState = {
      exclude: [],
      force: "normal",
      includeFinder: false,
      includeTrash: false,
      includeBackground: false,
      groupBackground: true,
      defaultSelectAll: true,
      neverQuitMusic: false,
      musicApps: [],
      autoUpdate: true,
    };

    vi.spyOn(configModule, "loadConfig").mockImplementation(
      () => mockConfigState,
    );
    vi.spyOn(configModule, "saveConfig").mockImplementation(
      (cfg: QuitxConfig) => {
        mockConfigState = { ...cfg };
      },
    );
  });

  describe("Feature 1: --dry-run simulation mode", () => {
    it("simulates quitting apps end-to-end with --all --dry-run --yes", async () => {
      const mockRunning: AppInfo[] = [
        { name: "Slack", pid: 1001 },
        { name: "Spotify", pid: 1002 },
      ];
      vi.spyOn(appsModule, "getRunningApps").mockResolvedValue(mockRunning);
      const quitSpy = vi.spyOn(quitModule, "quitApps");

      const exitCode = await main(["--all", "--dry-run", "--yes"]);

      expect(exitCode).toBe(0);
      expect(quitSpy).toHaveBeenCalledWith(
        mockRunning,
        expect.objectContaining({ dryRun: true }),
      );
    });

    it("simulates quitting specific app with --dry-run --yes", async () => {
      const mockRunning: AppInfo[] = [{ name: "Discord", pid: 2001 }];
      vi.spyOn(appsModule, "getRunningApps").mockResolvedValue(mockRunning);
      const quitSpy = vi.spyOn(quitModule, "quitApps");

      const exitCode = await main(["Discord", "--dry-run", "--yes"]);

      expect(exitCode).toBe(0);
      expect(quitSpy).toHaveBeenCalledWith(
        mockRunning,
        expect.objectContaining({ dryRun: true }),
      );
    });
  });

  describe("Feature 2: Non-interactive config CLI (show, get, set, reset)", () => {
    it("runs set, get, show, and reset end-to-end via main()", async () => {
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      // 1. set force mode
      const setCode = await main(["config", "set", "force", "force"]);
      expect(setCode).toBe(0);
      expect(mockConfigState.force).toBe("force");

      // 2. get force mode
      const getCode = await main(["config", "get", "force"]);
      expect(getCode).toBe(0);
      expect(logSpy).toHaveBeenCalledWith("force");

      // 3. show config in json format
      logSpy.mockClear();
      const showCode = await main(["config", "show", "--json"]);
      expect(showCode).toBe(0);
      const output = JSON.parse(
        String(logSpy.mock.calls[0]?.[0] ?? "{}"),
      ) as Record<string, unknown>;
      expect(output["force"]).toBe("force");

      // 4. reset config with -y flag
      const resetCode = await main(["config", "reset", "-y"]);
      expect(resetCode).toBe(0);
      expect(mockConfigState.force).toBe(configModule.DEFAULT_CONFIG.force);

      logSpy.mockRestore();
    });
  });

  describe("Feature 3: autoUpdate configuration toggle", () => {
    it("toggles autoUpdate setting via CLI and respects disabled state", async () => {
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      // 1. disable autoUpdate via config set
      const disableCode = await main(["config", "set", "autoUpdate", "false"]);
      expect(disableCode).toBe(0);
      expect(mockConfigState.autoUpdate).toBe(false);

      // 2. verify autoUpdate reads false via config get
      logSpy.mockClear();
      const getCode = await main(["config", "get", "autoUpdate"]);
      expect(getCode).toBe(0);
      expect(logSpy).toHaveBeenCalledWith("false");

      // 3. verify autoUpdate check is skipped when autoUpdate is false
      const updateModule = await import("../src/update");
      const checkForUpdateSpy = vi.spyOn(updateModule, "checkForUpdate");

      vi.spyOn(appsModule, "getRunningApps").mockResolvedValue([]);
      await main(["--all", "--yes"]);
      expect(checkForUpdateSpy).not.toHaveBeenCalled();

      // 4. re-enable autoUpdate via config set
      const enableCode = await main(["config", "set", "autoUpdate", "true"]);
      expect(enableCode).toBe(0);
      expect(mockConfigState.autoUpdate).toBe(true);

      logSpy.mockRestore();
      checkForUpdateSpy.mockRestore();
    });
  });

  describe("Feature 4: --keep and --except end-to-end integration", () => {
    it("respects --keep flag when quitting all apps", async () => {
      const mockRunning: AppInfo[] = [
        { name: "Slack", pid: 101 },
        { name: "Spotify", pid: 102 },
      ];
      vi.spyOn(appsModule, "getRunningApps").mockResolvedValue(mockRunning);
      vi.spyOn(quitModule, "quitApps").mockResolvedValue([]);

      const exitCode = await main(["--all", "--keep", "Spotify", "--yes"]);
      expect(exitCode).toBe(0);
      expect(appsModule.getRunningApps).toHaveBeenCalledWith(
        expect.objectContaining({ keep: ["Spotify"] }),
      );
    });

    it("respects --except alias when quitting all apps", async () => {
      const mockRunning: AppInfo[] = [
        { name: "Slack", pid: 101 },
        { name: "Spotify", pid: 102 },
      ];
      vi.spyOn(appsModule, "getRunningApps").mockResolvedValue(mockRunning);
      vi.spyOn(quitModule, "quitApps").mockResolvedValue([]);

      const exitCode = await main(["--all", "--except", "Slack", "--yes"]);
      expect(exitCode).toBe(0);
      expect(appsModule.getRunningApps).toHaveBeenCalledWith(
        expect.objectContaining({ keep: ["Slack"] }),
      );
    });
  });

  describe("Feature 5: --sort memory integration with --list", () => {
    it("lists apps sorted by memory consumption", async () => {
      const mockRunning: AppInfo[] = [
        { name: "LightApp", pid: 1, memoryBytes: 10 * 1024 * 1024 },
        { name: "HeavyApp", pid: 2, memoryBytes: 500 * 1024 * 1024 },
      ];
      vi.spyOn(appsModule, "getRunningApps").mockResolvedValue(mockRunning);

      const exitCode = await main(["--list", "--sort", "memory"]);
      expect(exitCode).toBe(0);
      expect(appsModule.getRunningApps).toHaveBeenCalledWith(
        expect.objectContaining({
          sortBy: "memory",
          includeMemory: true,
        }),
      );
    });
  });

  describe("Feature 6: Stash & Restore CLI integration", () => {
    it("runs stash --dry-run without saving data", async () => {
      const saveStashSpy = vi.spyOn(configModule, "saveStash");
      vi.spyOn(appsModule, "getRunningApps").mockResolvedValue([
        { name: "Slack", pid: 101 },
      ]);

      const exitCode = await main(["stash", "--dry-run", "--yes"]);
      expect(exitCode).toBe(0);
      expect(saveStashSpy).not.toHaveBeenCalled();
    });

    it("runs restore --dry-run without clearing stash", async () => {
      vi.spyOn(configModule, "loadStash").mockReturnValue({
        timestamp: "2026-01-01",
        apps: [{ name: "Slack" }],
      });
      const clearStashSpy = vi.spyOn(configModule, "clearStash");

      const exitCode = await main(["restore", "--dry-run", "--yes"]);
      expect(exitCode).toBe(0);
      expect(clearStashSpy).not.toHaveBeenCalled();
    });
  });

  describe("Feature 7: Restart CLI integration", () => {
    it("simulates restart with --dry-run and positional apps without quitting apps", async () => {
      vi.spyOn(appsModule, "getRunningApps").mockResolvedValue([
        { name: "Discord", pid: 201 },
      ]);
      const quitSpy = vi.spyOn(quitModule, "quitApp");

      const exitCode = await main(["restart", "Discord", "--dry-run", "--yes"]);
      expect(exitCode).toBe(0);
      expect(quitSpy).not.toHaveBeenCalled();
    });
  });
});
