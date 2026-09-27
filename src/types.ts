export interface AppInfo {
  name: string;
  bundleId?: string | undefined;
  pid?: number | undefined;
}

export interface QuitResult {
  app: AppInfo;
  success: boolean;
  forced: boolean;
  error?: string | undefined;
}

export interface CliOptions {
  all?: boolean | undefined;
  yes?: boolean | undefined;
  list?: boolean | undefined;
  force?: boolean | undefined;
  json?: boolean | undefined;
  help?: boolean | undefined;
  version?: boolean | undefined;
  includeFinder?: boolean | undefined;
  includeTerminal?: boolean | undefined;
  exclude?: string[] | undefined;
  apps?: string[] | undefined;
}

export interface FilterOptions {
  includeFinder?: boolean | undefined;
  includeTerminal?: boolean | undefined;
  exclude?: string[] | undefined;
  currentTerminal?: string | null | undefined;
}

export interface QuitOptions {
  force?: boolean | undefined;
  timeoutMs?: number | undefined;
  parallel?: boolean | undefined;
}
