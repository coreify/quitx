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

  it("parses --config flag and config subcommand", () => {
    const opts1 = parseCliArgs(["--config"]);
    expect(opts1.manageConfig).toBe(true);

    const opts2 = parseCliArgs(["config"]);
    expect(opts2.manageConfig).toBe(true);
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
      .spyOn(configModule, "configCommand")
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
});
