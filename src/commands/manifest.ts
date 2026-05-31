import type { CommandContext } from "../lib/context.js";
import { buildManifest } from "../lib/manifest.js";
import { jsonSuccess, printJson } from "../lib/output.js";

/** `manifest` always emits JSON (it exists for machine discovery). */
export function runManifest(_ctx: CommandContext): void {
  printJson(jsonSuccess("manifest", buildManifest()));
}
