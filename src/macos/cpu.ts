import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { AppInfo } from "../types";

const execFileAsync = promisify(execFile);

export function parsePsCpuOutput(stdout: string): Map<number, number> {
  const cpuByPid = new Map<number, number>();
  const lines = stdout.trim().split("\n").slice(1);
  for (const line of lines) {
    const parts = line.trim().split(/\s+/);
    if (parts.length >= 2) {
      const pid = parseInt(parts[0]!, 10);
      const cpu = parseFloat(parts[1]!);
      if (!Number.isNaN(pid) && !Number.isNaN(cpu)) {
        cpuByPid.set(pid, cpu);
      }
    }
  }
  return cpuByPid;
}

export async function getProcessCpuMap(
  customRunner?: () => Promise<string>,
): Promise<Map<number, number>> {
  try {
    const stdout = customRunner
      ? await customRunner()
      : (
          await execFileAsync("ps", ["-ax", "-o", "pid,%cpu,comm"], {
            maxBuffer: 10 * 1024 * 1024,
          })
        ).stdout;
    return parsePsCpuOutput(stdout);
  } catch {
    return new Map();
  }
}

export function calculateAppCpu(
  app: AppInfo,
  cpuByPid: ReadonlyMap<number, number>,
): number {
  const rootPids =
    app.pids && app.pids.length > 0 ? app.pids : app.pid ? [app.pid] : [];
  let total = 0;
  for (const pid of rootPids) {
    total += cpuByPid.get(pid) ?? 0;
  }
  return total;
}

export function formatCpu(cpu: number): string {
  return `${cpu.toFixed(1)}%`;
}

export async function enrichAppsWithCpu(
  apps: AppInfo[],
  customRunner?: () => Promise<string>,
): Promise<AppInfo[]> {
  if (apps.length === 0) return apps;

  const cpuByPid = await getProcessCpuMap(customRunner);
  if (cpuByPid.size === 0) {
    return apps;
  }

  for (const app of apps) {
    const cpu = calculateAppCpu(app, cpuByPid);
    if (cpu > 0) {
      app.cpuUsage = Math.round(cpu * 10) / 10;
    }
  }

  return apps;
}
