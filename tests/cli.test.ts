import { describe, expect, it, vi } from "vitest";
import { getPackageVersion, main, parseCliArgs } from "../src/cli";
import * as allCmd from "../src/commands/all";
import * as interactiveCmd from "../src/commands/interactive";
import * as listCmd from "../src/commands/list";
import * as output from "../src/ui/output";

describe("cli parser and dispatcher", () => {
  it("parses short and long flags correctly", () => {
    const opts = parseCliArgs([
      "-a",
      "-y",
      "-l",
      "-f",
      "--json",
      "--exclude",
      "Slack,Discord",
      "--exclude=Chrome",
      "Spotify,Notes",
    ]);

    expect(opts.all).toBe(true);
    expect(opts.yes).toBe(true);
    expect(opts.list).toBe(true);
    expect(opts.force).toBe(true);
    expect(opts.json).toBe(true);
    expect(opts.exclude).toEqual(["Slack", "Discord", "Chrome"]);
    expect(opts.apps).toEqual(["Spotify", "Notes"]);

    const optsExcludeCmd = parseCliArgs(["exclude", "Warp,Ghostty"]);
    expect(optsExcludeCmd.manageExclude).toBe(true);
    expect(optsExcludeCmd.exclude).toEqual(["Warp", "Ghostty"]);
  });

  it("validates comma-separated apps correctly", () => {
    // Single app
    const single = parseCliArgs(["Spotify"]);
    expect(single.apps).toEqual(["Spotify"]);

    // App with space in quotes
    const withSpace = parseCliArgs(["Google Chrome"]);
    expect(withSpace.apps).toEqual(["Google Chrome"]);

    // Comma-separated with spaces around comma
    const commaSpaces = parseCliArgs(["Spotify,", "Discord"]);
    expect(commaSpaces.apps).toEqual(["Spotify", "Discord"]);

    // Error on space-separated multiple apps
    expect(() => parseCliArgs(["Spotify", "Discord"])).toThrow(
      "Multiple applications must be comma-separated, not space-separated",
    );

    // Error on empty comma string
    expect(() => parseCliArgs([","])).toThrow("No application name specified");

    // Error on multiple space-separated exclude args
    expect(() => parseCliArgs(["exclude", "Spotify", "Discord"])).toThrow(
      "Multiple exclude applications must be comma-separated, not space-separated",
    );
  });

  it("parses --include-finder flag", () => {
    const opts = parseCliArgs(["--include-finder", "--list"]);
    expect(opts.includeFinder).toBe(true);
    expect(opts.list).toBe(true);
  });

  it("parses -b and --background flags", () => {
    const opts1 = parseCliArgs(["-b", "--list"]);
    expect(opts1.includeBackground).toBe(true);

    const opts2 = parseCliArgs(["--background", "--list"]);
    expect(opts2.includeBackground).toBe(true);
  });

  it("parses --on-quit-failure flag", () => {
    const opts1 = parseCliArgs(["--on-quit-failure", "force"]);
    expect(opts1.onQuitFailure).toBe("force");

    const opts2 = parseCliArgs(["--on-quit-failure=prompt"]);
    expect(opts2.onQuitFailure).toBe("prompt");

    const opts3 = parseCliArgs(["--on-quit-failure", "error"]);
    expect(opts3.onQuitFailure).toBe("error");

    expect(() => parseCliArgs(["--on-quit-failure", "invalid"])).toThrow(
      /Invalid on-quit-failure option/,
    );
    expect(() => parseCliArgs(["--on-quit-failure=invalid"])).toThrow(
      /Invalid on-quit-failure option/,
    );
  });

  it("parses --config flag and config subcommand with actions", () => {
    const opts1 = parseCliArgs(["--config"]);
    expect(opts1.manageConfig).toBe(true);

    const opts2 = parseCliArgs(["config"]);
    expect(opts2.manageConfig).toBe(true);

    const optsDry = parseCliArgs(["--dry-run", "-a"]);
    expect(optsDry.dryRun).toBe(true);
    expect(optsDry.all).toBe(true);

    const optsShow = parseCliArgs(["config", "show", "--json"]);
    expect(optsShow.manageConfig).toBe(true);
    expect(optsShow.configAction).toBe("show");
    expect(optsShow.json).toBe(true);

    const optsGet = parseCliArgs(["config", "get", "force"]);
    expect(optsGet.configAction).toBe("get");
    expect(optsGet.configKey).toBe("force");

    const optsSet = parseCliArgs(["config", "set", "force", "true"]);
    expect(optsSet.configAction).toBe("set");
    expect(optsSet.configKey).toBe("force");
    expect(optsSet.configValue).toBe("true");

    const optsReset = parseCliArgs(["config", "reset", "-y"]);
    expect(optsReset.configAction).toBe("reset");
    expect(optsReset.yes).toBe(true);

    expect(() => parseCliArgs(["config", "unknowncmd"])).toThrow(
      /Unknown config command/,
    );
  });

  it("parses check-update and --no-update-check flags", () => {
    const opts1 = parseCliArgs(["check-update"]);
    expect(opts1.checkUpdate).toBe(true);

    const opts2 = parseCliArgs(["--check-update"]);
    expect(opts2.checkUpdate).toBe(true);

    const opts3 = parseCliArgs(["--no-update-check"]);
    expect(opts3.noUpdateCheck).toBe(true);
  });

  it("handles help and version flags", async () => {
    const helpSpy = vi.spyOn(output, "renderHelp").mockImplementation(() => {});
    const versionSpy = vi
      .spyOn(output, "renderVersion")
      .mockImplementation(() => {});

    expect(await main(["-h"])).toBe(0);
    expect(helpSpy).toHaveBeenCalled();

    const expectedVersion = await getPackageVersion();
    expect(await main(["--version"])).toBe(0);
    expect(versionSpy).toHaveBeenCalledWith(expectedVersion);

    helpSpy.mockRestore();
    versionSpy.mockRestore();
  });

  it("resolves version dynamically from package.json", async () => {
    const v = await getPackageVersion();
    expect(v).toMatch(/^\d+\.\d+\.\d+$/);
    expect(v).toBe(v);
  });

  it("dispatches to list command when --list passed", async () => {
    const listSpy = vi.spyOn(listCmd, "listCommand").mockResolvedValue(0);

    const code = await main(["--list"]);
    expect(code).toBe(0);
    expect(listSpy).toHaveBeenCalledWith(
      expect.objectContaining({ list: true }),
    );

    listSpy.mockRestore();
  });

  it("dispatches to all command when --all passed", async () => {
    const allSpy = vi.spyOn(allCmd, "allCommand").mockResolvedValue(0);

    const code = await main(["--all"]);
    expect(code).toBe(0);
    expect(allSpy).toHaveBeenCalledWith(expect.objectContaining({ all: true }));

    allSpy.mockRestore();
  });

  it("dispatches to exclude command when exclude or --exclude passed", async () => {
    const excludeModule = await import("../src/commands/exclude");
    const excludeSpy = vi
      .spyOn(excludeModule, "excludeCommand")
      .mockResolvedValue(0);

    const code1 = await main(["exclude"]);
    expect(code1).toBe(0);
    expect(excludeSpy).toHaveBeenCalledWith(
      expect.objectContaining({ manageExclude: true }),
    );

    const code2 = await main(["--exclude", "Discord"]);
    expect(code2).toBe(0);
    expect(excludeSpy).toHaveBeenCalledWith(
      expect.objectContaining({ exclude: ["Discord"] }),
    );

    excludeSpy.mockRestore();
  });

  it("dispatches to config command when config or --config passed", async () => {
    const configModule = await import("../src/commands/config");
    const configSpy = vi
      .spyOn(configModule, "handleConfigCli")
      .mockResolvedValue(0);

    const code1 = await main(["config"]);
    expect(code1).toBe(0);
    expect(configSpy).toHaveBeenCalled();

    configSpy.mockClear();

    const code2 = await main(["--config"]);
    expect(code2).toBe(0);
    expect(configSpy).toHaveBeenCalled();

    configSpy.mockRestore();
  });

  it("dispatches to interactive command by default", async () => {
    const interactiveSpy = vi
      .spyOn(interactiveCmd, "interactiveCommand")
      .mockResolvedValue(0);

    const code = await main([]);
    expect(code).toBe(0);
    expect(interactiveSpy).toHaveBeenCalled();

    interactiveSpy.mockRestore();
  });

  it("handles check-update with json output", async () => {
    const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => {});

    const code = await main(["check-update", "--json"]);
    expect(code).toBe(0);
    expect(consoleLogSpy).toHaveBeenCalled();
    const outputArg = String(consoleLogSpy.mock.calls[0]?.[0] ?? "{}");
    const parsed: unknown = JSON.parse(outputArg);
    expect(parsed).toHaveProperty("updateAvailable");
    expect(parsed).toHaveProperty("latestVersion");

    consoleLogSpy.mockRestore();
  });

  it("handles unexpected errors cleanly", async () => {
    vi.spyOn(interactiveCmd, "interactiveCommand").mockRejectedValue(
      new Error("Unexpected failure"),
    );
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const code = await main([]);
    expect(code).toBe(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith("✖ Error: Unexpected failure");

    consoleErrorSpy.mockRestore();
  });

  it("handles arg validation errors in main cleanly", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const code = await main(["Spotify", "Discord"]);
    expect(code).toBe(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("Multiple applications must be comma-separated"),
    );

    consoleErrorSpy.mockRestore();
  });

  it("handleAutoUpdateCheck respects dryRun and autoUpdate config", async () => {
    const { handleAutoUpdateCheck } = await import("../src/cli");
    const updateModule = await import("../src/update");
    const checkSpy = vi.spyOn(updateModule, "checkForUpdate");

    await handleAutoUpdateCheck("1.0.0", { dryRun: true });
    expect(checkSpy).not.toHaveBeenCalled();

    const configModule = await import("../src/config");
    vi.spyOn(configModule, "loadConfig").mockReturnValue({
      exclude: [],
      force: "normal",
      includeFinder: false,
      includeTrash: false,
      includeBackground: false,
      groupBackground: true,
      defaultSelectAll: true,
      neverQuitMusic: false,
      musicApps: [],
      autoUpdate: false,
    });
    await handleAutoUpdateCheck("1.0.0", {});
    expect(checkSpy).not.toHaveBeenCalled();

    checkSpy.mockRestore();
  });

  it("dispatches to restart command when restart specified", async () => {
    const restartModule = await import("../src/commands/restart");
    const restartSpy = vi
      .spyOn(restartModule, "restartCommand")
      .mockResolvedValue(0);

    const code = await main(["restart", "Discord", "-y"]);
    expect(code).toBe(0);
    expect(restartSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        command: "restart",
        apps: ["Discord"],
        yes: true,
      }),
    );
  });

  it("dispatches to stash and restore commands", async () => {
    const stashModule = await import("../src/commands/stash");
    const restoreModule = await import("../src/commands/restore");
    const stashSpy = vi.spyOn(stashModule, "stashCommand").mockResolvedValue(0);
    const restoreSpy = vi
      .spyOn(restoreModule, "restoreCommand")
      .mockResolvedValue(0);

    expect(await main(["stash", "-y"])).toBe(0);
    expect(stashSpy).toHaveBeenCalled();

    expect(await main(["restore", "-y"])).toBe(0);
    expect(restoreSpy).toHaveBeenCalled();
  });

  it("dispatches to exclude and config commands", async () => {
    const excludeModule = await import("../src/commands/exclude");
    const configModule = await import("../src/commands/config");
    const excludeSpy = vi
      .spyOn(excludeModule, "excludeCommand")
      .mockResolvedValue(0);
    const configSpy = vi
      .spyOn(configModule, "handleConfigCli")
      .mockResolvedValue(0);

    expect(await main(["exclude", "Warp"])).toBe(0);
    expect(excludeSpy).toHaveBeenCalled();

    expect(await main(["config", "show"])).toBe(0);
    expect(configSpy).toHaveBeenCalled();
  });

  it("rejects non-macOS platforms in main()", async () => {
    const platformModule = await import("../src/utils/platform");
    vi.spyOn(platformModule, "isMacOS").mockReturnValue(false);
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const code = await main([]);
    expect(code).toBe(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining("quitx only works on macOS"),
    );

    consoleErrorSpy.mockRestore();
  });

  it("parses additional flags: --include-trash, --never-quit-music, --no-update-check", () => {
    const opts = parseCliArgs([
      "--include-trash",
      "--never-quit-music",
      "--no-update-check",
    ]);
    expect(opts.includeTrash).toBe(true);
    expect(opts.neverQuitMusic).toBe(true);
    expect(opts.noUpdateCheck).toBe(true);
  });
});
