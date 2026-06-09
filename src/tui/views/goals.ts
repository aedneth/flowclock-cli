/**
 * Goals view — per-goal rollups from snap.goals.
 *
 * Pure function: no I/O, no side effects.
 */

import type { DashboardSnapshot } from "../../lib/snapshot.js";
import type { Rect } from "../../lib/tui/layout.js";
import type { ThemeName } from "../../schemas/config.js";
import { panel, kv, padTo, truncate } from "../../lib/tui/draw.js";
import { THEME_FG } from "../../lib/theme.js";
import { humanDuration } from "../../lib/format.js";

export function renderGoals(
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

  const { goals } = snap;

  if (goals.length === 0) {
    body.push(padTo("No goals yet.", innerW));
    body.push(padTo('Start a session with: --goal "My goal"', innerW));
  } else {
    for (const g of goals) {
      const name = truncate(g.goal, Math.min(innerW, 30));
      body.push(padTo(`[${name}]`, innerW));
      body.push(kv("  Sessions", String(g.count), innerW));
      body.push(kv("  Total focus", humanDuration(g.totalS), innerW));
      body.push(kv("  Total break", humanDuration(g.totalBreakS), innerW));
      // met/missed/neutral
      const tally = `${g.met}✓  ${g.missed}✗  ${g.neutral}·`;
      body.push(kv("  Results", tally, innerW));
      // budget / target
      if (g.budgetMet > 0 || g.targetMet > 0) {
        body.push(kv("  Budget met", String(g.budgetMet), innerW));
        body.push(kv("  Target met", String(g.targetMet), innerW));
      }
      body.push(padTo("", innerW));
    }
  }

  return panel({ title: "Goals", width: w, height: h, body, color: color ? THEME_FG[theme] : undefined });
}
