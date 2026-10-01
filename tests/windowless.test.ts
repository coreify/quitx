import { describe, expect, it } from "vitest";
import { parseCliArgs } from "../src/cli";
import {
  buildDiscoveryScript,
  filterApps,
  parseAppListOutput,
} from "../src/macos/apps";
import type { AppInfo } from "../src/types";

describe("Windowless Apps Filter", () => {
  describe("buildDiscoveryScript", () => {
    it("generates script with CoreGraphics window counting", () => {
      const script = buildDiscoveryScript(false);
      expect(script).toContain("ObjC.import('CoreGraphics')");
      expect(script).toContain("$.CGWindowListCopyWindowInfo");
      expect(script).toContain("const includeBackground = false");

      const bgScript = buildDiscoveryScript(true);
      expect(bgScript).toContain("const includeBackground = true");
    });
  });

  describe("parseAppListOutput", () => {
    it("parses windowCount column from discovery script", () => {
      const stdout = [
        "Preview\tcom.apple.Preview\t101\t0\t0\t0",
        "Chrome\tcom.google.Chrome\t102\t0\t0\t4",
        "Slack\tcom.tinyspeck.slackmacgap\t103\t0\t0\t0",
      ].join("\n");

      const apps = parseAppListOutput(stdout);
      expect(apps[0]?.name).toBe("Preview");
      expect(apps[0]?.windowCount).toBe(0);
      expect(apps[1]?.name).toBe("Chrome");
      expect(apps[1]?.windowCount).toBe(4);
      expect(apps[2]?.name).toBe("Slack");
      expect(apps[2]?.windowCount).toBe(0);
    });

    it("handles missing or invalid windowCount gracefully", () => {
      const stdout = [
        "App1\tcom.app1\t101\t0\t0",
        "App2\tcom.app2\t102\t0\t0\tNaN",
        "App3\tcom.app3\t103\t0\t0\t-1",
      ].join("\n");

      const apps = parseAppListOutput(stdout);
      expect(apps[0]?.windowCount).toBeUndefined();
      expect(apps[1]?.windowCount).toBeUndefined();
      expect(apps[2]?.windowCount).toBeUndefined();
    });
  });

  describe("filterApps windowless logic", () => {
    it("filterApps with windowless: true keeps only apps with 0 windows and excludes background", () => {
      const apps: AppInfo[] = [
        { name: "Preview", windowCount: 0 },
        { name: "Chrome", windowCount: 2 },
        { name: "Notes", windowCount: 0 },
        { name: "HelperDaemon", windowCount: 0, isBackground: true },
        { name: "UnknownApp" }, // windowCount is undefined
      ];

      const filtered = filterApps(apps, { windowless: true });
      expect(filtered.map((a) => a.name)).toEqual(["Notes", "Preview"]);
    });

    it("never includes Trash when windowless: true even if includeTrash: true", () => {
      const apps: AppInfo[] = [{ name: "Notes", windowCount: 0 }];
      const filtered = filterApps(apps, {
        windowless: true,
        includeTrash: true,
      });
      expect(filtered.some((a) => a.name.toLowerCase() === "trash")).toBe(
        false,
      );
    });

    it("aggregates windowCount across multiple grouped instances", () => {
      const apps: AppInfo[] = [
        {
          name: "Helper",
          bundleId: "com.helper",
          pid: 101,
          windowCount: 0,
          isBackground: true,
        },
        {
          name: "Helper",
          bundleId: "com.helper",
          pid: 102,
          windowCount: 1,
          isBackground: true,
        },
      ];

      const filtered = filterApps(apps, { groupBackground: true });
      expect(filtered.length).toBe(1);
      expect(filtered[0]?.count).toBe(2);
      expect(filtered[0]?.windowCount).toBe(1);
    });

    it("returns empty array if all apps have active open windows", () => {
      const apps: AppInfo[] = [
        { name: "Chrome", windowCount: 3 },
        { name: "VS Code", windowCount: 1 },
      ];
      expect(filterApps(apps, { windowless: true })).toEqual([]);
    });
  });

  describe("CLI parsing for windowless", () => {
    it("parseCliArgs parses --windowless and -w flags", () => {
      expect(parseCliArgs(["--windowless"]).windowless).toBe(true);
      expect(parseCliArgs(["-w"]).windowless).toBe(true);
    });

    it("combines -w with -a and -y cleanly", () => {
      const opts = parseCliArgs(["-w", "-a", "-y"]);
      expect(opts.windowless).toBe(true);
      expect(opts.all).toBe(true);
      expect(opts.yes).toBe(true);
    });
  });
});
