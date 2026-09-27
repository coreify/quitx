import type { AppInfo } from "../types";

export interface TerminalDefinition {
  name: string;
  aliases: string[];
  bundleIds: string[];
}

export const KNOWN_TERMINALS: readonly TerminalDefinition[] = [
  {
    name: "Terminal",
    aliases: ["apple_terminal", "terminal"],
    bundleIds: ["com.apple.terminal"],
  },
  {
    name: "iTerm2",
    aliases: ["iterm.app", "iterm", "iterm2"],
    bundleIds: ["com.googlecode.iterm2"],
  },
  {
    name: "Warp",
    aliases: ["warpterminal", "warp"],
    bundleIds: ["dev.warp.warp-stable", "dev.warp.warp"],
  },
  {
    name: "Ghostty",
    aliases: ["ghostty"],
    bundleIds: ["com.mitchellh.ghostty"],
  },
  {
    name: "Alacritty",
    aliases: ["alacritty"],
    bundleIds: ["org.alacritty"],
  },
  {
    name: "kitty",
    aliases: ["kitty"],
    bundleIds: ["net.kovidgoyal.kitty"],
  },
  {
    name: "WezTerm",
    aliases: ["wezterm", "wezterm-gui"],
    bundleIds: ["com.github.wez.wezterm"],
  },
  {
    name: "Hyper",
    aliases: ["hyper"],
    bundleIds: ["co.zeit.hyper"],
  },
  {
    name: "Visual Studio Code",
    aliases: ["vscode", "code"],
    bundleIds: ["com.microsoft.vscode", "com.microsoft.vscodeinsiders"],
  },
  {
    name: "Cursor",
    aliases: ["cursor"],
    bundleIds: ["com.todesktop.230313mzl4w4u92"],
  },
];

export function getCurrentTerminalApp(
  env: NodeJS.ProcessEnv = process.env,
): string | null {
  const termProgram = env["TERM_PROGRAM"]?.toLowerCase().trim();
  const terminalEmulator = env["TERMINAL_EMULATOR"]?.toLowerCase().trim();
  const lcTerminal = env["LC_TERMINAL"]?.toLowerCase().trim();

  const target = termProgram || terminalEmulator || lcTerminal;
  if (!target) {
    return null;
  }

  // Check warp explicitly to prevent 'terminal' in 'warpterminal' matching Apple Terminal
  if (target.includes("warp")) {
    return "Warp";
  }

  for (const term of KNOWN_TERMINALS) {
    if (term.aliases.some((alias) => target === alias || (alias !== "terminal" && target.includes(alias)))) {
      return term.name;
    }
  }

  // If unknown terminal program, return raw name if not empty
  return env["TERM_PROGRAM"] || null;
}

export function isTerminalApp(
  app: AppInfo,
  currentTerminal?: string | null,
): boolean {
  const appNameLower = app.name.toLowerCase();
  const appBundleLower = app.bundleId?.toLowerCase();

  // If current terminal specified, check exact match
  if (currentTerminal) {
    const curLower = currentTerminal.toLowerCase();
    if (appNameLower === curLower) {
      return true;
    }
  }

  // Check known terminals
  for (const term of KNOWN_TERMINALS) {
    if (currentTerminal && term.name.toLowerCase() === currentTerminal.toLowerCase()) {
      if (
        appNameLower === term.name.toLowerCase() ||
        (appBundleLower && term.bundleIds.includes(appBundleLower))
      ) {
        return true;
      }
    }

    // Default terminal emulators to avoid killing terminal sessions
    if (
      term.name !== "Visual Studio Code" &&
      term.name !== "Cursor"
    ) {
      if (
        appNameLower === term.name.toLowerCase() ||
        (appBundleLower && term.bundleIds.includes(appBundleLower))
      ) {
        return true;
      }
    }
  }

  return false;
}
