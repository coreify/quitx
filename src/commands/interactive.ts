import { isCancel, log, spinner } from "@clack/prompts";
import { getRunningApps } from "../macos/apps";
import { quitApps } from "../macos/quit";
import type { AppInfo, CliOptions } from "../types";
import {
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

  const apps = await getRunningApps({
    includeFinder: options.includeFinder,
    includeTerminal: options.includeTerminal,
    exclude: options.exclude,
  });

  if (!options.json) {
    s.stop(`Found ${apps.length} running ${apps.length === 1 ? "app" : "apps"}`);
  }

  if (apps.length === 0) {
    if (options.json) {
      console.log(JSON.stringify({ quit: 0, results: [] }, null, 2));
    } else {
      showOutro("No running GUI applications found to quit.");
    }
    return 0;
  }

  let targetApps: AppInfo[] = [];

  // If specific apps were passed via arguments, e.g. `quitx Spotify Discord`
  if (options.apps && options.apps.length > 0) {
    const targets = new Set(options.apps.map((a) => a.toLowerCase().trim()));
    targetApps = apps.filter(
      (app) =>
        targets.has(app.name.toLowerCase().trim()) ||
        (app.bundleId && targets.has(app.bundleId.toLowerCase().trim())),
    );

    if (targetApps.length === 0) {
      if (options.json) {
        console.log(JSON.stringify({ quit: 0, results: [], error: "No matching apps running" }, null, 2));
      } else {
        log.warn("None of the specified applications are currently running.");
        showOutro("Nothing to quit.");
      }
      return 0;
    }
  } else {
    // Interactive selector
    const selected = await selectApps(apps);
    if (isCancel(selected)) {
      showCancel("Cancelled.");
      return 0;
    }

    if (selected.length === 0) {
      showOutro("No apps selected.");
      return 0;
    }

    targetApps = selected;
  }

  // Confirmation step (PLAN.md Section 18: 1-3 apps skip confirm, 4+ apps confirm)
  if (!options.yes) {
    const confirmation = await shouldConfirmQuit(targetApps.length, false, false);
    if (isCancel(confirmation) || confirmation !== true) {
      showCancel("Cancelled.");
      return 0;
    }
  }

  if (!options.json) {
    s.start(`Quitting ${targetApps.length} ${targetApps.length === 1 ? "app" : "apps"}...`);
  }

  const results = await quitApps(targetApps, { force: options.force });

  if (!options.json) {
    s.stop("Quitting complete");
    renderResults(results);
    const successCount = results.filter((r) => r.success).length;
    showOutro(`Done. Quit ${successCount} of ${targetApps.length} apps.`);
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
