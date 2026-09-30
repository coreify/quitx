export interface AppInfo {
  name: string;
  bundleId?: string | undefined;
  pid?: number | undefined;
  pids?: number[] | undefined;
  count?: number | undefined;
  isBackground?: boolean | undefined;
  isMusic?: boolean | undefined;
  windowCount?: number | undefined;
  memoryBytes?: number | undefined;
  memoryFormatted?: string | undefined;
}

export interface QuitResult {
  app: AppInfo;
  success: boolean;
  forced: boolean;
  error?: string | undefined;
}

export type OnQuitFailureMode = "prompt" | "force" | "error";

export interface QuitxConfig {
  exclude: string[];
  force: "normal" | "force";
  includeFinder: boolean;
  includeTrash: boolean;
  includeBackground: boolean;
  groupBackground: boolean;
  defaultSelectAll: boolean;
  neverQuitMusic: boolean;
  musicApps: string[];
  autoUpdate: boolean;
  sortBy?: "name" | "memory" | undefined;
  onQuitFailure?: OnQuitFailureMode | undefined;
}

export interface CliOptions {
  all?: boolean | undefined;
  yes?: boolean | undefined;
  list?: boolean | undefined;
  force?: boolean | undefined;
  json?: boolean | undefined;
  dryRun?: boolean | undefined;
  help?: boolean | undefined;
  version?: boolean | undefined;
  quiet?: boolean | undefined;
  exclude?: string[] | undefined;
  manageExclude?: boolean | undefined;
  manageConfig?: boolean | undefined;
  configAction?: "get" | "set" | "show" | "reset" | undefined;
  configKey?: string | undefined;
  configValue?: string | undefined;
  includeFinder?: boolean | undefined;
  includeTrash?: boolean | undefined;
  includeBackground?: boolean | undefined;
  neverQuitMusic?: boolean | undefined;
  musicApps?: string[] | undefined;
  apps?: string[] | undefined;
  checkUpdate?: boolean | undefined;
  noUpdateCheck?: boolean | undefined;
  windowless?: boolean | undefined;
  keep?: string[] | undefined;
  sortBy?: "name" | "memory" | undefined;
  command?: "restart" | "stash" | "restore" | undefined;
  restart?: boolean | undefined;
  stash?: boolean | undefined;
  restore?: boolean | undefined;
  onQuitFailure?: OnQuitFailureMode | undefined;
}

export interface QuitOptions {
  force?: boolean | undefined;
  dryRun?: boolean | undefined;
  timeoutMs?: number | undefined;
  parallel?: boolean | undefined;
}

export interface StashAppEntry {
  name: string;
  bundleId?: string | undefined;
}

export interface StashData {
  timestamp: string;
  apps: StashAppEntry[];
}
