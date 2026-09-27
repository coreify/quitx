import { isCancel, note, select, spinner } from "@clack/prompts";
import { readFile } from "node:fs/promises";
import { allCommand } from "./commands/all";
import { handleConfigCli } from "./commands/config";
import { excludeCommand } from "./commands/exclude";
import { interactiveCommand } from "./commands/interactive";
import { listCommand } from "./commands/list";
import { loadConfig } from "./config";
import type { CliOptions } from "./types";
import {
  printThanks,
  renderHelp,
  renderVersion,
  showIntro,
  showOutro,
} from "./ui/output";
import {
  checkForUpdate,
  checkUpdateManually,
  ignoreUpdateVersion,
  installUpdate,
  updateNotice,
} from "./update";
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

    if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg === "config") {
      options.manageConfig = true;
      const next = args[i + 1];
      if (
        next &&
        !next.startsWith("-") &&
        ["show", "get", "set", "reset"].includes(next.toLowerCase())
      ) {
        options.configAction = next.toLowerCase() as
          "show" | "get" | "set" | "reset";
        i++;
        if (options.configAction === "get") {
          const key = args[++i];
          if (key && !key.startsWith("-")) {
            options.configKey = key;
          } else if (key) {
            i--;
          }
        } else if (options.configAction === "set") {
          const key = args[++i];
          if (key && !key.startsWith("-")) {
            options.configKey = key;
            const val = args[++i];
            if (val && !val.startsWith("-")) {
              options.configValue = val;
            } else if (val) {
              i--;
            }
          } else if (key) {
            i--;
          }
        }
      }
    } else if (arg === "exclude") {
      options.manageExclude = true;
    } else if (arg === "check-update" || arg === "--check-update") {
      options.checkUpdate = true;
    } else if (arg === "--no-update-check") {
      options.noUpdateCheck = true;
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
    } else if (arg === "--include-trash") {
      options.includeTrash = true;
    } else if (arg === "-b" || arg === "--background") {
      options.includeBackground = true;
    } else if (arg === "--never-quit-music") {
      options.neverQuitMusic = true;
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
    if (options.manageConfig) {
      if (!options.configAction) {
        throw new Error(
          `Unknown config command: "${rawPositional[0]}". Usage: quitx config [show|get|set|reset]`,
        );
      }
    } else if (options.manageExclude) {
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

export async function handleManualUpdateCheck(
  version: string,
  options: CliOptions,
): Promise<number> {
  const isInteractive =
    !options.json && Boolean(process.stdout.isTTY && process.stdin.isTTY);

  if (options.json) {
    const result = await checkUpdateManually(version, { force: options.force });
    console.log(JSON.stringify(result, null, 2));
    return 0;
  }

  if (isInteractive) {
    showIntro();
    const checkSpinner = spinner();
    checkSpinner.start("Checking npm registry for updates");
    const result = await checkUpdateManually(version, { force: options.force });
    if (result.rateLimited) {
      checkSpinner.stop(
        `Checked recently (rate limited, 60s cooldown). Latest: v${result.latestVersion}`,
      );
    } else if (result.updateAvailable) {
      checkSpinner.stop(
        `Update available: ${result.currentVersion} → ${result.latestVersion}`,
      );
    } else {
      checkSpinner.stop(`quitx is up to date (v${result.currentVersion})`);
    }

    if (result.updateAvailable) {
      note(
        `Run: npm install --global @coreify/quitx@latest`,
        "Upgrade Available",
      );
      const answer = await select({
        message: `Install v${result.latestVersion} now?`,
        options: [
          { value: "install", label: "Install update now" },
          { value: "skip", label: "Skip for now" },
        ],
        initialValue: "install",
      });
      if (isCancel(answer) || answer === "skip") {
        printThanks(options);
        return 0;
      }
      if (answer === "install") {
        console.log(`Updating to ${result.latestVersion}...`);
        try {
          await installUpdate(result.latestVersion);
          showOutro(
            `Updated to ${result.latestVersion}. Restart quitx to use it.`,
          );
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`Failed to install update: ${msg}`);
        }
      }
    }
    printThanks(options);
    return 0;
  }

  const result = await checkUpdateManually(version, { force: options.force });
  if (result.updateAvailable) {
    console.log(
      `Update available: ${result.currentVersion} → ${result.latestVersion}`,
    );
    console.log("Run: npm install --global @coreify/quitx@latest");
  } else {
    console.log(`quitx is up to date (${result.currentVersion})`);
  }
  if (result.rateLimited) {
    console.log(
      "(Checked recently with 60s rate limit; use --force to bypass)",
    );
  }
  printThanks(options);
  return 0;
}

export async function handleAutoUpdateCheck(
  currentVersion: string,
  options: CliOptions,
): Promise<void> {
  if (
    options.noUpdateCheck ||
    options.checkUpdate ||
    options.help ||
    options.version ||
    options.dryRun
  ) {
    return;
  }

  const config = loadConfig();
  if (config.autoUpdate === false) {
    return;
  }

  try {
    const update = await checkForUpdate(currentVersion);
    if (!update) return;

    if (
      options.json ||
      options.yes ||
      !process.stdin.isTTY ||
      !process.stdout.isTTY
    ) {
      console.error(updateNotice(update));
      return;
    }

    console.log(
      `\nUpdate available · ${update.currentVersion} → ${update.latestVersion}\nRelease notes: ${update.releaseUrl}`,
    );
    const action = await select({
      message: "Update quitx?",
      options: [
        { value: "update", label: "Update now", hint: "npm install --global" },
        { value: "skip", label: "Skip" },
        {
          value: "ignore",
          label: "Skip this version",
          hint: `hide ${update.latestVersion}`,
        },
      ],
      initialValue: "update",
    });
    if (isCancel(action) || action === "skip") {
      return;
    }
    if (action === "ignore") {
      await ignoreUpdateVersion(update.latestVersion);
      return;
    }

    console.log(`Updating to ${update.latestVersion}...`);
    try {
      await installUpdate(update.latestVersion);
      showOutro(`Updated to ${update.latestVersion}. Restart quitx to use it.`);
      process.exit(0);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`Failed to install update: ${msg}`);
    }
  } catch {
    // Non-blocking
  }
}

export async function main(argv = process.argv.slice(2)): Promise<number> {
  if (!isMacOS()) {
    console.error(
      "✖ quitx only works on macOS. Windows and Linux are not supported.",
    );
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

  const version = await getPackageVersion();

  if (options.version) {
    renderVersion(version);
    printThanks(options);
    return 0;
  }

  if (options.checkUpdate) {
    return await handleManualUpdateCheck(version, options);
  }

  if (!options.noUpdateCheck && !options.json) {
    await handleAutoUpdateCheck(version, options);
  }

  try {
    if (options.manageConfig) {
      return await handleConfigCli(options);
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

const scriptName = process.argv[1]
  ? process.argv[1].replace(/\\/g, "/").split("/").pop()?.toLowerCase()
  : "";

const isMain =
  scriptName === "cli.ts" ||
  scriptName === "cli.js" ||
  scriptName === "quitx" ||
  scriptName === "quitx.cmd" ||
  scriptName === "quitx.ps1" ||
  scriptName === "quitx.exe";

if (isMain) {
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
