import { isCancel, log, spinner } from "@clack/prompts";
import { loadConfig } from "../config";
import { getRunningApps } from "../macos/apps";
import { quitApps } from "../macos/quit";
import type { AppInfo, CliOptions } from "../types";
import {
  printThanks,
  renderResults,
  showCancel,
  showIntro,
  showOutro,
} from "../ui/output";
import { selectApps, shouldConfirmQuit } from "../ui/selector";

export async function interactiveCommand(
  options: CliOptions = {},
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
    includeFinder,
    includeTrash,
    includeBackground,
    groupBackground: config.groupBackground,
    neverQuitMusic,
    musicApps: options.musicApps ?? config.musicApps,
  });

  if (!options.json) {
    s.stop(
      `Found ${apps.length} running ${apps.length === 1 ? "app" : "apps"}`,
    );
  }

  if (apps.length === 0) {
    if (options.json) {
      console.log(JSON.stringify({ quit: 0, results: [] }, null, 2));
    } else {
      showOutro("No running GUI applications found to quit.");
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
            { quit: 0, results: [], error: "No matching apps running" },
            null,
            2,
          ),
        );
      } else {
        log.warn("None of the specified applications are currently running.");
        showOutro("Nothing to quit.");
        printThanks(options);
      }
      return 0;
    }
  } else {
    const selected = await selectApps(apps, {
      defaultSelectAll: config.defaultSelectAll,
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

  if (!options.yes) {
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
        ? `Simulating quit for ${targetApps.length} ${targetApps.length === 1 ? "app" : "apps"}...`
        : `Quitting ${targetApps.length} ${targetApps.length === 1 ? "app" : "apps"}...`,
    );
  }

  const results = await quitApps(targetApps, {
    force: useForce,
    dryRun: options.dryRun,
  });

  if (!options.json) {
    s.stop(options.dryRun ? "Dry run complete" : "Quitting complete");
    renderResults(results, options.dryRun);
    const successCount = results.filter((r) => r.success).length;
    const actionVerb = options.dryRun ? "Would quit" : "Quit";
    showOutro(
      `Done. ${actionVerb} ${successCount} of ${targetApps.length} apps.`,
    );
    printThanks(options);
  } else {
    console.log(
      JSON.stringify(
        {
          total: targetApps.length,
          quit: results.filter((r) => r.success).length,
          results,
        },
        null,
        2,
      ),
    );
  }

  return 0;
}
