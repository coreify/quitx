import * as clack from "@clack/prompts";
import { describe, expect, it, vi } from "vitest";
import { allCommand } from "../src/commands/all";
import { interactiveCommand } from "../src/commands/interactive";
import { listCommand } from "../src/commands/list";
import * as appsModule from "../src/macos/apps";
import * as quitModule from "../src/macos/quit";
import type { AppInfo, QuitResult } from "../src/types";

describe("cli commands", () => {
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
    vi.spyOn(clack, "confirm").mockResolvedValue(true as never);
    vi.spyOn(clack, "spinner").mockReturnValue({
      start: vi.fn(),
      stop: vi.fn(),
      message: vi.fn(),
    });
    const mockResults: QuitResult[] = [
      { app: mockApps[0]!, success: true, forced: false },
      { app: mockApps[1]!, success: true, forced: false },
    ];
    vi.spyOn(quitModule, "quitApps").mockResolvedValue(mockResults);
    const outroSpy = vi.spyOn(clack, "outro").mockImplementation(() => {});

    const code = await allCommand({});
    expect(code).toBe(0);
    expect(outroSpy).toHaveBeenCalledWith("Quit 2 of 2 apps.");

    outroSpy.mockRestore();
  });

  it("allCommand cancels when user rejects confirmation", async () => {
    vi.spyOn(appsModule, "getRunningApps").mockResolvedValue([{ name: "Arc" }]);
    vi.spyOn(clack, "confirm").mockResolvedValue(false as never);
    const cancelSpy = vi.spyOn(clack, "cancel").mockImplementation(() => {});

    const code = await allCommand({});
    expect(code).toBe(0);
    expect(cancelSpy).toHaveBeenCalledWith("Cancelled.");

    cancelSpy.mockRestore();
  });

  it("allCommand handles no running apps gracefully", async () => {
    vi.spyOn(appsModule, "getRunningApps").mockResolvedValue([]);
    const outroSpy = vi.spyOn(clack, "outro").mockImplementation(() => {});

    const code = await allCommand({});
    expect(code).toBe(0);
    expect(outroSpy).toHaveBeenCalledWith("No running apps found to quit.");

    outroSpy.mockRestore();
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

  it("interactiveCommand quits targeted positional apps", async () => {
    const mockApps: AppInfo[] = [
      { name: "Arc", bundleId: "com.arc" },
      { name: "Spotify", bundleId: "com.spotify" },
    ];
    vi.spyOn(appsModule, "getRunningApps").mockResolvedValue(mockApps);
    vi.spyOn(clack, "spinner").mockReturnValue({
      start: vi.fn(),
      stop: vi.fn(),
      message: vi.fn(),
    });
    vi.spyOn(quitModule, "quitApps").mockResolvedValue([
      { app: mockApps[1]!, success: true, forced: false },
    ]);
    const outroSpy = vi.spyOn(clack, "outro").mockImplementation(() => {});

    const code = await interactiveCommand({ apps: ["Spotify"], yes: true });
    expect(code).toBe(0);
    expect(outroSpy).toHaveBeenCalledWith("Done. Quit 1 of 1 apps.");

    outroSpy.mockRestore();
  });

  it("interactiveCommand handles no matching positional apps", async () => {
    const mockApps: AppInfo[] = [{ name: "Arc" }];
    vi.spyOn(appsModule, "getRunningApps").mockResolvedValue(mockApps);
    vi.spyOn(clack, "spinner").mockReturnValue({
      start: vi.fn(),
      stop: vi.fn(),
      message: vi.fn(),
    });
    const outroSpy = vi.spyOn(clack, "outro").mockImplementation(() => {});

    const code = await interactiveCommand({ apps: ["NonExistentApp"] });
    expect(code).toBe(0);
    expect(outroSpy).toHaveBeenCalledWith("Nothing to quit.");

    outroSpy.mockRestore();
  });

  it("interactiveCommand handles cancel from multiselect", async () => {
    vi.spyOn(appsModule, "getRunningApps").mockResolvedValue([{ name: "Arc" }]);
    vi.spyOn(clack, "spinner").mockReturnValue({
      start: vi.fn(),
      stop: vi.fn(),
      message: vi.fn(),
    });
    vi.spyOn(clack, "multiselect").mockResolvedValue(Symbol("cancel") as never);
    const cancelSpy = vi.spyOn(clack, "cancel").mockImplementation(() => {});

    const code = await interactiveCommand({});
    expect(code).toBe(0);
    expect(cancelSpy).toHaveBeenCalledWith("Cancelled.");

    cancelSpy.mockRestore();
  });

  it("interactiveCommand handles empty selection", async () => {
    vi.spyOn(appsModule, "getRunningApps").mockResolvedValue([{ name: "Arc" }]);
    vi.spyOn(clack, "spinner").mockReturnValue({
      start: vi.fn(),
      stop: vi.fn(),
      message: vi.fn(),
    });
    vi.spyOn(clack, "multiselect").mockResolvedValue([] as never);
    const outroSpy = vi.spyOn(clack, "outro").mockImplementation(() => {});

    const code = await interactiveCommand({});
    expect(code).toBe(0);
    expect(outroSpy).toHaveBeenCalledWith("No apps selected.");

    outroSpy.mockRestore();
  });
});
