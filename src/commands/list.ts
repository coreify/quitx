import { getRunningApps } from "../macos/apps";
import type { CliOptions } from "../types";
import { renderList } from "../ui/output";

export async function listCommand(options: CliOptions = {}): Promise<number> {
  const apps = await getRunningApps({
    includeFinder: options.includeFinder,
    includeTerminal: options.includeTerminal,
    exclude: options.exclude,
  });

  renderList(apps, options.json);
  return 0;
}
