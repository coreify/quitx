import { MultiSelectPrompt } from "@clack/core";
import { confirm, isCancel, multiselect } from "@clack/prompts";
import type { AppInfo } from "../types";

export const SELECT_ALL_VALUE = "__QUIT_ALL_APPS__";
export const BACK_VALUE = "back";

export interface SelectorOption {
  value: string;
  label: string;
  hint?: string;
}

export function backOption(): SelectorOption {
  return { value: BACK_VALUE, label: "Back to main menu" };
}

export function handleQuitAllToggle(
  currentValue: string,
  selectedValues: readonly string[],
): string[] {
  if (currentValue === SELECT_ALL_VALUE) {
    if (selectedValues.includes(SELECT_ALL_VALUE)) {
      return [];
    }
    return [SELECT_ALL_VALUE];
  }

  if (selectedValues.includes(SELECT_ALL_VALUE)) {
    return [...selectedValues];
  }

  const isSelected = selectedValues.includes(currentValue);
  return isSelected
    ? selectedValues.filter((v) => v !== currentValue)
    : [...selectedValues, currentValue];
}

export function attachQuitAllBehavior(prompt: {
  options: SelectorOption[];
  value?: string[];
  cursor?: number;
  _value?: string;
  toggleValue?: () => void;
  toggleAll?: () => void;
  toggleInvert?: () => void;
}): void {
  let _cursor = prompt.cursor ?? 0;
  let _value: string[] = prompt.value ? [...prompt.value] : [];

  Object.defineProperty(prompt, "cursor", {
    get() {
      return _cursor;
    },
    set(val: number) {
      if (_value.includes(SELECT_ALL_VALUE)) {
        _cursor = 0;
      } else {
        _cursor = val;
      }
    },
    configurable: true,
  });

  Object.defineProperty(prompt, "value", {
    get() {
      return _value;
    },
    set(val: string[]) {
      if (!Array.isArray(val)) {
        _value = [];
        return;
      }
      if (val.includes(SELECT_ALL_VALUE)) {
        _value = [SELECT_ALL_VALUE];
        _cursor = 0;
      } else {
        _value = val.filter((v) => v !== SELECT_ALL_VALUE);
      }
    },
    configurable: true,
  });

  prompt.toggleValue = function () {
    const cur = prompt.options[prompt.cursor ?? 0]?.value;
    if (!cur) return;
    prompt.value = handleQuitAllToggle(cur, prompt.value ?? []);
  };

  prompt.toggleAll = function () {
    if (prompt.value?.includes(SELECT_ALL_VALUE)) {
      prompt.value = [];
    } else {
      prompt.value = [SELECT_ALL_VALUE];
    }
  };

  prompt.toggleInvert = function () {
    if (prompt.value?.includes(SELECT_ALL_VALUE)) {
      prompt.value = [];
    } else {
      prompt.value = [SELECT_ALL_VALUE];
    }
  };
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

  const initialValues = [SELECT_ALL_VALUE];

  const proto = MultiSelectPrompt?.prototype as unknown as
    | {
        prompt?: () => Promise<unknown>;
        toggleValue?: () => void;
        toggleAll?: () => void;
        _value?: string;
        value?: string[];
        cursor?: number;
      }
    | undefined;

  const origPrompt = proto?.prompt;
  const origToggleValue = proto?.toggleValue;
  const origToggleAll = proto?.toggleAll;
  const origToggleInvert = (proto as { toggleInvert?: () => void } | undefined)
    ?.toggleInvert;

  let selected: string[] | symbol;
  try {
    if (proto && origPrompt) {
      proto.prompt = function (this: {
        options?: SelectorOption[];
        value?: string[];
        cursor?: number;
        _value?: string;
        toggleValue?: () => void;
        toggleAll?: () => void;
        toggleInvert?: () => void;
      }) {
        if (this.options?.some((o) => o.value === SELECT_ALL_VALUE)) {
          attachQuitAllBehavior(
            this as Parameters<typeof attachQuitAllBehavior>[0],
          );
        }
        return origPrompt.call(this);
      };
    }

    selected = await multiselect({
      message: "Select apps to quit",
      options,
      required: false,
      initialValues,
    });
  } finally {
    if (proto && origPrompt) proto.prompt = origPrompt;
    if (proto && origToggleValue) proto.toggleValue = origToggleValue;
    if (proto && origToggleAll) proto.toggleAll = origToggleAll;
    if (proto && origToggleInvert) {
      (proto as { toggleInvert?: () => void }).toggleInvert = origToggleInvert;
    }
  }

  if (isCancel(selected) || !Array.isArray(selected)) {
    return selected;
  }

  const selectedArray: string[] = selected;
  if (selectedArray.length === 0) {
    return [];
  }

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
