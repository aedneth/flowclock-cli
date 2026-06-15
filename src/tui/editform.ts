/**
 * Edit-session form — a pure, self-contained, transient overlay for the TUI
 * dashboard. Lets the user modify an existing session's goal, name, focus
 * target and break budget WITHOUT dropping to the shell.
 *
 * Mirrors sessionform.ts: types + pure functions only, no I/O. The caller
 * (app.ts) does the wiring (parsing durations, updating the session, etc.).
 */

import type { Key } from "../lib/tui/input.js";
import type { ThemeName } from "../schemas/config.js";
import { panel, truncate, padTo } from "../lib/tui/draw.js";
import { paint, THEME_FG } from "../lib/theme.js";
import { parseDurationToS } from "../lib/format.js";
import { lineApplyKey, withCursor } from "../lib/tui/lineedit.js";

// ---------------------------------------------------------------------------
// Fields
// ---------------------------------------------------------------------------

export type EditFormField = "goal" | "label" | "focus" | "break";

export type EditFormValues = Record<EditFormField, string>;

interface FieldSpec {
  key: EditFormField;
  label: string;
  hint: string;
}

/** Ordered fields, top to bottom. */
export const EDIT_FORM_FIELDS: FieldSpec[] = [
  { key: "goal",  label: "Goal",    hint: "goal/intention (optional, blank clears)" },
  { key: "label", label: "Details", hint: "session details (optional, blank clears)" },
  { key: "focus", label: "Focus", hint: "active focus time — e.g. 1h30m, 90m, 45s" },
  { key: "break", label: "Break", hint: "total break time — e.g. 20m, 0 to clear breaks" },
];

const LABEL_WIDTH = 13; // "Break budget" is 12; keep parity with sessionform

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export interface EditFormState {
  open: boolean;
  /** The id of the session being edited (carried through to the submit action). */
  sessionId: string | null;
  /** Immutable original start (ISO) — shown read-only and used for the End preview. */
  startISO: string | null;
  values: EditFormValues;
  active: number; // index into EDIT_FORM_FIELDS
  /** Cursor position (code units) within the active field's value. */
  cursor: number;
  error: string | null;
}

/** Canonical empty / closed form state. */
export function emptyEditFormState(): EditFormState {
  return {
    open: false,
    sessionId: null,
    startISO: null,
    values: { goal: "", label: "", focus: "", break: "" },
    active: 0,
    cursor: 0,
    error: null,
  };
}

