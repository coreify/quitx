import { spawn } from "node:child_process";
import type { AppInfo, QuitOptions, QuitResult } from "../types";
import { sleep } from "../utils/sleep";
import { runAppleScript, type ScriptExecutor } from "./applescript";
import { isAppRunning } from "./apps";
import { isCurrentTerminalApp } from "./terminal";

export type DeferredQuitScheduler = (app: AppInfo, force: boolean) => void;

export function defaultDeferredQuitScheduler(
  app: AppInfo,
  force = false,
): void {
  try {
    const script = getQuitScript(app);
    const cmd =
      force && app.pid
        ? `sleep 0.4 && kill -9 ${app.pid}`
        : `sleep 0.4 && osascript -e '${script.replace(/'/g, "'\\''")}'`;
    const child = spawn("sh", ["-c", cmd], {
      detached: true,
      stdio: "ignore",
    });
    child.unref();
  } catch {
    // Ignore error
  }
}

export function getQuitScript(app: AppInfo): string {
  if (app.bundleId) {
    const escapedBundle = app.bundleId
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"');
    return `tell application id "${escapedBundle}" to quit`;
  }
  const escapedName = app.name.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  return `tell application "${escapedName}" to quit`;
}

export async function sendQuitSignal(
  app: AppInfo,
  executor?: ScriptExecutor,
): Promise<void> {
  const script = getQuitScript(app);
  try {
    await runAppleScript(script, executor);
  } catch (error: unknown) {
    // If bundleId quit failed, try by app name as fallback
    if (app.bundleId) {
      const fallbackScript = `tell application "${app.name.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}" to quit`;
      await runAppleScript(fallbackScript, executor);
      return;
    }
    throw error;
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

  const timeoutMs = options.timeoutMs ?? 600;

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

  await sleep(timeoutMs);

  const stillRunning = await isAppRunning(app, executor);
  if (!stillRunning) {
    return { app, success: true, forced: false };
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
    const timeoutMs = options.timeoutMs ?? 700;

    await Promise.allSettled(
      otherApps.map((app) => sendQuitSignal(app, executor)),
    );

    await sleep(timeoutMs);

    for (const app of otherApps) {
      const stillRunning = await isAppRunning(app, executor);
      if (!stillRunning) {
        results.push({ app, success: true, forced: false });
        continue;
      }

      if (options.force) {
        const killed = forceQuitApp(app);
        if (killed) {
          await sleep(100);
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
