import { beforeEach, describe, expect, it, vi } from "vitest";

const mockMultiselect =
  vi.fn<(...args: unknown[]) => Promise<string[] | symbol>>();
const mockConfirm = vi.fn<(...args: unknown[]) => Promise<boolean | symbol>>();
const mockIsCancel = vi.fn<(val: unknown) => boolean>(
  (val) => typeof val === "symbol",
);

vi.mock("@clack/prompts", () => ({
  multiselect: (...args: unknown[]): Promise<string[] | symbol> =>
    mockMultiselect(...args),
  confirm: (...args: unknown[]): Promise<boolean | symbol> =>
    mockConfirm(...args),
  isCancel: (val: unknown): boolean => mockIsCancel(val),
}));

import type { AppInfo } from "../src/types";
import {
  SELECT_ALL_VALUE,
  selectApps,
  shouldConfirmQuit,
} from "../src/ui/selector";

describe("selector ui", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("selectApps returns empty array if no apps provided", async () => {
    expect(await selectApps([])).toEqual([]);
    expect(mockMultiselect).not.toHaveBeenCalled();
  });

  it("selectApps returns selected apps from multiselect", async () => {
    const apps: AppInfo[] = [
      { name: "Arc", bundleId: "company.thebrowser.Browser" },
      { name: "Spotify", bundleId: "com.spotify.client" },
    ];

    mockMultiselect.mockResolvedValue(["com.spotify.client"]);

    const result = await selectApps(apps);
    expect(result).toEqual([apps[1]]);
  });

  it("selectApps selects all apps when Quit all apps is picked", async () => {
    const apps: AppInfo[] = [
      { name: "Arc", bundleId: "company.thebrowser.Browser" },
      { name: "Spotify", bundleId: "com.spotify.client" },
    ];

    mockMultiselect.mockResolvedValue([SELECT_ALL_VALUE]);

    const result = await selectApps(apps);
    expect(result).toEqual(apps);
  });

  it("selectApps returns cancel symbol on user cancel", async () => {
    const cancelSymbol = Symbol("cancel");
    mockMultiselect.mockResolvedValue(cancelSymbol);

    const result = await selectApps([{ name: "Test" }]);
    expect(result).toBe(cancelSymbol);
  });

  it("shouldConfirmQuit skips confirmation for 1-3 apps", async () => {
    expect(await shouldConfirmQuit(1)).toBe(true);
    expect(await shouldConfirmQuit(2)).toBe(true);
    expect(await shouldConfirmQuit(3)).toBe(true);
    expect(mockConfirm).not.toHaveBeenCalled();
  });

  it("shouldConfirmQuit prompts for 4+ apps", async () => {
    mockConfirm.mockResolvedValue(true);
    const res = await shouldConfirmQuit(5);
    expect(res).toBe(true);
    expect(mockConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Quit 5 selected apps?" }),
    );
  });

  it("shouldConfirmQuit prompts when isAll is true even for small counts", async () => {
    mockConfirm.mockResolvedValue(true);
    const res = await shouldConfirmQuit(2, true);
    expect(res).toBe(true);
    expect(mockConfirm).toHaveBeenCalledWith(
      expect.objectContaining({ message: "Quit all 2 apps?" }),
    );
  });

  it("shouldConfirmQuit skips when forceYes is true", async () => {
    expect(await shouldConfirmQuit(10, true, true)).toBe(true);
    expect(mockConfirm).not.toHaveBeenCalled();
  });
});
