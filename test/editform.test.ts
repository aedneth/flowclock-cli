import { describe, it, expect } from "vitest";
import {
  EDIT_FORM_FIELDS,
  emptyEditFormState,
  openEditFormState,
  editFormApplyKey,
  renderEditForm,
} from "../src/tui/editform.js";
import type { EditFormState, EditFormValues } from "../src/tui/editform.js";
import { displayWidth } from "../src/lib/tui/draw.js";
import type { Key } from "../src/lib/tui/input.js";

// ---------------------------------------------------------------------------
// Key construction helper (mirrors sessionform.test.ts)
// ---------------------------------------------------------------------------

const ch = (c: string): Key => ({ name: "char", char: c });

function typeInto(state: EditFormState, text: string): EditFormState {
  let s = state;
  for (const c of text) s = editFormApplyKey(s, ch(c)).state;
  return s;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const SAMPLE_VALUES: EditFormValues = {
  goal: "Deep work",
  label: "Morning sprint",
  focus: "1h30m",
  break: "20m",
};

const SAMPLE_START_ISO = "2026-06-12T03:00:00.000Z";

function openSample(): EditFormState {
  return openEditFormState({
    sessionId: "sess-42",
    startISO: SAMPLE_START_ISO,
    values: { ...SAMPLE_VALUES },
  });
}

// ---------------------------------------------------------------------------
// State helpers
// ---------------------------------------------------------------------------

describe("emptyEditFormState", () => {
  it("is closed with null ids and blank fields", () => {
    const s = emptyEditFormState();
    expect(s.open).toBe(false);
    expect(s.sessionId).toBeNull();
    expect(s.startISO).toBeNull();
    expect(s.active).toBe(0);
    expect(s.error).toBeNull();
    expect(s.values).toEqual({ goal: "", label: "", focus: "", break: "" });
  });
});

describe("openEditFormState", () => {
  it("is open and carries through opts", () => {
    const s = openSample();
    expect(s.open).toBe(true);
    expect(s.sessionId).toBe("sess-42");
    expect(s.startISO).toBe(SAMPLE_START_ISO);
    expect(s.values).toEqual(SAMPLE_VALUES);
    expect(s.active).toBe(0);
    expect(s.error).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Reducer — purity + editing
// ---------------------------------------------------------------------------

describe("editFormApplyKey", () => {
  it("never mutates the input state", () => {
    const s = openSample();
    const frozen = JSON.stringify(s);
    editFormApplyKey(s, ch("x"));
    expect(JSON.stringify(s)).toBe(frozen);
  });

  it("types printable chars into the active field", () => {
    const s = openEditFormState({
      sessionId: "s1",
      startISO: SAMPLE_START_ISO,
      values: { goal: "", label: "", focus: "", break: "" },
    });
    const next = typeInto(s, "Sprint");
    expect(next.values.goal).toBe("Sprint");
  });

  it("appends chars onto existing value in the active field", () => {
    const s = openSample(); // goal starts as "Deep work"
    const next = typeInto(s, "!");
    expect(next.values.goal).toBe("Deep work!");
  });

  it("backspace deletes the last char of the active field", () => {
    let s = openSample();
    s = editFormApplyKey(s, { name: "backspace" }).state;
    // "Deep work" → "Deep wor"
    expect(s.values.goal).toBe("Deep wor");
  });

  it("backspace on empty field does not crash", () => {
    const s = openEditFormState({
      sessionId: "s1",
      startISO: SAMPLE_START_ISO,
      values: { goal: "", label: "", focus: "", break: "" },
    });
    const next = editFormApplyKey(s, { name: "backspace" }).state;
    expect(next.values.goal).toBe("");
  });

  it("tab / down advance the active field and wrap", () => {
    let s = openSample();
    for (let i = 0; i < EDIT_FORM_FIELDS.length; i++) {
      expect(s.active).toBe(i);
      s = editFormApplyKey(s, { name: "tab" }).state;
    }
    expect(s.active).toBe(0); // wrapped
  });

  it("down also advances the active field", () => {
    const s = openSample();
    const next = editFormApplyKey(s, { name: "down" }).state;
    expect(next.active).toBe(1);
  });

  it("up moves backwards and wraps to the last field", () => {
    const s = editFormApplyKey(openSample(), { name: "up" }).state;
    expect(s.active).toBe(EDIT_FORM_FIELDS.length - 1);
  });

  it("routes typing to whichever field is active", () => {
    let s = openEditFormState({
      sessionId: "s2",
      startISO: SAMPLE_START_ISO,
      values: { goal: "", label: "", focus: "", break: "" },
    });
    s = typeInto(s, "obj");                               // goal
    s = editFormApplyKey(s, { name: "tab" }).state;        // → label
    s = typeInto(s, "name");
    s = editFormApplyKey(s, { name: "tab" }).state;        // → focus
    s = typeInto(s, "1h");
    s = editFormApplyKey(s, { name: "tab" }).state;        // → break
    s = typeInto(s, "5m");
    expect(s.values).toMatchObject({ goal: "obj", label: "name", focus: "1h", break: "5m" });
  });

  it("ignores Ctrl-C as a printable char (no append)", () => {
    const s = editFormApplyKey(openSample(), ch("\x03"));
    expect(s.state.values.goal).toBe(SAMPLE_VALUES.goal); // unchanged
  });

  it("escape returns a cancel action and an empty closed state", () => {
    const r = editFormApplyKey(openSample(), { name: "escape" });
    expect(r.action).toEqual({ type: "cancel" });
    expect(r.state.open).toBe(false);
    expect(r.state.sessionId).toBeNull();
    expect(r.state.startISO).toBeNull();
  });

  it("enter returns a submit action carrying sessionId and values", () => {
    const r = editFormApplyKey(openSample(), { name: "enter" });
    expect(r.action?.type).toBe("submit");
    if (r.action?.type === "submit") {
      expect(r.action.sessionId).toBe("sess-42");
      expect(r.action.values).toEqual(SAMPLE_VALUES);
    }
  });

  it("submit with null sessionId coerces to empty string", () => {
    // openEditFormState always sets sessionId, but test internal path
    const state: EditFormState = {
      ...emptyEditFormState(),
      open: true,
      sessionId: null,
      values: { goal: "", label: "", focus: "", break: "" },
    };
    const r = editFormApplyKey(state, { name: "enter" });
    if (r.action?.type === "submit") {
      expect(r.action.sessionId).toBe("");
    }
  });

  it("unknown keys leave state unchanged", () => {
    const s = openSample();
    const next = editFormApplyKey(s, { name: "home" }).state;
    expect(next).toEqual(s);
  });
});

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

describe("renderEditForm", () => {
  it("returns an overlay with rows, top, left", () => {
    const o = renderEditForm(openSample(), 80, 24, "neon", false);
    expect(Array.isArray(o.rows)).toBe(true);
    expect(o.top).toBeGreaterThanOrEqual(0);
    expect(o.left).toBeGreaterThanOrEqual(0);
  });

  it("contains the 'Edit session' title", () => {
    const joined = renderEditForm(openSample(), 80, 24, "neon", false).rows.join("\n");
    expect(joined).toContain("Edit session");
  });

  it("contains a read-only Start line", () => {
    const joined = renderEditForm(openSample(), 80, 24, "neon", false).rows.join("\n");
    expect(joined).toContain("Start");
    // The locale string from the fixed ISO should appear somewhere
    const expected = new Date(SAMPLE_START_ISO).toLocaleString();
    expect(joined).toContain(expected);
  });

  it("contains an End → preview line", () => {
    const joined = renderEditForm(openSample(), 80, 24, "neon", false).rows.join("\n");
    expect(joined).toContain("End →");
  });

  it("End → line reflects start + focus + break durations", () => {
    // start: 2026-06-12T03:00:00Z, focus: 1h30m (5400s), break: 20m (1200s) → +6600s
    const joined = renderEditForm(openSample(), 80, 24, "neon", false).rows.join("\n");
    const endMs = new Date(SAMPLE_START_ISO).getTime() + (5400 + 1200) * 1000;
    const expectedEnd = new Date(endMs).toLocaleString();
    expect(joined).toContain(expectedEnd);
  });

  it("End → shows — when focus value is invalid (bad parse)", () => {
    const s = openEditFormState({
      sessionId: "s3",
      startISO: SAMPLE_START_ISO,
      values: { goal: "", label: "", focus: "xyz", break: "" },
    });
    // The End preview line should contain a dash because "xyz" cannot be parsed
    const lines = renderEditForm(s, 80, 24, "neon", false).rows;
    const endLine = lines.find((r) => r.includes("End →"));
    expect(endLine).toBeDefined();
    expect(endLine).toContain("—");
  });

  it("Start shows — when startISO is null", () => {
    const s: EditFormState = { ...emptyEditFormState(), open: true };
    // The Start line should appear with a dash
    const lines = renderEditForm(s, 80, 24, "neon", false).rows;
    const startLine = lines.find((r) => r.includes("Start"));
    expect(startLine).toBeDefined();
    expect(startLine).toContain("—");
  });

  it("shows field labels Goal, Name, Focus, Break", () => {
    const joined = renderEditForm(openSample(), 80, 24, "neon", false).rows.join("\n");
    expect(joined).toContain("Goal");
    expect(joined).toContain("Name");
    expect(joined).toContain("Focus");
    expect(joined).toContain("Break");
  });

  it("shows the footer with [Tab] and [Enter] save and [Esc]", () => {
    const joined = renderEditForm(openSample(), 80, 24, "neon", false).rows.join("\n");
    expect(joined).toContain("[Tab] next");
    expect(joined).toContain("[Enter] save");
    expect(joined).toContain("[Esc] cancel");
  });

  it("renders the typed / pre-populated value in the field", () => {
    const joined = renderEditForm(openSample(), 80, 24, "neon", false).rows.join("\n");
    expect(joined).toContain("Deep work");
    expect(joined).toContain("1h30m");
  });

  it("surfaces an error line when state.error is set", () => {
    const s: EditFormState = { ...openSample(), error: "invalid duration" };
    const joined = renderEditForm(s, 80, 24, "neon", false).rows.join("\n");
    expect(joined).toContain("invalid duration");
  });

  it("no overlay row exceeds the box width", () => {
    const o = renderEditForm(openSample(), 80, 24, "neon", false);
    const w = displayWidth(o.rows[0]!);
    for (const row of o.rows) {
      expect(displayWidth(row)).toBe(w);
    }
  });

  it("color mode does not throw and stays within width", () => {
    const o = renderEditForm(openSample(), 80, 24, "neon", true);
    const w = displayWidth(o.rows[0]!);
    for (const row of o.rows) {
      expect(displayWidth(row)).toBeLessThanOrEqual(w);
    }
  });

  it("works at narrow terminal width (34 cols minimum)", () => {
    const o = renderEditForm(openSample(), 34, 24, "neon", false);
    expect(o.rows.length).toBeGreaterThan(0);
  });

  it("active field has the cursor bar ▏", () => {
    const joined = renderEditForm(openSample(), 80, 24, "neon", false).rows.join("\n");
    expect(joined).toContain("▏");
  });
});
