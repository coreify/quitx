import { execa } from "execa";

export type ScriptExecutor = (
  cmd: string,
  args: readonly string[],
) => Promise<{ stdout: string }>;

export async function runJXA(
  script: string,
  args: readonly string[] = [],
  executor: ScriptExecutor = execa,
): Promise<string> {
  const { stdout } = await executor("osascript", [
    "-l",
    "JavaScript",
    "-e",
    script,
    ...args,
  ]);
  return stdout.trim();
}

export async function runAppleScript(
  script: string,
  executor: ScriptExecutor = execa,
): Promise<string> {
  const { stdout } = await executor("osascript", ["-e", script]);
  return stdout.trim();
}
