/**
 * Session view — the HERO live-counter panel for the TUI dashboard.
 *
 * Layout philosophy: RESERVE metadata/footer space first, then scale the
 * big-font counter into what remains. This prevents the counter from growing
 * so large that it crowds out the progress lines and footer controls.
 *
 * Pure function: no I/O, no side effects.
 */

import type { Rect } from "../../lib/tui/layout.js";
import type { ThemeName } from "../../schemas/config.js";
import type { BreakCategory } from "../../schemas/session.js";
import { panel, padTo, displayWidth } from "../../lib/tui/draw.js";
import { barH } from "../../lib/tui/draw.js";
import { paint, THEME_FG } from "../../lib/theme.js";
import { humanDuration } from "../../lib/format.js";
import { breakRatio } from "../../lib/flowtime.js";
import {
  renderCounter,
  styleWidth,
  styleBaseRows,
  uniformCounterScale,
} from "../../lib/bigfont.js";
import type { DisplayStyle } from "../../schemas/config.js";

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface SessionViewState {
  active: boolean;                 // is a session currently running?
  time: string;                    // display clock "HH:MM:SS" (or "MM:SS")
  goal: string | null;
  label: string | null;
  focusS: number;                  // active focus seconds
  totalBreakS: number;             // total break seconds (closed + current)
  onBreak: boolean;
  currentBreakS: number;           // seconds in the current break (0 if not on break)
  breakCategory: BreakCategory;    // current/most-recent break category
  suggestedBreakS: number | null;  // proportional suggestion
  focusTargetS: number | null;
  breakBudgetS: number | null;
  zen: boolean;                    // hide goal + metadata (hero clock only)
  displayStyle: DisplayStyle;      // block · simple · outline · minimal · classic · bold
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/** Format whole seconds as MM:SS (no hours). Mirrors hud.ts formatMS. */
function fmtMS(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

/** Produce a blank line padded to innerW. */
function blankLine(innerW: number): string {
  return padTo("", innerW);
}

/** How the counter will be drawn: a real style, or the single-line text clock. */
interface CounterPlan {
  /** The style to render the counter in, or "text" for the tiny fallback. */
  style: DisplayStyle | "text";
  /** Whether the goal line is kept (dropped first to reclaim vertical room). */
  showGoal: boolean;
}

/**
 * Decide how to fit the counter into the available rows — the graceful
 * degradation ladder that keeps a real glyph clock on screen as long as possible:
 *
 *   1. requested style, keeping the goal line;
 *   2. requested style, with the goal line DROPPED to reclaim two rows;
 *   3. only when even a glyph font cannot fit do we collapse to the single
 *      centered text line.
 *
 * EVERY style now shares the exact 5-row × 4-col `block` footprint (`classic`/
 * `bold` are shade-weight variants of block, not the old taller letterforms), so
 * the requested style renders at every window size the others do. There is no
 * tall-font case and no fall-back to a different style: cycling styles never
 * changes the counter's footprint, and classic/bold are never silently swapped
 * for block in a tight window.
 */
function planCounter(
  innerW: number,
  innerH: number,
  time: string,
  style: DisplayStyle,
  hasGoal: boolean,
  bottomCount: number,
): CounterPlan {
  const bottomReserve = bottomCount > 0 ? bottomCount + 1 : 0; // lines + gap
  const goalRows = hasGoal ? 2 : 0; // goal line + its gap
  const availRows = (gr: number): number => innerH - (gr + bottomReserve);
  const fits = (st: DisplayStyle, gr: number): boolean =>
    innerW >= styleWidth(st, time, 1) && availRows(gr) >= styleBaseRows(st);

  // 1-2: keep the requested style; keep the goal if it fits, else drop it.
  if (fits(style, goalRows)) return { style, showGoal: hasGoal };
  if (hasGoal && fits(style, 0)) return { style, showGoal: false };

  // 3: last resort — single centered text line. Keep the goal only if there is
  // still a row for the clock after the goal + metadata.
  return { style: "text", showGoal: hasGoal && availRows(goalRows) >= 1 };
}

// ---------------------------------------------------------------------------
// Main render function
// ---------------------------------------------------------------------------

/**
 * Render the Session panel. Returns exactly `rect.height` rows each of
 * display-width `rect.width`.
 */
export function renderSession(
  state: SessionViewState,
  rect: Rect,
  theme: ThemeName,
  color: boolean,
): string[] {
  const innerW = Math.max(0, rect.width - 2);
  const innerH = Math.max(0, rect.height - 2);
  const themeColor = color ? THEME_FG[theme] : undefined;
  const RESET = "\x1b[0m";

  // ── IDLE ─────────────────────────────────────────────────────────────────
  if (!state.active) {
    const body = buildIdleBody(innerW, innerH);
    return panel({ title: "Session", width: rect.width, height: rect.height, body, color: themeColor });
  }

  // ── ACTIVE ───────────────────────────────────────────────────────────────
  const { goal, label, focusS, totalBreakS, focusTargetS, breakBudgetS,
          onBreak, currentBreakS, breakCategory, suggestedBreakS,
          zen, displayStyle, time } = state;

  // -- Bottom lines (progress / break metadata) -----------------------------
  // CENTERED below the counter; suppressed entirely in zen mode. The control
  // hints live ONLY in the dashboard's global footer (app.ts) — the panel no
  // longer renders its own footer, so the two never duplicate.
  const goalText = goal ?? label;
  const bottomLines: string[] = [];

  if (!zen) {
    // Focus progress line
    if (focusTargetS != null && focusTargetS > 0) {
      const ratio = Math.min(1, focusS / focusTargetS);
      const pct = Math.round(ratio * 100);
      const bar = barH(focusS, focusTargetS, 10);
      const won = focusS >= focusTargetS && (breakBudgetS == null || totalBreakS <= breakBudgetS);
      const prefix = won ? "✦ " : "";
      const progressLine = `${prefix}focus ${humanDuration(focusS)}/${humanDuration(focusTargetS)}  ▕${bar}▏ ${pct}%`;
      bottomLines.push(padTo(progressLine, innerW, "center"));
    }

    // Break summary line
    if (breakBudgetS != null || totalBreakS > 0) {
      const budgetStr = breakBudgetS != null ? humanDuration(breakBudgetS) : "—";
      let breakLine = `break ${humanDuration(totalBreakS)}/${budgetStr}`;
      if (totalBreakS > 0 && focusS > 0) {
        const r = breakRatio(focusS, totalBreakS);
        breakLine += ` · ratio 1:${r.toFixed(1)}`;
      }
      bottomLines.push(padTo(breakLine, innerW, "center"));
    }

    // On-break status line
    if (onBreak) {
      let onBreakLine = `☕ on break · ${breakCategory} · ${fmtMS(currentBreakS)}`;
      if (suggestedBreakS != null) {
        onBreakLine += `  (sug ${fmtMS(suggestedBreakS)})`;
      }
      bottomLines.push(padTo(onBreakLine, innerW, "center"));
    }
  }

  // -- Counter scaling: RESERVE-FIRST, with graceful degradation ------------
  // Plan how the counter fits the available rows: keep the requested style if it
  // fits, else drop the goal line, and only collapse to a single text line as a
  // last resort. Because every style shares block's 5-row footprint, the chosen
  // style — including classic/bold — renders at its true glyphs in a minimized
  // window with metadata, and is never silently swapped for a different style.
  const hasGoal = !!goalText && !zen;
  const plan = planCounter(innerW, innerH, time, displayStyle, hasGoal, bottomLines.length);

  // -- Top line (goal/label) — CENTERED above the counter, kept only if the
  //    plan made room for it (dropped first when vertical space is tight).
  const topLines: string[] = [];
  if (plan.showGoal && goalText) {
    const text = color ? paint(goalText, theme, true) : goalText;
    topLines.push(padTo(text, innerW, "center"));
  }

  // Reserve space for top and bottom sections first, then scale the counter
  // into what remains — the guarantee that the counter never overshadows the
  // metadata.
  const topGap = topLines.length > 0 ? 1 : 0;       // blank row after top lines
  const bottomGap = bottomLines.length > 0 ? 1 : 0;  // blank row before bottom lines
  const reserved = topLines.length + topGap + bottomLines.length + bottomGap;

  let counterLines: string[];

  if (plan.style === "text") {
    // Panel is too small for any glyph font — fall back to a single centered
    // text line so tiny panels still display the clock.
    const raw = padTo(time, innerW, "center");
    const line = color ? `${THEME_FG[theme]}${raw}${RESET}` : raw;
    counterLines = [line];
  } else {
    const counterAreaRows = Math.max(styleBaseRows(plan.style), innerH - reserved);
    // Uniform scaling: every style shares the 5-row × 4-col block footprint, so a
    // single scale gives them all an identical rendered size — cycling styles
    // never makes the counter jump in size.
    const scale = uniformCounterScale(innerW, counterAreaRows, time, plan.style);
    // Every style shares the reserve-first scaling maths via style-aware metrics
    // (styleWidth / styleBaseRows); they differ only in glyph rendering:
    //   "block"   solid full-block █ glyphs (default)
    //   "simple"  clean heavy box-drawing seven-segment line digits
    //   "outline" double-line box-drawing silhouette digits
    //   "minimal" light box-drawing seven-segment line digits
    //   "classic" solid LIGHT shade ░ terminal numerals
    //   "bold"    solid HEAVY shade ▓ terminal numerals
    const rawLines = renderCounter(plan.style, time, scale);
    counterLines = rawLines.map((line) => {
      const padded = padTo(line, innerW, "center");
      return color ? `${THEME_FG[theme]}${padded}${RESET}` : padded;
    });
  }

  // -- Assemble body with counter vertically centered in remaining space ----
  // Layout:  topLines | padTop blanks | counterLines | padBottom blanks | bottomLines
  const totalUsed = topLines.length + counterLines.length + bottomLines.length;
  const leftover = Math.max(0, innerH - totalUsed);
  const padTop = Math.floor(leftover / 2);
  const padBottom = leftover - padTop;

  const body: string[] = [];
  for (const line of topLines) body.push(padTo(line, innerW));
  for (let i = 0; i < padTop; i++) body.push(blankLine(innerW));
  for (const line of counterLines) body.push(padTo(line, innerW));
  for (let i = 0; i < padBottom; i++) body.push(blankLine(innerW));
  for (const line of bottomLines) body.push(padTo(line, innerW));

  // Safety clamp: if somehow we overshot innerH, drop trailing body lines.
  // (reserve math above should prevent this, but be defensive.)
  while (body.length > innerH) body.pop();

  // Pad out to exactly innerH if we undershot (e.g., very large panel with
  // few bottom lines and a capped counter).
  while (body.length < innerH) body.push(blankLine(innerW));

  return panel({ title: "Session", width: rect.width, height: rect.height, body, color: themeColor });
}

// ---------------------------------------------------------------------------
// Idle body builder
// ---------------------------------------------------------------------------

function buildIdleBody(innerW: number, innerH: number): string[] {
  const lines: string[] = [
    padTo("No active session", innerW, "center"),
    padTo("", innerW),
    padTo("Press [s] or Enter to start", innerW, "center"),
    padTo("or [/] for commands · start --goal --target --break-budget from your shell", innerW, "center"),
  ];

  const body: string[] = [];
  const padTop = Math.max(0, Math.floor((innerH - lines.length) / 2));

  for (let i = 0; i < padTop; i++) body.push(padTo("", innerW));
  for (const line of lines) body.push(line);
  while (body.length < innerH) body.push(padTo("", innerW));
  // Clamp
  while (body.length > innerH) body.pop();

  return body;
}

// Re-export displayWidth so tests can use it without a separate import path
export { displayWidth };
