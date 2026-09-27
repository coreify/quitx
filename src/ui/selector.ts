import { confirm, isCancel, multiselect } from "@clack/prompts";
import type { AppInfo } from "../types";

export const SELECT_ALL_VALUE = "__QUIT_ALL_APPS__";

export async function selectApps(
  apps: readonly AppInfo[],
): Promise<AppInfo[] | symbol> {
  if (apps.length === 0) {
    return [];
  }

  const options = [
    {
      value: SELECT_ALL_VALUE,
      label: "Quit all apps",
      hint: `${apps.length} eligible apps`,
    },
    ...apps.map((app) => {
      const hint = app.bundleId ?? (app.pid ? `PID: ${app.pid}` : undefined);
      return {
        value: app.bundleId ?? `${app.name}-${app.pid ?? 0}`,
        label: app.name,
        ...(hint ? { hint } : {}),
      };
    }),
  ];

  const selected = await multiselect({
    message: "Select apps to quit",
    options,
    required: false,
  });

  if (isCancel(selected)) {
    return selected;
  }

  const selectedArray = selected;
  if (selectedArray.length === 0) {
    return [];
  }

  // If "Quit all apps" was chosen, select all apps
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
