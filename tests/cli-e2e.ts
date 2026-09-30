import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const cli = join(process.cwd(), "dist", "cli.js");

async function runCliE2E() {
  const tempDir = mkdtempSync(join(tmpdir(), "quitx-e2e-"));
  const env = { ...process.env, QUITX_DIR: tempDir };

  try {
    const version = await execFileAsync(process.execPath, [cli, "--version"], {
      env,
    });
    assert.ok(version.stdout.includes("quitx v"));

    const help = await execFileAsync(process.execPath, [cli, "--help"], {
      env,
    });
    assert.ok(help.stdout.includes("quitx [options]"));
    assert.ok(help.stdout.includes("--windowless"));
    assert.ok(help.stdout.includes("--sort"));
    assert.ok(help.stdout.includes("--keep"));
    assert.ok(help.stdout.includes("restart"));
    assert.ok(help.stdout.includes("stash"));
    assert.ok(help.stdout.includes("restore"));

    const list = await execFileAsync(process.execPath, [cli, "--list"], {
      env,
    });
    assert.equal(typeof list.stdout, "string");

    const listJson = await execFileAsync(
      process.execPath,
      [cli, "--list", "--json"],
      { env },
    );
    const parsed: unknown = JSON.parse(listJson.stdout.trim());
    assert.ok(Array.isArray(parsed));

    const excludeJson = await execFileAsync(
      process.execPath,
      [cli, "--exclude", "TestDummyApp", "--json"],
      { env },
    );
    const excludeParsed: unknown = JSON.parse(excludeJson.stdout.trim());
    assert.ok(
      typeof excludeParsed === "object" &&
        excludeParsed !== null &&
        "exclude" in excludeParsed,
    );

    const configGet = await execFileAsync(
      process.execPath,
      [cli, "config", "get", "exclude", "--json"],
      { env },
    );
    assert.ok(configGet.stdout.includes("TestDummyApp"));

    const stashDry = await execFileAsync(
      process.execPath,
      [cli, "stash", "--dry-run", "--yes", "--json"],
      { env },
    );
    assert.ok(typeof JSON.parse(stashDry.stdout.trim()) === "object");

    const restoreDry = await execFileAsync(
      process.execPath,
      [cli, "restore", "--dry-run", "--yes", "--json"],
      { env },
    );
    assert.ok(typeof JSON.parse(restoreDry.stdout.trim()) === "object");
  } finally {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      //
    }
  }
}

void runCliE2E().then(() => {
  console.log("✓ E2E CLI tests passed");
});
