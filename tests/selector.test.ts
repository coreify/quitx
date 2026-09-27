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
  attachQuitAllBehavior,
  handleQuitAllToggle,
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

  it("selectApps pre-selects only Quit all apps option and keeps apps visible without strikethrough", async () => {
    const apps: AppInfo[] = [
      { name: "Arc", bundleId: "com.arc" },
      { name: "Spotify", bundleId: "com.spotify" },
    ];
    mockMultiselect.mockResolvedValue([SELECT_ALL_VALUE]);

    await selectApps(apps);
    const lastCall = mockMultiselect.mock.calls[0];
    const callArgs = (lastCall ? lastCall[0] : {}) as {
      options: { value: string; disabled?: boolean }[];
      initialValues: string[];
    };
    expect(callArgs.initialValues).toEqual([SELECT_ALL_VALUE]);
    for (const opt of callArgs.options) {
      expect(opt.disabled).toBeUndefined();
    }
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

  it("handleQuitAllToggle unselects quit-all when quit-all is toggled while selected", () => {
    const next = handleQuitAllToggle(SELECT_ALL_VALUE, [SELECT_ALL_VALUE]);
    expect(next).toEqual([]);
  });

  it("handleQuitAllToggle selects quit-all and clears individual apps when quit-all is picked", () => {
    const next = handleQuitAllToggle(SELECT_ALL_VALUE, ["app1", "app2"]);
    expect(next).toEqual([SELECT_ALL_VALUE]);
  });

  it("handleQuitAllToggle ignores individual app toggle while quit-all is active", () => {
    const next = handleQuitAllToggle("app1", [SELECT_ALL_VALUE]);
    expect(next).toEqual([SELECT_ALL_VALUE]);
  });

  it("handleQuitAllToggle allows selecting individual apps when quit-all is unselected", () => {
    let selected: string[] = [];
    selected = handleQuitAllToggle("app1", selected);
    expect(selected).toEqual(["app1"]);

    selected = handleQuitAllToggle("app2", selected);
    expect(selected).toEqual(["app1", "app2"]);

    selected = handleQuitAllToggle("app1", selected);
    expect(selected).toEqual(["app2"]);
  });

  it("attachQuitAllBehavior locks arrow cursor when quit-all active and unlocks when unselected", () => {
    interface TestPrompt {
      options: { value: string; label: string }[];
      value?: string[];
      cursor?: number;
      toggleValue?: () => void;
      toggleAll?: () => void;
    }

    const prompt: TestPrompt = {
      options: [
        { value: SELECT_ALL_VALUE, label: "Quit all" },
        { value: "app1", label: "App 1" },
        { value: "app2", label: "App 2" },
      ],
      value: [SELECT_ALL_VALUE],
      cursor: 0,
    };

    attachQuitAllBehavior(prompt);

    // Initial state: cursor locked at 0
    expect(prompt.cursor).toBe(0);
    prompt.cursor = 1; // Simulate down arrow
    expect(prompt.cursor).toBe(0);

    // Unselect quit-all via toggleValue
    prompt.toggleValue!();
    expect(prompt.value).toEqual([]);

    // Arrows now work as normal
    prompt.cursor = 1;
    expect(prompt.cursor).toBe(1);

    // Toggle app1
    prompt.toggleValue!();
    expect(prompt.value).toEqual(["app1"]);

    // Move to app2 and toggle
    prompt.cursor = 2;
    prompt.toggleValue!();
    expect(prompt.value).toEqual(["app1", "app2"]);

    // Move back to quit-all and select it again
    prompt.cursor = 0;
    prompt.toggleValue!();
    expect(prompt.value).toEqual([SELECT_ALL_VALUE]);
    expect(prompt.cursor).toBe(0);

    // Arrow navigation locked again
    prompt.cursor = 2;
    expect(prompt.cursor).toBe(0);
  });

  it("attachQuitAllBehavior toggleAll switches between quit-all and none", () => {
    interface TestPrompt {
      options: { value: string; label: string }[];
      value?: string[];
      cursor?: number;
      toggleValue?: () => void;
      toggleAll?: () => void;
    }

    const prompt: TestPrompt = {
      options: [
        { value: SELECT_ALL_VALUE, label: "Quit all" },
        { value: "app1", label: "App 1" },
      ],
      value: [SELECT_ALL_VALUE],
      cursor: 0,
    };

    attachQuitAllBehavior(prompt);
    prompt.toggleAll!();
    expect(prompt.value).toEqual([]);

    prompt.toggleAll!();
    expect(prompt.value).toEqual([SELECT_ALL_VALUE]);
    expect(prompt.cursor).toBe(0);
  });
});
