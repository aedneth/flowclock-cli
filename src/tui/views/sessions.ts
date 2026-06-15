/**
 * Sessions view — scrollable list of recent sessions + detail timeline.
 *
 * Pure function: no I/O, no side effects.
 */

import type { DashboardSnapshot } from "../../lib/snapshot.js";
import type { Session } from "../../schemas/session.js";
import type { Rect } from "../../lib/tui/layout.js";
import type { ThemeName } from "../../schemas/config.js";
import { panel, padTo, truncate } from "../../lib/tui/draw.js";
import { paint, THEME_FG } from "../../lib/theme.js";
import { humanDuration } from "../../lib/format.js";

export interface SessionsState {
  selectedIndex: number;
  scrollTop: number;
  detailOpen: boolean;
}

/**
 * Render the scrollable sessions list.
 */
export function renderSessions(
  snap: DashboardSnapshot,
  rect: Rect,
  state: SessionsState,
  theme: ThemeName,
  color: boolean,
): string[] {
  const { recent } = snap;
  const w = rect.width;
  const h = rect.height;
  const innerW = Math.max(0, w - 2);
  // height - 2 for panel borders
  const visibleRows = Math.max(0, h - 2);

  const body: string[] = [];

  if (recent.length === 0) {
    body.push(padTo("No sessions yet.", innerW));
  } else {
    const start = Math.max(0, state.scrollTop);
    const end = Math.min(recent.length, start + visibleRows);

    for (let i = start; i < end; i++) {
      const session = recent[i]!;
      const isSelected = i === state.selectedIndex;

      const timeStr = new Date(session.start).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      const focusStr = humanDuration(session.durationS);
      const breakStr = session.breakS > 0 ? humanDuration(session.breakS) : "—";
      const goalStr = session.goal ? truncate(session.goal, 12) : "—";

      // Target hit marker
      let hitMark = " ";
      if (session.focusTargetS !== null && session.focusTargetS !== undefined) {
        hitMark = session.durationS >= session.focusTargetS ? "✓" : "✗";
      }

      // Format: time | focus | break | goal | hit
      const row = `${timeStr} ${focusStr.padStart(8)} brk:${breakStr.padStart(6)} ${goalStr.padEnd(12)} ${hitMark}`;
      const truncated = truncate(row, innerW);
      const padded = padTo(truncated, innerW);

      if (isSelected) {
        const highlighted = color
          ? `${THEME_FG[theme]}${padded}\x1b[0m`
          : `>${padded.slice(1)}`;
        body.push(highlighted);
      } else {
        body.push(padded);
      }
    }
  }

  // Scroll indicator
  if (recent.length > visibleRows) {
    const scrollInfo = `${state.scrollTop + 1}-${Math.min(recent.length, state.scrollTop + visibleRows)}/${recent.length}`;
    body.push(padTo(scrollInfo, innerW, "right"));
  }

  void theme; void color;

  return panel({ title: "Sessions", width: w, height: h, body, color: color ? THEME_FG[theme] : undefined });
}

/**
 * Render a single session's timeline: focus intervals and break intervals.
 *
 * Reconstructs intervals from session.start, ordered session.breaks[], and session.end.
 */
export function sessionDetail(
  session: Session,
  rect: Rect,
  theme: ThemeName,
  color: boolean,
): string[] {
  const w = rect.width;
  const h = rect.height;
  const innerW = Math.max(0, w - 2);
  const body: string[] = [];

  // Header info
  const startTime = new Date(session.start).toLocaleString();
  const endTime = new Date(session.end).toLocaleString();
  body.push(padTo(`Start: ${startTime}`, innerW));
  body.push(padTo(`End:   ${endTime}`, innerW));
  body.push(padTo(`Focus: ${humanDuration(session.durationS)}`, innerW));
  if (session.breakS > 0) {
    body.push(padTo(`Break: ${humanDuration(session.breakS)}`, innerW));
  }
  if (session.goal) {
    body.push(padTo(`Goal:  ${session.goal}`, innerW));
  }
  if (session.label) {
    body.push(padTo(`Details: ${session.label}`, innerW));
  }
  body.push(padTo("─".repeat(Math.min(innerW, 20)), innerW));
  body.push(padTo("Timeline:", innerW));

  // Build timeline intervals
  const intervals: Array<{ type: "focus"; start: Date; end: Date } | { type: "break"; start: Date; end: Date; category: string }> = [];

  const sessionStart = new Date(session.start);
  const sessionEnd = new Date(session.end);

  // Sort breaks chronologically
  const sortedBreaks = [...session.breaks].sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
  );

  let cursor = sessionStart;
  for (const brk of sortedBreaks) {
    const bStart = new Date(brk.start);
    const bEnd = new Date(brk.end);

    // Focus interval before this break
    if (bStart > cursor) {
      intervals.push({ type: "focus", start: cursor, end: bStart });
    }
    intervals.push({ type: "break", start: bStart, end: bEnd, category: brk.category ?? "rest" });
    cursor = bEnd;
  }

  // Final focus interval after last break
  if (cursor < sessionEnd) {
    intervals.push({ type: "focus", start: cursor, end: sessionEnd });
  }

  // Render intervals
  for (const iv of intervals) {
    const durationS = Math.round((iv.end.getTime() - iv.start.getTime()) / 1000);
    const timeStr = iv.start.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
    if (iv.type === "focus") {
      const label = color ? paint(`FOCUS ${humanDuration(durationS)}`, theme, true) : `FOCUS ${humanDuration(durationS)}`;
      body.push(padTo(`  ${timeStr} ${label}`, innerW));
    } else {
      const cat = iv.category.toUpperCase();
      body.push(padTo(`  ${timeStr} BREAK(${cat}) ${humanDuration(durationS)}`, innerW));
    }
  }

  if (intervals.length === 0) {
    body.push(padTo("  (no break intervals)", innerW));
  }

  const title = `Session Detail`;
  return panel({ title, width: w, height: h, body, color: color ? THEME_FG[theme] : undefined });
}
