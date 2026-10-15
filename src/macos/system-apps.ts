import type { AppInfo } from "../types";

export const SYSTEM_PROTECTED_BUNDLE_IDS = new Set([
  "com.apple.dock",
  "com.apple.systemuiserver",
  "com.apple.controlcenter",
  "com.apple.notificationcenterui",
  "com.apple.spotlight",
  "com.apple.loginwindow",
  "com.apple.windowmanager",
  "com.apple.dock.extra",
]);

export const SYSTEM_PROTECTED_APP_NAMES = new Set([
  "dock",
  "systemuiserver",
  "control center",
  "notification center",
  "spotlight",
  "loginwindow",
  "windowserver",
  "dock extra",
]);

export function isSystemProtectedApp(app: AppInfo): boolean {
  const bid = app.bundleId?.toLowerCase().trim();
  if (bid && SYSTEM_PROTECTED_BUNDLE_IDS.has(bid)) {
    return true;
  }
  const name = app.name.toLowerCase().trim();
  if (SYSTEM_PROTECTED_APP_NAMES.has(name)) {
    return true;
  }
  const nameCompact = name.replace(/\s+/g, "");
  if (
    nameCompact === "systemuiserver" ||
    nameCompact === "controlcenter" ||
    nameCompact === "notificationcenter" ||
    nameCompact === "loginwindow" ||
    nameCompact === "windowserver"
  ) {
    return true;
  }
  return false;
}
