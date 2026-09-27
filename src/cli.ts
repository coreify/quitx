import { allCommand } from "./commands/all";
import { interactiveCommand } from "./commands/interactive";
import { listCommand } from "./commands/list";
import type { CliOptions } from "./types";
import { printThanks, renderHelp, renderVersion } from "./ui/output";
import { ensureMacOS, isMacOS } from "./utils/platform";

export const VERSION = "0.1.0";

export function parseCliArgs(args: readonly string[]): CliOptions {
  const options: CliOptions = {
    exclude: [],
    apps: [],
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg) continue;

    if (arg === "-a" || arg === "--all") {
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
    } else if (arg === "--include-terminal") {
      options.includeTerminal = true;
    } else if (arg === "--exclude") {
      const next = args[++i];
      if (next) {
        options.exclude?.push(next);
      }
    } else if (arg.startsWith("--exclude=")) {
      const val = arg.slice("--exclude=".length);
      if (val) {
        options.exclude?.push(val);
      }
    } else if (arg.startsWith("-")) {
      // Ignore or handle unknown flags gracefully
      continue;
    } else {
      options.apps?.push(arg);
    }
  }

  return options;
}

export async function main(argv = process.argv.slice(2)): Promise<number> {
  // 1. Validate platform runtime first
  if (!isMacOS()) {
    console.error("✖ quitx only works on macOS.");
    return 1;
  }
  ensureMacOS();

  const options = parseCliArgs(argv);

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
    renderVersion(VERSION);
    printThanks(options);
    return 0;
  }

  try {
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

// Auto-run if executed directly as CLI
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
