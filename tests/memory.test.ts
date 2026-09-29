import { describe, expect, it } from "vitest";
import {
  calculateAppMemory,
  enrichAppsWithMemory,
  formatMemory,
  parsePsMemoryOutput,
} from "../src/macos/memory";
import type { AppInfo } from "../src/types";

describe("memory calculation and formatting", () => {
  it("formatMemory formats sizes into appropriate units", () => {
    expect(formatMemory(0)).toBe("0 MB");
    expect(formatMemory(500)).toBe("500 B");
    expect(formatMemory(1024 * 50)).toBe("50 KB");
    expect(formatMemory(1024 * 1024 * 82)).toBe("82 MB");
    expect(formatMemory(1024 * 1024 * 612)).toBe("612 MB");
    expect(formatMemory(1024 * 1024 * 1024 * 1.1)).toBe("1.1 GB");
    expect(formatMemory(1024 * 1024 * 1024 * 2.4)).toBe("2.4 GB");
  });

  it("parsePsMemoryOutput parses ps output into process entries and child map", () => {
    const psStdout = `
  PID  PPID    RSS COMM
 1000     1 102400 /Applications/Google Chrome.app/Contents/MacOS/Google Chrome
 1001  1000 204800 /Applications/Google Chrome.app/Contents/Frameworks/Google Chrome Framework.framework/Helpers/Google Chrome Helper (Renderer).app/Contents/MacOS/Google Chrome Helper (Renderer)
 1002  1000  51200 /Applications/Google Chrome.app/Contents/Frameworks/Google Chrome Framework.framework/Helpers/Google Chrome Helper (GPU).app/Contents/MacOS/Google Chrome Helper (GPU)
 2000     1  81920 /Applications/Discord.app/Contents/MacOS/Discord
    `.trim();

    const data = parsePsMemoryOutput(psStdout);
    expect(data.processes.size).toBe(4);
    expect(data.processes.get(1000)?.rssBytes).toBe(102400 * 1024);
    expect(data.children.get(1000)).toEqual([1001, 1002]);
  });

  it("calculateAppMemory aggregates root PID and child helper processes", () => {
    const psStdout = `
  PID  PPID    RSS COMM
 1000     1 102400 /Applications/Google Chrome.app/Contents/MacOS/Google Chrome
 1001  1000 204800 /Applications/Google Chrome Helper (Renderer)
 1002  1000  51200 /Applications/Google Chrome Helper (GPU)
 1003  1001  10240 /Applications/Google Chrome Helper (Subworker)
 2000     1  50000 /Applications/Spotify.app/Contents/MacOS/Spotify
    `.trim();

    const procData = parsePsMemoryOutput(psStdout);
    const chromeApp: AppInfo = {
      name: "Google Chrome",
      pid: 1000,
    };

    // 102400 + 204800 + 51200 + 10240 = 368640 KB
    const expectedBytes = (102400 + 204800 + 51200 + 10240) * 1024;
    expect(calculateAppMemory(chromeApp, procData)).toBe(expectedBytes);

    const spotifyApp: AppInfo = {
      name: "Spotify",
      pid: 2000,
    };
    expect(calculateAppMemory(spotifyApp, procData)).toBe(50000 * 1024);
  });

  it("enrichAppsWithMemory enriches app list with memoryBytes and memoryFormatted", async () => {
    const psStdout = `
  PID  PPID    RSS COMM
 1000     1 2457600 /Applications/Google Chrome.app/Contents/MacOS/Google Chrome
 2000     1  389120 /Applications/Spotify.app/Contents/MacOS/Spotify
    `.trim();

    const apps: AppInfo[] = [
      { name: "Google Chrome", pid: 1000 },
      { name: "Spotify", pid: 2000 },
      { name: "GhostApp", pid: 9999 },
    ];

    await enrichAppsWithMemory(apps, () => Promise.resolve(psStdout));

    expect(apps[0]?.memoryBytes).toBe(2457600 * 1024);
    expect(apps[0]?.memoryFormatted).toBe("2.3 GB");
    expect(apps[1]?.memoryBytes).toBe(389120 * 1024);
    expect(apps[1]?.memoryFormatted).toBe("380 MB");

    expect(apps[2]?.memoryBytes).toBeUndefined();
  });
});
