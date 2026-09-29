import { describe, expect, it } from "vitest";
import { parseCliArgs } from "../src/cli";
import { filterApps } from "../src/macos/apps";
import type { AppInfo } from "../src/types";

describe("Keep / Except Exclusions", () => {
  it("parseCliArgs parses --keep and --except without modifying config", () => {
    const opts1 = parseCliArgs(["--all", "--keep", "Figma,Slack"]);
    expect(opts1.keep).toEqual(["Figma", "Slack"]);

    const opts2 = parseCliArgs(["-a", "--except", "Terminal,Spotify"]);
    expect(opts2.keep).toEqual(["Terminal", "Spotify"]);

    const opts3 = parseCliArgs(["--keep=Figma,Slack"]);
    expect(opts3.keep).toEqual(["Figma", "Slack"]);
  });

  it("filterApps excludes apps specified in keep list", () => {
    const apps: AppInfo[] = [
      { name: "Figma", bundleId: "com.figma.Desktop" },
      { name: "Slack", bundleId: "com.tinyspeck.slackmacgap" },
      { name: "Chrome", bundleId: "com.google.Chrome" },
      { name: "Terminal", bundleId: "com.apple.terminal" },
    ];

    const filtered = filterApps(apps, {
      keep: ["figma", "com.apple.terminal"],
    });
    expect(filtered.map((a) => a.name)).toEqual(["Chrome", "Slack"]);
  });
});
