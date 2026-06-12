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
  { key: "goal",  label: "Goal",  hint: "goal/intention (optional, blank clears)" },
  { key: "label", label: "Name",  hint: "session name (optional, blank clears)" },
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
    error: null,
  };
}

/** Open a form pre-populated with the session to edit. */
export function openEditFormState(opts: {
  sessionId: string;
  startISO: string;
  values: EditFormValues;
}): EditFormState {
  return { ...emptyEditFormState(), open: true, ...opts };
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

/**
 * Pure reducer — never mutates `state`.
 *
 *   escape           → cancel (close, return emptyEditFormState)
 *   enter            → submit the current values (with sessionId)
 *   tab / down       → focus next field (wraps)
 *   up               → focus previous field (wraps)
 *   backspace        → delete last char of the active field
 *   printable char   → append to the active field
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
      return { state: { ...state, active: (state.active + 1) % n, error: null } };

    case "up":
      return { state: { ...state, active: (state.active - 1 + n) % n, error: null } };

    case "backspace":
      return {
        state: {
          ...state,
          values: {
            ...state.values,
            [activeKey]: state.values[activeKey].slice(0, -1),
          },
          error: null,
        },
      };

    case "char": {
      const ch = key.char;
      const code = ch.codePointAt(0) ?? 0;
      // Printable and not Ctrl-C
      if (code >= 0x20 && ch !== "\x03") {
        return {
          state: {
            ...state,
            values: { ...state.values, [activeKey]: state.values[activeKey] + ch },
            error: null,
          },
        };
      }
      return { state };
    }

    default:
      return { state };
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
    const cursor = isActive ? "▏" : "";
    const raw = `${field.label.padEnd(LABEL_WIDTH)} ${value}${cursor}`;

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
