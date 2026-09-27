import { isCancel, multiselect, select } from "@clack/prompts";
import { addExcludedApps, loadConfig, removeExcludedApps } from "../config";
import { getRunningApps } from "../macos/apps";
import type { CliOptions } from "../types";
import { printThanks, showCancel, showIntro, showOutro } from "../ui/output";

export async function manageExcludeInteractive(): Promise<number> {
  showIntro();

  const choice = await select({
    message: "Manage excluded apps",
    options: [
      { value: "add", label: "Add running apps to exclude list" },
      { value: "remove", label: "Remove apps from exclude list" },
      { value: "view", label: "View current exclude list" },
    ],
  });

  if (isCancel(choice)) {
    showCancel("Cancelled.");
    printThanks();
    return 0;
  }

  const currentConfig = loadConfig();

  if (choice === "view") {
    if (currentConfig.exclude.length === 0) {
      showOutro("No apps currently excluded in config.json.");
    } else {
      showOutro(
        `Excluded apps:\n${currentConfig.exclude.map((e) => `  - ${e}`).join("\n")}`,
      );
    }
    printThanks();
    return 0;
  }

  if (choice === "add") {
    const available = await getRunningApps({
      exclude: currentConfig.exclude,
      includeFinder: currentConfig.includeFinder,
      includeBackground: currentConfig.includeBackground,
      groupBackground: currentConfig.groupBackground,
    });

    if (available.length === 0) {
      showOutro("All running apps are already excluded.");
      printThanks();
      return 0;
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

    if (isCancel(selected)) {
      showCancel("Cancelled.");
      printThanks();
      return 0;
    }

    if (!Array.isArray(selected) || selected.length === 0) {
      showOutro("No apps selected.");
      printThanks();
      return 0;
    }

    addExcludedApps(selected);
    showOutro(`Added ${selected.length} apps to exclude list.`);
    printThanks();
    return 0;
  }

  if (choice === "remove") {
    if (currentConfig.exclude.length === 0) {
      showOutro("No apps currently in exclude list.");
      printThanks();
      return 0;
    }

    const selected = await multiselect({
      message: "Select apps to remove from exclude list",
      options: currentConfig.exclude.map((name) => ({
        value: name,
        label: name,
      })),
      required: false,
    });

    if (isCancel(selected)) {
      showCancel("Cancelled.");
      printThanks();
      return 0;
    }

    if (!Array.isArray(selected) || selected.length === 0) {
      showOutro("No apps selected.");
      printThanks();
      return 0;
    }

    removeExcludedApps(selected);
    showOutro(`Removed ${selected.length} apps from exclude list.`);
    printThanks();
    return 0;
  }

  return 0;
}

export async function excludeCommand(
  options: CliOptions = {},
): Promise<number> {
  if (options.exclude && options.exclude.length > 0) {
    const updated = addExcludedApps(options.exclude);
    if (options.json) {
      console.log(JSON.stringify(updated, null, 2));
    } else {
      showIntro();
      showOutro(
        `Added to exclude list:\n${options.exclude.map((e) => `  - ${e}`).join("\n")}`,
      );
      printThanks(options);
    }
    return 0;
  }

  return await manageExcludeInteractive();
}
