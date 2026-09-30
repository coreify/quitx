import { beforeEach, describe, expect, it, vi } from "vitest";

const mockIntro = vi.fn<(...args: unknown[]) => void>();
const mockOutro = vi.fn<(...args: unknown[]) => void>();
const mockCancel = vi.fn<(...args: unknown[]) => void>();
const mockSelect = vi.fn<(...args: unknown[]) => Promise<string | symbol>>();
const mockMultiselect =
  vi.fn<(...args: unknown[]) => Promise<string[] | symbol>>();

vi.mock("@clack/prompts", () => ({
  intro: (...args: unknown[]) => {
    mockIntro(...args);
  },
  outro: (...args: unknown[]) => {
    mockOutro(...args);
  },
  cancel: (...args: unknown[]) => {
    mockCancel(...args);
  },
  select: (...args: unknown[]): Promise<string | symbol> => mockSelect(...args),
  multiselect: (...args: unknown[]): Promise<string[] | symbol> =>
    mockMultiselect(...args),
  isCancel: (val: unknown): boolean => typeof val === "symbol",
  log: {
    info: vi.fn(),
    success: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    message: vi.fn(),
    step: vi.fn(),
  },
  spinner: () => ({ start: vi.fn(), stop: vi.fn() }),
}));

import { excludeCommand } from "../src/commands/exclude";
import * as configModule from "../src/config";
import * as appsModule from "../src/macos/apps";
import type { QuitxConfig } from "../src/types";

const fullConfig = (overrides: Partial<QuitxConfig> = {}): QuitxConfig => ({
  groupBackground: true,
  defaultSelectAll: true,
  exclude: [] as string[],
  force: "normal" as const,
  includeFinder: false,
  includeTrash: false,
  includeBackground: false,
  neverQuitMusic: false,
  musicApps: [],
  autoUpdate: true,
  ...overrides,
});

