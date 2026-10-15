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

export interface SelectAppsOptions {
  defaultSelectAll?: boolean;
  message?: string;
}

export async function selectApps(
  apps: readonly AppInfo[],
  options: SelectAppsOptions = {},
): Promise<AppInfo[] | symbol> {
  if (apps.length === 0) {
    return [];
  }

  const bundleCounts = new Map<string, number>();
  for (const app of apps) {
    const k = app.bundleId ?? app.name;
    bundleCounts.set(k, (bundleCounts.get(k) ?? 0) + 1);
  }

  const appOptions: SelectorOption[] = apps.map((app, index) => {
    let hint = app.bundleId ?? (app.pid ? `PID: ${app.pid}` : undefined);
    if (app.count && app.count > 1) {
      hint = app.bundleId
        ? `${app.bundleId} (${app.count} instances)`
        : `${app.count} instances`;
    } else if (app.pid && app.isBackground) {
      hint = app.bundleId
        ? `${app.bundleId} (PID: ${app.pid})`
        : `PID: ${app.pid}`;
    }

    if (app.memoryFormatted || (app.windowCount === 0 && !app.isBackground)) {
      const parts: string[] = [];
      if (app.memoryFormatted) {
        parts.push(app.memoryFormatted);
      }
      if (app.windowCount === 0 && !app.isBackground) {
        parts.push("no windows");
      }
      if (app.count && app.count > 1) {
        parts.push(`${app.count} instances`);
      } else if (app.pid && app.isBackground) {
        parts.push(`PID: ${app.pid}`);
      }
      hint = parts.join(" · ");
    }

    const base = app.bundleId ?? app.name;
    const isDup = (bundleCounts.get(base) ?? 0) > 1;
    const value =
      isDup && app.pid
        ? `${base}:${app.pid}`
        : (app.bundleId ?? `${app.name}-${app.pid ?? index}`);

    const label =
      app.count && app.count > 1 ? `${app.name} (${app.count})` : app.name;

    return {
      value,
      label,
      ...(hint ? { hint } : {}),
    };
  });

  const defaultSelectAll = options.defaultSelectAll ?? true;
  const initialValues = defaultSelectAll
    ? appOptions.map((opt) => opt.value)
    : [];

  const selected = await multiselect({
    message: options.message ?? "Select apps to quit",
    options: appOptions,
    required: false,
    initialValues,
  });

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
  return apps.filter((app, index) => {
    const optValue = appOptions[index]?.value;
    const key = app.bundleId ?? `${app.name}-${app.pid ?? index}`;
    return (
      (optValue && selectedSet.has(optValue)) ||
      (app.bundleId && selectedSet.has(app.bundleId)) ||
      selectedSet.has(key)
    );
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
