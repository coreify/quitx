import { beforeEach, describe, expect, it, vi } from "vitest";

const mockIntro = vi.fn();
const mockOutro = vi.fn();
const mockCancel = vi.fn();
const mockLogSuccess = vi.fn();
const mockLogError = vi.fn();

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
  log: {
    success: (...args: unknown[]) => {
      mockLogSuccess(...args);
    },
    error: (...args: unknown[]) => {
      mockLogError(...args);
    },
  },
}));

import type { AppInfo, QuitResult } from "../src/types";
import {
  renderHelp,
  renderList,
  renderResults,
  renderVersion,
  showCancel,
  showIntro,
  showOutro,
} from "../src/ui/output";

describe("output utilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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

    expect(mockLogSuccess).toHaveBeenCalledWith("App1");
    expect(mockLogSuccess).toHaveBeenCalledWith("Force quit App2");
    expect(mockLogError).toHaveBeenCalledWith(
      "Could not quit App3 (Prompt open)",
    );
  });

  it("showIntro, showOutro, and showCancel call clack functions", () => {
    showIntro();
    expect(mockIntro).toHaveBeenCalledWith("quitx");

    showOutro("Done");
    expect(mockOutro).toHaveBeenCalledWith("Done");

    showCancel("Aborted");
    expect(mockCancel).toHaveBeenCalledWith("Aborted");
  });
});