/** Open a form pre-populated with the session to edit. */
export function openEditFormState(opts: {
  sessionId: string;
  startISO: string;
  values: EditFormValues;
}): EditFormState {
  // Park the cursor at the end of the first field's value.
  return {
    ...emptyEditFormState(),
    open: true,
    ...opts,
    cursor: opts.values.goal.length,
  };
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

export interface EditFormResult {
  state: EditFormState;
  action?:
    | { type: "submit"; sessionId: string; values: EditFormValues }
    | { type: "cancel" };
}

/** Move focus to another field and park the cursor at the end of its value. */
function focusField(state: EditFormState, nextActive: number): EditFormState {
  const key = EDIT_FORM_FIELDS[nextActive]?.key ?? "goal";
  return { ...state, active: nextActive, cursor: state.values[key].length, error: null };
}

/**
 * Pure reducer — never mutates `state`.
 *
 *   escape              → cancel (close, return emptyEditFormState)
 *   enter               → submit the current values (with sessionId)
 *   tab / down          → focus next field (wraps)
 *   up                  → focus previous field (wraps)
 *   ← → Home End        → move the cursor within the active field
 *   backspace / delete  → delete around the cursor
 *   printable / paste    → insert at the cursor (full paste supported)
 */
export function editFormApplyKey(
  state: EditFormState,
  key: Key,
): EditFormResult {
  const n = EDIT_FORM_FIELDS.length;
  const activeKey = EDIT_FORM_FIELDS[state.active]?.key ?? "goal";

  switch (key.name) {
    case "escape":
      return { state: emptyEditFormState(), action: { type: "cancel" } };

    case "enter":
      return {
        state,
        action: {
          type: "submit",
          sessionId: state.sessionId ?? "",
          values: { ...state.values },
        },
      };

    case "tab":
    case "down":
      return { state: focusField(state, (state.active + 1) % n) };

    case "up":
      return { state: focusField(state, (state.active - 1 + n) % n) };

    default: {
      const { state: line, handled } = lineApplyKey(
        { text: state.values[activeKey], cursor: state.cursor },
        key,
      );
      if (!handled) return { state };
      return {
        state: {
          ...state,
          values: { ...state.values, [activeKey]: line.text },
          cursor: line.cursor,
          error: null,
        },
      };
    }
  }
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

export interface EditFormOverlay {
  rows: string[];
  top: number;
  left: number;
}

/**
 * Compute the "End" timestamp from startISO + focus + break fields.
 * Returns a locale string, or "—" on any error or missing data.
 */
function computeEndPreview(
  startISO: string | null,
  focusStr: string,
  breakStr: string,
): string {
  if (!startISO) return "—";
  try {
    const startMs = new Date(startISO).getTime();
    const focusS = focusStr ? parseDurationToS(focusStr) : 0;
    const breakS = breakStr ? parseDurationToS(breakStr) : 0;
    const endMs = startMs + (focusS + breakS) * 1000;
    return new Date(endMs).toLocaleString();
  } catch {
    return "—";
  }
}

/**
 * Render the edit-session form as a centered bordered panel.
 *
 * Layout:
 *   [read-only start line]  "Start        <local time>"
 *   [field rows]            "Label        value▏"   (active field shows the cursor bar)
 *   [end preview]           "End →        <local time>"
 *   (blank)
 *   active field hint
 *   error line (only when state.error is set)
 *   (blank)
 *   "[Tab] next · [Enter] save · [Esc] cancel"
 */
export function renderEditForm(
  state: EditFormState,
  cols: number,
  rows: number,
  theme: ThemeName,
  color: boolean,
): EditFormOverlay {
  const boxWidth = Math.min(56, Math.max(34, cols - 4));
  const innerW = boxWidth - 2;

  const clampedActive = Math.max(0, Math.min(state.active, EDIT_FORM_FIELDS.length - 1));

  const body: string[] = [];

  // Read-only Start line (dimmed/plain — NOT the active-accent color)
  const startDisplay = state.startISO
    ? new Date(state.startISO).toLocaleString()
    : "—";
  const startRaw = `${"Start".padEnd(LABEL_WIDTH)} ${startDisplay}`;
  body.push(truncate("  " + startRaw, innerW));

  // Editable field rows
  EDIT_FORM_FIELDS.forEach((field, i) => {
    const isActive = i === clampedActive;
    const value = state.values[field.key];
    const shown = isActive ? withCursor(value, state.cursor) : value;
    const raw = `${field.label.padEnd(LABEL_WIDTH)} ${shown}`;

    let line: string;
    if (isActive) {
      const text = truncate("› " + raw, innerW);
      line = color ? paint(text, theme, true) : text;
    } else {
      line = truncate("  " + raw, innerW);
    }
    body.push(line);
  });

  // End preview line (plain — not focusable)
  const endDisplay = computeEndPreview(
    state.startISO,
    state.values.focus,
    state.values.break,
  );
  const endRaw = `${"End →".padEnd(LABEL_WIDTH)} ${endDisplay}`;
  body.push(truncate("  " + endRaw, innerW));

  // Spacer + active field hint
  body.push(padTo("", innerW));
  const hint = EDIT_FORM_FIELDS[clampedActive]?.hint ?? "";
  body.push(truncate("  " + hint, innerW));

  // Error (if any)
  if (state.error) {
    body.push(truncate("  ⚠ " + state.error, innerW));
  }

  // Spacer + footer
  body.push(padTo("", innerW));
  body.push(truncate("  [Tab] next · [Enter] save · [Esc] cancel", innerW));

  const boxHeight = body.length + 2; // 2 borders

  const panelRows = panel({
    title: "Edit session",
    width: boxWidth,
    height: boxHeight,
    body,
    color: color ? THEME_FG[theme] : undefined,
  });

  const left = Math.max(0, Math.floor((cols - boxWidth) / 2));
  const top = Math.max(0, Math.floor((rows - boxHeight) / 2));

  return { rows: panelRows, top, left };
}
