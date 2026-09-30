import { beforeEach, describe, expect, it, vi } from "vitest";

const mockIntro = vi.fn<(...args: unknown[]) => void>();
const mockOutro = vi.fn<(...args: unknown[]) => void>();
const mockSelect =
  vi.fn<(...args: unknown[]) => Promise<string | symbol | boolean>>();
const mockMultiselect =
  vi.fn<(...args: unknown[]) => Promise<string[] | symbol>>();
const mockLogInfo = vi.fn<(...args: unknown[]) => void>();
const mockLogSuccess = vi.fn<(...args: unknown[]) => void>();

vi.mock("@clack/prompts", () => ({
  intro: (...args: unknown[]) => {
    mockIntro(...args);
  },
  outro: (...args: unknown[]) => {
    mockOutro(...args);
  },
  cancel: vi.fn(),
  select: (...args: unknown[]) => mockSelect(...args),
  multiselect: (...args: unknown[]) => mockMultiselect(...args),
  isCancel: (val: unknown): boolean => typeof val === "symbol",
  log: {
    info: (...args: unknown[]) => mockLogInfo(...args),
    success: (...args: unknown[]) => mockLogSuccess(...args),
    warn: vi.fn(),
    error: vi.fn(),
    message: vi.fn(),
    step: vi.fn(),
  },
  spinner: () => ({ start: vi.fn(), stop: vi.fn() }),
}));

import { configCommand, handleConfigCli } from "../src/commands/config";
import * as configModule from "../src/config";
import * as appsModule from "../src/macos/apps";
import type { QuitxConfig } from "../src/types";

const fullConfig = (overrides: Partial<QuitxConfig> = {}): QuitxConfig => ({
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
  onQuitFailure: "prompt",
  ...overrides,
});

