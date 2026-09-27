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

  it("showIntro, showOutro, and showCancel call clack functions", () => {
    showIntro();
    expect(intro).toHaveBeenCalledWith("quitx");

    showOutro("Done");
    expect(outro).toHaveBeenCalledWith("Done");

    showCancel("Aborted");
    expect(cancel).toHaveBeenCalledWith("Aborted");
  });
});
