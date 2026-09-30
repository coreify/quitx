import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleQuitFailures } from "../src/macos/quit";
import type {
  AppInfo,
  CliOptions,
  QuitResult,
  QuitxConfig,
} from "../src/types";

const mockConfirm = vi.fn<(...args: unknown[]) => Promise<boolean | symbol>>();
const mockLogWarn = vi.fn<(...args: unknown[]) => void>();
const mockLogSuccess = vi.fn<(...args: unknown[]) => void>();
const mockLogError = vi.fn<(...args: unknown[]) => void>();

vi.mock("@clack/prompts", () => ({
  confirm: (...args: unknown[]) => mockConfirm(...args),
  isCancel: (val: unknown): boolean => typeof val === "symbol",
  log: {
    warn: (...args: unknown[]) => mockLogWarn(...args),
    success: (...args: unknown[]) => mockLogSuccess(...args),
    error: (...args: unknown[]) => mockLogError(...args),
  },
}));

describe("handleQuitFailures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const stubbornApp: AppInfo = { name: "StubbornApp", pid: 9001 };
  const successfulResult: QuitResult = {
    app: { name: "NormalApp", pid: 9002 },
    success: true,
    forced: false,
  };
  const failedResult: QuitResult = {
    app: stubbornApp,
    success: false,
    forced: false,
    error: "App is still running (may have unsaved changes or prompt)",
  };

  it("returns original results when all apps quit successfully", async () => {
    const results = [successfulResult];
    const out = await handleQuitFailures(results);
    expect(out).toEqual(results);
    expect(mockConfirm).not.toHaveBeenCalled();
  });

  it("returns original results when dryRun is true", async () => {
    const results = [failedResult];
    const out = await handleQuitFailures(results, { dryRun: true });
    expect(out).toEqual(results);
    expect(mockConfirm).not.toHaveBeenCalled();
  });

  it("does nothing when onQuitFailure mode is 'error'", async () => {
    const results = [{ ...failedResult }];
    const config: Partial<QuitxConfig> = { onQuitFailure: "error" };
    const out = await handleQuitFailures(results, {}, config);
    expect(out[0]?.success).toBe(false);
    expect(mockConfirm).not.toHaveBeenCalled();
  });

  it("auto force-quits when onQuitFailure is 'force' via config", async () => {
    const killSpy = vi.spyOn(process, "kill").mockReturnValue(true);
    const results = [{ ...failedResult }];
    const config: Partial<QuitxConfig> = { onQuitFailure: "force" };

    const out = await handleQuitFailures(results, {}, config);

    expect(killSpy).toHaveBeenCalledWith(9001, "SIGKILL");
    expect(out[0]?.success).toBe(true);
    expect(out[0]?.forced).toBe(true);
    expect(out[0]?.error).toBeUndefined();
    killSpy.mockRestore();
  });

  it("auto force-quits when --on-quit-failure=force is passed via options", async () => {
    const killSpy = vi.spyOn(process, "kill").mockReturnValue(true);
    const results = [{ ...failedResult }];
    const options: CliOptions = { onQuitFailure: "force" };
    const config: Partial<QuitxConfig> = { onQuitFailure: "prompt" };

    const out = await handleQuitFailures(results, options, config);

    expect(killSpy).toHaveBeenCalledWith(9001, "SIGKILL");
    expect(out[0]?.success).toBe(true);
    expect(out[0]?.forced).toBe(true);
    killSpy.mockRestore();
  });

  it("handles failed SIGKILL in force mode", async () => {
    const killSpy = vi.spyOn(process, "kill").mockImplementation(() => {
      throw new Error("EPERM");
    });
    const results = [{ ...failedResult }];
    const options: CliOptions = { onQuitFailure: "force" };

    const out = await handleQuitFailures(results, options);

    expect(killSpy).toHaveBeenCalledWith(9001, "SIGKILL");
    expect(out[0]?.success).toBe(false);
    expect(out[0]?.forced).toBe(true);
    expect(out[0]?.error).toBe("Force quit failed (SIGKILL)");
    killSpy.mockRestore();
  });

  it("prompts user and force-quits when user confirms yes", async () => {
    mockConfirm.mockResolvedValue(true);
    const killSpy = vi.spyOn(process, "kill").mockReturnValue(true);
    const results = [{ ...failedResult }];

    const out = await handleQuitFailures(
      results,
      {},
      { onQuitFailure: "prompt" },
    );

    expect(mockConfirm).toHaveBeenCalledTimes(1);
    expect(killSpy).toHaveBeenCalledWith(9001, "SIGKILL");
    expect(out[0]?.success).toBe(true);
    expect(out[0]?.forced).toBe(true);
    killSpy.mockRestore();
  });

  it("leaves failure intact when user rejects prompt", async () => {
    mockConfirm.mockResolvedValue(false);
    const killSpy = vi.spyOn(process, "kill");
    const results = [{ ...failedResult }];

    const out = await handleQuitFailures(
      results,
      {},
      { onQuitFailure: "prompt" },
    );

    expect(mockConfirm).toHaveBeenCalledTimes(1);
    expect(killSpy).not.toHaveBeenCalled();
    expect(out[0]?.success).toBe(false);
  });

  it("leaves failure intact when prompt is cancelled (symbol)", async () => {
    mockConfirm.mockResolvedValue(Symbol("cancel"));
    const killSpy = vi.spyOn(process, "kill");
    const results = [{ ...failedResult }];

    const out = await handleQuitFailures(
      results,
      {},
      { onQuitFailure: "prompt" },
    );

    expect(mockConfirm).toHaveBeenCalledTimes(1);
    expect(killSpy).not.toHaveBeenCalled();
    expect(out[0]?.success).toBe(false);
  });

  it("bypasses prompt in non-interactive modes (yes, quiet, json)", async () => {
    const results = [{ ...failedResult }];

    // yes: true
    await handleQuitFailures(
      results,
      { yes: true },
      { onQuitFailure: "prompt" },
    );
    expect(mockConfirm).not.toHaveBeenCalled();

    // quiet: true
    await handleQuitFailures(
      results,
      { quiet: true },
      { onQuitFailure: "prompt" },
    );
    expect(mockConfirm).not.toHaveBeenCalled();

    // json: true
    await handleQuitFailures(
      results,
      { json: true },
      { onQuitFailure: "prompt" },
    );
    expect(mockConfirm).not.toHaveBeenCalled();
  });
});
