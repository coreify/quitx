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
        hint: "Immediately terminates processes. Unsaved work will be lost. Use when apps are unresponsive.",
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
    message: `Include Empty Trash in list (current: ${config.includeTrash ? "enabled" : "disabled"})`,
    options: [
      {
        value: "disabled",
        label: "Disabled",
        hint: "Empty Trash is not shown in the app list.",
      },
      {
        value: "enabled",
        label: "Enabled",
        hint: "Shows 'Empty Trash' in list. Quitting it PERMANENTLY deletes all items in Trash (cannot be undone).",
      },
      backOption(),
    ],
    initialValue: config.includeTrash ? "enabled" : "disabled",
  });

  if (isCancel(choice) || choice === BACK_VALUE) return;
  config.includeTrash = choice === "enabled";
  saveConfig(config);
  log.success(
    `Include Empty Trash in list: ${config.includeTrash ? "enabled" : "disabled"}`,
  );
  if (config.includeTrash) {
    log.warn(
      "Note: Quitting 'Empty Trash' permanently and irreversibly deletes all files in macOS Trash.",
    );
  }
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

async function toggleAutoUpdate(): Promise<void> {
  const config = loadConfig();
  const choice = await select({
    message: `Automatic Update Checks (current: ${config.autoUpdate ? "enabled" : "disabled"})`,
    options: [
      {
        value: "enabled",
        label: "Enabled",
        hint: "Check npm registry in background every 6 hours for updates.",
      },
      {
        value: "disabled",
        label: "Disabled",
        hint: "Never perform automatic background update checks.",
      },
      backOption(),
    ],
    initialValue: config.autoUpdate ? "enabled" : "disabled",
  });

  if (isCancel(choice) || choice === BACK_VALUE) return;
  config.autoUpdate = choice === "enabled";
  saveConfig(config);
  log.success(
    `Automatic update checks: ${config.autoUpdate ? "enabled" : "disabled"}`,
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

async function toggleSortBy(): Promise<void> {
  const config = loadConfig();
  const current = config.sortBy ?? "name";
  const choice = await select({
    message: `Default App Sorting (current: ${current})`,
    options: [
      {
        value: "name",
        label: "Alphabetical (name)",
        hint: "Sort applications alphabetically by name (A to Z).",
      },
      {
        value: "memory",
        label: "Memory usage (memory)",
        hint: "Sort applications with highest RAM usage first.",
      },
      backOption(),
    ],
    initialValue: current,
  });

  if (isCancel(choice) || choice === BACK_VALUE) return;
  config.sortBy = choice as "name" | "memory";
  saveConfig(config);
  log.success(`Default sorting set to: ${config.sortBy}`);
}

async function toggleOnQuitFailure(): Promise<void> {
  const config = loadConfig();
  const current = config.onQuitFailure ?? "prompt";
  const choice = await select({
    message: `On Quit Failure Action (current: ${current})`,
    options: [
      {
        value: "prompt",
        label: "Prompt to Force Quit (prompt)",
        hint: "Ask interactively before force-quitting stubborn apps.",
      },
      {
        value: "force",
        label: "Auto Force Quit (force)",
        hint: "Automatically force quit if graceful quit fails.",
      },
      {
        value: "error",
        label: "Error Only (error)",
        hint: "Report error and leave stubborn apps running without prompting.",
      },
      backOption(),
    ],
    initialValue: current,
  });

  if (isCancel(choice) || choice === BACK_VALUE) return;
  config.onQuitFailure = choice as "prompt" | "force" | "error";
  saveConfig(config);
  log.success(`On quit failure action set to: ${config.onQuitFailure}`);
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
          hint: `current: ${config.force === "normal" ? "Normal quit" : "Force quit"}`,
        },
        {
          value: "background",
          label: "View background apps",
          hint: `current: ${config.includeBackground ? "enabled" : "disabled"}`,
        },
        {
          value: "group-background",
          label: "Group background instances",
          hint: `current: ${config.groupBackground ? "enabled" : "disabled"}`,
        },
        {
          value: "never-quit-music",
          label: "Never quit music apps",
          hint: `current: ${config.neverQuitMusic ? "enabled" : "disabled"}`,
        },
        {
          value: "auto-update",
          label: "Automatic update checks",
          hint: `current: ${config.autoUpdate ? "enabled" : "disabled"}`,
        },
        {
          value: "default-select",
          label: "Deselect apps by default",
          hint: `current: ${!config.defaultSelectAll ? "enabled" : "disabled"}`,
        },
        {
          value: "finder",
          label: "Include Finder Windows in list",
          hint: `current: ${config.includeFinder ? "enabled" : "disabled"}`,
        },
        {
          value: "trash",
          label: "Include Empty Trash in list",
          hint: `current: ${config.includeTrash ? "enabled (empties trash)" : "disabled"}`,
        },
        {
          value: "exclude",
          label: "Manage excluded apps",
          hint: `${config.exclude.length} excluded`,
        },
        {
          value: "custom-music",
          label: "Manage custom music apps",
          hint: `${config.musicApps.length} custom apps`,
        },
        {
          value: "sort-by",
          label: "Default App Sorting",
          hint: `current: ${config.sortBy ?? "name"}`,
        },
        {
          value: "on-quit-failure",
          label: "On Quit Failure Action",
          hint: `current: ${config.onQuitFailure ?? "prompt"}`,
        },
        {
          value: "reset",
          label: "Reset all",
          hint: "restore all settings to defaults",
        },
        { value: "exit", label: "Exit" },
      ],
    });

    if (isCancel(choice) || choice === "exit") {
      running = false;
      continue;
    }

    if (choice === "quit-mode") await toggleQuitMode();
    if (choice === "background") await toggleIncludeBackground();
    if (choice === "group-background") await toggleGroupBackground();
    if (choice === "never-quit-music") await toggleNeverQuitMusic();
    if (choice === "auto-update") await toggleAutoUpdate();
    if (choice === "default-select") await toggleDefaultSelection();
    if (choice === "finder") await toggleIncludeFinder();
    if (choice === "trash") await toggleIncludeTrash();
    if (choice === "exclude") await manageExcludedApps();
    if (choice === "custom-music") await manageCustomMusicApps();
    if (choice === "sort-by") await toggleSortBy();
    if (choice === "on-quit-failure") await toggleOnQuitFailure();
    if (choice === "reset") resetConfig();
  }

  showOutro("Config saved.");
  printThanks();
  return 0;
}

