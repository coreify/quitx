import { describe, expect, it } from "vitest";
import { ensureMacOS, isMacOS } from "../src/utils/platform";

describe("platform utils", () => {
  it("correctly identifies macOS darwin platform", () => {
    expect(isMacOS("darwin")).toBe(true);
    expect(isMacOS("linux")).toBe(false);
    expect(isMacOS("win32")).toBe(false);
    expect(isMacOS("aix")).toBe(false);
  });

  it("ensureMacOS succeeds on darwin", () => {
    expect(() => ensureMacOS("darwin")).not.toThrow();
  });

  it("ensureMacOS throws on non-darwin platforms", () => {
    expect(() => ensureMacOS("linux")).toThrowError(
      "quitx only works on macOS.",
    );
    expect(() => ensureMacOS("win32")).toThrowError(
      "quitx only works on macOS.",
    );
  });

  it("isMacOS uses process.platform by default", () => {
    expect(isMacOS()).toBe(process.platform === "darwin");
  });

  it("ensureMacOS respects default process.platform", () => {
    if (process.platform === "darwin") {
      expect(() => ensureMacOS()).not.toThrow();
    } else {
      expect(() => ensureMacOS()).toThrowError("quitx only works on macOS.");
    }
  });

  it("handles other platform strings correctly", () => {
    expect(isMacOS("android")).toBe(false);
    expect(isMacOS("freebsd")).toBe(false);
    expect(isMacOS("openbsd")).toBe(false);
    expect(isMacOS("sunos")).toBe(false);
    expect(() => ensureMacOS("freebsd")).toThrowError(
      "quitx only works on macOS.",
    );
  });
});
