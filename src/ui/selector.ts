import { MultiSelectPrompt } from "@clack/core";
import { confirm, isCancel, multiselect } from "@clack/prompts";
import type { AppInfo } from "../types";

export const SELECT_ALL_VALUE = "__QUIT_ALL_APPS__";

export interface SelectorOption {
  value: string;
  label: string;
  hint?: string;
  disabled?: boolean;
}

export function syncQuitAllState(prompt: {
  options: SelectorOption[];
  value?: string[];
}): void {
  if (!prompt.options?.some((o) => o.value === SELECT_ALL_VALUE)) {
    return;
  }
  const isQuitAllSelected = prompt.value?.includes(SELECT_ALL_VALUE) ?? false;
  if (isQuitAllSelected) {
    prompt.value = [SELECT_ALL_VALUE];
  }
  for (const opt of prompt.options) {
    if (opt.value !== SELECT_ALL_VALUE) {
      opt.disabled = isQuitAllSelected;
    }
  }
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
      disabled: true,
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
        toggleInvert?: () => void;
      }
    | undefined;

  const origToggleValue = proto?.toggleValue;
  const origToggleAll = proto?.toggleAll;
  const origToggleInvert = proto?.toggleInvert;

  let selected: string[] | symbol;
  try {
    if (proto && origToggleValue) {
      proto.toggleValue = function (this: unknown) {
        origToggleValue.call(this);
        syncQuitAllState(
          this as { options: SelectorOption[]; value?: string[] },
        );
      };
    }
    if (proto && origToggleAll) {
      proto.toggleAll = function (this: unknown) {
        origToggleAll.call(this);
        syncQuitAllState(
          this as { options: SelectorOption[]; value?: string[] },
        );
      };
    }
    if (proto && origToggleInvert) {
      proto.toggleInvert = function (this: unknown) {
        origToggleInvert.call(this);
        syncQuitAllState(
          this as { options: SelectorOption[]; value?: string[] },
        );
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
    if (proto && origToggleInvert) proto.toggleInvert = origToggleInvert;
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
