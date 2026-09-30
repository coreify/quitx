import { confirm, isCancel, log, spinner } from "@clack/prompts";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { clearStash, loadStash } from "../config";
import type { CliOptions, StashAppEntry } from "../types";
import { printThanks, showCancel, showIntro, showOutro } from "../ui/output";

const execFileAsync = promisify(execFile);

export async function reopenStashedApp(
  app: StashAppEntry,
  runner?: (file: string, args: string[]) => Promise<unknown>,
): Promise<void> {
  const run = runner ?? ((cmd, args) => execFileAsync(cmd, args));
  if (app.bundleId && app.bundleId !== "missing value") {
    await run("open", ["-b", app.bundleId]);
  } else {
    await run("open", ["-a", app.name]);
  }
}

export async function restoreCommand(
  options: CliOptions = {},
  dependencies?: {
    reopen?: (app: StashAppEntry) => Promise<void>;
  },
): Promise<number> {
  if (!options.json) {
    showIntro();
  }

  const stash = loadStash();
  if (!stash || stash.apps.length === 0) {
    if (options.json) {
      console.log(
        JSON.stringify(
          { restored: 0, error: "No stashed session found" },
          null,
          2,
        ),
      );
    } else {
      log.warn("No stashed session found.");
      showOutro("Nothing to restore.");
      printThanks(options);
    }
    return 0;
  }

  if (!options.yes) {
    const confirmed = await confirm({
      message: `Restore ${stash.apps.length} ${stash.apps.length === 1 ? "application" : "applications"} from stash?`,
      initialValue: true,
    });

    if (isCancel(confirmed) || confirmed !== true) {
      showCancel("Cancelled.");
      printThanks(options);
      return 0;
    }
  }

  const s = spinner();
  if (!options.json) {
    s.start(
      options.dryRun
        ? `[dry-run] Simulating restore for ${stash.apps.length} apps...`
        : `Restoring ${stash.apps.length} apps...`,
    );
  }

  const reopenFn =
    dependencies?.reopen ?? ((app: StashAppEntry) => reopenStashedApp(app));
  const results: { app: StashAppEntry; success: boolean; error?: string }[] =
    [];

  for (const app of stash.apps) {
    if (options.dryRun) {
      results.push({ app, success: true });
      continue;
    }

    try {
      await reopenFn(app);
      results.push({ app, success: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({ app, success: false, error: msg });
    }
  }

  if (!options.dryRun) {
    clearStash();
  }

  if (!options.json) {
    s.stop(options.dryRun ? "Dry run complete" : "Restore complete");
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
    const actionVerb = options.dryRun ? "Would restore" : "Restored";
    showOutro(
      `${actionVerb} ${successCount} of ${stash.apps.length} applications.`,
    );
    printThanks(options);
  } else {
    console.log(
      JSON.stringify(
        {
          total: stash.apps.length,
          restored: results.filter((r) => r.success).length,
          results,
        },
        null,
        2,
      ),
    );
  }

  return 0;
}
