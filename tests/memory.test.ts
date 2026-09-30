import { describe, expect, it } from "vitest";
import {
  calculateAppMemory,
  enrichAppsWithMemory,
  formatMemory,
  getProcessMemoryMap,
  parsePsMemoryOutput,
} from "../src/macos/memory";
import type { AppInfo } from "../src/types";

describe("memory calculation and formatting", () => {
  describe("formatMemory", () => {
    it("formats sizes into appropriate units", () => {
      expect(formatMemory(0)).toBe("0 MB");
      expect(formatMemory(-10)).toBe("0 MB");
      expect(formatMemory(500)).toBe("500 B");
      expect(formatMemory(1023)).toBe("1023 B");
      expect(formatMemory(1024)).toBe("1 KB");
      expect(formatMemory(1024 * 50)).toBe("50 KB");
      expect(formatMemory(1024 * 1024 - 1)).toBe("1024 KB");
      expect(formatMemory(1024 * 1024)).toBe("1 MB");
      expect(formatMemory(1024 * 1024 * 82)).toBe("82 MB");
      expect(formatMemory(1024 * 1024 * 612)).toBe("612 MB");
      expect(formatMemory(1024 * 1024 * 1024 * 1.1)).toBe("1.1 GB");
      expect(formatMemory(1024 * 1024 * 1024 * 2.4)).toBe("2.4 GB");
    });
  });

  describe("parsePsMemoryOutput", () => {
    it("parses ps output into process entries and child map", () => {
      const psStdout = `
    PID  PPID    RSS COMM
   1000     1 102400 /Applications/Google Chrome.app/Contents/MacOS/Google Chrome
   1001  1000 204800 /Applications/Google Chrome Helper (Renderer)
   1002  1000  51200 /Applications/Google Chrome Helper (GPU)
   2000     1  81920 /Applications/Discord.app/Contents/MacOS/Discord
      `.trim();

      const data = parsePsMemoryOutput(psStdout);
      expect(data.processes.size).toBe(4);
      expect(data.processes.get(1000)?.rssBytes).toBe(102400 * 1024);
      expect(data.children.get(1000)).toEqual([1001, 1002]);
    });

    it("handles empty or header-only output gracefully", () => {
      const empty = parsePsMemoryOutput("");
      expect(empty.processes.size).toBe(0);
      expect(empty.children.size).toBe(0);

      const headerOnly = parsePsMemoryOutput("PID  PPID    RSS COMM");
      expect(headerOnly.processes.size).toBe(0);
    });

    it("ignores malformed lines with insufficient columns or invalid numbers", () => {
      const badData = `
    PID  PPID    RSS COMM
    foo   bar    baz invalid
    bad   100    100 command
    200   100    notnumber command
    300   100    5000 /valid/app
      `.trim();

      const data = parsePsMemoryOutput(badData);
      expect(data.processes.size).toBe(1);
      expect(data.processes.get(300)?.rssBytes).toBe(5000 * 1024);
    });
  });

  describe("calculateAppMemory", () => {
    it("aggregates root PID and child helper processes", () => {
      const psStdout = `
    PID  PPID    RSS COMM
   1000     1 102400 /Applications/Google Chrome.app/Contents/MacOS/Google Chrome
   1001  1000 204800 /Applications/Google Chrome Helper (Renderer)
   1002  1000  51200 /Applications/Google Chrome Helper (GPU)
   1003  1001  10240 /Applications/Google Chrome Helper (Subworker)
   2000     1  50000 /Applications/Spotify.app/Contents/MacOS/Spotify
      `.trim();

      const procData = parsePsMemoryOutput(psStdout);
      const chromeApp: AppInfo = { name: "Google Chrome", pid: 1000 };
      const expectedBytes = (102400 + 204800 + 51200 + 10240) * 1024;
      expect(calculateAppMemory(chromeApp, procData)).toBe(expectedBytes);

      const spotifyApp: AppInfo = { name: "Spotify", pid: 2000 };
      expect(calculateAppMemory(spotifyApp, procData)).toBe(50000 * 1024);
    });

    it("aggregates memory for multiple grouped PIDs in app.pids", () => {
      const psStdout = `
    PID  PPID    RSS COMM
   3001     1  10000 /Helper1
   3002     1  20000 /Helper2
   3003  3002   5000 /HelperChild
      `.trim();

      const procData = parsePsMemoryOutput(psStdout);
      const groupedApp: AppInfo = {
        name: "HelperGroup",
        pid: 3001,
        pids: [3001, 3002],
      };

      // 10000 + 20000 + 5000 = 35000 KB
      expect(calculateAppMemory(groupedApp, procData)).toBe(35000 * 1024);
    });

    it("returns 0 when app has no pid and no pids", () => {
      const procData = parsePsMemoryOutput("PID PPID RSS COMM\n1 0 1000 init");
      expect(calculateAppMemory({ name: "NoPidApp" }, procData)).toBe(0);
    });

    it("prevents infinite loops if process tree has cyclical parentage", () => {
      const procData = {
        processes: new Map([
          [10, { pid: 10, ppid: 20, rssBytes: 1000, comm: "a" }],
          [20, { pid: 20, ppid: 10, rssBytes: 2000, comm: "b" }],
        ]),
        children: new Map([
          [10, [20]],
          [20, [10]],
        ]),
      };

      const app: AppInfo = { name: "Cyclic", pid: 10 };
      expect(calculateAppMemory(app, procData)).toBe(3000);
    });
  });

  describe("enrichAppsWithMemory and getProcessMemoryMap", () => {
    it("enriches app list with memoryBytes and memoryFormatted", async () => {
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

    it("handles empty apps array without error", async () => {
      const apps: AppInfo[] = [];
      const result = await enrichAppsWithMemory(apps);
      expect(result).toEqual([]);
    });

    it("handles runner rejection gracefully in getProcessMemoryMap", async () => {
      const runner = () => Promise.reject(new Error("ps command failed"));
      const map = await getProcessMemoryMap(runner);
      expect(map.processes.size).toBe(0);
      expect(map.children.size).toBe(0);
    });

    it("returns unchanged apps when process memory map is empty", async () => {
      const apps: AppInfo[] = [{ name: "Chrome", pid: 101 }];
      await enrichAppsWithMemory(apps, () => Promise.resolve(""));
      expect(apps[0]?.memoryBytes).toBeUndefined();
    });
  });
});
