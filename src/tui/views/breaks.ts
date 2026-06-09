/**
 * Breaks view — time by break category aggregated across recent sessions.
 *
 * Pure function: no I/O, no side effects.
 */

import type { DashboardSnapshot } from "../../lib/snapshot.js";
import type { Rect } from "../../lib/tui/layout.js";
import type { ThemeName } from "../../schemas/config.js";
import { panel, kv, barH, padTo } from "../../lib/tui/draw.js";
import { THEME_FG } from "../../lib/theme.js";
import { humanDuration } from "../../lib/format.js";
import type { BreakCategory } from "../../schemas/session.js";

const ALL_CATEGORIES: BreakCategory[] = [
  "rest",
  "meal",
  "exercise",
  "walk",
  "distraction",
  "other",
];

export function renderBreaks(
  snap: DashboardSnapshot,
  rect: Rect,
  _state: Record<string, unknown>,
  theme: ThemeName,
  color: boolean,
): string[] {
  const w = rect.width;
  const h = rect.height;
  const innerW = Math.max(0, w - 2);
  const body: string[] = [];

  // Aggregate break seconds by category across all recent sessions
  const byCategory = new Map<BreakCategory, number>();
  let totalFocusS = 0;
  let totalBreakS = 0;

  for (const session of snap.recent) {
    totalFocusS += session.durationS;
    totalBreakS += session.breakS;
    for (const brk of session.breaks) {
      const cat = brk.category as BreakCategory;
      byCategory.set(cat, (byCategory.get(cat) ?? 0) + brk.durationS);
    }
  }

  // Focus vs rest summary
  body.push(kv("Total focus (recent)", humanDuration(totalFocusS), innerW));
  body.push(kv("Total break (recent)", humanDuration(totalBreakS), innerW));
  const ratio =
    totalBreakS > 0 ? `${(totalFocusS / totalBreakS).toFixed(1)}:1` : "—";
  body.push(kv("Focus:break ratio", ratio, innerW));
  body.push(padTo("", innerW));
  body.push(padTo("Break by category:", innerW));

  // Render a bar per category
  const maxCatS = Math.max(1, ...byCategory.values());
  const labelW = 12; // "distraction " is 11 chars
  const durW = 10;
  const barW = Math.max(0, innerW - labelW - durW - 2);

  for (const cat of ALL_CATEGORIES) {
    const s = byCategory.get(cat) ?? 0;
    const label = cat.padEnd(labelW);
    const bar = barH(s, maxCatS, barW);
    const dur = humanDuration(s).padStart(durW);
    body.push(padTo(`${label}${bar} ${dur}`, innerW));
  }

  return panel({ title: "Breaks", width: w, height: h, body, color: color ? THEME_FG[theme] : undefined });
}
