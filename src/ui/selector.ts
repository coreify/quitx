import { MultiSelectPrompt } from "@clack/core";
import { confirm, isCancel, multiselect } from "@clack/prompts";
import type { AppInfo } from "../types";

export const SELECT_ALL_VALUE = "__QUIT_ALL_APPS__";

export interface SelectorOption {
  value: string;
  label: string;
  hint?: string;
}

export function handleQuitAllToggle(
  currentValue: string,
  selectedValues: readonly string[],
): string[] {
  if (currentValue === SELECT_ALL_VALUE) {
    // Toggling Quit all apps
    if (selectedValues.includes(SELECT_ALL_VALUE)) {
      // Unselect quit-all -> enables picking individual apps
      return [];
    }
    // Select quit-all -> clears individual apps and locks to quit-all
    return [SELECT_ALL_VALUE];
  }

  // Toggling an individual app
  if (selectedValues.includes(SELECT_ALL_VALUE)) {
    // Disabled while Quit all is selected: ignore toggle, user must unselect quit-all first
    return [...selectedValues];
  }

  // Normal toggle of individual app
  const isSelected = selectedValues.includes(currentValue);
  return isSelected
    ? selectedValues.filter((v) => v !== currentValue)
    : [...selectedValues, currentValue];
}

export async function selectApps(
  apps: readonly AppInfo[],
): Promise<AppInfo[] | symbol> {
  if (apps.length === 0) {
    return [];
  }

  const appOptions: SelectorOption[] = apps.map((app) => {
    const hint = app.bundleId ?? (app.pid ? `PID: ${app.pid}` : undefined);
    return {
      value: app.bundleId ?? `${app.name}-${app.pid ?? 0}`,
      label: app.name,
      ...(hint ? { hint } : {}),
    };
  });

  const options: SelectorOption[] = [
    {
      value: SELECT_ALL_VALUE,
      label: "Quit all apps",
      hint: `${apps.length} eligible apps`,
    },
    ...appOptions,
  ];

  // Pre-select ONLY the "Quit all apps" option by default
  const initialValues = [SELECT_ALL_VALUE];

  const proto = MultiSelectPrompt?.prototype as unknown as
    | {
        toggleValue?: () => void;
        toggleAll?: () => void;
        _value?: string;
        value?: string[];
      }
    | undefined;

  const origToggleValue = proto?.toggleValue;
  const origToggleAll = proto?.toggleAll;

  let selected: string[] | symbol;
  try {
    if (proto && origToggleValue) {
      proto.toggleValue = function (this: {
        _value?: string;
        value?: string[];
      }) {
        const cur = this._value;
        if (!cur) return;
        this.value = handleQuitAllToggle(cur, this.value ?? []);
      };
    }
    if (proto && origToggleAll) {
      proto.toggleAll = function (this: { value?: string[] }) {
        if (this.value?.includes(SELECT_ALL_VALUE)) {
          this.value = [];
        } else {
          this.value = [SELECT_ALL_VALUE];
        }
      };
    }

    selected = await multiselect({
      message: "Select apps to quit",
      options,
      required: false,
      initialValues,
    });
  } finally {
    if (proto && origToggleValue) proto.toggleValue = origToggleValue;
    if (proto && origToggleAll) proto.toggleAll = origToggleAll;
  }

  if (isCancel(selected) || !Array.isArray(selected)) {
    return selected;
  }

  const selectedArray: string[] = selected;
  if (selectedArray.length === 0) {
    return [];
  }

  // If "Quit all apps" option was selected
  if (selectedArray.includes(SELECT_ALL_VALUE)) {
    return [...apps];
  }

  const selectedSet = new Set(selectedArray);
  return apps.filter((app) => {
    const key = app.bundleId ?? `${app.name}-${app.pid ?? 0}`;
    return selectedSet.has(key);
  });
}

export async function shouldConfirmQuit(
  count: number,
  isAll = false,
  forceYes = false,
): Promise<boolean | symbol> {
  if (forceYes || count === 0) {
    return true;
  }

  // PLAN.md Section 18: 1-3 apps: no confirmation needed (unless --all)
  if (!isAll && count < 4) {
    return true;
  }

  const message = isAll
    ? `Quit all ${count} apps?`
    : `Quit ${count} selected apps?`;

  const confirmed = await confirm({
    message,
    initialValue: false,
  });

  return confirmed;
}
