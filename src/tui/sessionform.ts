/**
 * New-session form — a pure, self-contained, transient overlay for the TUI
 * dashboard. Lets the user pick a goal, name, focus target and break budget
 * for a session WITHOUT dropping to the shell, then start it in the dashboard.
 *
 * Mirrors the palette's design: types + pure functions only, no I/O. The caller
 * (app.ts) does the wiring (parsing durations, creating the Timer, etc.).
 */

import type { Key } from "../lib/tui/input.js";
import type { ThemeName } from "../schemas/config.js";
import { panel, truncate, padTo } from "../lib/tui/draw.js";
import { paint, THEME_FG } from "../lib/theme.js";

// ---------------------------------------------------------------------------
// Fields
// ---------------------------------------------------------------------------

export type SessionFormField = "goal" | "label" | "target" | "break";

export type SessionFormValues = Record<SessionFormField, string>;

interface FieldSpec {
  key: SessionFormField;
  label: string;
  hint: string;
}

/** Ordered fields, top to bottom. */
export const SESSION_FORM_FIELDS: FieldSpec[] = [
  { key: "goal", label: "Goal", hint: "what you want to accomplish (optional)" },
  { key: "label", label: "Name", hint: "short session name (optional)" },
  { key: "target", label: "Target", hint: "focus target — e.g. 1h, 90m, 25m (optional)" },
  { key: "break", label: "Break budget", hint: "e.g. 20m, 5m (optional)" },
];

const LABEL_WIDTH = 13; // "Break budget" is the longest label

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export interface SessionFormState {
  open: boolean;
  values: SessionFormValues;
  active: number; // index into SESSION_FORM_FIELDS
  error: string | null;
}

/** Canonical empty / closed form state. */
export function emptySessionFormState(): SessionFormState {
  return {
    open: false,
    values: { goal: "", label: "", target: "", break: "" },
    active: 0,
    error: null,
  };
}

/** Open a fresh form. */
export function openSessionFormState(): SessionFormState {
  return { ...emptySessionFormState(), open: true };
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

export interface SessionFormResult {
  state: SessionFormState;
  action?:
    | { type: "submit"; values: SessionFormValues }
    | { type: "cancel" };
}

/**
 * Pure reducer — never mutates `state`.
 *
 *   escape           → cancel (close)
 *   enter            → submit the current values
 *   tab / down       → focus next field (wraps)
 *   up               → focus previous field (wraps)
 *   backspace        → delete last char of the active field
 *   printable char   → append to the active field
 */
export function sessionFormApplyKey(
  state: SessionFormState,
  key: Key,
): SessionFormResult {
  const n = SESSION_FORM_FIELDS.length;
  const activeKey = SESSION_FORM_FIELDS[state.active]?.key ?? "goal";

  switch (key.name) {
    case "escape":
      return { state: emptySessionFormState(), action: { type: "cancel" } };

    case "enter":
      return { state, action: { type: "submit", values: { ...state.values } } };

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

export interface SessionFormOverlay {
  rows: string[];
  top: number;
  left: number;
}

/**
 * Render the new-session form as a centered bordered panel.
 *
 * Layout:
 *   [field rows]      "Label        value▏"   (active field shows the cursor bar)
 *   (blank)
 *   active field hint
 *   error line (only when state.error is set)
 *   (blank)
 *   "[Tab] next · [Enter] start · [Esc] cancel"
 */
export function renderSessionForm(
  state: SessionFormState,
  cols: number,
  rows: number,
  theme: ThemeName,
  color: boolean,
): SessionFormOverlay {
  const boxWidth = Math.min(56, Math.max(34, cols - 4));
  const innerW = boxWidth - 2;

  const clampedActive = Math.max(0, Math.min(state.active, SESSION_FORM_FIELDS.length - 1));

  const body: string[] = [];

  // Field rows
  SESSION_FORM_FIELDS.forEach((field, i) => {
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

  // Spacer + active field hint
  body.push(padTo("", innerW));
  const hint = SESSION_FORM_FIELDS[clampedActive]?.hint ?? "";
  body.push(truncate("  " + hint, innerW));

  // Error (if any)
  if (state.error) {
    body.push(truncate("  ⚠ " + state.error, innerW));
  }

  // Spacer + footer
  body.push(padTo("", innerW));
  body.push(truncate("  [Tab] next · [Enter] start · [Esc] cancel", innerW));

  const boxHeight = body.length + 2; // 2 borders

  const panelRows = panel({
    title: "New session",
    width: boxWidth,
    height: boxHeight,
    body,
    color: color ? THEME_FG[theme] : undefined,
  });

  const left = Math.max(0, Math.floor((cols - boxWidth) / 2));
  const top = Math.max(0, Math.floor((rows - boxHeight) / 2));

  return { rows: panelRows, top, left };
}
