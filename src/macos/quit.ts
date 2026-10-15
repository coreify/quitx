import { spawn } from "node:child_process";
import type {
  AppInfo,
  CliOptions,
  QuitOptions,
  QuitResult,
  QuitxConfig,
} from "../types";
import { sleep } from "../utils/sleep";
import { isAppRunning, isProcessAlive } from "./apps";
import { APPKIT_PREAMBLE, RUNNING_APPS } from "./jxa";
import { runAppleScript, runJXA, type ScriptExecutor } from "./osascript";
import { isSystemProtectedApp } from "./system-apps";
import { isCurrentTerminalApp } from "./terminal";

export const EMPTY_TRASH_SCRIPT = `
ignoring application responses
    tell application "Finder"
        try
            set warns before emptying to false
            empty the trash
        end try
    end tell
end ignoring
`.trim();

export const FINDER_CLOSE_WINDOWS_SCRIPT = `
with timeout of 2 seconds
    tell application "Finder"
        close every window
    end tell
end timeout
`.trim();

function isFinderApp(app: AppInfo): boolean {
  return (
    app.bundleId === "com.apple.finder" || app.name.toLowerCase() === "finder"
  );
}

const QUIT_JXA_SCRIPT = `${APPKIT_PREAMBLE}
function run(argv) {
    const bundleId = argv[0] || '';
    const name = argv[1] || '';
    const pidStr = argv[2] || '';
    const targetPid = pidStr ? parseInt(pidStr, 10) : 0;
    const apps = ${RUNNING_APPS};
    let root = null;
    let rootBid = '';
    for (let i = 0; i < apps.count; i++) {
        const candidate = apps.objectAtIndex(i);
        const bid = candidate.bundleIdentifier ? candidate.bundleIdentifier.js : '';
        const nm = candidate.localizedName ? candidate.localizedName.js : '';
        const candPid = candidate.processIdentifier;
        const matches = targetPid
            ? candPid === targetPid
            : ((bundleId && bid === bundleId) || (name && nm.toLowerCase() === name.toLowerCase()));
        if (matches) {
            root = candidate;
            rootBid = bid;
            break;
        }
    }
    if (!root) {
        return 'false';
    }
    let rootPath = '';
    try {
        if (root.bundleURL && root.bundleURL.path) {
            rootPath = root.bundleURL.path.js;
        }
    } catch (e) {}
    let res;
    try {
        res = typeof root.terminate === 'function' ? root.terminate() : root.terminate;
    } catch (e) {
        res = 'false';
    }
    const helperBase = bundleId || rootBid;
    if (rootPath && helperBase) {
        const prefix = helperBase + '.';
        const contentPrefix = rootPath + '/Contents/';
        const rootPid = root.processIdentifier;
        for (let j = 0; j < apps.count; j++) {
            const helper = apps.objectAtIndex(j);
            if (helper.processIdentifier === rootPid) continue;
            let helperBid = '';
            try {
                helperBid = helper.bundleIdentifier ? helper.bundleIdentifier.js : '';
            } catch (e) {}
            if (!helperBid || (helperBid !== helperBase && helperBid.indexOf(prefix) !== 0)) continue;
            let helperPath = '';
            try {
                if (helper.bundleURL && helper.bundleURL.path) {
                    helperPath = helper.bundleURL.path.js;
                }
            } catch (e) {}
            if (helperPath.indexOf(contentPrefix) !== 0) continue;
            try {
                if (typeof helper.terminate === 'function') {
                    helper.terminate();
                }
            } catch (e) {}
        }
    }
    return String(res);
}`;

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

