import { describe, expect, it } from "vitest";
import { parseCliArgs } from "../src/cli";
import { filterApps, parseAppListOutput } from "../src/macos/apps";
import type { AppInfo } from "../src/types";

describe("Windowless Apps Filter", () => {
  it("parseAppListOutput parses windowCount column from discovery script", () => {
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

  it("filterApps with windowless: true keeps only apps with 0 windows and excludes background", () => {
    const apps: AppInfo[] = [
      { name: "Preview", windowCount: 0 },
      { name: "Chrome", windowCount: 2 },
      { name: "Notes", windowCount: 0 },
      { name: "HelperDaemon", windowCount: 0, isBackground: true },
    ];

    const filtered = filterApps(apps, { windowless: true });
    expect(filtered.map((a) => a.name)).toEqual(["Notes", "Preview"]);
  });

  it("parseCliArgs parses --windowless and -w flags", () => {
    expect(parseCliArgs(["--windowless"]).windowless).toBe(true);
    expect(parseCliArgs(["-w"]).windowless).toBe(true);
  });
});
