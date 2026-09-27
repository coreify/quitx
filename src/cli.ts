import { readFile } from "node:fs/promises";
import { allCommand } from "./commands/all";
import { configCommand } from "./commands/config";
import { excludeCommand } from "./commands/exclude";
import { interactiveCommand } from "./commands/interactive";
import { listCommand } from "./commands/list";
import type { CliOptions } from "./types";
import { printThanks, renderHelp, renderVersion } from "./ui/output";
import { ensureMacOS, isMacOS } from "./utils/platform";

export async function getPackageVersion(): Promise<string> {
  for (const url of [
    new URL("../package.json", import.meta.url),
    new URL("../../package.json", import.meta.url),
  ]) {
    try {
      const content = await readFile(url, "utf-8");
      const parsed: unknown = JSON.parse(content);
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        "version" in parsed &&
        typeof parsed.version === "string"
      ) {
        return parsed.version;
      }
    } catch {
      // try next
    }
  }
  return "unknown";
}

export function parseCliArgs(args: readonly string[]): CliOptions {
  const options: CliOptions = {
    apps: [],
    exclude: [],
  };
  const rawPositional: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg) continue;

    if (arg === "config") {
      options.manageConfig = true;
    } else if (arg === "exclude") {
      options.manageExclude = true;
    } else if (arg === "-a" || arg === "--all") {
      options.all = true;
    } else if (arg === "-y" || arg === "--yes") {
      options.yes = true;
    } else if (arg === "-l" || arg === "--list") {
      options.list = true;
    } else if (arg === "-f" || arg === "--force") {
      options.force = true;
    } else if (arg === "-h" || arg === "--help") {
      options.help = true;
    } else if (arg === "-v" || arg === "--version") {
      options.version = true;
    } else if (arg === "--json") {
      options.json = true;
    } else if (arg === "--include-finder") {
      options.includeFinder = true;
    } else if (arg === "-b" || arg === "--background") {
      options.includeBackground = true;
    } else if (arg === "--config") {
      options.manageConfig = true;
    } else if (arg === "--exclude") {
      const next = args[++i];
      if (next) {
        const split = next
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        options.exclude?.push(...split);
      }
    } else if (arg.startsWith("--exclude=")) {
      const val = arg.slice("--exclude=".length);
      if (val) {
        const split = val
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean);
        options.exclude?.push(...split);
      }
    } else if (arg.startsWith("-")) {
      continue;
    } else {
      rawPositional.push(arg);
    }
  }

  if (rawPositional.length > 0) {
    if (options.manageExclude) {
      if (
        rawPositional.length > 1 &&
        !rawPositional.some((a) => a.includes(","))
      ) {
        throw new Error(
          "Multiple exclude applications must be comma-separated, not space-separated. Example: quitx exclude Spotify,Discord",
        );
      }
      const combined = rawPositional.join(" ");
      const split = combined
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (split.length === 0) {
        throw new Error(
          "No application name specified to exclude. Example: quitx exclude Spotify,Discord",
        );
      }
      options.exclude?.push(...split);
    } else {
      if (
        rawPositional.length > 1 &&
        !rawPositional.some((a) => a.includes(","))
      ) {
        throw new Error(
          'Multiple applications must be comma-separated, not space-separated. Example: quitx Slack,Discord. For names with spaces, use quotes: quitx "Google Chrome"',
        );
      }
      const combined = rawPositional.join(" ");
      const split = combined
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (split.length === 0) {
        throw new Error(
          'No application name specified. Example: quitx Slack,Discord. For names with spaces, use quotes: quitx "Google Chrome"',
        );
      }
      options.apps?.push(...split);
    }
  }

  return options;
}

export async function main(argv = process.argv.slice(2)): Promise<number> {
  if (!isMacOS()) {
    console.error("✖ quitx only works on macOS.");
    return 1;
  }
  ensureMacOS();

  let options: CliOptions = {};
  try {
    options = parseCliArgs(argv);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`✖ Error: ${msg}`);
    return 1;
  }

  if (process.stdin.isTTY) {
    process.once("SIGINT", () => {
      printThanks(options);
      process.exit(130);
    });
  }

  if (options.help) {
    renderHelp();
    printThanks(options);
    return 0;
  }

  if (options.version) {
    const version = await getPackageVersion();
    renderVersion(version);
    printThanks(options);
    return 0;
  }

  try {
    if (options.manageConfig) {
      return await configCommand();
    }

    if (
      options.manageExclude ||
      (options.exclude && options.exclude.length > 0)
    ) {
      return await excludeCommand(options);
    }

    if (options.list) {
      const code = await listCommand(options);
      printThanks(options);
      return code;
    }

    if (options.all) {
      return await allCommand(options);
    }

    return await interactiveCommand(options);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`✖ Error: ${msg}`);
    printThanks(options);
    return 1;
  }
}

if (
  process.argv[1] &&
  (process.argv[1].endsWith("/cli.ts") ||
    process.argv[1].endsWith("/cli.js") ||
    process.argv[1].endsWith("/quitx"))
) {
  main()
    .then((code) => {
      if (code !== 0) {
        process.exit(code);
      }
    })
    .catch((err: unknown) => {
      console.error(err);
      process.exit(1);
    });
}
