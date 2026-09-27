import { defineConfig } from "tsup";

export default defineConfig({
  entry: { cli: "src/cli.ts" },
  format: ["esm"],
  dts: false,
  clean: true,
  minify: false,
  platform: "node",
  target: "node20",
  treeshake: true,
  external: ["@clack/core", "@clack/prompts", "execa"],
  banner: { js: "#!/usr/bin/env node" },
});
