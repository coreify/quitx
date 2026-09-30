import { describe, expect, it } from "vitest";
import {
  getCurrentTerminalApp,
  isCurrentTerminalApp,
  isTerminalApp,
} from "../src/macos/terminal";
import type { AppInfo } from "../src/types";

describe("terminal detection", () => {
  it("detects Apple_Terminal", () => {
    expect(getCurrentTerminalApp({ TERM_PROGRAM: "Apple_Terminal" })).toBe(
      "Terminal",
    );
  });

  it("detects iTerm.app", () => {
    expect(getCurrentTerminalApp({ TERM_PROGRAM: "iTerm.app" })).toBe("iTerm2");
  });

  it("detects WarpTerminal", () => {
    expect(getCurrentTerminalApp({ TERM_PROGRAM: "WarpTerminal" })).toBe(
      "Warp",
    );
  });

  it("detects Ghostty", () => {
    expect(getCurrentTerminalApp({ TERM_PROGRAM: "ghostty" })).toBe("Ghostty");
  });

  it("detects Alacritty", () => {
    expect(getCurrentTerminalApp({ TERM_PROGRAM: "alacritty" })).toBe(
      "Alacritty",
    );
  });

  it("detects kitty", () => {
    expect(getCurrentTerminalApp({ TERM_PROGRAM: "kitty" })).toBe("kitty");
  });

  it("detects WezTerm", () => {
    expect(getCurrentTerminalApp({ TERM_PROGRAM: "WezTerm" })).toBe("WezTerm");
  });

  it("detects vscode", () => {
    expect(getCurrentTerminalApp({ TERM_PROGRAM: "vscode" })).toBe(
      "Visual Studio Code",
    );
  });

  it("falls back to TERMINAL_EMULATOR or LC_TERMINAL", () => {
    expect(getCurrentTerminalApp({ TERMINAL_EMULATOR: "warp" })).toBe("Warp");
    expect(getCurrentTerminalApp({ LC_TERMINAL: "iterm2" })).toBe("iTerm2");
  });

  it("returns null if no terminal environment variables found", () => {
    expect(getCurrentTerminalApp({})).toBeNull();
  });

  it("identifies known terminal applications", () => {
    const iterm: AppInfo = {
      name: "iTerm2",
      bundleId: "com.googlecode.iterm2",
      pid: 1234,
    };
    expect(isTerminalApp(iterm)).toBe(true);

    const terminal: AppInfo = {
      name: "Terminal",
      bundleId: "com.apple.terminal",
      pid: 2345,
    };
    expect(isTerminalApp(terminal)).toBe(true);

    const warp: AppInfo = {
      name: "Warp",
      bundleId: "dev.warp.Warp-Stable",
      pid: 3456,
    };
    expect(isTerminalApp(warp)).toBe(true);
  });

  it("identifies current terminal by custom name", () => {
    const custom: AppInfo = {
      name: "MyCustomTerm",
      bundleId: "com.custom.term",
      pid: 4567,
    };
    expect(isTerminalApp(custom, "MyCustomTerm")).toBe(true);
    expect(isTerminalApp(custom, "OtherTerm")).toBe(false);
  });

  it("does not identify general applications as terminals", () => {
    const chrome: AppInfo = {
      name: "Google Chrome",
      bundleId: "com.google.Chrome",
      pid: 5678,
    };
    expect(isTerminalApp(chrome)).toBe(false);

    const spotify: AppInfo = {
      name: "Spotify",
      bundleId: "com.spotify.client",
      pid: 6789,
    };
    expect(isTerminalApp(spotify)).toBe(false);
  });

  it("isCurrentTerminalApp identifies when app matches current terminal env", () => {
    const iterm: AppInfo = {
      name: "iTerm2",
      bundleId: "com.googlecode.iterm2",
      pid: 1234,
    };
    expect(isCurrentTerminalApp(iterm, { TERM_PROGRAM: "iTerm.app" })).toBe(
      true,
    );
    expect(
      isCurrentTerminalApp(iterm, { TERM_PROGRAM: "Apple_Terminal" }),
    ).toBe(false);
    expect(isCurrentTerminalApp(iterm, {})).toBe(false);
  });

  it("identifies modern terminal bundle IDs", () => {
    expect(
      isTerminalApp({ name: "ghostty", bundleId: "com.mitchellh.ghostty" }),
    ).toBe(true);
    expect(isTerminalApp({ name: "alacritty", bundleId: "io.alacritty" })).toBe(
      true,
    );
    expect(
      isTerminalApp({ name: "kitty", bundleId: "net.kovidgoyal.kitty" }),
    ).toBe(true);
    expect(
      isTerminalApp({ name: "wezterm", bundleId: "com.github.wez.wezterm" }),
    ).toBe(true);
    expect(
      isTerminalApp(
        { name: "Code", bundleId: "com.microsoft.VSCode" },
        "Visual Studio Code",
      ),
    ).toBe(true);
    expect(
      isTerminalApp(
        {
          name: "Cursor",
          bundleId: "com.todesktop.230313mzl4w4u92",
        },
        "Cursor",
      ),
    ).toBe(true);
  });

  it("handles case-insensitive matching for custom terminal names", () => {
    const term: AppInfo = {
      name: "CustomTerminal",
      bundleId: "com.custom.term",
    };
    expect(isTerminalApp(term, "customterminal")).toBe(true);
    expect(isTerminalApp(term, "CUSTOMTERMINAL")).toBe(true);
    expect(isTerminalApp(term, "NonTerm")).toBe(false);
  });
});
