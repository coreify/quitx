import { isCancel, log, multiselect, select } from "@clack/prompts";
import {
  addExcludedApps,
  addMusicApps,
  DEFAULT_CONFIG,
  loadConfig,
  removeExcludedApps,
  removeMusicApps,
  saveConfig,
} from "../config";
import { getRunningApps } from "../macos/apps";
import { printThanks, showIntro, showOutro } from "../ui/output";
import { BACK_VALUE, backOption } from "../ui/selector";

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
      backOption(),
    ],
    initialValue: config.force,
  });

  if (isCancel(choice) || choice === BACK_VALUE) return;
  config.force = choice as "normal" | "force";
  saveConfig(config);
  log.success(`Quit mode set to: ${config.force}`);
}

async function toggleIncludeFinder(): Promise<void> {
  const config = loadConfig();
  const choice = await select({
    message: `Include Finder (current: ${config.includeFinder ? "enabled" : "disabled"})`,
    options: [
      {
        value: "disabled",
        label: "Disabled",
        hint: "Finder is excluded from the quit list. Recommended — Finder restarts automatically and quitting it rarely helps.",
      },
      {
        value: "enabled",
        label: "Enabled",
        hint: "Finder appears in the quit list like any other app. Useful if you want to fully restart Finder.",
      },
      backOption(),
    ],
    initialValue: config.includeFinder ? "enabled" : "disabled",
  });

  if (isCancel(choice) || choice === BACK_VALUE) return;
  config.includeFinder = choice === "enabled";
  saveConfig(config);
  log.success(
    `Include Finder: ${config.includeFinder ? "enabled" : "disabled"}`,
  );
}

async function toggleIncludeTrash(): Promise<void> {
  const config = loadConfig();
  const choice = await select({
    message: `Include Trash (current: ${config.includeTrash ? "enabled" : "disabled"})`,
    options: [
      {
        value: "disabled",
        label: "Disabled",
        hint: "Trash is excluded from the quit list.",
      },
      {
        value: "enabled",
        label: "Enabled",
        hint: "Trash appears in the quit list like an app and empties when quit.",
      },
      backOption(),
    ],
    initialValue: config.includeTrash ? "enabled" : "disabled",
  });

  if (isCancel(choice) || choice === BACK_VALUE) return;
  config.includeTrash = choice === "enabled";
  saveConfig(config);
  log.success(`Include Trash: ${config.includeTrash ? "enabled" : "disabled"}`);
}

async function toggleIncludeBackground(): Promise<void> {
  const config = loadConfig();
  const choice = await select({
    message: `Background Apps (current: ${config.includeBackground ? "enabled" : "disabled"})`,
    options: [
      {
        value: "disabled",
        label: "Disabled",
        hint: "Only shows foreground GUI apps. This is the default and safest option — system daemons stay hidden.",
      },
      {
        value: "enabled",
        label: "Enabled",
        hint: "Shows ALL application processes including background agents and helpers. Use with caution — quitting system processes can cause instability.",
      },
      backOption(),
    ],
    initialValue: config.includeBackground ? "enabled" : "disabled",
  });

  if (isCancel(choice) || choice === BACK_VALUE) return;
  config.includeBackground = choice === "enabled";
  saveConfig(config);
  log.success(
    `Background apps: ${config.includeBackground ? "enabled" : "disabled"}`,
  );
}

async function toggleDefaultSelection(): Promise<void> {
  const config = loadConfig();
  const currentVal = config.defaultSelectAll ? "select-all" : "deselect-all";
  const choice = await select({
    message: `Default App Selection (current: ${currentVal})`,
    options: [
      {
        value: "select-all",
        label: "Select all apps",
        hint: "All apps are pre-selected by default when launching quitx.",
      },
      {
        value: "deselect-all",
        label: "Deselect all apps",
        hint: "No apps are selected by default. Pick specific apps to quit.",
      },
      backOption(),
    ],
    initialValue: currentVal,
  });

  if (isCancel(choice) || choice === BACK_VALUE) return;
  config.defaultSelectAll = choice === "select-all";
  saveConfig(config);
  log.success(
    `Default selection: ${config.defaultSelectAll ? "select-all" : "deselect-all"}`,
  );
}

async function toggleGroupBackground(): Promise<void> {
  const config = loadConfig();
  const choice = await select({
    message: `Group Background Instances (current: ${config.groupBackground ? "enabled" : "disabled"})`,
    options: [
      {
        value: "enabled",
        label: "Enabled",
        hint: "Combines multiple instances of the same background app into a single item with instance count.",
      },
      {
        value: "disabled",
        label: "Disabled",
        hint: "Lists each background instance separately with its process ID (PID).",
      },
      backOption(),
    ],
    initialValue: config.groupBackground ? "enabled" : "disabled",
  });

  if (isCancel(choice) || choice === BACK_VALUE) return;
  config.groupBackground = choice === "enabled";
  saveConfig(config);
  log.success(
    `Group background instances: ${config.groupBackground ? "enabled" : "disabled"}`,
  );
}

