import { beforeEach, describe, expect, it, vi } from "vitest";

const mockIntro = vi.fn<(...args: unknown[]) => void>();
const mockOutro = vi.fn<(...args: unknown[]) => void>();
const mockCancel = vi.fn<(...args: unknown[]) => void>();
const mockConfirm = vi.fn<(...args: unknown[]) => Promise<boolean | symbol>>();
const mockMultiselect =
  vi.fn<(...args: unknown[]) => Promise<string[] | symbol>>();
const mockSpinnerStart = vi.fn<(...args: unknown[]) => void>();
const mockSpinnerStop = vi.fn<(...args: unknown[]) => void>();
const mockLogWarn = vi.fn<(...args: unknown[]) => void>();
const mockLogSuccess = vi.fn<(...args: unknown[]) => void>();
const mockLogError = vi.fn<(...args: unknown[]) => void>();

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
  confirm: (...args: unknown[]): Promise<boolean | symbol> =>
    mockConfirm(...args),
  multiselect: (...args: unknown[]): Promise<string[] | symbol> =>
    mockMultiselect(...args),
  isCancel: (val: unknown): boolean => typeof val === "symbol",
  spinner: () => ({
    start: mockSpinnerStart,
    stop: mockSpinnerStop,
  }),
  log: {
    warn: (...args: unknown[]) => {
      mockLogWarn(...args);
    },
    success: (...args: unknown[]) => {
      mockLogSuccess(...args);
    },
    error: (...args: unknown[]) => {
      mockLogError(...args);
    },
  },
}));

import { allCommand } from "../src/commands/all";
import { interactiveCommand } from "../src/commands/interactive";
import { listCommand } from "../src/commands/list";
import * as appsModule from "../src/macos/apps";
import * as quitModule from "../src/macos/quit";
import type { AppInfo, QuitResult } from "../src/types";

