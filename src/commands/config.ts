import { isCancel, log, multiselect, select } from "@clack/prompts";
import {
  addExcludedApps,
  DEFAULT_CONFIG,
  loadConfig,
  removeExcludedApps,
  saveConfig,
} from "../config";
import { getRunningApps } from "../macos/apps";
import { printThanks, showIntro, showOutro } from "../ui/output";

async function toggleQuitMode(): Promise<void> {
  const config = loadConfig();
  const choice = await select({
    message: `Quit Mode (current: ${config.force})`,
    options: [
      {
        value: "normal",
        label: "Normal Quit",
        hint: "Sends a graceful quit signal. Apps may prompt to save unsaved work before closing.",
      },
      {
        value: "force",
        label: "Force Quit",
        hint: "Immediately kills processes (SIGKILL). Unsaved work will be lost. Use when apps are unresponsive.",
      },
    ],
    initialValue: config.force,
  });

  if (isCancel(choice)) return;
  config.force = choice;
  saveConfig(config);
  log.success(`Quit mode set to: ${config.force}`);
}

async function toggleIncludeFinder(): Promise<void> {
  const config = loadConfig();
  const choice = await select({
    message: `Include Finder (current: ${config.includeFinder ? "enabled" : "disabled"})`,
    options: [
      {
        value: false,
        label: "Disabled",
        hint: "Finder is excluded from the quit list. Recommended — Finder restarts automatically and quitting it rarely helps.",
      },
      {
        value: true,
        label: "Enabled",
        hint: "Finder appears in the quit list like any other app. Useful if you want to fully restart Finder.",
      },
    ],
    initialValue: config.includeFinder,
  });

  if (isCancel(choice)) return;
  config.includeFinder = choice;
  saveConfig(config);
  log.success(
    `Include Finder: ${config.includeFinder ? "enabled" : "disabled"}`,
  );
}

async function toggleIncludeBackground(): Promise<void> {
  const config = loadConfig();
  const choice = await select({
    message: `Background Apps (current: ${config.includeBackground ? "enabled" : "disabled"})`,
    options: [
      {
        value: false,
        label: "Disabled",
        hint: "Only shows foreground GUI apps. This is the default and safest option — system daemons stay hidden.",
      },
      {
        value: true,
        label: "Enabled",
        hint: "Shows ALL application processes including background agents and helpers. Use with caution — quitting system processes can cause instability.",
      },
    ],
    initialValue: config.includeBackground,
  });

  if (isCancel(choice)) return;
  config.includeBackground = choice;
  saveConfig(config);
  log.success(
    `Background apps: ${config.includeBackground ? "enabled" : "disabled"}`,
  );
}

async function manageExcludedApps(): Promise<void> {
  const choice = await select({
    message: "Manage excluded apps",
    options: [
      { value: "add", label: "Add running apps to exclude list" },
      { value: "remove", label: "Remove apps from exclude list" },
      { value: "view", label: "View current exclude list" },
    ],
  });

  if (isCancel(choice)) return;

  const config = loadConfig();

  if (choice === "view") {
    if (config.exclude.length === 0) {
      log.info("No apps currently excluded.");
    } else {
      log.info(
        `Excluded apps:\n${config.exclude.map((e) => `  - ${e}`).join("\n")}`,
      );
    }
    return;
  }

  if (choice === "add") {
    const apps = await getRunningApps();
    const currentSet = new Set(
      config.exclude.map((e) => e.toLowerCase().trim()),
    );
    const available = apps.filter(
      (a) =>
        !currentSet.has(a.name.toLowerCase().trim()) &&
        !(a.bundleId && currentSet.has(a.bundleId.toLowerCase().trim())),
    );

    if (available.length === 0) {
      log.info("All running apps are already excluded.");
      return;
    }

    const selected = await multiselect({
      message: "Select apps to exclude from quitting",
      options: available.map((a) => ({
        value: a.name,
        label: a.name,
        ...(a.bundleId ? { hint: a.bundleId } : {}),
      })),
      required: false,
    });

    if (isCancel(selected)) return;
    if (!Array.isArray(selected) || selected.length === 0) {
      log.info("No apps selected.");
      return;
    }

    addExcludedApps(selected);
    log.success(`Added ${selected.length} apps to exclude list.`);
    return;
  }

  if (choice === "remove") {
    if (config.exclude.length === 0) {
      log.info("No apps currently in exclude list.");
      return;
    }

    const selected = await multiselect({
      message: "Select apps to remove from exclude list",
      options: config.exclude.map((name) => ({
        value: name,
        label: name,
      })),
      required: false,
    });

    if (isCancel(selected)) return;
    if (!Array.isArray(selected) || selected.length === 0) {
      log.info("No apps selected.");
      return;
    }

    removeExcludedApps(selected);
    log.success(`Removed ${selected.length} apps from exclude list.`);
  }
}

function resetConfig(): void {
  saveConfig({ ...DEFAULT_CONFIG, exclude: [] });
  log.success("Config reset to defaults.");
}

export async function configCommand(): Promise<number> {
  showIntro();

  let running = true;
  while (running) {
    const config = loadConfig();
    const choice = await select({
      message: "Configuration",
      options: [
        {
          value: "quit-mode",
          label: `Toggle Quit Mode`,
          hint: `current: ${config.force}`,
        },
        {
          value: "finder",
          label: `Toggle Include Finder`,
          hint: `current: ${config.includeFinder ? "enabled" : "disabled"}`,
        },
        {
          value: "background",
          label: `Toggle Background Apps`,
          hint: `current: ${config.includeBackground ? "enabled" : "disabled"}`,
        },
        {
          value: "exclude",
          label: "Manage Excluded Apps",
          hint: `${config.exclude.length} excluded`,
        },
        {
          value: "reset",
          label: "Reset to Defaults",
          hint: "restore all settings",
        },
        { value: "exit", label: "Exit" },
      ],
    });

    if (isCancel(choice) || choice === "exit") {
      running = false;
      continue;
    }

    if (choice === "quit-mode") await toggleQuitMode();
    if (choice === "finder") await toggleIncludeFinder();
    if (choice === "background") await toggleIncludeBackground();
    if (choice === "exclude") await manageExcludedApps();
    if (choice === "reset") resetConfig();
  }

  showOutro("Config saved.");
  printThanks();
  return 0;
}
