import * as cp from "node:child_process";
import { EventEmitter } from "node:events";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CHECK_INTERVAL_MS,
  checkForUpdate,
  checkUpdateManually,
  compareVersions,
  ignoreUpdateVersion,
  installUpdate,
  parseVersion,
  readCache,
  updateCacheDirectory,
  updateNotice,
  writeCache,
} from "../src/update";

function createMockFetcher(version: string): typeof fetch {
  return vi.fn().mockImplementation(() =>
    Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ version }),
    } as Response),
  );
}

describe("version parsing and comparison", () => {
  it("parses valid semver versions", () => {
    expect(parseVersion("1.0.0")).toEqual({ numbers: [1, 0, 0] });
    expect(parseVersion("v2.3.4")).toEqual({ numbers: [2, 3, 4] });
    expect(parseVersion("1.2.3-alpha.1")).toEqual({
      numbers: [1, 2, 3],
      prerelease: ["alpha", "1"],
    });
    expect(parseVersion("invalid")).toBeUndefined();
    expect(parseVersion("1.0")).toBeUndefined();
  });

  it("compares versions correctly", () => {
    expect(compareVersions("1.0.0", "1.0.0")).toBe(0);
    expect(compareVersions("1.1.0", "1.0.0")).toBe(1);
    expect(compareVersions("1.0.0", "1.1.0")).toBe(-1);
    expect(compareVersions("2.0.0", "1.9.9")).toBe(1);
    expect(compareVersions("1.0.1", "1.0.0")).toBe(1);
    expect(compareVersions("1.0.0-alpha", "1.0.0")).toBe(-1);
    expect(compareVersions("1.0.0", "1.0.0-alpha")).toBe(1);
    expect(compareVersions("1.0.0-alpha.1", "1.0.0-alpha.2")).toBe(-1);
    expect(compareVersions("1.0.0-alpha.2", "1.0.0-alpha.1")).toBe(1);
    expect(compareVersions("1.0.0-alpha.1", "1.0.0-alpha.beta")).toBe(-1);
    expect(compareVersions("1.0.0-alpha.beta", "1.0.0-alpha.1")).toBe(1);
    expect(compareVersions("1.0.0-alpha.beta", "1.0.0-alpha.gamma")).toBe(-1);
    expect(compareVersions("1.0.0-alpha.1", "1.0.0-alpha.1.1")).toBe(-1);
    expect(compareVersions("1.0.0-alpha.1.1", "1.0.0-alpha.1")).toBe(1);
    expect(compareVersions("1.0.0-alpha.1", "1.0.0-alpha.1")).toBe(0);
    expect(compareVersions("invalid", "1.0.0")).toBe(0);
  });
});

describe("update cache and directory", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "quitx-update-test-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("returns cache directory path", () => {
    const dir = updateCacheDirectory();
    expect(dir).toBeTruthy();
    expect(typeof dir).toBe("string");
  });

  it("reads and writes cache safely", async () => {
    const cacheFile = join(tempDir, "update.json");
    expect(await readCache(cacheFile)).toEqual({});

    await writeCache(cacheFile, {
      checkedAt: 123456789,
      latestVersion: "1.2.0",
      ignoredVersion: "1.1.5",
    });

    const read = await readCache(cacheFile);
    expect(read.checkedAt).toBe(123456789);
    expect(read.latestVersion).toBe("1.2.0");
    expect(read.ignoredVersion).toBe("1.1.5");
  });

  it("handles corrupt cache files gracefully", async () => {
    const cacheFile = join(tempDir, "corrupt.json");
    await writeCache(cacheFile, {});
    await writeFile(cacheFile, "INVALID JSON DATA");

    const read = await readCache(cacheFile);
    expect(read).toEqual({});
  });

  it("ignores update versions", async () => {
    await ignoreUpdateVersion("1.3.0", tempDir);
    const read = await readCache(join(tempDir, "update.json"));
    expect(read.ignoredVersion).toBe("1.3.0");
  });
});

