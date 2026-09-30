import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { AppInfo } from "../types";

const execFileAsync = promisify(execFile);

export function formatMemory(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 MB";
  const gb = 1024 * 1024 * 1024;
  const mb = 1024 * 1024;
  const kb = 1024;

  if (bytes >= gb) {
    return `${(bytes / gb).toFixed(1)} GB`;
  }
  if (bytes >= mb) {
    return `${Math.round(bytes / mb)} MB`;
  }
  if (bytes >= kb) {
    return `${Math.round(bytes / kb)} KB`;
  }
  return `${bytes} B`;
}

export interface ProcessMemoryEntry {
  pid: number;
  ppid: number;
  rssBytes: number;
  comm: string;
}

export interface ProcessMemoryMap {
  processes: Map<number, ProcessMemoryEntry>;
  children: Map<number, number[]>;
}

export function parsePsMemoryOutput(stdout: string): ProcessMemoryMap {
  const processes = new Map<number, ProcessMemoryEntry>();
  const children = new Map<number, number[]>();

  const lines = stdout.trim().split("\n").slice(1);
  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    if (parts.length >= 4) {
      const pid = parseInt(parts[0]!, 10);
      const ppid = parseInt(parts[1]!, 10);
      const rssKb = parseInt(parts[2]!, 10);
      const comm = parts.slice(3).join(" ");

      if (!Number.isNaN(pid) && !Number.isNaN(rssKb)) {
        const rssBytes = rssKb * 1024;
        processes.set(pid, { pid, ppid, rssBytes, comm });
        if (!children.has(ppid)) {
          children.set(ppid, []);
        }
        children.get(ppid)!.push(pid);
      }
    }
  }

  return { processes, children };
}

export async function getProcessMemoryMap(
  customRunner?: () => Promise<string>,
): Promise<ProcessMemoryMap> {
  try {
    const stdout = customRunner
      ? await customRunner()
      : (
          await execFileAsync("ps", ["-ax", "-o", "pid,ppid,rss,comm"], {
            maxBuffer: 10 * 1024 * 1024,
          })
        ).stdout;
    return parsePsMemoryOutput(stdout);
  } catch {
    return { processes: new Map(), children: new Map() };
  }
}

export function calculateAppMemory(
  app: AppInfo,
  procData: ProcessMemoryMap,
): number {
  const rootPids: number[] = [];
  if (app.pid) rootPids.push(app.pid);
  if (app.pids) {
    for (const p of app.pids) {
      if (!rootPids.includes(p)) rootPids.push(p);
    }
  }

  if (rootPids.length === 0) return 0;

  let totalBytes = 0;
  const queue = [...rootPids];
  const seen = new Set<number>(rootPids);

  while (queue.length > 0) {
    const currentPid = queue.shift()!;
    const proc = procData.processes.get(currentPid);
    if (proc) {
      totalBytes += proc.rssBytes;
    }
    const kids = procData.children.get(currentPid) ?? [];
    for (const childPid of kids) {
      if (!seen.has(childPid)) {
        seen.add(childPid);
        queue.push(childPid);
      }
    }
  }

  return totalBytes;
}

export async function enrichAppsWithMemory(
  apps: AppInfo[],
  customRunner?: () => Promise<string>,
): Promise<AppInfo[]> {
  if (apps.length === 0) return apps;

  const procData = await getProcessMemoryMap(customRunner);
  if (procData.processes.size === 0) {
    return apps;
  }

  for (const app of apps) {
    const bytes = calculateAppMemory(app, procData);
    if (bytes > 0) {
      app.memoryBytes = bytes;
      app.memoryFormatted = formatMemory(bytes);
    }
  }

  return apps;
}
