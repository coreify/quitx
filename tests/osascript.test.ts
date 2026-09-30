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

  it("handles empty stdout correctly", async () => {
    const mockExecutor: ScriptExecutor = vi.fn().mockResolvedValue({
      stdout: "",
    });

    const result = await runJXA("function run() {}", [], mockExecutor);
    expect(result).toBe("");
  });

  it("uses default empty array when args are omitted", async () => {
    const mockExecutor: ScriptExecutor = vi.fn().mockResolvedValue({
      stdout: "ok",
    });

    const result = await runJXA("test", undefined, mockExecutor);
    expect(result).toBe("ok");
    expect(mockExecutor).toHaveBeenCalledWith("osascript", [
      "-l",
      "JavaScript",
      "-e",
      "test",
    ]);
  });
});

describe("runAppleScript", () => {
  it("executes AppleScript with osascript -e and returns trimmed output", async () => {
    const { runAppleScript } = await import("../src/macos/osascript");
    const mockExecutor: ScriptExecutor = vi.fn().mockResolvedValue({
      stdout: "\n  Finder, Safari  \n",
    });

    const result = await runAppleScript(
      'tell app "Finder" to get name',
      mockExecutor,
    );
    expect(result).toBe("Finder, Safari");
    expect(mockExecutor).toHaveBeenCalledWith("osascript", [
      "-e",
      'tell app "Finder" to get name',
    ]);
  });

  it("handles empty output in runAppleScript", async () => {
    const { runAppleScript } = await import("../src/macos/osascript");
    const mockExecutor: ScriptExecutor = vi.fn().mockResolvedValue({
      stdout: "   ",
    });

    const result = await runAppleScript("tell app", mockExecutor);
    expect(result).toBe("");
  });

  it("propagates errors from AppleScript executor", async () => {
    const { runAppleScript } = await import("../src/macos/osascript");
    const mockExecutor: ScriptExecutor = vi
      .fn()
      .mockRejectedValue(new Error("AppleScript syntax error"));

    await expect(runAppleScript("invalid as", mockExecutor)).rejects.toThrow(
      "AppleScript syntax error",
    );
  });
});
