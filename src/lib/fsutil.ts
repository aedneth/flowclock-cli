import {
  mkdirSync,
  writeFileSync,
  renameSync,
  copyFileSync,
  unlinkSync,
} from "node:fs";
import { dirname } from "node:path";

/**
 * Write `data` to `file` atomically: write to a sibling temp file, then rename.
 * Falls back to copy+unlink if rename crosses a filesystem boundary.
 * Creates parent directories as needed.
 */
export function writeFileAtomic(file: string, data: string): void {
  mkdirSync(dirname(file), { recursive: true });
  const tmp = `${file}.tmp-${process.pid}`;
  writeFileSync(tmp, data, "utf8");
  try {
    renameSync(tmp, file);
  } catch {
    copyFileSync(tmp, file);
    unlinkSync(tmp);
  }
}
