import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { existsSync, rmSync } from "node:fs";

const mockIntro = vi.fn<(...args: unknown[]) => void>();
const mockOutro = vi.fn<(...args: unknown[]) => void>();
const mockCancel = vi.fn<(...args: unknown[]) => void>();
const mockConfirm = vi.fn<(...args: unknown[]) => Promise<boolean | symbol>>();
const mockLogWarn = vi.fn<(...args: unknown[]) => void>();
const mockLogSuccess = vi.fn<(...args: unknown[]) => void>();
const mockLogError = vi.fn<(...args: unknown[]) => void>();
const mockSpinnerStart = vi.fn<(...args: unknown[]) => void>();
const mockSpinnerStop = vi.fn<(...args: unknown[]) => void>();

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

import { getRecentlyQuitFile, recordRecentlyQuit } from "../src/config/recent";
import { undoCommand } from "../src/commands/undo";
import * as outputModule from "../src/ui/output";

function clearStore(): void {
  const file = getRecentlyQuitFile();
  if (existsSync(file)) {
    rmSync(file);
  }
}

describe("undo command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearStore();
  });

  afterEach(() => {
    clearStore();
  });

  it("returns 0 with a warning when nothing was recently quit", async () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const code = await undoCommand({ json: true });
    expect(code).toBe(0);
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("No recently quit apps found"),
    );
    expect(mockConfirm).not.toHaveBeenCalled();

    logSpy.mockRestore();
  });

  it("cancels when the user rejects the confirmation", async () => {
    recordRecentlyQuit([{ name: "Spotify" }]);
    mockConfirm.mockResolvedValueOnce(false);

    const thanksSpy = vi
      .spyOn(outputModule, "printThanks")
      .mockImplementation(() => {});

    const code = await undoCommand({});
    expect(code).toBe(0);
    expect(mockCancel).toHaveBeenCalledWith("Cancelled.");
    expect(thanksSpy).toHaveBeenCalled();

    thanksSpy.mockRestore();
  });

  it("cancels when the prompt is cancelled via signal", async () => {
    recordRecentlyQuit([{ name: "Spotify" }]);
    mockConfirm.mockResolvedValueOnce(Symbol("cancel"));

    const thanksSpy = vi
      .spyOn(outputModule, "printThanks")
      .mockImplementation(() => {});

    const code = await undoCommand({});
    expect(code).toBe(0);
    expect(mockCancel).toHaveBeenCalledWith("Cancelled.");

    thanksSpy.mockRestore();
  });

  it("reopens all recorded apps when confirmed", async () => {
    recordRecentlyQuit([
      { name: "Spotify" },
      { name: "Slack", bundleId: "com.tinyspeck.slackmacgap" },
    ]);
    mockConfirm.mockResolvedValueOnce(true);
    const reopened: string[] = [];

    const thanksSpy = vi
      .spyOn(outputModule, "printThanks")
      .mockImplementation(() => {});

    const code = await undoCommand(
      {},
      {
        reopen: (app) => {
          reopened.push(app.name);
          return Promise.resolve();
        },
      },
    );

    expect(code).toBe(0);
    expect(reopened.sort()).toEqual(["Slack", "Spotify"]);
    expect(mockOutro).toHaveBeenCalledWith("Reopened 2 of 2 applications.");
    expect(mockSpinnerStop).toHaveBeenCalledWith("Undo complete");

    thanksSpy.mockRestore();
  });

  it("returns 1 and keeps failed entries when reopen fails", async () => {
    recordRecentlyQuit([{ name: "Broken" }, { name: "Good" }]);
    mockConfirm.mockResolvedValueOnce(true);

    const thanksSpy = vi
      .spyOn(outputModule, "printThanks")
      .mockImplementation(() => {});

    const code = await undoCommand(
      { yes: true },
      {
        reopen: (app) =>
          app.name === "Broken"
            ? Promise.reject(new Error("not installed"))
            : Promise.resolve(),
      },
    );

    expect(code).toBe(1);
    expect(mockLogError).toHaveBeenCalledWith(
      expect.stringContaining("Could not reopen Broken"),
    );
    expect(mockLogSuccess).toHaveBeenCalledWith("Reopened Good");

    thanksSpy.mockRestore();
  });

  it("simulates reopen on dry run without touching the store", async () => {
    recordRecentlyQuit([{ name: "Spotify" }]);
    const reopen = vi.fn();

    const thanksSpy = vi
      .spyOn(outputModule, "printThanks")
      .mockImplementation(() => {});

    const code = await undoCommand({ dryRun: true, yes: true }, { reopen });

    expect(code).toBe(0);
    expect(reopen).not.toHaveBeenCalled();
    expect(mockLogSuccess).toHaveBeenCalledWith(
      "[dry-run] Would reopen Spotify",
    );
    expect(mockOutro).toHaveBeenCalledWith("Would reopen 1 of 1 applications.");

    thanksSpy.mockRestore();
  });

  it("prints JSON output in json mode", async () => {
    recordRecentlyQuit([{ name: "Spotify" }]);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const code = await undoCommand(
      { json: true, yes: true },
      { reopen: async () => {} },
    );

    expect(code).toBe(0);
    expect(logSpy).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(String(logSpy.mock.calls[0]?.[0])) as {
      total: number;
      reopened: number;
      results: { app: { name: string }; success: boolean }[];
    };
    expect(payload.total).toBe(1);
    expect(payload.reopened).toBe(1);
    expect(payload.results[0]?.app.name).toBe("Spotify");
    expect(payload.results[0]?.success).toBe(true);

    logSpy.mockRestore();
  });

  it("skips the confirmation prompt with --yes", async () => {
    recordRecentlyQuit([{ name: "Spotify" }]);
    const thanksSpy = vi
      .spyOn(outputModule, "printThanks")
      .mockImplementation(() => {});

    const code = await undoCommand({ yes: true }, { reopen: async () => {} });
    expect(code).toBe(0);
    expect(mockConfirm).not.toHaveBeenCalled();

    thanksSpy.mockRestore();
  });
});
