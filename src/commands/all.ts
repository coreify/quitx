import { isCancel, spinner } from "@clack/prompts";
import { getRunningApps } from "../macos/apps";
import { quitApps } from "../macos/quit";
import type { CliOptions } from "../types";
import {
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

  const apps = await getRunningApps({
    includeFinder: options.includeFinder,
    includeTerminal: options.includeTerminal,
    exclude: options.exclude,
  });

  if (apps.length === 0) {
    if (options.json) {
      console.log(JSON.stringify({ quit: 0, results: [] }, null, 2));
    } else {
      showOutro("No running apps found to quit.");
    }
    return 0;
  }

  if (!options.yes) {
    const confirmation = await shouldConfirmQuit(apps.length, true, false);
    if (isCancel(confirmation) || confirmation !== true) {
      showCancel("Cancelled.");
      return 0;
    }
  }

  const s = spinner();
  if (!options.json) {
    s.start(`Quitting ${apps.length} apps...`);
  }

  const results = await quitApps(apps, { force: options.force });

  if (!options.json) {
    s.stop("Quitting complete");
    renderResults(results);
    const successCount = results.filter((r) => r.success).length;
    showOutro(`Quit ${successCount} of ${apps.length} apps.`);
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
