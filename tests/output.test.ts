import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@clack/prompts", () => ({
  intro: vi.fn(),
  outro: vi.fn(),
  cancel: vi.fn(),
  log: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { cancel, intro, log, outro } from "@clack/prompts";
import type { AppInfo, QuitResult } from "../src/types";
import {
  printThanks,
  renderHelp,
  renderList,
  renderResults,
  renderVersion,
  showCancel,
  showIntro,
  showOutro,
  THANKS_MESSAGE,
} from "../src/ui/output";

describe("output utilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("contains THANKS_MESSAGE and printThanks logs it", () => {
    expect(THANKS_MESSAGE).toContain(
      "Thanks for using quitx..!\nFor more visit - quitx.js.org",
    );

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    printThanks();
    expect(logSpy).toHaveBeenCalledWith(THANKS_MESSAGE);

    logSpy.mockClear();
    printThanks({ json: true });
    expect(logSpy).not.toHaveBeenCalled();

    logSpy.mockClear();
    printThanks({ quiet: true });
    expect(logSpy).not.toHaveBeenCalled();

    logSpy.mockRestore();
  });

  it("renders help and version without errors", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    renderHelp();
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("quitx - Quit"),
    );

    renderVersion("1.2.3");
    expect(logSpy).toHaveBeenCalledWith("quitx v1.2.3");
    logSpy.mockRestore();
  });

  it("renders plain list of apps", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const apps: AppInfo[] = [{ name: "Arc" }, { name: "Spotify" }];
    renderList(apps, false);

    expect(logSpy).toHaveBeenCalledWith("Arc");
    expect(logSpy).toHaveBeenCalledWith("Spotify");
    logSpy.mockRestore();
  });

  it("renders JSON list of apps", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const apps: AppInfo[] = [{ name: "Arc", bundleId: "com.arc" }];
    renderList(apps, true);

    expect(logSpy).toHaveBeenCalledWith(JSON.stringify(apps, null, 2));
    logSpy.mockRestore();
  });

  it("renders quit results using clack log", () => {
    const results: QuitResult[] = [
      { app: { name: "App1" }, success: true, forced: false },
      { app: { name: "App2" }, success: true, forced: true },
      {
        app: { name: "App3" },
        success: false,
        forced: false,
        error: "Prompt open",
      },
    ];

    renderResults(results);

    expect(log.success).toHaveBeenCalledWith("App1");
    expect(log.success).toHaveBeenCalledWith("Force quit App2");
    expect(log.error).toHaveBeenCalledWith("Could not quit App3 (Prompt open)");
  });

  it("renders quit results with dryRun flag", () => {
    const results: QuitResult[] = [
      { app: { name: "App1" }, success: true, forced: false },
      { app: { name: "App2" }, success: true, forced: true },
      {
        app: { name: "App3" },
        success: false,
        forced: false,
        error: "Prompt open",
      },
    ];

    renderResults(results, true);

    expect(log.success).toHaveBeenCalledWith("[dry-run] Would quit App1");
    expect(log.success).toHaveBeenCalledWith("[dry-run] Would force quit App2");
    expect(log.error).toHaveBeenCalledWith(
      "[dry-run] Could not quit App3 (Prompt open)",
    );
  });

  it("showIntro, showOutro, and showCancel call clack functions", () => {
    showIntro();
    expect(intro).toHaveBeenCalledWith("quitx");

    showOutro("Done");
    expect(outro).toHaveBeenCalledWith("Done");

    showCancel("Aborted");
    expect(cancel).toHaveBeenCalledWith("Aborted");
  });

  it("renderList includes (no windows) label only for non-background windowless apps", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const apps: AppInfo[] = [
      { name: "Preview", windowCount: 0 },
      { name: "Helper", windowCount: 0, isBackground: true },
      { name: "Safari", windowCount: 2 },
    ];

    renderList(apps, false);
    expect(logSpy).toHaveBeenCalledWith("Preview (no windows)");
    expect(logSpy).toHaveBeenCalledWith("Helper");
    expect(logSpy).toHaveBeenCalledWith("Safari");

    logSpy.mockRestore();
  });

  it("renderResults falls back to app name when error message is missing", () => {
    const results: QuitResult[] = [
      { app: { name: "AppX" }, success: false, forced: false },
    ];

    renderResults(results);
    expect(log.error).toHaveBeenCalledWith("Could not quit AppX");
  });

  it("showCancel uses default Cancelled. message when argument is omitted", () => {
    showCancel();
    expect(cancel).toHaveBeenCalledWith("Cancelled.");
  });

  it("renderList with empty apps array prints nothing", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    renderList([], false);
    expect(logSpy).not.toHaveBeenCalled();
    logSpy.mockRestore();
  });

  it("renderResults with empty results array does not call logger", () => {
    renderResults([]);
    expect(log.success).not.toHaveBeenCalled();
    expect(log.error).not.toHaveBeenCalled();
  });

  it("renderHelp contains documentation for all major subcommands and options", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    renderHelp();
    const output = logSpy.mock.calls[0]?.[0] as string;
    expect(output).toContain("restart");
    expect(output).toContain("stash");
    expect(output).toContain("restore");
    expect(output).toContain("--keep");
    expect(output).toContain("--except");
    expect(output).toContain("--sort");
    expect(output).toContain("--windowless");
    expect(output).toContain("config");
    expect(output).toContain("exclude");
    logSpy.mockRestore();
  });

  it("renderVersion logs formatted version prefix", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    renderVersion("2.5.0");
    expect(logSpy).toHaveBeenCalledWith("quitx v2.5.0");
    logSpy.mockRestore();
  });
});
