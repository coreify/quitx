import * as clack from "@clack/prompts";
import { describe, expect, it, vi } from "vitest";
import {
  renderHelp,
  renderList,
  renderResults,
  renderVersion,
  showCancel,
  showIntro,
  showOutro,
} from "../src/ui/output";
import type { AppInfo, QuitResult } from "../src/types";

describe("output utilities", () => {
  it("renders help and version without errors", () => {
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    renderHelp();
    expect(logSpy).toHaveBeenCalledWith(expect.stringContaining("quitx - Quit"));

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
    const successSpy = vi.spyOn(clack.log, "success").mockImplementation(() => {});
    const errorSpy = vi.spyOn(clack.log, "error").mockImplementation(() => {});

    const results: QuitResult[] = [
      { app: { name: "App1" }, success: true, forced: false },
      { app: { name: "App2" }, success: true, forced: true },
      { app: { name: "App3" }, success: false, forced: false, error: "Prompt open" },
    ];

    renderResults(results);

    expect(successSpy).toHaveBeenCalledWith("App1");
    expect(successSpy).toHaveBeenCalledWith("Force quit App2");
    expect(errorSpy).toHaveBeenCalledWith("Could not quit App3 (Prompt open)");

    successSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it("showIntro, showOutro, and showCancel call clack functions", () => {
    const introSpy = vi.spyOn(clack, "intro").mockImplementation(() => {});
    const outroSpy = vi.spyOn(clack, "outro").mockImplementation(() => {});
    const cancelSpy = vi.spyOn(clack, "cancel").mockImplementation(() => {});

    showIntro();
    expect(introSpy).toHaveBeenCalledWith("quitx");

    showOutro("Done");
    expect(outroSpy).toHaveBeenCalledWith("Done");

    showCancel("Aborted");
    expect(cancelSpy).toHaveBeenCalledWith("Aborted");

    introSpy.mockRestore();
    outroSpy.mockRestore();
    cancelSpy.mockRestore();
  });
});
