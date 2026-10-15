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

  it("selectApps does not contain Quit all apps option and pre-selects all apps by default", async () => {
    const apps: AppInfo[] = [
      { name: "Arc", bundleId: "com.arc" },
      { name: "Spotify", bundleId: "com.spotify" },
    ];
    mockMultiselect.mockResolvedValue(["com.arc", "com.spotify"]);

    await selectApps(apps);
    const lastCall = mockMultiselect.mock.calls[0];
    const callArgs = (lastCall ? lastCall[0] : {}) as {
      options: { value: string; label: string; hint?: string }[];
      initialValues: string[];
    };
    expect(callArgs.initialValues).toEqual(["com.arc", "com.spotify"]);
    expect(callArgs.options.some((o) => o.value === SELECT_ALL_VALUE)).toBe(
      false,
    );
    expect(callArgs.options.map((o) => o.value)).toEqual([
      "com.arc",
      "com.spotify",
    ]);
  });

  it("selectApps respects defaultSelectAll: false by providing empty initialValues", async () => {
    const apps: AppInfo[] = [
      { name: "Arc", bundleId: "com.arc" },
      { name: "Spotify", bundleId: "com.spotify" },
    ];
    mockMultiselect.mockResolvedValue(["com.spotify"]);

    await selectApps(apps, { defaultSelectAll: false });
    const lastCall = mockMultiselect.mock.calls[0];
    const callArgs = (lastCall ? lastCall[0] : {}) as {
      options: { value: string }[];
      initialValues: string[];
    };
    expect(callArgs.initialValues).toEqual([]);
  });

  it("selectApps formats hints for grouped instances and background PIDs", async () => {
    const apps: AppInfo[] = [
      {
        name: "Helper",
        bundleId: "com.helper",
        count: 3,
        pids: [1, 2, 3],
        isBackground: true,
      },
      {
        name: "Daemon",
        pid: 99,
        isBackground: true,
      },
    ];
    mockMultiselect.mockResolvedValue(["com.helper"]);

    await selectApps(apps);
    const lastCall = mockMultiselect.mock.calls[0];
    const callArgs = (lastCall ? lastCall[0] : {}) as {
      options: { value: string; label: string; hint?: string }[];
    };
    expect(callArgs.options[0]?.hint).toBe("com.helper (3 instances)");
    expect(callArgs.options[0]?.label).toBe("Helper (3)");
    expect(callArgs.options[1]?.hint).toBe("PID: 99");
    expect(callArgs.options[1]?.label).toBe("Daemon");
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

  describe("backOption and option hints formatting", () => {
    it("returns correct backOption structure", async () => {
      const { backOption } = await import("../src/ui/selector");
      expect(backOption()).toEqual({
        value: "back",
        label: "Back to main menu",
      });
    });

    it("formats option hints with memory, windowless status, and instance counts", async () => {
      const apps: AppInfo[] = [
        {
          name: "Chrome",
          bundleId: "com.chrome",
          memoryFormatted: "1.2 GB",
          windowCount: 0,
          count: 2,
        },
        {
          name: "Notes",
          bundleId: "com.notes",
          windowCount: 0,
        },
        {
          name: "Helper",
          bundleId: "com.helper",
          isBackground: true,
          pid: 555,
        },
      ];

      mockMultiselect.mockResolvedValue(["com.chrome"]);
      await selectApps(apps);

      const callArgs = mockMultiselect.mock.calls[0]![0] as {
        options: { value: string; label: string; hint?: string }[];
      };

      expect(callArgs.options[0]?.hint).toBe(
        "1.2 GB · no windows · 2 instances",
      );
      expect(callArgs.options[1]?.hint).toBe("no windows");
      expect(callArgs.options[2]?.hint).toBe("com.helper (PID: 555)");
    });
  });

  describe("shouldConfirmQuit", () => {
    it("returns true when count is 0 or forceYes is true", async () => {
      expect(await shouldConfirmQuit(0)).toBe(true);
      expect(await shouldConfirmQuit(10, false, true)).toBe(true);
    });

    it("returns true for fewer than 4 apps when not isAll", async () => {
      expect(await shouldConfirmQuit(1, false, false)).toBe(true);
      expect(await shouldConfirmQuit(3, false, false)).toBe(true);
    });

    it("prompts user confirmation when isAll is true", async () => {
      mockConfirm.mockResolvedValueOnce(true);
      const res = await shouldConfirmQuit(2, true, false);
      expect(res).toBe(true);
      expect(mockConfirm).toHaveBeenCalled();
    });

    it("prompts user confirmation when 4 or more apps targeted", async () => {
      mockConfirm.mockResolvedValueOnce(false);
      const res = await shouldConfirmQuit(4, false, false);
      expect(res).toBe(false);
      expect(mockConfirm).toHaveBeenCalled();
    });
  });
});
