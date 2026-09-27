import { describe, expect, it, vi } from "vitest";
import { runAppleScript, type ScriptExecutor } from "../src/macos/applescript";

describe("applescript runner", () => {
  it("executes script with osascript -e and returns trimmed output", async () => {
    const mockExecutor: ScriptExecutor = vi.fn().mockResolvedValue({
      stdout: "  Result String  \n",
    });

    const result = await runAppleScript("tell app ...", mockExecutor);
    expect(result).toBe("Result String");
    expect(mockExecutor).toHaveBeenCalledWith("osascript", [
      "-e",
      "tell app ...",
    ]);
  });

  it("propagates errors from executor", async () => {
    const mockExecutor: ScriptExecutor = vi
      .fn()
      .mockRejectedValue(new Error("AppleScript syntax error"));

    await expect(
      runAppleScript("invalid script", mockExecutor),
    ).rejects.toThrow("AppleScript syntax error");
  });
});
