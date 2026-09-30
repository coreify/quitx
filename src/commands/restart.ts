import { isCancel, log, spinner } from "@clack/prompts";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { loadConfig } from "../config";
import { getRunningApps, isAppRunning } from "../macos/apps";
import { forceQuitApp, quitApp } from "../macos/quit";
import type { AppInfo, CliOptions } from "../types";
import { printThanks, showCancel, showIntro, showOutro } from "../ui/output";
import { selectApps, shouldConfirmQuit } from "../ui/selector";

const execFileAsync = promisify(execFile);

export interface RestartResult {
  app: AppInfo;
  success: boolean;
  restarted: boolean;
  forced: boolean;
  error?: string | undefined;
}

export async function reopenApp(
  app: AppInfo,
  runner?: (file: string, args: string[]) => Promise<unknown>,
): Promise<void> {
  const run = runner ?? ((cmd, args) => execFileAsync(cmd, args));
  if (app.bundleId && app.bundleId !== "missing value") {
    await run("open", ["-b", app.bundleId]);
  } else {
    await run("open", ["-a", app.name]);
  }
}

export async function waitForAppTermination(
  app: AppInfo,
  timeoutMs = 5000,
  intervalMs = 100,
  checker?: (target: AppInfo) => Promise<boolean>,
): Promise<boolean> {
  const isRunning = checker ?? ((a) => isAppRunning(a));
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    const running = await isRunning(app);
    if (!running) {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return false;
}

export async function restartCommand(
  options: CliOptions = {},
  dependencies?: {
    reopen?: (app: AppInfo) => Promise<void>;
    wait?: (app: AppInfo) => Promise<boolean>;
  },
): Promise<number> {
  if (!options.json) {
    showIntro();
  }

  const s = spinner();
  if (!options.json) {
    s.start("Scanning running applications...");
  }

  const config = loadConfig();
  const useForce = options.force ?? config.force === "force";
  const includeFinder = options.includeFinder ?? config.includeFinder;
  const includeTrash = options.includeTrash ?? config.includeTrash;
  const includeBackground =
    options.includeBackground ?? config.includeBackground;
  const neverQuitMusic = options.neverQuitMusic ?? config.neverQuitMusic;

  const apps = await getRunningApps({
    exclude: config.exclude,
    keep: options.keep,
    windowless: options.windowless,
    sortBy: options.sortBy ?? config.sortBy,
    includeFinder,
    includeTrash,
    includeBackground,
    groupBackground: config.groupBackground,
    neverQuitMusic,
    musicApps: options.musicApps ?? config.musicApps,
    includeMemory: true,
  });

  if (!options.json) {
    s.stop(
      `Found ${apps.length} running ${apps.length === 1 ? "app" : "apps"}`,
    );
  }

  if (apps.length === 0) {
    if (options.json) {
      console.log(JSON.stringify({ restarted: 0, results: [] }, null, 2));
    } else {
      showOutro("No running applications found to restart.");
      printThanks(options);
    }
    return 0;
  }

  let targetApps: AppInfo[];

  if (options.apps && options.apps.length > 0) {
    const targets = new Set(options.apps.map((a) => a.toLowerCase().trim()));
    targetApps = apps.filter(
      (app) =>
        targets.has(app.name.toLowerCase().trim()) ||
        (app.bundleId && targets.has(app.bundleId.toLowerCase().trim())),
    );

    if (targetApps.length === 0) {
      if (options.json) {
        console.log(
          JSON.stringify(
            {
              restarted: 0,
              results: [],
              error: "No matching running apps found to restart",
            },
            null,
            2,
          ),
        );
      } else {
        log.warn("None of the specified applications are currently running.");
        showOutro("Nothing to restart.");
        printThanks(options);
      }
      return 0;
    }
  } else {
    const selected = await selectApps(apps, {
      defaultSelectAll: false,
      message: "Select apps to restart",
    });

    if (typeof selected === "symbol" || isCancel(selected)) {
      showCancel("Cancelled.");
      printThanks(options);
      return 0;
    }

    if (selected.length === 0) {
      showOutro("No apps selected.");
      printThanks(options);
      return 0;
    }

    targetApps = selected;
  }

  if (!options.yes && targetApps.length >= 4) {
    const confirmation = await shouldConfirmQuit(targetApps.length, false);
    if (isCancel(confirmation) || confirmation !== true) {
      showCancel("Cancelled.");
      printThanks(options);
      return 0;
    }
  }

  if (!options.json) {
    s.start(
      options.dryRun
        ? `Simulating restart for ${targetApps.length} ${targetApps.length === 1 ? "app" : "apps"}...`
        : `Restarting ${targetApps.length} ${targetApps.length === 1 ? "app" : "apps"}...`,
    );
  }

  const results: RestartResult[] = [];
  const reopenFn = dependencies?.reopen ?? ((app) => reopenApp(app));
  const waitFn = dependencies?.wait ?? ((app) => waitForAppTermination(app));

  for (const app of targetApps) {
    if (options.dryRun) {
      results.push({
        app,
        success: true,
        restarted: true,
        forced: useForce,
      });
      continue;
    }

    let quitRes = await quitApp(app, { force: useForce });
    if (!quitRes.success) {
      const failMode =
        options.onQuitFailure ?? config.onQuitFailure ?? "prompt";
      let forceSuccess = false;
      if (failMode === "force") {
        forceSuccess = forceQuitApp(app);
      } else if (
        failMode === "prompt" &&
        !options.yes &&
        !options.quiet &&
        !options.json
      ) {
        const { confirm, isCancel: isConfirmCancel } =
          await import("@clack/prompts");
        const shouldForce = await confirm({
          message: `Could not quit "${app.name}". Force quit to restart?`,
          initialValue: true,
        });
        if (!isConfirmCancel(shouldForce) && shouldForce === true) {
          forceSuccess = forceQuitApp(app);
        }
      }

      if (forceSuccess) {
        quitRes = { app, success: true, forced: true };
      } else {
        results.push({
          app,
          success: false,
          restarted: false,
          forced: quitRes.forced,
          error: quitRes.error ?? "Failed to quit",
        });
        continue;
      }
    }

    await waitFn(app);

    try {
      await reopenFn(app);
      results.push({
        app,
        success: true,
        restarted: true,
        forced: quitRes.forced,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({
        app,
        success: true,
        restarted: false,
        forced: quitRes.forced,
        error: `Quit succeeded but reopening failed: ${msg}`,
      });
    }
  }

  if (!options.json) {
    s.stop(options.dryRun ? "Dry run complete" : "Restart complete");
    for (const res of results) {
      if (options.dryRun) {
        log.success(`[dry-run] Would restart ${res.app.name}`);
      } else if (res.restarted) {
        log.success(`Restarted ${res.app.name}`);
      } else {
        log.error(`Could not restart ${res.app.name} (${res.error})`);
      }
    }

    const successCount = results.filter((r) => r.restarted).length;
    const actionVerb = options.dryRun ? "Would restart" : "Restarted";
    showOutro(
      `Done. ${actionVerb} ${successCount} of ${targetApps.length} apps.`,
    );
    printThanks(options);
  } else {
    console.log(
      JSON.stringify(
        {
          total: targetApps.length,
          restarted: results.filter((r) => r.restarted).length,
          results,
        },
        null,
        2,
      ),
    );
  }

  return 0;
}
