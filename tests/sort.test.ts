import { describe, expect, it } from "vitest";
import { parseCliArgs } from "../src/cli";
import { sortApps } from "../src/macos/apps";
import type { AppInfo } from "../src/types";

describe("Sort Apps", () => {
  it("sortApps with sortBy: memory sorts descending by memoryBytes", () => {
    const apps: AppInfo[] = [
      { name: "Preview", memoryBytes: 82 * 1024 * 1024 },
      { name: "Chrome", memoryBytes: 2400 * 1024 * 1024 },
      { name: "Discord", memoryBytes: 612 * 1024 * 1024 },
      { name: "Spotify", memoryBytes: 380 * 1024 * 1024 },
    ];

    const sorted = sortApps(apps, "memory");
    expect(sorted.map((a) => a.name)).toEqual([
      "Chrome",
      "Discord",
      "Spotify",
      "Preview",
    ]);
  });

  it("sortApps breaks memory ties alphabetically by name", () => {
    const apps: AppInfo[] = [
      { name: "ZebraApp", memoryBytes: 50 * 1024 * 1024 },
      { name: "AlphaApp", memoryBytes: 50 * 1024 * 1024 },
      { name: "BigApp", memoryBytes: 100 * 1024 * 1024 },
    ];

    const sorted = sortApps(apps, "memory");
    expect(sorted.map((a) => a.name)).toEqual([
      "BigApp",
      "AlphaApp",
      "ZebraApp",
    ]);
  });

  it("sortApps treats undefined memoryBytes as 0", () => {
    const apps: AppInfo[] = [
      { name: "NoMemB" },
      { name: "HasMem", memoryBytes: 10 },
      { name: "NoMemA" },
    ];

    const sorted = sortApps(apps, "memory");
    expect(sorted.map((a) => a.name)).toEqual(["HasMem", "NoMemA", "NoMemB"]);
  });

  it("sortApps with sortBy: name sorts case-insensitively by name", () => {
    const apps: AppInfo[] = [
      { name: "Spotify" },
      { name: "apple Music" },
      { name: "Discord" },
    ];

    const sorted = sortApps(apps, "name");
    expect(sorted.map((a) => a.name)).toEqual([
      "apple Music",
      "Discord",
      "Spotify",
    ]);
  });

  it("sortApps defaults to name sorting when sortBy argument omitted", () => {
    const apps: AppInfo[] = [{ name: "Slack" }, { name: "Arc" }];
    expect(sortApps(apps).map((a) => a.name)).toEqual(["Arc", "Slack"]);
  });

  it("sortApps handles empty or single item arrays", () => {
    expect(sortApps([])).toEqual([]);
    expect(sortApps([{ name: "OnlyApp" }])).toEqual([{ name: "OnlyApp" }]);
  });

  it("parseCliArgs parses --sort memory and --sort name", () => {
    expect(parseCliArgs(["--sort", "memory"]).sortBy).toBe("memory");
    expect(parseCliArgs(["--sort=memory"]).sortBy).toBe("memory");
    expect(parseCliArgs(["--sort", "name"]).sortBy).toBe("name");
    expect(parseCliArgs(["--sort=name"]).sortBy).toBe("name");
  });

  it("parseCliArgs rejects invalid sort options", () => {
    expect(() => parseCliArgs(["--sort", "invalid"])).toThrow(
      /Invalid sort option/,
    );
    expect(() => parseCliArgs(["--sort=bogus"])).toThrow(/Invalid sort option/);
    expect(() => parseCliArgs(["--sort"])).toThrow(/Invalid sort option/);
  });

  it("parseCliArgs parses --sort alongside other flags cleanly", () => {
    const opts = parseCliArgs(["--all", "--sort=memory", "-y", "--dry-run"]);
    expect(opts.all).toBe(true);
    expect(opts.sortBy).toBe("memory");
    expect(opts.yes).toBe(true);
    expect(opts.dryRun).toBe(true);
  });

  it("sortApps preserves order for items with identical memory and identical name", () => {
    const apps: AppInfo[] = [
      { name: "AppOne", pid: 101, memoryBytes: 50 },
      { name: "AppOne", pid: 102, memoryBytes: 50 },
    ];
    const sorted = sortApps(apps, "memory");
    expect(sorted[0]?.pid).toBe(101);
    expect(sorted[1]?.pid).toBe(102);
  });
});
