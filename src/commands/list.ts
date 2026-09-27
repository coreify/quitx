import { loadConfig } from "../config";
import { getRunningApps } from "../macos/apps";
import type { CliOptions } from "../types";
import { renderList } from "../ui/output";

export async function listCommand(options: CliOptions = {}): Promise<number> {
  const config = loadConfig();
  const apps = await getRunningApps(config.exclude);

  renderList(apps, options.json);
  return 0;
}
