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

  it("parseCliArgs parses --sort memory and --sort name", () => {
    expect(parseCliArgs(["--sort", "memory"]).sortBy).toBe("memory");
    expect(parseCliArgs(["--sort=memory"]).sortBy).toBe("memory");
    expect(parseCliArgs(["--sort", "name"]).sortBy).toBe("name");
    expect(parseCliArgs(["--sort=name"]).sortBy).toBe("name");
    expect(() => parseCliArgs(["--sort", "invalid"])).toThrow(
      /Invalid sort option/,
    );
  });
});
