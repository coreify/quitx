import { execa } from "execa";

export type ScriptExecutor = (
  cmd: string,
  args: readonly string[],
) => Promise<{ stdout: string }>;

export async function runAppleScript(
  script: string,
  executor: ScriptExecutor = execa,
): Promise<string> {
  const { stdout } = await executor("osascript", ["-e", script]);
  return stdout.trim();
}
