import { confirm, isCancel, spinner } from "@clack/prompts";
import { loadConfig, saveStash } from "../config";
import { getRunningApps } from "../macos/apps";
import { quitApps } from "../macos/quit";
import type { CliOptions, StashData } from "../types";
import {
  printThanks,
  renderResults,
  showCancel,
  showIntro,
  showOutro,
} from "../ui/output";

export async function stashCommand(options: CliOptions = {}): Promise<number> {
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
    keep: options.keep,
    windowless: options.windowless,
    sortBy: options.sortBy ?? config.sortBy,
    includeFinder,
    includeTrash,
    includeBackground,
    groupBackground: config.groupBackground,
    neverQuitMusic,
    musicApps: options.musicApps ?? config.musicApps,
  });

  if (apps.length === 0) {
    if (options.json) {
      console.log(JSON.stringify({ stashed: 0, apps: [] }, null, 2));
    } else {
      showOutro("No running applications found to stash.");
      printThanks(options);
    }
    return 0;
  }

  if (!options.yes) {
    const confirmed = await confirm({
      message: `Stash and quit ${apps.length} running ${apps.length === 1 ? "app" : "apps"}?`,
      initialValue: true,
    });

    if (isCancel(confirmed) || confirmed !== true) {
      showCancel("Cancelled.");
      printThanks(options);
      return 0;
    }
  }

  const stashData: StashData = {
    timestamp: new Date().toISOString(),
    apps: apps.map((a) => ({
      name: a.name,
      bundleId: a.bundleId,
    })),
  };

  if (!options.dryRun) {
    saveStash(stashData);
  }

  const s = spinner();
  if (!options.json) {
    s.start(
      options.dryRun
        ? `[dry-run] Stashing ${apps.length} apps...`
        : `Quitting ${apps.length} stashed apps...`,
    );
  }

  const results = await quitApps(apps, {
    force: useForce,
    dryRun: options.dryRun,
  });

  if (!options.json) {
    s.stop(options.dryRun ? "Dry run complete" : "Stash complete");
    renderResults(results, options.dryRun);
    const successCount = results.filter((r) => r.success).length;
    const actionVerb = options.dryRun
      ? "Would stash and quit"
      : "Stashed and quit";
    showOutro(
      `${actionVerb} ${successCount} of ${apps.length} apps. Run "quitx restore" to reopen them.`,
    );
    printThanks(options);
  } else {
    console.log(
      JSON.stringify(
        {
          timestamp: stashData.timestamp,
          stashed: apps.length,
          quit: results.filter((r) => r.success).length,
          apps: stashData.apps,
          results,
        },
        null,
        2,
      ),
    );
  }

  return 0;
}
