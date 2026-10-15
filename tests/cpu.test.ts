import { describe, expect, it, vi } from "vitest";
import {
  calculateAppCpu,
  enrichAppsWithCpu,
  formatCpu,
  getProcessCpuMap,
  parsePsCpuOutput,
} from "../src/macos/cpu";
import type { AppInfo } from "../src/types";

const execFileMock = vi.hoisted(() => {
  const fn = (
    _cmd: string,
    _args: readonly string[],
    _opts: unknown,
    cb: (err: Error | null, stdout: string) => void,
  ): void => {
    cb(null, "PID CPU\n 1 4.0\n");
  };
  const mock = vi.fn(fn);
  return Object.assign(mock, {
    [Symbol.for("nodejs.util.promisify.custom")]: (
      cmd: string,
      args: readonly string[],
      opts: unknown,
    ) => {
      mock(cmd, args, opts, () => {});
      return Promise.resolve({
        stdout: "PID CPU\n 1 4.0\n",
        stderr: "",
      });
    },
  });
});

vi.mock("node:child_process", () => ({
  execFile: execFileMock,
}));

describe("parsePsCpuOutput", () => {
  it("parses pid and cpu columns skipping the header", () => {
    const stdout = [
      "  PID  %CPU COMMAND",
      "  101  12.5 /Applications/Slack.app",
      "  102   0.0 /usr/libexec/foo",
      "bad line",
      "",
    ].join("\n");

    const map = parsePsCpuOutput(stdout);
    expect(map.get(101)).toBe(12.5);
    expect(map.get(102)).toBe(0);
    expect(map.size).toBe(2);
  });

  it("ignores malformed numbers", () => {
    const stdout = ["PID CPU", "abc def", "103 xyz"].join("\n");
    const map = parsePsCpuOutput(stdout);
    expect(map.size).toBe(0);
  });
});

describe("getProcessCpuMap", () => {
  it("uses a custom runner when provided", async () => {
    const map = await getProcessCpuMap(() =>
      Promise.resolve("PID CPU\n 42 7.5\n"),
    );
    expect(map.get(42)).toBe(7.5);
  });

  it("returns an empty map when the runner throws", async () => {
    const map = await getProcessCpuMap(() =>
      Promise.reject(new Error("ps failed")),
    );
    expect(map.size).toBe(0);
  });
});

describe("calculateAppCpu", () => {
  it("sums cpu across grouped pids", () => {
    const app: AppInfo = { name: "App", pids: [1, 2, 3] };
    const cpu = new Map([
      [1, 10],
      [2, 2.5],
      [3, 99],
    ]);
    expect(calculateAppCpu(app, cpu)).toBe(111.5);
  });

  it("falls back to the single pid and ignores unknown pids", () => {
    expect(calculateAppCpu({ name: "App", pid: 7 }, new Map([[7, 3]]))).toBe(3);
    expect(calculateAppCpu({ name: "App" }, new Map([[7, 3]]))).toBe(0);
  });
});

describe("formatCpu", () => {
  it("formats with one decimal place", () => {
    expect(formatCpu(12.34)).toBe("12.3%");
    expect(formatCpu(0)).toBe("0.0%");
  });
});

describe("enrichAppsWithCpu", () => {
  it("returns apps untouched when the list is empty", async () => {
    await expect(
      enrichAppsWithCpu([], () => Promise.resolve("x")),
    ).resolves.toEqual([]);
  });

  it("returns apps untouched when ps output is empty", async () => {
    const apps: AppInfo[] = [{ name: "App", pid: 1 }];
    const result = await enrichAppsWithCpu(apps, () =>
      Promise.resolve("PID CPU\n"),
    );
    expect(result[0]?.cpuUsage).toBeUndefined();
  });

  it("attaches rounded cpuUsage for running pids", async () => {
    const apps: AppInfo[] = [
      { name: "Busy", pids: [10, 11] },
      { name: "Idle", pid: 12 },
    ];
    const stdout = ["PID CPU", "10 6.66", "11 1.11", "12 0"].join("\n");
    const result = await enrichAppsWithCpu(apps, () => Promise.resolve(stdout));
    expect(result[0]?.cpuUsage).toBe(7.8);
    expect(result[1]?.cpuUsage).toBeUndefined();
  });

  it("swallows runner failures", async () => {
    const apps: AppInfo[] = [{ name: "App", pid: 1 }];
    const result = await enrichAppsWithCpu(apps, () =>
      Promise.reject(new Error("boom")),
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.cpuUsage).toBeUndefined();
  });

  it("uses execFile when no custom runner is given", async () => {
    const map = await getProcessCpuMap();
    expect(execFileMock).toHaveBeenCalledWith(
      "ps",
      ["-ax", "-o", "pid,%cpu,comm"],
      expect.any(Object),
      expect.any(Function),
    );
    expect(map.get(1)).toBe(4);
  });
});
