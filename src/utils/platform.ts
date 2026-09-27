export function isMacOS(platform = process.platform): boolean {
  return platform === "darwin";
}

export function ensureMacOS(platform = process.platform): void {
  if (!isMacOS(platform)) {
    throw new Error("quitx only works on macOS.");
  }
}