describe("checkForUpdate", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "quitx-update-check-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("returns undefined for invalid current version", async () => {
    const res = await checkForUpdate("invalid", { cacheDirectory: tempDir });
    expect(res).toBeUndefined();
  });

  it("fetches latest version and detects update", async () => {
    const mockFetcher = createMockFetcher("1.5.0");

    const res = await checkForUpdate("1.1.0", {
      cacheDirectory: tempDir,
      fetcher: mockFetcher,
    });

    expect(res).toBeDefined();
    expect(res?.latestVersion).toBe("1.5.0");
    expect(res?.currentVersion).toBe("1.1.0");
    expect(mockFetcher).toHaveBeenCalled();
  });

  it("returns undefined when already on latest version", async () => {
    const mockFetcher = createMockFetcher("1.1.0");

    const res = await checkForUpdate("1.1.0", {
      cacheDirectory: tempDir,
      fetcher: mockFetcher,
    });

    expect(res).toBeUndefined();
  });

  it("uses cached check if within 6 hours", async () => {
    const now = 1000000000000;
    const cacheFile = join(tempDir, "update.json");
    await writeCache(cacheFile, {
      checkedAt: now - (CHECK_INTERVAL_MS - 10000), // less than 6h ago
      latestVersion: "1.5.0",
    });

    const mockFetcher: typeof fetch = vi.fn();
    const res = await checkForUpdate("1.1.0", {
      cacheDirectory: tempDir,
      fetcher: mockFetcher,
      now,
    });

    expect(res?.latestVersion).toBe("1.5.0");
    expect(mockFetcher).not.toHaveBeenCalled();
  });

  it("refetches if cache is older than 6 hours", async () => {
    const now = 1000000000000;
    const cacheFile = join(tempDir, "update.json");
    await writeCache(cacheFile, {
      checkedAt: now - (CHECK_INTERVAL_MS + 10000), // older than 6h
      latestVersion: "1.2.0",
    });

    const mockFetcher = createMockFetcher("1.6.0");

    const res = await checkForUpdate("1.1.0", {
      cacheDirectory: tempDir,
      fetcher: mockFetcher,
      now,
    });

    expect(res?.latestVersion).toBe("1.6.0");
    expect(mockFetcher).toHaveBeenCalled();
  });

  it("skips ignored versions", async () => {
    const cacheFile = join(tempDir, "update.json");
    await writeCache(cacheFile, {
      latestVersion: "1.5.0",
      ignoredVersion: "1.5.0",
      checkedAt: Date.now(),
    });

    const res = await checkForUpdate("1.1.0", {
      cacheDirectory: tempDir,
    });

    expect(res).toBeUndefined();
  });

  it("handles fetch network failure gracefully without throwing", async () => {
    const mockFetcher: typeof fetch = vi
      .fn()
      .mockImplementation(() => Promise.reject(new Error("Network offline")));

    const res = await checkForUpdate("1.1.0", {
      cacheDirectory: tempDir,
      fetcher: mockFetcher,
    });

    expect(res).toBeUndefined();
  });
});

describe("checkUpdateManually", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), "quitx-manual-update-"));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it("checks npm registry and returns update result", async () => {
    const mockFetcher = createMockFetcher("2.0.0");

    const res = await checkUpdateManually("1.1.0", {
      cacheDirectory: tempDir,
      fetcher: mockFetcher,
    });

    expect(res.updateAvailable).toBe(true);
    expect(res.latestVersion).toBe("2.0.0");
    expect(res.rateLimited).toBe(false);
  });

  it("enforces 60s cooldown unless forced", async () => {
    const now = 1000000000000;
    const cacheFile = join(tempDir, "update.json");
    await writeCache(cacheFile, {
      checkedAt: now - 10000, // 10s ago
      latestVersion: "2.0.0",
    });

    const mockFetcher: typeof fetch = vi.fn();
    const rateLimitedRes = await checkUpdateManually("1.1.0", {
      cacheDirectory: tempDir,
      fetcher: mockFetcher,
      now,
    });

    expect(rateLimitedRes.rateLimited).toBe(true);
    expect(mockFetcher).not.toHaveBeenCalled();

    const forcedRes = await checkUpdateManually("1.1.0", {
      cacheDirectory: tempDir,
      fetcher: createMockFetcher("2.1.0"),
      now,
      force: true,
    });

    expect(forcedRes.rateLimited).toBe(false);
    expect(forcedRes.latestVersion).toBe("2.1.0");
  });
});

describe("updateNotice", () => {
  it("formats update notice correctly", () => {
    const notice = updateNotice({
      currentVersion: "1.1.0",
      latestVersion: "1.2.0",
      releaseUrl: "https://github.com/coreify/quitx/releases/latest",
    });
    expect(notice).toContain("Update available: 1.1.0 → 1.2.0");
    expect(notice).toContain("npm install --global @coreify/quitx@latest");
  });
});

describe("installUpdate", () => {
  it("rejects on invalid version string", async () => {
    await expect(installUpdate("invalid")).rejects.toThrow(
      "Invalid update version",
    );
  });

  it("spawns npm install and resolves on code 0", async () => {
    const mockEmitter = new EventEmitter();
    const mockSpawner = vi.fn().mockReturnValue(mockEmitter as unknown);
    setTimeout(() => mockEmitter.emit("exit", 0, null), 5);

    await expect(
      installUpdate("1.2.0", mockSpawner as unknown as typeof cp.spawn),
    ).resolves.toBeUndefined();
  });

  it("spawns npm install and rejects on non-zero exit or error", async () => {
    const mockEmitter1 = new EventEmitter();
    const mockSpawner1 = vi.fn().mockReturnValue(mockEmitter1 as unknown);
    setTimeout(() => mockEmitter1.emit("exit", 1, null), 5);

    await expect(
      installUpdate("1.2.0", mockSpawner1 as unknown as typeof cp.spawn),
    ).rejects.toThrow("npm install exited with code 1");

    const mockEmitter2 = new EventEmitter();
    const mockSpawner2 = vi.fn().mockReturnValue(mockEmitter2 as unknown);
    setTimeout(() => mockEmitter2.emit("error", new Error("exec failure")), 5);

    await expect(
      installUpdate("1.2.0", mockSpawner2 as unknown as typeof cp.spawn),
    ).rejects.toThrow("exec failure");
  });
});

describe("fetchLatestVersion", () => {
  it("throws error when all registry URLs fail", async () => {
    const { fetchLatestVersion } = await import("../src/update");
    const mockFetcher: typeof fetch = vi.fn().mockImplementation(() =>
      Promise.resolve({
        ok: false,
        status: 404,
      } as Response),
    );
    await expect(fetchLatestVersion(mockFetcher)).rejects.toThrow(
      "Unable to fetch latest version from npm registry",
    );
  });
});
