export interface AppInfo {
  name: string;
  bundleId?: string | undefined;
  pid?: number | undefined;
  pids?: number[] | undefined;
  count?: number | undefined;
  isBackground?: boolean | undefined;
  isMusic?: boolean | undefined;
}

export interface QuitResult {
  app: AppInfo;
  success: boolean;
  forced: boolean;
  error?: string | undefined;
}

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
}

export interface CliOptions {
  all?: boolean | undefined;
  yes?: boolean | undefined;
  list?: boolean | undefined;
  force?: boolean | undefined;
  json?: boolean | undefined;
  help?: boolean | undefined;
  version?: boolean | undefined;
  quiet?: boolean | undefined;
  exclude?: string[] | undefined;
  manageExclude?: boolean | undefined;
  manageConfig?: boolean | undefined;
  includeFinder?: boolean | undefined;
  includeTrash?: boolean | undefined;
  includeBackground?: boolean | undefined;
  neverQuitMusic?: boolean | undefined;
  musicApps?: string[] | undefined;
  apps?: string[] | undefined;
}

export interface QuitOptions {
  force?: boolean | undefined;
  timeoutMs?: number | undefined;
  parallel?: boolean | undefined;
}
