import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

export const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000; // 6 hours
export const MANUAL_RATE_LIMIT_MS = 60 * 1000; // 60 seconds
const REQUEST_TIMEOUT_MS = 1_500;
const REGISTRY_URL = "https://registry.npmjs.org/@coreify%2Fquitx/latest";
const FALLBACK_REGISTRY_URL = "https://registry.npmjs.org/quitx/latest";
export const RELEASE_URL = "https://github.com/coreify/quitx/releases/latest";

export interface UpdateCache {
  checkedAt?: number | undefined;
  ignoredVersion?: string | undefined;
  latestVersion?: string | undefined;
}

export interface UpdateInfo {
  currentVersion: string;
  latestVersion: string;
  releaseUrl: string;
}

export interface UpdateCheckOptions {
  cacheDirectory?: string | undefined;
  fetcher?: typeof fetch | undefined;
  force?: boolean | undefined;
  now?: number | undefined;
}

export interface ManualUpdateResult {
  currentVersion: string;
  latestVersion: string;
  rateLimited: boolean;
  releaseUrl: string;
  updateAvailable: boolean;
}

export function updateCacheDirectory(): string {
  const configured = process.env.XDG_CACHE_HOME;
  if (configured) return join(configured, "quitx");
  return join(homedir(), ".quitx");
}

export function parseVersion(
  version: string,
): { numbers: [number, number, number]; prerelease?: string[] } | undefined {
  const match =
    /^v?(\d+)\.(\d+)\.(\d+)(?:-([\dA-Za-z.-]+))?(?:\+[\dA-Za-z.-]+)?$/u.exec(
      version.trim(),
    );
  if (!match) return undefined;
  const numbers: [number, number, number] = [
    Number(match[1]),
    Number(match[2]),
    Number(match[3]),
  ];
  return match[4] ? { numbers, prerelease: match[4].split(".") } : { numbers };
}

export function compareVersions(left: string, right: string): number {
  const leftVersion = parseVersion(left);
  const rightVersion = parseVersion(right);
  if (!leftVersion || !rightVersion) return 0;

  for (let index = 0; index < 3; index++) {
    const difference =
      leftVersion.numbers[index]! - rightVersion.numbers[index]!;
    if (difference !== 0) return Math.sign(difference);
  }
  if (!leftVersion.prerelease && !rightVersion.prerelease) return 0;
  if (!leftVersion.prerelease) return 1;
  if (!rightVersion.prerelease) return -1;

  const length = Math.max(
    leftVersion.prerelease.length,
    rightVersion.prerelease.length,
  );
  for (let index = 0; index < length; index++) {
    const leftPart = leftVersion.prerelease[index];
    const rightPart = rightVersion.prerelease[index];
    if (leftPart === undefined) return -1;
    if (rightPart === undefined) return 1;
    if (leftPart === rightPart) continue;
    const leftNumber = /^\d+$/u.test(leftPart) ? Number(leftPart) : undefined;
    const rightNumber = /^\d+$/u.test(rightPart)
      ? Number(rightPart)
      : undefined;
    if (leftNumber !== undefined && rightNumber !== undefined) {
      return Math.sign(leftNumber - rightNumber);
    }
    if (leftNumber !== undefined) return -1;
    if (rightNumber !== undefined) return 1;
    return leftPart.localeCompare(rightPart);
  }
  return 0;
}

export async function readCache(path: string): Promise<UpdateCache> {
  try {
    const value: unknown = JSON.parse(await readFile(path, "utf8"));
    if (typeof value !== "object" || value === null) return {};
    const record = value as Record<string, unknown>;
    return {
      ...(typeof record.checkedAt === "number" &&
      Number.isFinite(record.checkedAt)
        ? { checkedAt: record.checkedAt }
        : {}),
      ...(typeof record.ignoredVersion === "string" &&
      parseVersion(record.ignoredVersion)
        ? { ignoredVersion: record.ignoredVersion }
        : {}),
      ...(typeof record.latestVersion === "string" &&
      parseVersion(record.latestVersion)
        ? { latestVersion: record.latestVersion }
        : {}),
    };
  } catch {
    return {};
  }
}

export async function writeCache(
  path: string,
  value: UpdateCache,
): Promise<void> {
  try {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, JSON.stringify(value), { mode: 0o600 });
  } catch {
    // Read-only or permission issues must not break commands.
  }
}

