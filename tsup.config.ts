import { defineConfig } from "tsup";
import { chmodSync, readFileSync, writeFileSync } from "node:fs";

const SHEBANG = "#!/usr/bin/env node\n";

export default defineConfig({
  entry: {
    cli: "src/cli.ts",
    index: "src/index.ts",
  },
  format: ["esm"],
  target: "node20",
  platform: "node",
  outDir: "dist",
  clean: true,
  dts: true,
  sourcemap: true,
  // Splitting makes the dynamic import() of the MCP server a real lazy chunk,
  // so the heavy MCP SDK is only loaded by `flowclock mcp` — not the HUD path.
  splitting: true,
  shims: false,
  // Add the shebang to the executable entry only (not chunks/library main).
  async onSuccess() {
    const cli = "dist/cli.js";
    const body = readFileSync(cli, "utf8");
    if (!body.startsWith("#!")) writeFileSync(cli, SHEBANG + body);
    chmodSync(cli, 0o755);
  },
});
