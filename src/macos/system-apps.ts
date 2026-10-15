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
  "com.apple.screensaver.engine",
]);

export const QUITX_BUNDLE_IDS = new Set([
  "io.coreify.quitx",
  "com.coreify.quitx",
  "com.kiron.quitx",
  "com.quitx.quitx",
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

const PROTECTED_PATH_PREFIXES = ["/System/Library/PrivateFrameworks/", "/usr/"];

const BACKGROUND_PATH_PREFIXES = [
  "/System/Library/",
  "/System/Volumes/Preboot/",
  "/Library/Apple/System/",
];

export function isQuitxSelf(app: AppInfo): boolean {
  const bid = app.bundleId?.toLowerCase().trim();
  if (bid && QUITX_BUNDLE_IDS.has(bid)) {
    return true;
  }
  return app.name.toLowerCase().trim() === "quitx";
}

export function isSystemProtectedApp(app: AppInfo): boolean {
  if (isQuitxSelf(app)) {
    return true;
  }
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

  const path = app.path;
  if (path) {
    if (PROTECTED_PATH_PREFIXES.some((p) => path.startsWith(p))) {
      return true;
    }
    if (
      app.isBackground &&
      BACKGROUND_PATH_PREFIXES.some((p) => path.startsWith(p))
    ) {
      return true;
    }
  }

  return false;
}
