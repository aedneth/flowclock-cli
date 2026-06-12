/**
 * Session editing — pure, deterministic recompute of a logged session.
 *
 * The user edits the ESSENTIAL totals (focus seconds, break seconds) and the
 * goal/name; everything else in the record — the end timestamp and the break
 * interval timeline — is recomputed automatically from those totals. The start
 * timestamp is immutable (it is the original anchor of the record).
 *
 * Design decisions (v3.7.0), confirmed with the user:
 *
 *  - Breaks are NOT auto-scaled when only focus changes. When you reduce the
 *    focus time (the classic "I fell asleep and the timer kept counting" case),
 *    the surplus is trimmed from the LAST focus segment — the tail where the
 *    runaway time actually accumulated — cascading backwards only if the last
 *    segment cannot absorb it all. Existing breaks keep their exact duration,
 *    category and ordering.
 *
 *  - Break total is edited independently and is optional. Leaving it unchanged
 *    keeps the recorded breaks byte-for-byte. Setting it to 0 removes all
 *    breaks. Setting a new positive total scales the existing break intervals
 *    proportionally (preserving their categories), or — if the session had no
 *    breaks — appends a single `rest` break of that length.
 *
 *  - end = start + focusS + breakS, exactly. The function guarantees the
 *    rebuilt segments sum to the requested totals to the whole second, so the
 *    timeline (rebuilt by `sessionDetail`) is always internally consistent.
 *
 * No I/O, no side effects. `updateSession` (in session.ts) wraps this with the
 * atomic read-modify-write.
 */

import {
  SessionSchema,
  type Session,
  type Break,
  type BreakCategory,
} from "../schemas/session.js";

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

/**
 * A surgical edit to a session's essential values. Any field left `undefined`
 * is preserved from the original record. `goal`/`label` accept `null` to clear.
 */
export interface SessionEditPatch {
  /** New active focus seconds (>= 0). Omit to keep the original focus. */
  focusS?: number;
  /** New total break seconds (>= 0). Omit to keep the recorded breaks intact. */
  breakS?: number;
  /** New goal text, or `null` to clear. Omit to keep the original. */
  goal?: string | null;
  /** New label/name text, or `null` to clear. Omit to keep the original. */
  label?: string | null;
}

// ---------------------------------------------------------------------------
// Internal segment model
// ---------------------------------------------------------------------------

/** Metadata carried by a break interval across an edit (categories survive). */
interface BreakMeta {
  durationS: number;
  category: BreakCategory;
  label: string | null;
  suggestedS: number | null;
}

/**
 * Decompose a session into the aligned focus / break segment lists used by the
 * timeline: `focus[i]` is the focus interval that PRECEDES `breaks[i]`, and the
 * trailing `focus[breaks.length]` is the focus after the last break. The
 * invariant `focus.length === breaks.length + 1` always holds.
 *
 * Focus durations are derived from the gaps between break timestamps; break
 * durations come from the canonical `durationS` on each break record.
 */
function decompose(session: Session): { focus: number[]; breaks: BreakMeta[] } {
  const startMs = Date.parse(session.start);
  const endMs = Date.parse(session.end);

  const sorted = [...session.breaks].sort(
    (a, b) => Date.parse(a.start) - Date.parse(b.start),
  );

  const focus: number[] = [];
  const breaks: BreakMeta[] = [];

  let cursor = startMs;
  for (const brk of sorted) {
    const bStart = Date.parse(brk.start);
    const bEnd = Date.parse(brk.end);
    const gap = Math.max(0, Math.round((bStart - cursor) / 1000));
    focus.push(gap);
    breaks.push({
      durationS: brk.durationS,
      category: brk.category,
      label: brk.label,
      suggestedS: brk.suggestedS,
    });
    cursor = bEnd;
  }
  // Trailing focus segment after the last break (or the whole session if none).
  const tail = Math.max(0, Math.round((endMs - cursor) / 1000));
  focus.push(tail);

  // The gap-derived focus total can drift from the canonical `durationS` (clock
  // rounding, or a session whose stored end predates a break edit). Reconcile
  // the trailing segment so the focus segments sum to the canonical focus — the
  // trim-from-end edit then operates on a faithful baseline.
  const gapTotal = focus.reduce((a, b) => a + b, 0);
  const drift = session.durationS - gapTotal;
  focus[focus.length - 1] = Math.max(0, focus[focus.length - 1]! + drift);

  return { focus, breaks };
}

