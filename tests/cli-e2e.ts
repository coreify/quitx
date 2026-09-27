import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const cli = join(process.cwd(), "dist", "cli.js");

async function runCliE2E() {
  const version = await execFileAsync(process.execPath, [cli, "--version"]);
  assert.ok(version.stdout.includes("quitx v"));

  const help = await execFileAsync(process.execPath, [cli, "--help"]);
  assert.ok(help.stdout.includes("quitx [options]"));
  assert.ok(help.stdout.includes("--exclude"));
  assert.ok(help.stdout.includes("exclude"));

  const list = await execFileAsync(process.execPath, [cli, "--list"]);
  assert.equal(typeof list.stdout, "string");

  const listJson = await execFileAsync(process.execPath, [
    cli,
    "--list",
    "--json",
  ]);
  const parsed: unknown = JSON.parse(listJson.stdout.trim());
  assert.ok(Array.isArray(parsed));

  const excludeJson = await execFileAsync(process.execPath, [
    cli,
    "--exclude",
    "TestDummyApp",
    "--json",
  ]);
  const excludeParsed: unknown = JSON.parse(excludeJson.stdout.trim());
  assert.ok(
    typeof excludeParsed === "object" &&
      excludeParsed !== null &&
      "exclude" in excludeParsed,
  );
}

void runCliE2E().then(() => {
  console.log("✓ E2E CLI tests passed");
});
