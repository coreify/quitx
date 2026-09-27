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

import { configCommand } from "../src/commands/config";
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
});