describe("exclude command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("adds apps directly when --exclude provided", async () => {
    const addSpy = vi
      .spyOn(configModule, "addExcludedApps")
      .mockReturnValue(fullConfig({ exclude: ["Spotify", "Slack"] }));

    const code = await excludeCommand({ exclude: ["Spotify", "Slack"] });
    expect(code).toBe(0);
    expect(addSpy).toHaveBeenCalledWith(["Spotify", "Slack"]);
    expect(mockOutro).toHaveBeenCalled();
  });

  it("outputs json when --json provided with --exclude", async () => {
    vi.spyOn(configModule, "addExcludedApps").mockReturnValue(
      fullConfig({ exclude: ["Spotify"] }),
    );
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const code = await excludeCommand({
      exclude: ["Spotify"],
      json: true,
    });
    expect(code).toBe(0);
    expect(logSpy).toHaveBeenCalledWith(
      JSON.stringify(fullConfig({ exclude: ["Spotify"] }), null, 2),
    );

    logSpy.mockRestore();
  });

  it("handles cancelled selection on main menu", async () => {
    mockSelect.mockResolvedValue(Symbol("cancel"));

    const code = await excludeCommand({});
    expect(code).toBe(0);
    expect(mockCancel).toHaveBeenCalledWith("Cancelled.");
  });

  it("views current exclude list when view selected", async () => {
    mockSelect.mockResolvedValue("view");
    vi.spyOn(configModule, "loadConfig").mockReturnValue(
      fullConfig({ exclude: ["Spotify"] }),
    );

    const code = await excludeCommand({});
    expect(code).toBe(0);
    expect(mockOutro).toHaveBeenCalledWith(expect.stringContaining("Spotify"));
  });

  it("adds apps interactively when add selected", async () => {
    mockSelect.mockResolvedValue("add");
    vi.spyOn(configModule, "loadConfig").mockReturnValue(fullConfig());
    vi.spyOn(appsModule, "getRunningApps").mockResolvedValue([
      { name: "Spotify", bundleId: "com.spotify.client" },
    ]);
    mockMultiselect.mockResolvedValue(["Spotify"]);
    const addSpy = vi
      .spyOn(configModule, "addExcludedApps")
      .mockReturnValue(fullConfig({ exclude: ["Spotify"] }));

    const code = await excludeCommand({});
    expect(code).toBe(0);
    expect(addSpy).toHaveBeenCalledWith(["Spotify"]);
    expect(mockOutro).toHaveBeenCalledWith("Added 1 apps to exclude list.");
  });

  it("removes apps interactively when remove selected", async () => {
    mockSelect.mockResolvedValue("remove");
    vi.spyOn(configModule, "loadConfig").mockReturnValue(
      fullConfig({ exclude: ["Spotify", "Slack"] }),
    );
    mockMultiselect.mockResolvedValue(["Spotify"]);
    const removeSpy = vi
      .spyOn(configModule, "removeExcludedApps")
      .mockReturnValue(fullConfig({ exclude: ["Slack"] }));

    const code = await excludeCommand({});
    expect(code).toBe(0);
    expect(removeSpy).toHaveBeenCalledWith(["Spotify"]);
    expect(mockOutro).toHaveBeenCalledWith("Removed 1 apps from exclude list.");
  });

  it("handles viewing empty exclude list", async () => {
    mockSelect.mockResolvedValue("view");
    vi.spyOn(configModule, "loadConfig").mockReturnValue(
      fullConfig({ exclude: [] }),
    );

    const code = await excludeCommand({});
    expect(code).toBe(0);
    expect(mockOutro).toHaveBeenCalledWith(
      "No apps currently excluded in config.json.",
    );
  });

  it("handles interactive add when no running apps are available", async () => {
    mockSelect.mockResolvedValue("add");
    vi.spyOn(configModule, "loadConfig").mockReturnValue(fullConfig());
    vi.spyOn(appsModule, "getRunningApps").mockResolvedValue([]);

    const code = await excludeCommand({});
    expect(code).toBe(0);
    expect(mockOutro).toHaveBeenCalledWith(
      "All running apps are already excluded.",
    );
  });

  it("handles cancelled or empty selection during interactive add", async () => {
    mockSelect.mockResolvedValue("add");
    vi.spyOn(configModule, "loadConfig").mockReturnValue(fullConfig());
    vi.spyOn(appsModule, "getRunningApps").mockResolvedValue([
      { name: "Slack" },
    ]);

    mockMultiselect.mockResolvedValueOnce(Symbol("cancel"));
    expect(await excludeCommand({})).toBe(0);
    expect(mockCancel).toHaveBeenCalledWith("Cancelled.");

    mockMultiselect.mockResolvedValueOnce([]);
    expect(await excludeCommand({})).toBe(0);
    expect(mockOutro).toHaveBeenCalledWith("No apps selected.");
  });

  it("handles remove when exclude list is empty", async () => {
    mockSelect.mockResolvedValue("remove");
    vi.spyOn(configModule, "loadConfig").mockReturnValue(
      fullConfig({ exclude: [] }),
    );

    const code = await excludeCommand({});
    expect(code).toBe(0);
    expect(mockOutro).toHaveBeenCalledWith(
      "No apps currently in exclude list.",
    );
  });

  it("handles cancelled or empty selection during interactive remove", async () => {
    mockSelect.mockResolvedValue("remove");
    vi.spyOn(configModule, "loadConfig").mockReturnValue(
      fullConfig({ exclude: ["Slack"] }),
    );

    mockMultiselect.mockResolvedValueOnce(Symbol("cancel"));
    expect(await excludeCommand({})).toBe(0);
    expect(mockCancel).toHaveBeenCalledWith("Cancelled.");

    mockMultiselect.mockResolvedValueOnce([]);
    expect(await excludeCommand({})).toBe(0);
    expect(mockOutro).toHaveBeenCalledWith("No apps selected.");
  });
});
