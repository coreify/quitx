import { describe, expect, it, vi } from "vitest";
import { main, parseCliArgs, VERSION } from "../src/cli";
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
      "--include-finder",
      "--include-terminal",
      "--exclude",
      "Slack",
      "--exclude=Discord",
      "Spotify",
      "Notes",
    ]);

    expect(opts.all).toBe(true);
    expect(opts.yes).toBe(true);
    expect(opts.list).toBe(true);
    expect(opts.force).toBe(true);
    expect(opts.json).toBe(true);
    expect(opts.includeFinder).toBe(true);
    expect(opts.includeTerminal).toBe(true);
    expect(opts.exclude).toEqual(["Slack", "Discord"]);
    expect(opts.apps).toEqual(["Spotify", "Notes"]);
  });

  it("handles help and version flags", async () => {
    const helpSpy = vi.spyOn(output, "renderHelp").mockImplementation(() => {});
    const versionSpy = vi
      .spyOn(output, "renderVersion")
      .mockImplementation(() => {});

    expect(await main(["-h"])).toBe(0);
    expect(helpSpy).toHaveBeenCalled();

    expect(await main(["--version"])).toBe(0);
    expect(versionSpy).toHaveBeenCalledWith(VERSION);

    helpSpy.mockRestore();
    versionSpy.mockRestore();
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

  it("dispatches to interactive command by default", async () => {
    const interactiveSpy = vi
      .spyOn(interactiveCmd, "interactiveCommand")
      .mockResolvedValue(0);

    const code = await main([]);
    expect(code).toBe(0);
    expect(interactiveSpy).toHaveBeenCalled();

    interactiveSpy.mockRestore();
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
});