describe("config command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exits on cancel from main menu", async () => {
    vi.spyOn(configModule, "loadConfig").mockReturnValue(fullConfig());
    mockSelect.mockResolvedValueOnce(Symbol("cancel"));

    const code = await configCommand();
    expect(code).toBe(0);
    expect(mockOutro).toHaveBeenCalledWith("Config saved.");
  });

  it("exits when user selects exit", async () => {
    vi.spyOn(configModule, "loadConfig").mockReturnValue(fullConfig());
    mockSelect.mockResolvedValueOnce("exit");

    const code = await configCommand();
    expect(code).toBe(0);
    expect(mockOutro).toHaveBeenCalledWith("Config saved.");
  });

  it("toggles quit mode to force", async () => {
    vi.spyOn(configModule, "loadConfig").mockReturnValue(fullConfig());
    const saveSpy = vi
      .spyOn(configModule, "saveConfig")
      .mockImplementation(() => {});

    mockSelect
      .mockResolvedValueOnce("quit-mode")
      .mockResolvedValueOnce("force")
      .mockResolvedValueOnce("exit");

    const code = await configCommand();
    expect(code).toBe(0);
    expect(saveSpy).toHaveBeenCalledWith(
      expect.objectContaining({ force: "force" }),
    );
    expect(mockLogSuccess).toHaveBeenCalledWith("Quit mode set to: force");
  });

  it("toggles include finder to enabled", async () => {
    vi.spyOn(configModule, "loadConfig").mockReturnValue(fullConfig());
    const saveSpy = vi
      .spyOn(configModule, "saveConfig")
      .mockImplementation(() => {});

    mockSelect
      .mockResolvedValueOnce("finder")
      .mockResolvedValueOnce("enabled")
      .mockResolvedValueOnce("exit");

    const code = await configCommand();
    expect(code).toBe(0);
    expect(saveSpy).toHaveBeenCalledWith(
      expect.objectContaining({ includeFinder: true }),
    );
    expect(mockLogSuccess).toHaveBeenCalledWith("Include Finder: enabled");
  });

  it("toggles include trash to enabled", async () => {
    vi.spyOn(configModule, "loadConfig").mockReturnValue(fullConfig());
    const saveSpy = vi
      .spyOn(configModule, "saveConfig")
      .mockImplementation(() => {});

    mockSelect
      .mockResolvedValueOnce("trash")
      .mockResolvedValueOnce("enabled")
      .mockResolvedValueOnce("exit");

    const code = await configCommand();
    expect(code).toBe(0);
    expect(saveSpy).toHaveBeenCalledWith(
      expect.objectContaining({ includeTrash: true }),
    );
    expect(mockLogSuccess).toHaveBeenCalledWith(
      "Include Empty Trash in list: enabled",
    );
  });

  it("toggles background apps to enabled", async () => {
    vi.spyOn(configModule, "loadConfig").mockReturnValue(fullConfig());
    const saveSpy = vi
      .spyOn(configModule, "saveConfig")
      .mockImplementation(() => {});

    mockSelect
      .mockResolvedValueOnce("background")
      .mockResolvedValueOnce("enabled")
      .mockResolvedValueOnce("exit");

    const code = await configCommand();
    expect(code).toBe(0);
    expect(saveSpy).toHaveBeenCalledWith(
      expect.objectContaining({ includeBackground: true }),
    );
    expect(mockLogSuccess).toHaveBeenCalledWith("Background apps: enabled");
  });

  it("resets config to defaults", async () => {
    vi.spyOn(configModule, "loadConfig").mockReturnValue(
      fullConfig({ force: "force", includeFinder: true }),
    );
    const saveSpy = vi
      .spyOn(configModule, "saveConfig")
      .mockImplementation(() => {});

    mockSelect.mockResolvedValueOnce("reset").mockResolvedValueOnce("exit");

    const code = await configCommand();
    expect(code).toBe(0);
    expect(saveSpy).toHaveBeenCalledWith(fullConfig());
    expect(mockLogSuccess).toHaveBeenCalledWith("Config reset to defaults.");
  });

  it("manages excluded apps - view empty list", async () => {
    vi.spyOn(configModule, "loadConfig").mockReturnValue(fullConfig());

    mockSelect
      .mockResolvedValueOnce("exclude")
      .mockResolvedValueOnce("view")
      .mockResolvedValueOnce("exit");

    const code = await configCommand();
    expect(code).toBe(0);
    expect(mockLogInfo).toHaveBeenCalledWith("No apps currently excluded.");
  });

  it("manages excluded apps - view existing list", async () => {
    vi.spyOn(configModule, "loadConfig").mockReturnValue(
      fullConfig({ exclude: ["Spotify", "Discord"] }),
    );

    mockSelect
      .mockResolvedValueOnce("exclude")
      .mockResolvedValueOnce("view")
      .mockResolvedValueOnce("exit");

    const code = await configCommand();
    expect(code).toBe(0);
    expect(mockLogInfo).toHaveBeenCalledWith(
      expect.stringContaining("Spotify"),
    );
  });

  it("manages excluded apps - add apps", async () => {
    vi.spyOn(configModule, "loadConfig").mockReturnValue(fullConfig());
    vi.spyOn(appsModule, "getRunningApps").mockResolvedValue([
      { name: "Spotify", bundleId: "com.spotify.client" },
    ]);
    mockMultiselect.mockResolvedValueOnce(["Spotify"]);
    const addSpy = vi
      .spyOn(configModule, "addExcludedApps")
      .mockReturnValue(fullConfig({ exclude: ["Spotify"] }));

    mockSelect
      .mockResolvedValueOnce("exclude")
      .mockResolvedValueOnce("add")
      .mockResolvedValueOnce("exit");

    const code = await configCommand();
    expect(code).toBe(0);
    expect(addSpy).toHaveBeenCalledWith(["Spotify"]);
    expect(mockLogSuccess).toHaveBeenCalledWith(
      "Added 1 apps to exclude list.",
    );
  });

  it("manages excluded apps - remove apps", async () => {
    vi.spyOn(configModule, "loadConfig").mockReturnValue(
      fullConfig({ exclude: ["Spotify", "Discord"] }),
    );
    mockMultiselect.mockResolvedValueOnce(["Spotify"]);
    const removeSpy = vi
      .spyOn(configModule, "removeExcludedApps")
      .mockReturnValue(fullConfig({ exclude: ["Discord"] }));

    mockSelect
      .mockResolvedValueOnce("exclude")
      .mockResolvedValueOnce("remove")
      .mockResolvedValueOnce("exit");

    const code = await configCommand();
    expect(code).toBe(0);
    expect(removeSpy).toHaveBeenCalledWith(["Spotify"]);
    expect(mockLogSuccess).toHaveBeenCalledWith(
      "Removed 1 apps from exclude list.",
    );
  });

  it("toggles default selection to deselect-all", async () => {
    vi.spyOn(configModule, "loadConfig").mockReturnValue(fullConfig());
    const saveSpy = vi
      .spyOn(configModule, "saveConfig")
      .mockImplementation(() => {});

    mockSelect
      .mockResolvedValueOnce("default-select")
      .mockResolvedValueOnce("deselect-all")
      .mockResolvedValueOnce("exit");

    const code = await configCommand();
    expect(code).toBe(0);
    expect(saveSpy).toHaveBeenCalledWith(
      expect.objectContaining({ defaultSelectAll: false }),
    );
    expect(mockLogSuccess).toHaveBeenCalledWith(
      "Default selection: deselect-all",
    );
  });

  it("toggles group background instances to disabled", async () => {
    vi.spyOn(configModule, "loadConfig").mockReturnValue(fullConfig());
    const saveSpy = vi
      .spyOn(configModule, "saveConfig")
      .mockImplementation(() => {});

    mockSelect
      .mockResolvedValueOnce("group-background")
      .mockResolvedValueOnce("disabled")
      .mockResolvedValueOnce("exit");

    const code = await configCommand();
    expect(code).toBe(0);
    expect(saveSpy).toHaveBeenCalledWith(
      expect.objectContaining({ groupBackground: false }),
    );
    expect(mockLogSuccess).toHaveBeenCalledWith(
      "Group background instances: disabled",
    );
  });

  it("toggles never quit music apps to enabled", async () => {
    vi.spyOn(configModule, "loadConfig").mockReturnValue(fullConfig());
    const saveSpy = vi
      .spyOn(configModule, "saveConfig")
      .mockImplementation(() => {});

    mockSelect
      .mockResolvedValueOnce("never-quit-music")
      .mockResolvedValueOnce("enabled")
      .mockResolvedValueOnce("exit");

    const code = await configCommand();
    expect(code).toBe(0);
    expect(saveSpy).toHaveBeenCalledWith(
      expect.objectContaining({ neverQuitMusic: true }),
    );
    expect(mockLogSuccess).toHaveBeenCalledWith(
      "Never quit music apps: enabled",
    );
  });

  it("manages custom music apps - view empty list", async () => {
    vi.spyOn(configModule, "loadConfig").mockReturnValue(fullConfig());

    mockSelect
      .mockResolvedValueOnce("custom-music")
      .mockResolvedValueOnce("view")
      .mockResolvedValueOnce("exit");

    const code = await configCommand();
    expect(code).toBe(0);
    expect(mockLogInfo).toHaveBeenCalledWith(
      "No custom music apps registered.",
    );
  });

  it("manages custom music apps - add app", async () => {
    vi.spyOn(configModule, "loadConfig").mockReturnValue(fullConfig());
    vi.spyOn(appsModule, "getRunningApps").mockResolvedValueOnce([
      { name: "MyPlayer", bundleId: "com.custom.player" },
    ]);
    mockMultiselect.mockResolvedValueOnce(["MyPlayer"]);
    const addSpy = vi
      .spyOn(configModule, "addMusicApps")
      .mockReturnValue(fullConfig({ musicApps: ["MyPlayer"] }));

    mockSelect
      .mockResolvedValueOnce("custom-music")
      .mockResolvedValueOnce("add")
      .mockResolvedValueOnce("exit");

    const code = await configCommand();
    expect(code).toBe(0);
    expect(addSpy).toHaveBeenCalledWith(["MyPlayer"]);
    expect(mockLogSuccess).toHaveBeenCalledWith(
      "Added 1 apps to custom music list.",
    );
  });

  it("handles cancel on toggle quit mode", async () => {
    vi.spyOn(configModule, "loadConfig").mockReturnValue(fullConfig());

    mockSelect
      .mockResolvedValueOnce("quit-mode")
      .mockResolvedValueOnce(Symbol("cancel"))
      .mockResolvedValueOnce("exit");

    const code = await configCommand();
    expect(code).toBe(0);
  });

  it("toggles auto update to disabled and handles cancel", async () => {
    vi.spyOn(configModule, "loadConfig").mockReturnValue(fullConfig());
    const saveSpy = vi
      .spyOn(configModule, "saveConfig")
      .mockImplementation(() => {});

    mockSelect
      .mockResolvedValueOnce("auto-update")
      .mockResolvedValueOnce("disabled")
      .mockResolvedValueOnce("auto-update")
      .mockResolvedValueOnce(Symbol("cancel"))
      .mockResolvedValueOnce("exit");

    const code = await configCommand();
    expect(code).toBe(0);
    expect(saveSpy).toHaveBeenCalledWith(
      expect.objectContaining({ autoUpdate: false }),
    );
    expect(mockLogSuccess).toHaveBeenCalledWith(
      "Automatic update checks: disabled",
    );
  });

  it("toggles on-quit-failure mode to force and handles cancel", async () => {
    vi.spyOn(configModule, "loadConfig").mockReturnValue(fullConfig());
    const saveSpy = vi
      .spyOn(configModule, "saveConfig")
      .mockImplementation(() => {});

    mockSelect
      .mockResolvedValueOnce("on-quit-failure")
      .mockResolvedValueOnce("force")
      .mockResolvedValueOnce("on-quit-failure")
      .mockResolvedValueOnce(Symbol("cancel"))
      .mockResolvedValueOnce("exit");

    const code = await configCommand();
    expect(code).toBe(0);
    expect(saveSpy).toHaveBeenCalledWith(
      expect.objectContaining({ onQuitFailure: "force" }),
    );
    expect(mockLogSuccess).toHaveBeenCalledWith(
      "On quit failure action set to: force",
    );
  });

  describe("handleConfigCli", () => {
    it("delegates to interactive configCommand when no configAction is provided", async () => {
      vi.spyOn(configModule, "loadConfig").mockReturnValue(fullConfig());
      mockSelect.mockResolvedValueOnce("exit");

      const code = await handleConfigCli();
      expect(code).toBe(0);
      expect(mockOutro).toHaveBeenCalledWith("Config saved.");
    });

    it("handles show action with text and json outputs", async () => {
      vi.spyOn(configModule, "loadConfig").mockReturnValue(
        fullConfig({ exclude: ["Spotify"] }),
      );
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const codeText = await handleConfigCli({ configAction: "show" });
      expect(codeText).toBe(0);
      expect(logSpy).toHaveBeenCalledWith("quitx configuration:");

      logSpy.mockClear();
      const codeJson = await handleConfigCli({
        configAction: "show",
        json: true,
      });
      expect(codeJson).toBe(0);
      expect(logSpy).toHaveBeenCalledWith(
        JSON.stringify(fullConfig({ exclude: ["Spotify"] }), null, 2),
      );

      logSpy.mockRestore();
    });

    it("handles get action with valid, invalid, and missing keys", async () => {
      vi.spyOn(configModule, "loadConfig").mockReturnValue(
        fullConfig({ force: "normal", exclude: ["App1", "App2"] }),
      );
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      // Missing key
      const codeMissing = await handleConfigCli({ configAction: "get" });
      expect(codeMissing).toBe(1);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Missing config key"),
      );

      // Unknown key
      const codeUnknown = await handleConfigCli({
        configAction: "get",
        configKey: "nonExistentKey",
      });
      expect(codeUnknown).toBe(1);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining("Unknown config key"),
      );

      // Scalar key
      const codeScalar = await handleConfigCli({
        configAction: "get",
        configKey: "force",
      });
      expect(codeScalar).toBe(0);
      expect(logSpy).toHaveBeenCalledWith("normal");

      // Array key
      const codeArray = await handleConfigCli({
        configAction: "get",
        configKey: "exclude",
      });
      expect(codeArray).toBe(0);
      expect(logSpy).toHaveBeenCalledWith("App1, App2");

      // JSON key
      const codeJson = await handleConfigCli({
        configAction: "get",
        configKey: "force",
        json: true,
      });
      expect(codeJson).toBe(0);
      expect(logSpy).toHaveBeenCalledWith(
        JSON.stringify({ force: "normal" }, null, 2),
      );

      logSpy.mockRestore();
      errorSpy.mockRestore();
    });

    it("handles set action with force, booleans, arrays, validation and json", async () => {
      const cfg = fullConfig();
      vi.spyOn(configModule, "loadConfig").mockReturnValue(cfg);
      const saveSpy = vi
        .spyOn(configModule, "saveConfig")
        .mockImplementation(() => {});
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      // Missing key
      expect(await handleConfigCli({ configAction: "set" })).toBe(1);
      // Missing value
      expect(
        await handleConfigCli({ configAction: "set", configKey: "force" }),
      ).toBe(1);
      // Unknown key
      expect(
        await handleConfigCli({
          configAction: "set",
          configKey: "invalid",
          configValue: "val",
        }),
      ).toBe(1);

      // Invalid force
      expect(
        await handleConfigCli({
          configAction: "set",
          configKey: "force",
          configValue: "invalid",
        }),
      ).toBe(1);

      // Valid force
      expect(
        await handleConfigCli({
          configAction: "set",
          configKey: "force",
          configValue: "force",
        }),
      ).toBe(0);
      expect(saveSpy).toHaveBeenCalledWith(
        expect.objectContaining({ force: "force" }),
      );

      // Force normal
      expect(
        await handleConfigCli({
          configAction: "set",
          configKey: "force",
          configValue: "normal",
        }),
      ).toBe(0);
      expect(saveSpy).toHaveBeenCalledWith(
        expect.objectContaining({ force: "normal" }),
      );

      // Invalid boolean
      expect(
        await handleConfigCli({
          configAction: "set",
          configKey: "autoUpdate",
          configValue: "maybe",
        }),
      ).toBe(1);

      // Valid booleans
      expect(
        await handleConfigCli({
          configAction: "set",
          configKey: "autoUpdate",
          configValue: "false",
        }),
      ).toBe(0);
      expect(saveSpy).toHaveBeenCalledWith(
        expect.objectContaining({ autoUpdate: false }),
      );

      expect(
        await handleConfigCli({
          configAction: "set",
          configKey: "includeFinder",
          configValue: "true",
        }),
      ).toBe(0);
      expect(saveSpy).toHaveBeenCalledWith(
        expect.objectContaining({ includeFinder: true }),
      );

      // Array value
      expect(
        await handleConfigCli({
          configAction: "set",
          configKey: "exclude",
          configValue: "Spotify, Slack",
        }),
      ).toBe(0);
      expect(saveSpy).toHaveBeenCalledWith(
        expect.objectContaining({ exclude: ["Spotify", "Slack"] }),
      );

      // JSON output
      expect(
        await handleConfigCli({
          configAction: "set",
          configKey: "autoUpdate",
          configValue: "true",
          json: true,
        }),
      ).toBe(0);
      expect(logSpy).toHaveBeenCalledWith(
        JSON.stringify({ autoUpdate: true }, null, 2),
      );

      logSpy.mockRestore();
      errorSpy.mockRestore();
    });

    it("handles reset action with prompt confirmation, cancellation, --yes and --json", async () => {
      const saveSpy = vi
        .spyOn(configModule, "saveConfig")
        .mockImplementation(() => {});
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      // Cancelled by prompt
      mockSelect.mockResolvedValueOnce(Symbol("cancel"));
      expect(await handleConfigCli({ configAction: "reset" })).toBe(0);
      expect(saveSpy).not.toHaveBeenCalled();

      // Confirmed by prompt
      mockSelect.mockResolvedValueOnce("yes");
      expect(await handleConfigCli({ configAction: "reset" })).toBe(0);
      expect(saveSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          ...configModule.DEFAULT_CONFIG,
          exclude: [],
          musicApps: [],
        }),
      );

      // With --yes flag
      saveSpy.mockClear();
      expect(await handleConfigCli({ configAction: "reset", yes: true })).toBe(
        0,
      );
      expect(saveSpy).toHaveBeenCalled();

      // With --json flag
      saveSpy.mockClear();
      expect(
        await handleConfigCli({
          configAction: "reset",
          yes: true,
          json: true,
        }),
      ).toBe(0);
      expect(logSpy).toHaveBeenCalledWith(
        JSON.stringify({ reset: true }, null, 2),
      );

      logSpy.mockRestore();
    });

    it("handles sortBy get and set with validation and json output", async () => {
      const saveSpy = vi
        .spyOn(configModule, "saveConfig")
        .mockImplementation(() => {});
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      // get sortBy
      vi.spyOn(configModule, "loadConfig").mockReturnValue(
        fullConfig({ sortBy: "memory" }),
      );
      expect(
        await handleConfigCli({ configAction: "get", configKey: "sortBy" }),
      ).toBe(0);
      expect(logSpy).toHaveBeenCalledWith("memory");

      // get sortBy with --json
      logSpy.mockClear();
      expect(
        await handleConfigCli({
          configAction: "get",
          configKey: "sortBy",
          json: true,
        }),
      ).toBe(0);
      expect(logSpy).toHaveBeenCalledWith(
        JSON.stringify({ sortBy: "memory" }, null, 2),
      );

      // set sortBy memory
      expect(
        await handleConfigCli({
          configAction: "set",
          configKey: "sortBy",
          configValue: "memory",
        }),
      ).toBe(0);
      expect(saveSpy).toHaveBeenCalledWith(
        expect.objectContaining({ sortBy: "memory" }),
      );

      // set sortBy name
      saveSpy.mockClear();
      expect(
        await handleConfigCli({
          configAction: "set",
          configKey: "sortBy",
          configValue: "name",
        }),
      ).toBe(0);
      expect(saveSpy).toHaveBeenCalledWith(
        expect.objectContaining({ sortBy: "name" }),
      );

      // set sortBy invalid
      expect(
        await handleConfigCli({
          configAction: "set",
          configKey: "sortBy",
          configValue: "invalid-sort",
        }),
      ).toBe(1);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid value for sortBy: "invalid-sort"'),
      );

      logSpy.mockRestore();
      errorSpy.mockRestore();
    });

    it("handles unknown config action gracefully", async () => {
      const code = await handleConfigCli({
        configAction: "unknown" as "show",
      });
      expect(code).toBe(0);
    });

    it("handles invalid force mode in set", async () => {
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const code = await handleConfigCli({
        configAction: "set",
        configKey: "force",
        configValue: "turbo",
      });
      expect(code).toBe(1);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid value for force: "turbo"'),
      );
      errorSpy.mockRestore();
    });

    it("handles onQuitFailure get and set", async () => {
      vi.spyOn(configModule, "loadConfig").mockReturnValue(
        fullConfig({ onQuitFailure: "prompt" }),
      );
      const saveSpy = vi
        .spyOn(configModule, "saveConfig")
        .mockImplementation(() => {});
      const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      // get onQuitFailure
      expect(
        await handleConfigCli({
          configAction: "get",
          configKey: "onQuitFailure",
        }),
      ).toBe(0);
      expect(logSpy).toHaveBeenCalledWith("prompt");

      // set onQuitFailure valid
      expect(
        await handleConfigCli({
          configAction: "set",
          configKey: "onQuitFailure",
          configValue: "force",
        }),
      ).toBe(0);
      expect(saveSpy).toHaveBeenCalledWith(
        expect.objectContaining({ onQuitFailure: "force" }),
      );

      // set onQuitFailure invalid
      expect(
        await handleConfigCli({
          configAction: "set",
          configKey: "onQuitFailure",
          configValue: "invalid-mode",
        }),
      ).toBe(1);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'Invalid value for onQuitFailure: "invalid-mode"',
        ),
      );

      logSpy.mockRestore();
      errorSpy.mockRestore();
    });
  });
});