export const VALID_CONFIG_KEYS = [
  "exclude",
  "force",
  "includeFinder",
  "includeTrash",
  "includeBackground",
  "groupBackground",
  "defaultSelectAll",
  "neverQuitMusic",
  "musicApps",
  "autoUpdate",
  "sortBy",
  "onQuitFailure",
] as const;

export type ValidConfigKey = (typeof VALID_CONFIG_KEYS)[number];

export async function handleConfigCli(
  options: {
    configAction?: "get" | "set" | "show" | "reset" | undefined;
    configKey?: string | undefined;
    configValue?: string | undefined;
    json?: boolean | undefined;
    yes?: boolean | undefined;
  } = {},
): Promise<number> {
  const action = options.configAction;
  if (!action) {
    return await configCommand();
  }

  const config = loadConfig();

  if (action === "show") {
    if (options.json) {
      console.log(JSON.stringify(config, null, 2));
      return 0;
    }
    console.log("quitx configuration:");
    for (const [key, value] of Object.entries(config)) {
      const displayVal = Array.isArray(value)
        ? value.length === 0
          ? "[]"
          : `[${value.join(", ")}]`
        : String(value);
      console.log(`  ${key}: ${displayVal}`);
    }
    return 0;
  }

  if (action === "get") {
    if (!options.configKey) {
      console.error("✖ Missing config key. Usage: quitx config get <key>");
      return 1;
    }
    const key = options.configKey as ValidConfigKey;
    if (!VALID_CONFIG_KEYS.includes(key)) {
      console.error(
        `✖ Unknown config key: "${options.configKey}". Valid keys: ${VALID_CONFIG_KEYS.join(", ")}`,
      );
      return 1;
    }
    const val = config[key];
    if (options.json) {
      console.log(JSON.stringify({ [key]: val }, null, 2));
    } else if (Array.isArray(val)) {
      console.log(val.join(", "));
    } else {
      console.log(String(val));
    }
    return 0;
  }

  if (action === "set") {
    if (!options.configKey) {
      console.error(
        "✖ Missing config key. Usage: quitx config set <key> <value>",
      );
      return 1;
    }
    if (options.configValue === undefined) {
      console.error(
        `✖ Missing value for "${options.configKey}". Usage: quitx config set <key> <value>`,
      );
      return 1;
    }
    const key = options.configKey as ValidConfigKey;
    if (!VALID_CONFIG_KEYS.includes(key)) {
      console.error(
        `✖ Unknown config key: "${options.configKey}". Valid keys: ${VALID_CONFIG_KEYS.join(", ")}`,
      );
      return 1;
    }

    const raw = options.configValue.trim();
    if (key === "force") {
      const lower = raw.toLowerCase();
      if (lower === "force" || lower === "true" || lower === "1") {
        config.force = "force";
      } else if (lower === "normal" || lower === "false" || lower === "0") {
        config.force = "normal";
      } else {
        console.error(
          `✖ Invalid value for force: "${raw}". Must be "normal" or "force".`,
        );
        return 1;
      }
    } else if (
      key === "includeFinder" ||
      key === "includeTrash" ||
      key === "includeBackground" ||
      key === "groupBackground" ||
      key === "defaultSelectAll" ||
      key === "neverQuitMusic" ||
      key === "autoUpdate"
    ) {
      const lower = raw.toLowerCase();
      if (["true", "1", "yes", "on", "enable", "enabled"].includes(lower)) {
        config[key] = true;
      } else if (
        ["false", "0", "no", "off", "disable", "disabled"].includes(lower)
      ) {
        config[key] = false;
      } else {
        console.error(
          `✖ Invalid boolean for ${key}: "${raw}". Use true or false.`,
        );
        return 1;
      }
    } else if (key === "exclude" || key === "musicApps") {
      const items = raw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      config[key] = items;
    } else if (key === "sortBy") {
      const lower = raw.toLowerCase();
      if (lower === "name" || lower === "memory") {
        config.sortBy = lower;
      } else {
        console.error(
          `✖ Invalid value for sortBy: "${raw}". Must be "name" or "memory".`,
        );
        return 1;
      }
    } else if (key === "onQuitFailure") {
      const lower = raw.toLowerCase();
      if (lower === "prompt" || lower === "force" || lower === "error") {
        config.onQuitFailure = lower;
      } else {
        console.error(
          `✖ Invalid value for onQuitFailure: "${raw}". Must be "prompt", "force", or "error".`,
        );
        return 1;
      }
    }

    saveConfig(config);
    if (options.json) {
      console.log(JSON.stringify({ [key]: config[key] }, null, 2));
    } else {
      const displayVal = Array.isArray(config[key])
        ? `[${(config[key] as string[]).join(", ")}]`
        : String(config[key]);
      console.log(`Set ${key} = ${displayVal}`);
    }
    return 0;
  }

  if (action === "reset") {
    if (!options.yes) {
      const confirm = await select({
        message: "Reset all settings to defaults?",
        options: [
          { value: "yes", label: "Yes, reset all" },
          { value: "no", label: "No, keep current settings" },
        ],
        initialValue: "no",
      });
      if (isCancel(confirm) || confirm !== "yes") {
        return 0;
      }
    }

    saveConfig({ ...DEFAULT_CONFIG, exclude: [], musicApps: [] });
    if (options.json) {
      console.log(JSON.stringify({ reset: true }, null, 2));
    } else {
      log.success("Config reset to defaults.");
    }
    return 0;
  }

  return 0;
}