/** Trim (delta<0) or extend (delta>0) focus, applied from the LAST segment back. */
function applyFocusDelta(focus: number[], delta: number): void {
  if (delta >= 0) {
    focus[focus.length - 1] = (focus[focus.length - 1] ?? 0) + delta;
    return;
  }
  let remaining = -delta;
  for (let i = focus.length - 1; i >= 0 && remaining > 0; i--) {
    const take = Math.min(remaining, focus[i]!);
    focus[i]! -= take;
    remaining -= take;
  }
}

/** Scale break intervals to a new total, preserving categories, exact to the second. */
function scaleBreaks(breaks: BreakMeta[], newTotal: number): BreakMeta[] {
  const oldTotal = breaks.reduce((a, b) => a + b.durationS, 0);
  if (breaks.length === 0) return [];

  let scaled: BreakMeta[];
  if (oldTotal <= 0) {
    // Degenerate: zero-length breaks but a positive new total — load it onto the
    // first interval so the count/categories are preserved.
    scaled = breaks.map((b, i) => ({ ...b, durationS: i === 0 ? newTotal : 0 }));
  } else {
    scaled = breaks.map((b) => ({
      ...b,
      durationS: Math.round((b.durationS * newTotal) / oldTotal),
    }));
  }

  // Fix rounding drift on the last interval so the sum is exact.
  const got = scaled.reduce((a, b) => a + b.durationS, 0);
  const last = scaled.length - 1;
  scaled[last]!.durationS = Math.max(0, scaled[last]!.durationS + (newTotal - got));
  return scaled;
}

// ---------------------------------------------------------------------------
// Main recompute
// ---------------------------------------------------------------------------

/**
 * Recompute a session after a surgical edit to its essential values.
 *
 * Returns a NEW validated session record; never mutates the input. Throws (via
 * zod) only if the recomputed record is somehow invalid — which the totals
 * clamping below is designed to prevent.
 */
export function recomputeSession(
  original: Session,
  patch: SessionEditPatch,
): Session {
  const { focus, breaks } = decompose(original);

  // ── Break edit (applied first; it can restructure the focus segments) ──────
  let newBreaks: BreakMeta[];
  if (patch.breakS === undefined) {
    newBreaks = breaks;
  } else {
    const target = Math.max(0, Math.floor(patch.breakS));
    if (target === 0) {
      // Drop all breaks → focus collapses to a single segment.
      newBreaks = [];
      const merged = focus.reduce((a, b) => a + b, 0);
      focus.length = 0;
      focus.push(merged);
    } else if (breaks.length === 0) {
      // No breaks before → append a single `rest` break after all focus.
      newBreaks = [
        { durationS: target, category: "rest", label: null, suggestedS: null },
      ];
      const merged = focus.reduce((a, b) => a + b, 0);
      focus.length = 0;
      focus.push(merged, 0); // focus-before-break, focus-after-break(=0)
    } else {
      newBreaks = scaleBreaks(breaks, target);
    }
  }

  // ── Focus edit (trim/extend from the end) ──────────────────────────────────
  const oldFocusTotal = focus.reduce((a, b) => a + b, 0);
  const newFocusTotal =
    patch.focusS === undefined
      ? oldFocusTotal
      : Math.max(0, Math.floor(patch.focusS));
  applyFocusDelta(focus, newFocusTotal - oldFocusTotal);

  // ── Rebuild the break timeline from start, interleaving focus and breaks ───
  const startMs = Date.parse(original.start);
  const rebuilt: Break[] = [];
  let cursor = startMs;
  for (let i = 0; i < focus.length; i++) {
    cursor += (focus[i] ?? 0) * 1000;
    const brk = newBreaks[i];
    if (brk) {
      const bStart = cursor;
      const bEnd = cursor + brk.durationS * 1000;
      rebuilt.push({
        start: new Date(bStart).toISOString(),
        end: new Date(bEnd).toISOString(),
        durationS: brk.durationS,
        category: brk.category,
        label: brk.label,
        suggestedS: brk.suggestedS,
      });
      cursor = bEnd;
    }
  }

  const breakTotal = newBreaks.reduce((a, b) => a + b.durationS, 0);
  const endMs = startMs + (newFocusTotal + breakTotal) * 1000;

  const next: Session = {
    ...original,
    end: new Date(endMs).toISOString(),
    durationS: newFocusTotal,
    breaks: rebuilt,
    breakS: breakTotal,
    // Legacy `pauses` are superseded by canonical `breaks`; clear them so a
    // re-read never re-derives stale breaks from them (see normalizeSession).
    pauses: [],
    goal: patch.goal === undefined ? original.goal : patch.goal,
    label: patch.label === undefined ? original.label : patch.label,
  };

  return SessionSchema.parse(next);
}
