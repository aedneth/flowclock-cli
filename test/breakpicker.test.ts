import { describe, it, expect } from "vitest";
import {
  emptyBreakPickerState,
  openBreakPickerState,
  breakPickerApplyKey,
  renderBreakPicker,
} from "../src/tui/breakpicker.js";
import { ALL_BREAK_CATEGORIES } from "../src/schemas/session.js";
import type { Key } from "../src/lib/tui/input.js";

const N = ALL_BREAK_CATEGORIES.length;

describe("breakpicker state", () => {
  it("emptyBreakPickerState is closed at index 0", () => {
    expect(emptyBreakPickerState()).toEqual({ open: false, index: 0 });
  });

  it("openBreakPickerState seeds index at the current category", () => {
    const s = openBreakPickerState("coffee");
    expect(s.open).toBe(true);
    expect(s.index).toBe(ALL_BREAK_CATEGORIES.indexOf("coffee"));
    expect(ALL_BREAK_CATEGORIES[s.index]).toBe("coffee");
  });

  it("openBreakPickerState falls back to 0 for undefined/unknown", () => {
    expect(openBreakPickerState().index).toBe(0);
    expect(openBreakPickerState(undefined).index).toBe(0);
  });
});

describe("breakpicker reducer", () => {
  const up: Key = { name: "up" };
  const down: Key = { name: "down" };
  const enter: Key = { name: "enter" };
  const escape: Key = { name: "escape" };

  it("down wraps from last to first", () => {
    const s = { open: true, index: N - 1 };
    const r = breakPickerApplyKey(s, down);
    expect(r.state.index).toBe(0);
    expect(r.action).toBeUndefined();
  });

  it("up wraps from first to last", () => {
    const s = { open: true, index: 0 };
    const r = breakPickerApplyKey(s, up);
    expect(r.state.index).toBe(N - 1);
  });

  it("j mirrors down, k mirrors up", () => {
    const s = { open: true, index: 2 };
    const jKey: Key = { name: "char", char: "j" };
    const kKey: Key = { name: "char", char: "k" };
    expect(breakPickerApplyKey(s, jKey).state.index).toBe(3);
    expect(breakPickerApplyKey(s, kKey).state.index).toBe(1);
  });

  it("does not mutate the input state", () => {
    const s = { open: true, index: 2 };
    breakPickerApplyKey(s, down);
    expect(s).toEqual({ open: true, index: 2 });
  });

  it("enter picks the indexed category and closes", () => {
    const s = { open: true, index: 3 };
    const r = breakPickerApplyKey(s, enter);
    expect(r.action).toEqual({ type: "pick", category: ALL_BREAK_CATEGORIES[3] });
    expect(r.state).toEqual(emptyBreakPickerState());
  });

  it("escape cancels and closes", () => {
    const s = { open: true, index: 3 };
    const r = breakPickerApplyKey(s, escape);
    expect(r.action).toEqual({ type: "cancel" });
    expect(r.state).toEqual(emptyBreakPickerState());
  });

  it("digit picks the right (1-based) category and closes", () => {
    const s = { open: true, index: 0 };
    const r = breakPickerApplyKey(s, { name: "char", char: "7" });
    expect(r.action).toEqual({ type: "pick", category: ALL_BREAK_CATEGORIES[6] });
    expect(r.state).toEqual(emptyBreakPickerState());
  });

  it("out-of-range digit is a no-op", () => {
    const s = { open: true, index: 1 };
    const r = breakPickerApplyKey(s, { name: "char", char: "9" });
    expect(r.action).toBeUndefined();
    expect(r.state).toBe(s);
  });

  it("unrelated key leaves state unchanged with no action", () => {
    const s = { open: true, index: 1 };
    const r = breakPickerApplyKey(s, { name: "char", char: "x" });
    expect(r.action).toBeUndefined();
    expect(r.state).toEqual(s);
  });
});

describe("breakpicker render", () => {
  it("renders a panel containing the title and coffee/sleep", () => {
    const o = renderBreakPicker(openBreakPickerState("rest"), 80, 24, "neon", false);
    const joined = o.rows.join("\n");
    expect(joined).toContain("Break category");
    expect(joined).toContain("coffee");
    expect(joined).toContain("sleep");
    expect(typeof o.top).toBe("number");
    expect(typeof o.left).toBe("number");
  });

  it("is pure — calling twice gives equal output", () => {
    const s = openBreakPickerState("meal");
    const a = renderBreakPicker(s, 80, 24, "neon", true);
    const b = renderBreakPicker(s, 80, 24, "neon", true);
    expect(a).toEqual(b);
  });
});
