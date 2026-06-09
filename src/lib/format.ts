/** Humanize a duration in seconds as "1h 02m 03s" / "2m 05s" / "9s". */
export function humanDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0)
    return `${h}h ${String(m).padStart(2, "0")}m ${String(sec).padStart(2, "0")}s`;
  if (m > 0) return `${m}m ${String(sec).padStart(2, "0")}s`;
  return `${sec}s`;
}

/**
 * Parse a human duration string into whole seconds.
 *
 * Accepted forms:
 *   "1h30m"    → 5400
 *   "90m"      → 5400
 *   "45s"      → 45
 *   "1h"       → 3600
 *   "1h30m15s" → 5415
 *   "3600"     → 3600  (bare integer treated as seconds)
 *
 * Throws an error for anything that does not fully match one of these forms.
 */
export function parseDurationToS(input: string): number {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error(
      `invalid duration: ${JSON.stringify(input)} (use forms like 1h30m, 90m, 45s, or seconds)`,
    );
  }

  // Bare integer — treat as seconds.
  if (/^\d+$/.test(trimmed)) {
    return parseInt(trimmed, 10);
  }

  // hms pattern — must have at least one h/m/s component.
  const hmsRe = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/;
  const match = hmsRe.exec(trimmed);
  if (!match || trimmed === "") {
    throw new Error(
      `invalid duration: ${JSON.stringify(input)} (use forms like 1h30m, 90m, 45s, or seconds)`,
    );
  }

  const h = match[1] !== undefined ? parseInt(match[1], 10) : 0;
  const m = match[2] !== undefined ? parseInt(match[2], 10) : 0;
  const s = match[3] !== undefined ? parseInt(match[3], 10) : 0;

  // If all groups were undefined the string had no recognized tokens.
  if (match[1] === undefined && match[2] === undefined && match[3] === undefined) {
    throw new Error(
      `invalid duration: ${JSON.stringify(input)} (use forms like 1h30m, 90m, 45s, or seconds)`,
    );
  }

  return h * 3600 + m * 60 + s;
}
