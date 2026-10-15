import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

process.env.QUITX_DIR = mkdtempSync(join(tmpdir(), "quitx-test-"));
delete process.env.QUITX_RECENTLY_QUIT_FILE;
