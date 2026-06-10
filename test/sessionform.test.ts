import { describe, it, expect } from "vitest";
import {
  SESSION_FORM_FIELDS,
  emptySessionFormState,
  openSessionFormState,
  sessionFormApplyKey,
  renderSessionForm,
} from "../src/tui/sessionform.js";
import type { SessionFormState } from "../src/tui/sessionform.js";
import { displayWidth } from "../src/lib/tui/draw.js";
import type { Key } from "../src/lib/tui/input.js";

const ch = (c: string): Key => ({ name: "char", char: c });

function type(state: SessionFormState, text: string): SessionFormState {
  let s = state;
  for (const c of text) s = sessionFormApplyKey(s, ch(c)).state;
  return s;
}

// ---------------------------------------------------------------------------
// State helpers
// ---------------------------------------------------------------------------

describe("session form state", () => {
  it("emptySessionFormState is closed with blank fields", () => {
    const s = emptySessionFormState();
    expect(s.open).toBe(false);
    expect(s.active).toBe(0);
    expect(s.error).toBeNull();
    expect(s.values).toEqual({ goal: "", label: "", target: "", break: "" });
  });

  it("openSessionFormState is open and blank", () => {
    const s = openSessionFormState();
    expect(s.open).toBe(true);
    expect(s.values.goal).toBe("");
  });
});

// ---------------------------------------------------------------------------
// Reducer — purity + editing
// ---------------------------------------------------------------------------

describe("sessionFormApplyKey", () => {
  it("never mutates the input state", () => {
    const s = openSessionFormState();
    const frozen = JSON.stringify(s);
    sessionFormApplyKey(s, ch("x"));
    expect(JSON.stringify(s)).toBe(frozen);
  });

  it("types printable chars into the active field", () => {
    const s = type(openSessionFormState(), "Deep work");
    expect(s.values.goal).toBe("Deep work");
  });

  it("backspace deletes the last char of the active field", () => {
    let s = type(openSessionFormState(), "abc");
    s = sessionFormApplyKey(s, { name: "backspace" }).state;
    expect(s.values.goal).toBe("ab");
  });

  it("tab / down advance the active field and wrap", () => {
    let s = openSessionFormState();
    for (let i = 0; i < SESSION_FORM_FIELDS.length; i++) {
      expect(s.active).toBe(i);
      s = sessionFormApplyKey(s, { name: "tab" }).state;
    }
    expect(s.active).toBe(0); // wrapped
  });

  it("up moves backwards and wraps to the last field", () => {
    const s = sessionFormApplyKey(openSessionFormState(), { name: "up" }).state;
    expect(s.active).toBe(SESSION_FORM_FIELDS.length - 1);
  });

  it("routes typing to whichever field is active", () => {
    let s = openSessionFormState();
    s = type(s, "obj");                                  // goal
    s = sessionFormApplyKey(s, { name: "tab" }).state;   // → label
    s = type(s, "name");
    s = sessionFormApplyKey(s, { name: "tab" }).state;   // → target
    s = type(s, "1h");
    expect(s.values).toMatchObject({ goal: "obj", label: "name", target: "1h" });
  });

  it("ignores Ctrl-C as a printable char (no append)", () => {
    const s = sessionFormApplyKey(openSessionFormState(), ch("\x03"));
    expect(s.state.values.goal).toBe("");
  });

  it("escape returns a cancel action and a closed state", () => {
    const r = sessionFormApplyKey(openSessionFormState(), { name: "escape" });
    expect(r.action).toEqual({ type: "cancel" });
    expect(r.state.open).toBe(false);
  });

  it("enter returns a submit action carrying the values", () => {
    const s = type(openSessionFormState(), "Ship v3");
    const r = sessionFormApplyKey(s, { name: "enter" });
    expect(r.action?.type).toBe("submit");
    if (r.action?.type === "submit") {
      expect(r.action.values.goal).toBe("Ship v3");
    }
  });
});

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

describe("renderSessionForm", () => {
  it("returns an overlay with rows, top, left", () => {
    const o = renderSessionForm(openSessionFormState(), 80, 24, "neon", false);
    expect(Array.isArray(o.rows)).toBe(true);
    expect(o.top).toBeGreaterThanOrEqual(0);
    expect(o.left).toBeGreaterThanOrEqual(0);
  });

  it("shows the field labels and the title", () => {
    const joined = renderSessionForm(openSessionFormState(), 80, 24, "neon", false).rows.join("\n");
    expect(joined).toContain("New session");
    expect(joined).toContain("Goal");
    expect(joined).toContain("Break budget");
    expect(joined).toContain("[Enter] start");
  });

  it("renders the typed value", () => {
    const s = type(openSessionFormState(), "Deep work");
    const joined = renderSessionForm(s, 80, 24, "neon", false).rows.join("\n");
    expect(joined).toContain("Deep work");
  });

  it("surfaces an error line when present", () => {
    const s: SessionFormState = { ...openSessionFormState(), error: "invalid duration" };
    const joined = renderSessionForm(s, 80, 24, "neon", false).rows.join("\n");
    expect(joined).toContain("invalid duration");
  });

  it("no overlay row exceeds the box width", () => {
    const o = renderSessionForm(openSessionFormState(), 80, 24, "neon", false);
    const w = displayWidth(o.rows[0]!);
    for (const row of o.rows) {
      expect(displayWidth(row)).toBe(w);
    }
  });

  it("color mode does not throw and stays within width", () => {
    const o = renderSessionForm(openSessionFormState(), 80, 24, "neon", true);
    const w = displayWidth(o.rows[0]!);
    for (const row of o.rows) {
      expect(displayWidth(row)).toBeLessThanOrEqual(w);
    }
  });
});
