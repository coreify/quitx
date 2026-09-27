import { loadConfig } from "../config";
import { getRunningApps } from "../macos/apps";
import type { CliOptions } from "../types";
import { renderList } from "../ui/output";

export async function listCommand(options: CliOptions = {}): Promise<number> {
  const config = loadConfig();
  const includeFinder = options.includeFinder ?? config.includeFinder;
  const includeBackground =
    options.includeBackground ?? config.includeBackground;

  const apps = await getRunningApps({
    exclude: config.exclude,
    includeFinder,
    includeBackground,
    groupBackground: config.groupBackground,
  });

  renderList(apps, options.json);
  return 0;
}