function escapeAppleScriptString(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export type DeferredQuitScheduler = (app: AppInfo, force: boolean) => void;

export function defaultDeferredQuitScheduler(
  app: AppInfo,
  force = false,
): void {
  try {
    const bundleId = app.bundleId ?? "";
    const pids =
      app.pids && app.pids.length > 0 ? app.pids : app.pid ? [app.pid] : [];
    const pidArg = app.pid ? ` ${shellQuote(String(app.pid))}` : "";
    const cmd =
      force && pids.length > 0
        ? `sleep 0.4 && kill -9 ${pids.join(" ")}`
        : `sleep 0.4 && osascript -l JavaScript -e ${shellQuote(QUIT_JXA_SCRIPT)} ${shellQuote(bundleId)} ${shellQuote(app.name)}${pidArg}`;
    const child = spawn("sh", ["-c", cmd], {
      detached: true,
      stdio: "ignore",
    });
    child.unref();
  } catch {
    // Ignore error
  }
}

export async function sendQuitSignal(
  app: AppInfo,
  executor?: ScriptExecutor,
): Promise<void> {
  if (
    app.bundleId === "com.apple.trash" ||
    app.name.toLowerCase() === "trash"
  ) {
    await runAppleScript(EMPTY_TRASH_SCRIPT, executor);
    return;
  }

  if (app.pids && app.pids.length > 1) {
    let anyQuit = false;
    for (const pid of app.pids) {
      const args = [app.bundleId ?? "", app.name, String(pid)];
      try {
        const res = await runJXA(QUIT_JXA_SCRIPT, args, executor);
        if (res.trim().toLowerCase() === "true") {
          anyQuit = true;
        }
      } catch {
        // Continue trying other pids
      }
    }
    if (!anyQuit) {
      throw new Error(`Could not quit "${app.name}"`);
    }
    return;
  }

  const args = [app.bundleId ?? "", app.name];
  if (app.pid && app.pid > 0) {
    args.push(String(app.pid));
  }
  let res: string;
  try {
    res = await runJXA(QUIT_JXA_SCRIPT, args, executor);
  } catch (jxaErr) {
    try {
      const asScript =
        app.bundleId && app.bundleId !== "missing value"
          ? `tell application id "${escapeAppleScriptString(app.bundleId)}" to quit`
          : `tell application "${escapeAppleScriptString(app.name)}" to quit`;
      await runAppleScript(asScript, executor);
      return;
    } catch {
      throw jxaErr instanceof Error
        ? jxaErr
        : new Error(`Could not quit "${app.name}"`);
    }
  }

  if (res.trim().toLowerCase() !== "true") {
    try {
      const asScript =
        app.bundleId && app.bundleId !== "missing value"
          ? `tell application id "${escapeAppleScriptString(app.bundleId)}" to quit`
          : `tell application "${escapeAppleScriptString(app.name)}" to quit`;
      await runAppleScript(asScript, executor);
      return;
    } catch {
      throw new Error(`Could not quit "${app.name}"`);
    }
  }
}

export function forceQuitApp(app: AppInfo): boolean {
  if (app.pids && app.pids.length > 0) {
    let anyKilled = false;
    for (const pid of app.pids) {
      try {
        process.kill(pid, "SIGKILL");
        anyKilled = true;
      } catch {
        // Ignore
      }
    }
    return anyKilled;
  }
  if (app.pid && app.pid > 0) {
    try {
      process.kill(app.pid, "SIGKILL");
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

export const DEFAULT_QUIT_TIMEOUT_MS = 8000;

export async function quitApp(
  app: AppInfo,
  options: QuitOptions = {},
  executor?: ScriptExecutor,
  deferredScheduler: DeferredQuitScheduler = defaultDeferredQuitScheduler,
): Promise<QuitResult> {
  if (isSystemProtectedApp(app)) {
    return {
      app,
      success: false,
      forced: false,
      error: "System-protected app; refusing to quit",
    };
  }

  if (options.dryRun) {
    return { app, success: true, forced: options.force ?? false };
  }

  if (isFinderApp(app)) {
    try {
      await runAppleScript(FINDER_CLOSE_WINDOWS_SCRIPT, executor);
      return { app, success: true, forced: false };
    } catch (error: unknown) {
      const errorMsg =
        error instanceof Error
          ? error.message
          : "Failed to close Finder windows";
      return { app, success: false, forced: false, error: errorMsg };
    }
  }

  if (isCurrentTerminalApp(app)) {
    deferredScheduler(app, options.force ?? false);
    return { app, success: true, forced: options.force ?? false };
  }

  const maxTimeoutMs = options.timeoutMs ?? DEFAULT_QUIT_TIMEOUT_MS;
  const pollIntervalMs = Math.min(150, maxTimeoutMs);

  try {
    await sendQuitSignal(app, executor);
  } catch (error: unknown) {
    if (app.pid && !isProcessAlive(app.pid)) {
      return { app, success: true, forced: false };
    }

    const errorMsg =
      error instanceof Error ? error.message : "Failed to send quit event";

    if (options.force && (app.pid || (app.pids && app.pids.length > 0))) {
      forceQuitApp(app);
      await sleep(100);
      const aliveAfterForce = await isAppRunning(app, executor);
      if (!aliveAfterForce) {
        return { app, success: true, forced: true };
      }
    }

    return {
      app,
      success: false,
      forced: false,
      error: errorMsg,
    };
  }

  const start = Date.now();
  while (Date.now() - start <= maxTimeoutMs) {
    await sleep(pollIntervalMs);
    const stillRunning = await isAppRunning(app, executor);
    if (!stillRunning) {
      return { app, success: true, forced: false };
    }
  }

  if (options.force) {
    const killed = forceQuitApp(app);
    if (killed) {
      await sleep(150);
      const aliveAfterForce = await isAppRunning(app, executor);
      if (!aliveAfterForce) {
        return { app, success: true, forced: true };
      }
    }
    return {
      app,
      success: false,
      forced: true,
      error: "Force quit signal sent, but process remained active",
    };
  }

  return {
    app,
    success: false,
    forced: false,
    error: "App is still running (may have unsaved changes or prompt)",
  };
}

export async function quitApps(
  apps: readonly AppInfo[],
  options: QuitOptions = {},
  executor?: ScriptExecutor,
  deferredScheduler: DeferredQuitScheduler = defaultDeferredQuitScheduler,
): Promise<QuitResult[]> {
  if (apps.length === 0) {
    return [];
  }

  const results: QuitResult[] = [];
  const allowedApps: AppInfo[] = [];

  for (const app of apps) {
    if (isSystemProtectedApp(app)) {
      results.push({
        app,
        success: false,
        forced: false,
        error: "System-protected app; refusing to quit",
      });
    } else {
      allowedApps.push(app);
    }
  }

  if (allowedApps.length === 0) {
    return results;
  }

  if (options.dryRun) {
    for (const app of allowedApps) {
      results.push({ app, success: true, forced: options.force ?? false });
    }
    return results;
  }

  const currentTerminalApps: AppInfo[] = [];
  const finderApps: AppInfo[] = [];
  const otherApps: AppInfo[] = [];

  for (const app of allowedApps) {
    if (isCurrentTerminalApp(app)) {
      currentTerminalApps.push(app);
    } else if (isFinderApp(app)) {
      finderApps.push(app);
    } else {
      otherApps.push(app);
    }
  }

  for (const finderApp of finderApps) {
    try {
      await runAppleScript(FINDER_CLOSE_WINDOWS_SCRIPT, executor);
      results.push({ app: finderApp, success: true, forced: false });
    } catch (error: unknown) {
      results.push({
        app: finderApp,
        success: false,
        forced: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to close Finder windows",
      });
    }
  }

  if (otherApps.length > 0) {
    const maxTimeoutMs = options.timeoutMs ?? DEFAULT_QUIT_TIMEOUT_MS;
    const pollIntervalMs = Math.min(150, maxTimeoutMs);

    const signalSettled = await Promise.allSettled(
      otherApps.map((app) => sendQuitSignal(app, executor)),
    );

    const signalErrors = new Map<number | string, string>();
    for (let i = 0; i < otherApps.length; i++) {
      const app = otherApps[i]!;
      const outcome = signalSettled[i];
      const key = app.pid ?? `idx_${i}_${app.name}`;
      if (outcome && outcome.status === "rejected") {
        const msg =
          outcome.reason instanceof Error
            ? outcome.reason.message
            : String(outcome.reason);
        signalErrors.set(key, msg);
      }
    }

    const pending = new Map<number | string, AppInfo>();
    for (let i = 0; i < otherApps.length; i++) {
      const app = otherApps[i]!;
      const key = app.pid ?? `idx_${i}_${app.name}`;
      pending.set(key, app);
    }

    const start = Date.now();
    while (pending.size > 0 && Date.now() - start <= maxTimeoutMs) {
      await sleep(pollIntervalMs);
      for (const [key, app] of Array.from(pending.entries())) {
        const stillRunning = await isAppRunning(app, executor);
        if (!stillRunning) {
          results.push({ app, success: true, forced: false });
          pending.delete(key);
        }
      }
    }

    for (const [key, app] of pending.entries()) {
      const signalError = signalErrors.get(key);
      if (options.force) {
        const killed = forceQuitApp(app);
        if (killed) {
          await sleep(150);
          const aliveAfterForce = await isAppRunning(app, executor);
          if (!aliveAfterForce) {
            results.push({ app, success: true, forced: true });
            continue;
          }
        }
        results.push({
          app,
          success: false,
          forced: true,
          error: signalError ?? "App remained running after force quit",
        });
        continue;
      }

      results.push({
        app,
        success: false,
        forced: false,
        error:
          signalError ??
          "App is still running (may have unsaved changes or prompt)",
      });
    }
  }

  for (const termApp of currentTerminalApps) {
    deferredScheduler(termApp, options.force ?? false);
    results.push({
      app: termApp,
      success: true,
      forced: options.force ?? false,
    });
  }

  return results;
}

export async function handleQuitFailures(
  results: QuitResult[],
  options: CliOptions = {},
  config?: Partial<QuitxConfig>,
): Promise<QuitResult[]> {
  const failed = results.filter((r) => !r.success && !r.forced);
  if (failed.length === 0 || options.dryRun) {
    return results;
  }

  const mode = options.onQuitFailure ?? config?.onQuitFailure ?? "prompt";
  if (mode === "error") {
    return results;
  }

  if (mode === "force") {
    for (const res of failed) {
      const killed = forceQuitApp(res.app);
      if (killed) {
        await sleep(100);
        const alive = await isAppRunning(res.app);
        if (!alive) {
          res.success = true;
          res.forced = true;
          delete res.error;
          continue;
        }
      }
      res.forced = true;
      res.error = "Force quit failed";
    }
    return results;
  }

  if (mode === "prompt" && !options.yes && !options.json && !options.quiet) {
    const { confirm, isCancel } = await import("@clack/prompts");
    const appNames = failed.map((f) => f.app.name).join(", ");
    const message =
      failed.length === 1
        ? `Could not quit "${appNames}". Force quit?`
        : `Could not quit ${failed.length} apps (${appNames}). Force quit?`;

    const shouldForce = await confirm({
      message,
      initialValue: true,
    });

    if (!isCancel(shouldForce) && shouldForce === true) {
      for (const res of failed) {
        const killed = forceQuitApp(res.app);
        if (killed) {
          await sleep(100);
          const alive = await isAppRunning(res.app);
          if (!alive) {
            res.success = true;
            res.forced = true;
            delete res.error;
            continue;
          }
        }
        res.forced = true;
        res.error = "Force quit failed";
      }
    }
  }

  return results;
}
