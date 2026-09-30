import { loadConfig } from "../config";
import { getRunningApps } from "../macos/apps";
import type { CliOptions } from "../types";
import { renderList } from "../ui/output";

export async function listCommand(options: CliOptions = {}): Promise<number> {
  const config = loadConfig();
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
    includeMemory: options.sortBy === "memory" || options.json === true,
  });

  renderList(apps, options.json);

  return 0;
}
