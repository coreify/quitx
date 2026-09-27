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
}));

import { excludeCommand } from "../src/commands/exclude";
import * as configModule from "../src/config";
import * as appsModule from "../src/macos/apps";

describe("exclude command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("adds apps directly when --exclude provided", async () => {
    const addSpy = vi
      .spyOn(configModule, "addExcludedApps")
      .mockReturnValue({ exclude: ["Spotify", "Slack"] });

    const code = await excludeCommand({ exclude: ["Spotify", "Slack"] });
    expect(code).toBe(0);
    expect(addSpy).toHaveBeenCalledWith(["Spotify", "Slack"]);
    expect(mockOutro).toHaveBeenCalled();
  });

  it("outputs json when --json provided with --exclude", async () => {
    vi.spyOn(configModule, "addExcludedApps").mockReturnValue({
      exclude: ["Spotify"],
    });
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const code = await excludeCommand({
      exclude: ["Spotify"],
      json: true,
    });
    expect(code).toBe(0);
    expect(logSpy).toHaveBeenCalledWith(
      JSON.stringify({ exclude: ["Spotify"] }, null, 2),
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
    vi.spyOn(configModule, "loadConfig").mockReturnValue({
      exclude: ["Spotify"],
    });

    const code = await excludeCommand({});
    expect(code).toBe(0);
    expect(mockOutro).toHaveBeenCalledWith(expect.stringContaining("Spotify"));
  });

  it("adds apps interactively when add selected", async () => {
    mockSelect.mockResolvedValue("add");
    vi.spyOn(configModule, "loadConfig").mockReturnValue({ exclude: [] });
    vi.spyOn(appsModule, "getRunningApps").mockResolvedValue([
      { name: "Spotify", bundleId: "com.spotify.client" },
    ]);
    mockMultiselect.mockResolvedValue(["Spotify"]);
    const addSpy = vi
      .spyOn(configModule, "addExcludedApps")
      .mockReturnValue({ exclude: ["Spotify"] });

    const code = await excludeCommand({});
    expect(code).toBe(0);
    expect(addSpy).toHaveBeenCalledWith(["Spotify"]);
    expect(mockOutro).toHaveBeenCalledWith("Added 1 apps to exclude list.");
  });

  it("removes apps interactively when remove selected", async () => {
    mockSelect.mockResolvedValue("remove");
    vi.spyOn(configModule, "loadConfig").mockReturnValue({
      exclude: ["Spotify", "Slack"],
    });
    mockMultiselect.mockResolvedValue(["Spotify"]);
    const removeSpy = vi
      .spyOn(configModule, "removeExcludedApps")
      .mockReturnValue({ exclude: ["Slack"] });

    const code = await excludeCommand({});
    expect(code).toBe(0);
    expect(removeSpy).toHaveBeenCalledWith(["Spotify"]);
    expect(mockOutro).toHaveBeenCalledWith("Removed 1 apps from exclude list.");
  });
});
