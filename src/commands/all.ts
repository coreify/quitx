import { isCancel, spinner } from "@clack/prompts";
import { loadConfig } from "../config";
import { getRunningApps } from "../macos/apps";
import { quitApps } from "../macos/quit";
import type { CliOptions } from "../types";
import {
  printThanks,
  renderResults,
  showCancel,
  showIntro,
  showOutro,
} from "../ui/output";
import { shouldConfirmQuit } from "../ui/selector";

export async function allCommand(options: CliOptions = {}): Promise<number> {
  if (!options.json) {
    showIntro();
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

  if (apps.length === 0) {
    if (options.json) {
      console.log(JSON.stringify({ quit: 0, results: [] }, null, 2));
    } else {
      showOutro("No running apps found to quit.");
      printThanks(options);
    }
    return 0;
  }

  if (!options.yes) {
    const confirmation = await shouldConfirmQuit(apps.length, true, false);
    if (isCancel(confirmation) || confirmation !== true) {
      showCancel("Cancelled.");
      printThanks(options);
      return 0;
    }
  }

  const s = spinner();
  if (!options.json) {
    s.start(
      options.dryRun
        ? `Simulating quit for ${apps.length} apps...`
        : `Quitting ${apps.length} apps...`,
    );
  }

  const results = await quitApps(apps, {
    force: useForce,
    dryRun: options.dryRun,
  });

  if (!options.json) {
    s.stop(options.dryRun ? "Dry run complete" : "Quitting complete");
    renderResults(results, options.dryRun);
    const successCount = results.filter((r) => r.success).length;
    const actionVerb = options.dryRun ? "Would quit" : "Quit";
    showOutro(`${actionVerb} ${successCount} of ${apps.length} apps.`);
    printThanks(options);
  } else {
    console.log(
      JSON.stringify(
        {
          total: apps.length,
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
