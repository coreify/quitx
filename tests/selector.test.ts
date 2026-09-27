import * as clack from "@clack/prompts";
import { describe, expect, it, vi } from "vitest";
import {
  SELECT_ALL_VALUE,
  selectApps,
  shouldConfirmQuit,
} from "../src/ui/selector";
import type { AppInfo } from "../src/types";

describe("selector ui", () => {
  it("selectApps returns empty array if no apps provided", async () => {
    expect(await selectApps([])).toEqual([]);
  });

  it("selectApps returns selected apps from multiselect", async () => {
    const apps: AppInfo[] = [
      { name: "Arc", bundleId: "company.thebrowser.Browser" },
      { name: "Spotify", bundleId: "com.spotify.client" },
    ];

    vi.spyOn(clack, "multiselect").mockResolvedValue(["com.spotify.client"] as never);

    const result = await selectApps(apps);
    expect(result).toEqual([apps[1]]);
  });

  it("selectApps selects all apps when Quit all apps is picked", async () => {
    const apps: AppInfo[] = [
      { name: "Arc", bundleId: "company.thebrowser.Browser" },
      { name: "Spotify", bundleId: "com.spotify.client" },
    ];

    vi.spyOn(clack, "multiselect").mockResolvedValue([SELECT_ALL_VALUE] as never);

    const result = await selectApps(apps);
    expect(result).toEqual(apps);
  });

  it("selectApps returns cancel symbol on user cancel", async () => {
    const cancelSymbol = Symbol("cancel");
    vi.spyOn(clack, "multiselect").mockResolvedValue(cancelSymbol as never);

    const result = await selectApps([{ name: "Test" }]);
    expect(result).toBe(cancelSymbol);
  });

  it("shouldConfirmQuit skips confirmation for 1-3 apps", async () => {
    const confirmSpy = vi.spyOn(clack, "confirm");
    expect(await shouldConfirmQuit(1)).toBe(true);
    expect(await shouldConfirmQuit(2)).toBe(true);
    expect(await shouldConfirmQuit(3)).toBe(true);
    expect(confirmSpy).not.toHaveBeenCalled();
  });

  it("shouldConfirmQuit prompts for 4+ apps", async () => {
    const confirmSpy = vi.spyOn(clack, "confirm").mockResolvedValue(true as never);
    const res = await shouldConfirmQuit(5);
    expect(res).toBe(true);
    expect(confirmSpy).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Quit 5 selected apps?" }),
    );
  });

  it("shouldConfirmQuit prompts when isAll is true even for small counts", async () => {
    const confirmSpy = vi.spyOn(clack, "confirm").mockResolvedValue(true as never);
    const res = await shouldConfirmQuit(2, true);
    expect(res).toBe(true);
    expect(confirmSpy).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Quit all 2 apps?" }),
    );
  });

  it("shouldConfirmQuit skips when forceYes is true", async () => {
    const confirmSpy = vi.spyOn(clack, "confirm");
    expect(await shouldConfirmQuit(10, true, true)).toBe(true);
    expect(confirmSpy).not.toHaveBeenCalled();
  });
});
