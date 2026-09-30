import { describe, expect, it } from "vitest";
import { parseCliArgs } from "../src/cli";
import { filterApps } from "../src/macos/apps";
import type { AppInfo } from "../src/types";

describe("Keep / Except Exclusions", () => {
  describe("parseCliArgs", () => {
    it("parses --keep and --except with comma-separated values", () => {
      const opts1 = parseCliArgs(["--all", "--keep", "Figma,Slack"]);
      expect(opts1.keep).toEqual(["Figma", "Slack"]);

      const opts2 = parseCliArgs(["-a", "--except", "Terminal,Spotify"]);
      expect(opts2.keep).toEqual(["Terminal", "Spotify"]);

      const opts3 = parseCliArgs(["--keep=Figma,Slack"]);
      expect(opts3.keep).toEqual(["Figma", "Slack"]);

      const opts4 = parseCliArgs(["--except=Discord,Notes"]);
      expect(opts4.keep).toEqual(["Discord", "Notes"]);
    });

    it("trims whitespace and ignores empty items in keep values", () => {
      const opts = parseCliArgs(["--keep", " Slack ,  , Figma, "]);
      expect(opts.keep).toEqual(["Slack", "Figma"]);
    });

    it("accumulates multiple --keep and --except occurrences", () => {
      const opts = parseCliArgs([
        "--keep",
        "Slack",
        "--except",
        "Figma",
        "--keep=Notes",
      ]);
      expect(opts.keep).toEqual(["Slack", "Figma", "Notes"]);
    });
  });

  describe("filterApps", () => {
    const apps: AppInfo[] = [
      { name: "Figma", bundleId: "com.figma.Desktop" },
      { name: "Slack", bundleId: "com.tinyspeck.slackmacgap" },
      { name: "Google Chrome", bundleId: "com.google.Chrome" },
      { name: "Terminal", bundleId: "com.apple.terminal" },
    ];

    it("excludes apps specified in keep list by name case-insensitively", () => {
      const filtered = filterApps(apps, {
        keep: ["figma", "slack"],
      });
      expect(filtered.map((a) => a.name)).toEqual([
        "Google Chrome",
        "Terminal",
      ]);
    });

    it("excludes apps specified in keep list by bundleId case-insensitively", () => {
      const filtered = filterApps(apps, {
        keep: ["COM.GOOGLE.CHROME"],
      });
      expect(filtered.map((a) => a.name)).toEqual([
        "Figma",
        "Slack",
        "Terminal",
      ]);
    });

    it("prevents trash inclusion when trash is in keep list", () => {
      const filtered = filterApps(apps, {
        includeTrash: true,
        keep: ["trash"],
      });
      expect(filtered.some((a) => a.name.toLowerCase() === "trash")).toBe(
        false,
      );
    });

    it("combines persistent exclude and temporary keep cleanly", () => {
      const filtered = filterApps(apps, {
        exclude: ["figma"],
        keep: ["slack"],
      });
      expect(filtered.map((a) => a.name)).toEqual([
        "Google Chrome",
        "Terminal",
      ]);
    });

    it("returns empty array when all apps are kept", () => {
      const filtered = filterApps(apps, {
        keep: ["figma", "slack", "google chrome", "terminal"],
      });
      expect(filtered).toEqual([]);
    });

    it("leaves all apps eligible when keep list is empty", () => {
      const filtered = filterApps(apps, { keep: [] });
      expect(filtered.length).toBe(apps.length);
    });

    it("handles keep items that do not exist in running apps gracefully", () => {
      const filtered = filterApps(apps, {
        keep: ["NonExistentApp1", "NonExistentApp2"],
      });
      expect(filtered.length).toBe(apps.length);
    });

    it("excludes all instances when multiple apps match keep criteria", () => {
      const multiApps: AppInfo[] = [
        { name: "Code", pid: 1, bundleId: "com.microsoft.VSCode" },
        { name: "Code", pid: 2, bundleId: "com.microsoft.VSCode" },
        { name: "Notes", pid: 3, bundleId: "com.apple.Notes" },
      ];
      const filtered = filterApps(multiApps, { keep: ["code"] });
      expect(filtered).toEqual([
        { name: "Notes", pid: 3, bundleId: "com.apple.Notes" },
      ]);
    });
  });

  describe("parseCliArgs keep edge cases", () => {
    it("handles empty --keep= and --except= flags without breaking", () => {
      const opts1 = parseCliArgs(["--keep="]);
      expect(opts1.keep).toEqual([]);

      const opts2 = parseCliArgs(["--except="]);
      expect(opts2.keep).toEqual([]);
    });

    it("handles whitespace-only arguments in --keep", () => {
      const opts = parseCliArgs(["--keep", "   ,  \t ,   "]);
      expect(opts.keep).toEqual([]);
    });
  });
});
