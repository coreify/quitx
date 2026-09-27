import { describe, expect, it, vi } from "vitest";
import { runJXA, type ScriptExecutor } from "../src/macos/osascript";

describe("JXA runner", () => {
  it("executes script with osascript -l JavaScript and returns trimmed output", async () => {
    const mockExecutor: ScriptExecutor = vi.fn().mockResolvedValue({
      stdout: "  Result String  \n",
    });

    const result = await runJXA("function run() {}", [], mockExecutor);
    expect(result).toBe("Result String");
    expect(mockExecutor).toHaveBeenCalledWith("osascript", [
      "-l",
      "JavaScript",
      "-e",
      "function run() {}",
    ]);
  });

  it("passes arguments after the script", async () => {
    const mockExecutor: ScriptExecutor = vi.fn().mockResolvedValue({
      stdout: "true",
    });

    await runJXA(
      "function run(argv) {}",
      ["Spotify", "com.spotify.client"],
      mockExecutor,
    );
    expect(mockExecutor).toHaveBeenCalledWith("osascript", [
      "-l",
      "JavaScript",
      "-e",
      "function run(argv) {}",
      "Spotify",
      "com.spotify.client",
    ]);
  });

  it("propagates errors from executor", async () => {
    const mockExecutor: ScriptExecutor = vi
      .fn()
      .mockRejectedValue(new Error("osascript error"));

    await expect(runJXA("invalid script", [], mockExecutor)).rejects.toThrow(
      "osascript error",
    );
  });
});