async function toggleNeverQuitMusic(): Promise<void> {
  const config = loadConfig();
  const choice = await select({
    message: `Never Quit Music Apps (current: ${config.neverQuitMusic ? "enabled" : "disabled"})`,
    options: [
      {
        value: "enabled",
        label: "Enabled",
        hint: "Never show or quit music players (Spotify, Apple Music, Tidal, etc.) to keep your audio playing.",
      },
      {
        value: "disabled",
        label: "Disabled",
        hint: "Include music apps in quit list normally.",
      },
      backOption(),
    ],
    initialValue: config.neverQuitMusic ? "enabled" : "disabled",
  });

  if (isCancel(choice) || choice === BACK_VALUE) return;
  config.neverQuitMusic = choice === "enabled";
  saveConfig(config);
  log.success(
    `Never quit music apps: ${config.neverQuitMusic ? "enabled" : "disabled"}`,
  );
}

async function manageExcludedApps(): Promise<void> {
  const choice = await select({
    message: "Manage excluded apps",
    options: [
      { value: "add", label: "Add running apps to exclude list" },
      { value: "remove", label: "Remove apps from exclude list" },
      { value: "view", label: "View current exclude list" },
      backOption(),
    ],
  });

  if (isCancel(choice) || choice === BACK_VALUE) return;

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
    const available = await getRunningApps({
      exclude: config.exclude,
      includeFinder: config.includeFinder,
      includeBackground: config.includeBackground,
      groupBackground: config.groupBackground,
    });

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

async function manageCustomMusicApps(): Promise<void> {
  const choice = await select({
    message: "Manage custom music apps",
    options: [
      { value: "add", label: "Add running apps to custom music list" },
      { value: "remove", label: "Remove apps from custom music list" },
      { value: "view", label: "View current custom music list" },
      backOption(),
    ],
  });

  if (isCancel(choice) || choice === BACK_VALUE) return;

  const config = loadConfig();

  if (choice === "view") {
    if (config.musicApps.length === 0) {
      log.info("No custom music apps registered.");
    } else {
      log.info(
        `Custom music apps:\n${config.musicApps.map((e) => `  - ${e}`).join("\n")}`,
      );
    }
    return;
  }

  if (choice === "add") {
    const available = await getRunningApps({
      exclude: config.exclude,
      includeFinder: config.includeFinder,
      includeBackground: config.includeBackground,
      groupBackground: config.groupBackground,
      neverQuitMusic: false,
    });

    const unadded = available.filter(
      (a) =>
        !config.musicApps.some(
          (m) =>
            m.toLowerCase() === a.name.toLowerCase() ||
            (a.bundleId && m.toLowerCase() === a.bundleId.toLowerCase()),
        ),
    );

    if (unadded.length === 0) {
      log.info("All running apps are already in custom music list.");
      return;
    }

    const selected = await multiselect({
      message: "Select apps to mark as music players",
      options: unadded.map((a) => ({
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

    addMusicApps(selected);
    log.success(`Added ${selected.length} apps to custom music list.`);
    return;
  }

  if (choice === "remove") {
    if (config.musicApps.length === 0) {
      log.info("No apps currently in custom music list.");
      return;
    }

    const selected = await multiselect({
      message: "Select apps to remove from custom music list",
      options: config.musicApps.map((name) => ({
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

    removeMusicApps(selected);
    log.success(`Removed ${selected.length} apps from custom music list.`);
  }
}

function resetConfig(): void {
  saveConfig({ ...DEFAULT_CONFIG, exclude: [], musicApps: [] });
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
          label: "Quit Mode",
          hint: `current: ${config.force}`,
        },
        {
          value: "default-select",
          label: "Default App Selection",
          hint: `current: ${config.defaultSelectAll ? "select-all" : "deselect-all"}`,
        },
        {
          value: "group-background",
          label: "Group Background Instances",
          hint: `current: ${config.groupBackground ? "enabled" : "disabled"}`,
        },
        {
          value: "never-quit-music",
          label: "Never Quit Music Apps",
          hint: `current: ${config.neverQuitMusic ? "enabled" : "disabled"}`,
        },
        {
          value: "finder",
          label: "Include Finder",
          hint: `current: ${config.includeFinder ? "enabled" : "disabled"}`,
        },
        {
          value: "trash",
          label: "Include Trash",
          hint: `current: ${config.includeTrash ? "enabled" : "disabled"}`,
        },
        {
          value: "background",
          label: "Include Background Apps",
          hint: `current: ${config.includeBackground ? "enabled" : "disabled"}`,
        },
        {
          value: "exclude",
          label: "Excluded Apps",
          hint: `${config.exclude.length} excluded`,
        },
        {
          value: "custom-music",
          label: "Custom Music Apps",
          hint: `${config.musicApps.length} custom apps`,
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
    if (choice === "default-select") await toggleDefaultSelection();
    if (choice === "group-background") await toggleGroupBackground();
    if (choice === "never-quit-music") await toggleNeverQuitMusic();
    if (choice === "finder") await toggleIncludeFinder();
    if (choice === "trash") await toggleIncludeTrash();
    if (choice === "background") await toggleIncludeBackground();
    if (choice === "exclude") await manageExcludedApps();
    if (choice === "custom-music") await manageCustomMusicApps();
    if (choice === "reset") resetConfig();
  }

  showOutro("Config saved.");
  printThanks();
  return 0;
}
