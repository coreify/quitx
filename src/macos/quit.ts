import { spawn } from "node:child_process";
import type { AppInfo, QuitOptions, QuitResult } from "../types";
import { sleep } from "../utils/sleep";
import { isAppRunning } from "./apps";
import { buildAppMatcherScript } from "./jxa";
import { runJXA, type ScriptExecutor } from "./osascript";
import { isCurrentTerminalApp } from "./terminal";

const QUIT_JXA_SCRIPT = buildAppMatcherScript(`
const bundleId = argv[0] || '';
const name = argv[1] || '';
const pidStr = argv[2] || '';
const targetPid = pidStr ? parseInt(pidStr, 10) : 0;
const bid = app.bundleIdentifier ? app.bundleIdentifier.js : '';
const nm = app.localizedName ? app.localizedName.js : '';
const appPid = app.processIdentifier;

if (
  (targetPid && appPid === targetPid) ||
  (bundleId && bid === bundleId) ||
  (name && nm.toLowerCase() === name.toLowerCase())
) {
  const res = typeof app.terminate === 'function' ? app.terminate() : app.terminate;
  return String(res);
}
`);

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, "'\\''")}'`;
}

export type DeferredQuitScheduler = (app: AppInfo, force: boolean) => void;

export function defaultDeferredQuitScheduler(
  app: AppInfo,
  force = false,
): void {
  try {
    const bundleId = app.bundleId ?? "";
    const pidArg = app.pid ? ` ${shellQuote(String(app.pid))}` : "";
    const cmd =
      force && app.pid
        ? `sleep 0.4 && kill -9 ${app.pid}`
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
  const args = [app.bundleId ?? "", app.name];
  if (app.pid && app.pid > 0) {
    args.push(String(app.pid));
  }
  const res = await runJXA(QUIT_JXA_SCRIPT, args, executor);
  if (res.trim().toLowerCase() !== "true") {
    throw new Error(`Could not quit "${app.name}"`);
  }
}

export function forceQuitApp(app: AppInfo): boolean {
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

export async function quitApp(
  app: AppInfo,
  options: QuitOptions = {},
  executor?: ScriptExecutor,
  deferredScheduler: DeferredQuitScheduler = defaultDeferredQuitScheduler,
): Promise<QuitResult> {
  if (isCurrentTerminalApp(app)) {
    deferredScheduler(app, options.force ?? false);
    return { app, success: true, forced: options.force ?? false };
  }

  const maxTimeoutMs = options.timeoutMs ?? 2500;
  const pollIntervalMs = Math.min(150, maxTimeoutMs);

  try {
    await sendQuitSignal(app, executor);
  } catch (error: unknown) {
    const errorMsg =
      error instanceof Error ? error.message : "Failed to send quit event";

    // If force is requested and normal quit errored, attempt force quit immediately
    if (options.force && app.pid) {
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

  const currentTerminalApps: AppInfo[] = [];
  const otherApps: AppInfo[] = [];

  for (const app of apps) {
    if (isCurrentTerminalApp(app)) {
      currentTerminalApps.push(app);
    } else {
      otherApps.push(app);
    }
  }

  const results: QuitResult[] = [];

  if (otherApps.length > 0) {
    const maxTimeoutMs = options.timeoutMs ?? 2500;
    const pollIntervalMs = Math.min(150, maxTimeoutMs);

    await Promise.allSettled(
      otherApps.map((app) => sendQuitSignal(app, executor)),
    );

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

    for (const app of pending.values()) {
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
          error: "App remained running after force quit",
        });
        continue;
      }

      results.push({
        app,
        success: false,
        forced: false,
        error: "App is still running (may have unsaved changes or prompt)",
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
