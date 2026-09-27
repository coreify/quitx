import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const cli = join(process.cwd(), "dist", "cli.js");

async function runCliE2E() {
  // Test --version
  const version = await execFileAsync(process.execPath, [cli, "--version"]);
  assert.ok(version.stdout.includes("quitx v"));

  // Test --help
  const help = await execFileAsync(process.execPath, [cli, "--help"]);
  assert.ok(help.stdout.includes("quitx [options]"));
  assert.ok(help.stdout.includes("--include-finder"));

  // Test --list
  const list = await execFileAsync(process.execPath, [cli, "--list"]);
  assert.equal(typeof list.stdout, "string");

  // Test --list --json
  const listJson = await execFileAsync(process.execPath, [
    cli,
    "--list",
    "--json",
  ]);
  const parsed: unknown = JSON.parse(listJson.stdout.trim());
  assert.ok(Array.isArray(parsed));

  // Test --list with --exclude
  const listExcluded = await execFileAsync(process.execPath, [
    cli,
    "--list",
    "--exclude",
    "FakeAppThatDoesNotExist",
  ]);
  assert.equal(typeof listExcluded.stdout, "string");

  // Test --list with --include-finder
  const listFinder = await execFileAsync(process.execPath, [
    cli,
    "--list",
    "--include-finder",
  ]);
  assert.equal(typeof listFinder.stdout, "string");
}

void runCliE2E().then(() => {
  console.log("✓ E2E CLI tests passed");
});
