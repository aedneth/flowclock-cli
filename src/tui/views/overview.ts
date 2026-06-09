/**
 * Overview view — today's focus/break totals, flow score, streaks,
 * daily maximization bar, last-7-days sparkline, and latest achievements.
 *
 * Pure function: no I/O, no side effects.
 */

import type { DashboardSnapshot } from "../../lib/snapshot.js";
import type { Rect } from "../../lib/tui/layout.js";
import type { ThemeName } from "../../schemas/config.js";
import { panel, kv, gauge, barH, sparkline, padTo } from "../../lib/tui/draw.js";
import { paint, THEME_FG } from "../../lib/theme.js";
import { humanDuration } from "../../lib/format.js";

export function renderOverview(
  snap: DashboardSnapshot,
  rect: Rect,
  _state: Record<string, unknown>,
  theme: ThemeName,
  color: boolean,
): string[] {
  const { stats, game } = snap;
  const w = rect.width;
  const h = rect.height;
  const innerW = Math.max(0, w - 2);
  const fg = color ? THEME_FG[theme] : "";

  const body: string[] = [];

  // Today focus + break
  body.push(kv("Today focus", humanDuration(stats.todayTotalS), innerW));
  body.push(kv("Today break", humanDuration(stats.todayBreakS), innerW));

  // Focus:rest ratio (today)
  const ratioStr =
    game.focusRestRatioToday > 0
      ? `${game.focusRestRatioToday.toFixed(1)}:1`
      : "—";
  body.push(kv("Focus:rest today", ratioStr, innerW));

  // Flow score gauge
  const gaugeW = Math.max(10, innerW);
  const scoreGauge = gauge(game.flowScore, gaugeW);
  body.push(padTo(`Flow score: ${scoreGauge}`, innerW));

  // Streak info
  body.push(kv("Current streak", `${stats.currentStreak} day${stats.currentStreak !== 1 ? "s" : ""}`, innerW));
  body.push(kv("Longest streak", `${stats.longestStreak} day${stats.longestStreak !== 1 ? "s" : ""}`, innerW));

  // Daily maximization bar
  const dmLabel = `${game.dailyMaximizationPct}%`;
  const dmPrefix = "Daily goal: ";
  const barW = Math.max(0, innerW - dmPrefix.length - dmLabel.length - 1);
  const dmBar = barH(game.dailyMaximizationPct, 100, barW);
  body.push(padTo(`${dmPrefix}${dmBar} ${dmLabel}`, innerW));

  // Spacer
  body.push("");

  // Last 7 days sparkline
  const weekVals = snap.stats.week.map((d) => d.totalS);
  const spark = sparkline(weekVals);
  // Build day labels (Mon–Sun) abbreviated from the dates
  const dayLabels = snap.stats.week.map((d) => {
    const dt = new Date(d.date + "T12:00:00Z");
    return ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"][dt.getUTCDay()] ?? "--";
  });
  body.push(padTo("Last 7 days:", innerW));
  body.push(padTo(spark + "  " + dayLabels.join(" "), innerW));

  // Spacer
  body.push("");

  // Achievements (earned ones first, then unearned)
  const earned = game.achievements.filter((a) => a.earnedAt !== null);
  const unearned = game.achievements.filter((a) => a.earnedAt === null);

  body.push(padTo("Achievements:", innerW));
  for (const a of earned) {
    const mark = color ? paint("✓", theme, true) : "✓";
    body.push(padTo(`${mark} ${a.label} — ${a.description}`, innerW));
  }
  for (const a of unearned) {
    body.push(padTo(`· ${a.label} — ${a.description}`, innerW));
  }

  // Suppress unused variable warning
  void fg;

  return panel({ title: "Overview", width: w, height: h, body, color: color ? THEME_FG[theme] : undefined });
}