describe("cli commands", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("listCommand outputs running apps", async () => {
    const mockApps: AppInfo[] = [{ name: "Arc" }, { name: "Spotify" }];
    vi.spyOn(appsModule, "getRunningApps").mockResolvedValue(mockApps);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const code = await listCommand({});
    expect(code).toBe(0);
    expect(logSpy).toHaveBeenCalledWith("Arc");
    expect(logSpy).toHaveBeenCalledWith("Spotify");

    logSpy.mockRestore();
  });

  it("allCommand quits all apps when confirmed", async () => {
    const mockApps: AppInfo[] = [
      { name: "Arc", bundleId: "com.arc" },
      { name: "Spotify", bundleId: "com.spotify" },
    ];
    vi.spyOn(appsModule, "getRunningApps").mockResolvedValue(mockApps);
    mockConfirm.mockResolvedValue(true);

    const mockResults: QuitResult[] = [
      { app: mockApps[0]!, success: true, forced: false },
      { app: mockApps[1]!, success: true, forced: false },
    ];
    vi.spyOn(quitModule, "quitApps").mockResolvedValue(mockResults);

    const code = await allCommand({});
    expect(code).toBe(0);
    expect(mockOutro).toHaveBeenCalledWith("Quit 2 of 2 apps.");
  });

  it("allCommand cancels when user rejects confirmation", async () => {
    vi.spyOn(appsModule, "getRunningApps").mockResolvedValue([{ name: "Arc" }]);
    mockConfirm.mockResolvedValue(false);

    const code = await allCommand({});
    expect(code).toBe(0);
    expect(mockCancel).toHaveBeenCalledWith("Cancelled.");
  });

  it("allCommand handles no running apps gracefully", async () => {
    vi.spyOn(appsModule, "getRunningApps").mockResolvedValue([]);

    const code = await allCommand({});
    expect(code).toBe(0);
    expect(mockOutro).toHaveBeenCalledWith("No running apps found to quit.");
  });

  it("allCommand outputs JSON when --json passed", async () => {
    vi.spyOn(appsModule, "getRunningApps").mockResolvedValue([]);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const code = await allCommand({ json: true });
    expect(code).toBe(0);
    expect(logSpy).toHaveBeenCalledWith(
      JSON.stringify({ quit: 0, results: [] }, null, 2),
    );

    logSpy.mockRestore();
  });

  it("allCommand outputs JSON with results when apps quit", async () => {
    const mockApps: AppInfo[] = [{ name: "Arc" }];
    vi.spyOn(appsModule, "getRunningApps").mockResolvedValue(mockApps);
    vi.spyOn(quitModule, "quitApps").mockResolvedValue([
      { app: mockApps[0]!, success: true, forced: false },
    ]);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const code = await allCommand({ json: true, yes: true });
    expect(code).toBe(0);
    expect(logSpy).toHaveBeenCalledWith(
      JSON.stringify(
        {
          total: 1,
          quit: 1,
          results: [{ app: mockApps[0]!, success: true, forced: false }],
        },
        null,
        2,
      ),
    );

    logSpy.mockRestore();
  });

  it("interactiveCommand quits targeted positional apps", async () => {
    const mockApps: AppInfo[] = [
      { name: "Arc", bundleId: "com.arc" },
      { name: "Spotify", bundleId: "com.spotify" },
    ];
    vi.spyOn(appsModule, "getRunningApps").mockResolvedValue(mockApps);
    vi.spyOn(quitModule, "quitApps").mockResolvedValue([
      { app: mockApps[1]!, success: true, forced: false },
    ]);

    const code = await interactiveCommand({ apps: ["Spotify"], yes: true });
    expect(code).toBe(0);
    expect(mockOutro).toHaveBeenCalledWith("Done. Quit 1 of 1 apps.");
  });

  it("interactiveCommand matches positional apps case-insensitively", async () => {
    const mockApps: AppInfo[] = [
      { name: "Arc", bundleId: "com.arc" },
      { name: "Spotify", bundleId: "com.spotify" },
    ];
    vi.spyOn(appsModule, "getRunningApps").mockResolvedValue(mockApps);
    vi.spyOn(quitModule, "quitApps").mockResolvedValue([
      { app: mockApps[1]!, success: true, forced: false },
    ]);

    const code = await interactiveCommand({ apps: ["sPoTiFy"], yes: true });
    expect(code).toBe(0);
    expect(mockOutro).toHaveBeenCalledWith("Done. Quit 1 of 1 apps.");
  });

  it("interactiveCommand handles no matching positional apps", async () => {
    const mockApps: AppInfo[] = [{ name: "Arc" }];
    vi.spyOn(appsModule, "getRunningApps").mockResolvedValue(mockApps);

    const code = await interactiveCommand({ apps: ["NonExistentApp"] });
    expect(code).toBe(0);
    expect(mockOutro).toHaveBeenCalledWith("Nothing to quit.");
  });

  it("interactiveCommand handles no matching positional apps with json", async () => {
    const mockApps: AppInfo[] = [{ name: "Arc" }];
    vi.spyOn(appsModule, "getRunningApps").mockResolvedValue(mockApps);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const code = await interactiveCommand({
      apps: ["NonExistentApp"],
      json: true,
    });
    expect(code).toBe(0);
    expect(logSpy).toHaveBeenCalledWith(
      JSON.stringify(
        { quit: 0, results: [], error: "No matching apps running" },
        null,
        2,
      ),
    );
    logSpy.mockRestore();
  });

  it("interactiveCommand handles cancel from multiselect", async () => {
    vi.spyOn(appsModule, "getRunningApps").mockResolvedValue([{ name: "Arc" }]);
    mockMultiselect.mockResolvedValue(Symbol("cancel"));

    const code = await interactiveCommand({});
    expect(code).toBe(0);
    expect(mockCancel).toHaveBeenCalledWith("Cancelled.");
  });

  it("interactiveCommand handles empty selection", async () => {
    vi.spyOn(appsModule, "getRunningApps").mockResolvedValue([{ name: "Arc" }]);
    mockMultiselect.mockResolvedValue([]);

    const code = await interactiveCommand({});
    expect(code).toBe(0);
    expect(mockOutro).toHaveBeenCalledWith("No apps selected.");
  });

  it("interactiveCommand cancels when user rejects confirmation for 4+ apps", async () => {
    const mockApps: AppInfo[] = [
      { name: "App1" },
      { name: "App2" },
      { name: "App3" },
      { name: "App4" },
    ];
    vi.spyOn(appsModule, "getRunningApps").mockResolvedValue(mockApps);
    mockMultiselect.mockResolvedValue(["__QUIT_ALL_APPS__"]);
    mockConfirm.mockResolvedValue(false);

    const code = await interactiveCommand({});
    expect(code).toBe(0);
    expect(mockCancel).toHaveBeenCalledWith("Cancelled.");
  });

  it("interactiveCommand handles no running apps with json", async () => {
    vi.spyOn(appsModule, "getRunningApps").mockResolvedValue([]);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const code = await interactiveCommand({ json: true });
    expect(code).toBe(0);
    expect(logSpy).toHaveBeenCalledWith(
      JSON.stringify({ quit: 0, results: [] }, null, 2),
    );
    logSpy.mockRestore();
  });

  it("interactiveCommand outputs json result on completion", async () => {
    const mockApps: AppInfo[] = [{ name: "Arc" }];
    vi.spyOn(appsModule, "getRunningApps").mockResolvedValue(mockApps);
    mockMultiselect.mockResolvedValue(["__QUIT_ALL_APPS__"]);
    vi.spyOn(quitModule, "quitApps").mockResolvedValue([
      { app: mockApps[0]!, success: true, forced: false },
    ]);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const code = await interactiveCommand({ json: true, yes: true });
    expect(code).toBe(0);
    expect(logSpy).toHaveBeenCalledWith(
      JSON.stringify(
        {
          total: 1,
          quit: 1,
          results: [{ app: mockApps[0]!, success: true, forced: false }],
        },
        null,
        2,
      ),
    );
    logSpy.mockRestore();
  });

  it("allCommand handles dryRun option", async () => {
    const mockApps: AppInfo[] = [{ name: "Arc" }];
    vi.spyOn(appsModule, "getRunningApps").mockResolvedValue(mockApps);
    const quitSpy = vi
      .spyOn(quitModule, "quitApps")
      .mockResolvedValue([{ app: mockApps[0]!, success: true, forced: false }]);

    const code = await allCommand({ dryRun: true, yes: true });
    expect(code).toBe(0);
    expect(quitSpy).toHaveBeenCalledWith(
      mockApps,
      expect.objectContaining({ dryRun: true }),
    );
    expect(mockSpinnerStop).toHaveBeenCalledWith("Dry run complete");
    expect(mockOutro).toHaveBeenCalledWith("Would quit 1 of 1 apps.");
  });

  it("interactiveCommand handles dryRun option", async () => {
    const mockApps: AppInfo[] = [{ name: "Arc" }];
    vi.spyOn(appsModule, "getRunningApps").mockResolvedValue(mockApps);
    const quitSpy = vi
      .spyOn(quitModule, "quitApps")
      .mockResolvedValue([{ app: mockApps[0]!, success: true, forced: false }]);

    const code = await interactiveCommand({
      apps: ["Arc"],
      dryRun: true,
      yes: true,
    });
    expect(code).toBe(0);
    expect(quitSpy).toHaveBeenCalledWith(
      mockApps,
      expect.objectContaining({ dryRun: true }),
    );
    expect(mockSpinnerStop).toHaveBeenCalledWith("Dry run complete");
    expect(mockOutro).toHaveBeenCalledWith("Done. Would quit 1 of 1 apps.");
  });

  it("allCommand outputs JSON when 0 apps found", async () => {
    vi.spyOn(appsModule, "getRunningApps").mockResolvedValue([]);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const code = await allCommand({ json: true });
    expect(code).toBe(0);
    expect(logSpy).toHaveBeenCalledWith(
      JSON.stringify({ quit: 0, results: [] }, null, 2),
    );

    logSpy.mockRestore();
  });

  it("allCommand shows windowless outro when windowless: true and 0 apps found", async () => {
    vi.spyOn(appsModule, "getRunningApps").mockResolvedValue([]);
    const code = await allCommand({ windowless: true });
    expect(code).toBe(0);
    expect(mockOutro).toHaveBeenCalledWith(
      "No running windowless apps found to quit.",
    );
  });

  it("interactiveCommand outputs JSON when 0 apps found", async () => {
    vi.spyOn(appsModule, "getRunningApps").mockResolvedValue([]);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const code = await interactiveCommand({ json: true });
    expect(code).toBe(0);
    expect(logSpy).toHaveBeenCalledWith(
      JSON.stringify({ quit: 0, results: [] }, null, 2),
    );

    logSpy.mockRestore();
  });

  it("interactiveCommand matches positional apps by bundleId case-insensitively", async () => {
    const mockApps: AppInfo[] = [
      { name: "Browser", bundleId: "com.company.browser" },
    ];
    vi.spyOn(appsModule, "getRunningApps").mockResolvedValue(mockApps);
    const quitSpy = vi
      .spyOn(quitModule, "quitApps")
      .mockResolvedValue([{ app: mockApps[0]!, success: true, forced: false }]);

    const code = await interactiveCommand({
      apps: ["COM.COMPANY.BROWSER"],
      yes: true,
    });
    expect(code).toBe(0);
    expect(quitSpy).toHaveBeenCalledWith(mockApps, expect.anything());
  });

  it("listCommand outputs (no windows) hint for windowless apps", async () => {
    const mockApps: AppInfo[] = [
      { name: "Preview", windowCount: 0 },
      { name: "Helper", windowCount: 0, isBackground: true },
    ];
    vi.spyOn(appsModule, "getRunningApps").mockResolvedValue(mockApps);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const code = await listCommand({});
    expect(code).toBe(0);
    expect(logSpy).toHaveBeenCalledWith("Preview (no windows)");
    expect(logSpy).toHaveBeenCalledWith("Helper");

    logSpy.mockRestore();
  });
});
