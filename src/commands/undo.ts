import { confirm, isCancel, log, spinner } from "@clack/prompts";
import { loadRecentlyQuit, removeRecentlyQuitEntries } from "../config/recent";
import type { CliOptions, RecentlyQuitEntry } from "../types";
import { reopenApp } from "./restart";
import { printThanks, showCancel, showIntro, showOutro } from "../ui/output";

export async function undoCommand(
  options: CliOptions = {},
  dependencies?: {
    reopen?: (app: RecentlyQuitEntry) => Promise<void>;
  },
): Promise<number> {
  if (!options.json && !options.quiet) {
    showIntro();
  }

  const entries = loadRecentlyQuit();
  if (entries.length === 0) {
    if (options.json) {
      console.log(
        JSON.stringify(
          { reopened: 0, error: "No recently quit apps found" },
          null,
          2,
        ),
      );
    } else {
      log.warn("No recently quit apps found.");
      showOutro("Nothing to undo.");
      printThanks(options);
    }
    return 0;
  }

  if (!options.yes) {
    const confirmed = await confirm({
      message: `Reopen ${entries.length} recently quit ${entries.length === 1 ? "app" : "apps"}?`,
      initialValue: true,
    });

    if (isCancel(confirmed) || confirmed !== true) {
      showCancel("Cancelled.");
      printThanks(options);
      return 0;
    }
  }

  const s = spinner();
  if (!options.json && !options.quiet) {
    s.start(
      options.dryRun
        ? `[dry-run] Simulating reopen for ${entries.length} apps...`
        : `Reopening ${entries.length} apps...`,
    );
  }

  const reopenFn =
    dependencies?.reopen ??
    ((entry: RecentlyQuitEntry) =>
      reopenApp({ name: entry.name, bundleId: entry.bundleId }));

  const results: {
    app: RecentlyQuitEntry;
    success: boolean;
    error?: string;
  }[] = [];

  for (const entry of entries) {
    if (options.dryRun) {
      results.push({ app: entry, success: true });
      continue;
    }

    try {
      await reopenFn(entry);
      results.push({ app: entry, success: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({ app: entry, success: false, error: msg });
    }
  }

  if (!options.dryRun) {
    const reopened = results.filter((r) => r.success).map((r) => r.app);
    removeRecentlyQuitEntries(reopened);
  }

  if (!options.json && !options.quiet) {
    s.stop(options.dryRun ? "Dry run complete" : "Undo complete");
    for (const res of results) {
      if (options.dryRun) {
        log.success(`[dry-run] Would reopen ${res.app.name}`);
      } else if (res.success) {
        log.success(`Reopened ${res.app.name}`);
      } else {
        log.error(`Could not reopen ${res.app.name} (${res.error})`);
      }
    }

    const successCount = results.filter((r) => r.success).length;
    showOutro(
      `${options.dryRun ? "Would reopen" : "Reopened"} ${successCount} of ${entries.length} applications.`,
    );
    printThanks(options);
  } else {
    console.log(
      JSON.stringify(
        {
          total: entries.length,
          reopened: results.filter((r) => r.success).length,
          results,
        },
        null,
        2,
      ),
    );
  }

  return results.some((r) => !r.success) ? 1 : 0;
}
