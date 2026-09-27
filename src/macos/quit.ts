import type { AppInfo, QuitOptions, QuitResult } from "../types";
import { sleep } from "../utils/sleep";
import { runAppleScript, type ScriptExecutor } from "./applescript";
import { isAppRunning } from "./apps";

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
): Promise<QuitResult> {
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

  // Wait for application to process quit event
  await sleep(timeoutMs);

  const stillRunning = await isAppRunning(app, executor);
  if (!stillRunning) {
    return { app, success: true, forced: false };
  }

  // If still running and force is requested
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
): Promise<QuitResult[]> {
  if (apps.length === 0) {
    return [];
  }

  // Parallel quit flow as described in PLAN.md Section 35
  const timeoutMs = options.timeoutMs ?? 700;

  // 1. Send quit requests to all apps in parallel
  await Promise.allSettled(apps.map((app) => sendQuitSignal(app, executor)));

  // 2. Wait briefly
  await sleep(timeoutMs);

  // 3. Verify exit status and handle force quit if needed
  const results: QuitResult[] = [];
  for (const app of apps) {
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

  return results;
}