export async function fetchLatestVersion(
  fetcher: typeof fetch = fetch,
): Promise<string> {
  const urls = [REGISTRY_URL, FALLBACK_REGISTRY_URL];
  for (const url of urls) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    timer.unref();
    try {
      const response = await fetcher(url, {
        headers: { accept: "application/json" },
        signal: controller.signal,
      });
      if (!response.ok) continue;
      const value: unknown = await response.json();
      if (
        typeof value === "object" &&
        value !== null &&
        "version" in value &&
        typeof value.version === "string" &&
        parseVersion(value.version)
      ) {
        return value.version;
      }
    } catch {
      // try next url
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error("Unable to fetch latest version from npm registry");
}

export async function checkForUpdate(
  currentVersion: string,
  options: UpdateCheckOptions = {},
): Promise<UpdateInfo | undefined> {
  if (!parseVersion(currentVersion)) return undefined;

  const now = options.now ?? Date.now();
  const cachePath = join(
    options.cacheDirectory ?? updateCacheDirectory(),
    "update.json",
  );
  const cache = await readCache(cachePath);
  let latestVersion = cache.latestVersion;

  if (
    options.force ||
    !cache.checkedAt ||
    now - cache.checkedAt >= CHECK_INTERVAL_MS
  ) {
    try {
      latestVersion = await fetchLatestVersion(options.fetcher ?? fetch);
      await writeCache(cachePath, {
        ...cache,
        checkedAt: now,
        latestVersion,
      });
    } catch {
      // Update check must never crash or block normal commands.
    }
  }

  if (
    !latestVersion ||
    latestVersion === cache.ignoredVersion ||
    compareVersions(latestVersion, currentVersion) <= 0
  ) {
    return undefined;
  }

  return {
    currentVersion,
    latestVersion,
    releaseUrl: RELEASE_URL,
  };
}

export async function checkUpdateManually(
  currentVersion: string,
  options: UpdateCheckOptions = {},
): Promise<ManualUpdateResult> {
  const now = options.now ?? Date.now();
  const cachePath = join(
    options.cacheDirectory ?? updateCacheDirectory(),
    "update.json",
  );
  const cache = await readCache(cachePath);
  let latestVersion = cache.latestVersion;
  const isRateLimited = Boolean(
    !options.force &&
    cache.checkedAt &&
    now - cache.checkedAt < MANUAL_RATE_LIMIT_MS,
  );

  if (!isRateLimited) {
    try {
      latestVersion = await fetchLatestVersion(options.fetcher ?? fetch);
      await writeCache(cachePath, {
        ...cache,
        checkedAt: now,
        latestVersion,
      });
    } catch {
      // Manual checks handle network errors gracefully
    }
  }

  const effectiveLatest = latestVersion ?? currentVersion;
  const updateAvailable = Boolean(
    latestVersion && compareVersions(latestVersion, currentVersion) > 0,
  );

  return {
    currentVersion,
    latestVersion: effectiveLatest,
    rateLimited: isRateLimited,
    releaseUrl: RELEASE_URL,
    updateAvailable,
  };
}

export async function ignoreUpdateVersion(
  version: string,
  cacheDir = updateCacheDirectory(),
): Promise<void> {
  const cachePath = join(cacheDir, "update.json");
  const cache = await readCache(cachePath);
  await writeCache(cachePath, { ...cache, ignoredVersion: version });
}

export function installUpdate(
  version: string,
  spawner: typeof spawn = spawn,
): Promise<void> {
  if (!parseVersion(version)) {
    return Promise.reject(new Error(`Invalid update version: ${version}`));
  }

  return new Promise((resolve, reject) => {
    const pkg = `@coreify/quitx@${version}`;
    const child = spawner("npm", ["install", "--global", pkg], {
      stdio: "inherit",
      windowsHide: true,
    });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolve();
      else {
        reject(
          new Error(
            signal
              ? `Update stopped by ${signal}`
              : `npm install exited with code ${code ?? "unknown"}`,
          ),
        );
      }
    });
  });
}

export function updateNotice(update: UpdateInfo): string {
  return `Update available: ${update.currentVersion} → ${update.latestVersion}. Run: npm install --global @coreify/quitx@latest`;
}
