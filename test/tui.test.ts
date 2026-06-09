import { describe, it, expect } from "vitest";

import {
  diffFrames,
  cursorTo,
  ERASE_EOL,
  ENTER_ALT_SCREEN,
  EXIT_ALT_SCREEN,
  CLEAR_SCREEN,
  Screen,
} from "../src/lib/tui/screen.js";

import {
  displayWidth,
  truncate,
  padTo,
  panel,
  barH,
  sparkline,
  kv,
  gauge,
} from "../src/lib/tui/draw.js";

import { splitV, splitH } from "../src/lib/tui/layout.js";
import type { Rect } from "../src/lib/tui/layout.js";

import { parseKey } from "../src/lib/tui/input.js";

// ---------------------------------------------------------------------------
// screen.ts — diffFrames
// ---------------------------------------------------------------------------

describe("diffFrames", () => {
  it("returns empty string for identical frames", () => {
    const frame = ["hello", "world"];
    expect(diffFrames(frame, frame)).toBe("");
  });

  it("returns empty string for two empty frames", () => {
    expect(diffFrames([], [])).toBe("");
  });

  it("emits update only for changed rows", () => {
    const prev = ["row0", "row1", "row2"];
    const next = ["row0", "CHANGED", "row2"];
    const diff = diffFrames(prev, next);
    // Only row 1 changed (1-based index 2)
    expect(diff).toBe(cursorTo(2, 1) + ERASE_EOL + "CHANGED");
    // Must NOT contain row0 or row2 content (unchanged)
    expect(diff).not.toContain("row0");
    expect(diff).not.toContain("row2");
  });

  it("emits updates for all changed rows", () => {
    const prev = ["a", "b", "c"];
    const next = ["A", "b", "C"];
    const diff = diffFrames(prev, next);
    expect(diff).toContain(cursorTo(1, 1) + ERASE_EOL + "A");
    expect(diff).toContain(cursorTo(3, 1) + ERASE_EOL + "C");
    expect(diff).not.toContain(cursorTo(2, 1));
  });

  it("handles next frame longer than prev (new rows treated as change from empty)", () => {
    const prev = ["row0"];
    const next = ["row0", "new-row"];
    const diff = diffFrames(prev, next);
    // row0 unchanged; new-row is a change from "" → "new-row"
    expect(diff).toBe(cursorTo(2, 1) + ERASE_EOL + "new-row");
  });

  it("handles next frame shorter than prev (removed rows are change to empty)", () => {
    const prev = ["row0", "row1"];
    const next = ["row0"];
    const diff = diffFrames(prev, next);
    // row0 unchanged; row1 is a change from "row1" → ""
    expect(diff).toBe(cursorTo(2, 1) + ERASE_EOL + "");
  });

  it("handles both frames empty", () => {
    expect(diffFrames([], [])).toBe("");
  });

  it("emits correct row indices for many rows", () => {
    const prev = Array.from({ length: 10 }, (_, i) => `line${i}`);
    const next = [...prev];
    next[5] = "CHANGED";
    const diff = diffFrames(prev, next);
    expect(diff).toBe(cursorTo(6, 1) + ERASE_EOL + "CHANGED");
  });

  it("each row position in the diff starts at column 1", () => {
    const prev = ["old"];
    const next = ["new"];
    const diff = diffFrames(prev, next);
    expect(diff).toContain(";1H"); // col = 1
  });
});

// ---------------------------------------------------------------------------
// screen.ts — Screen class
// ---------------------------------------------------------------------------

describe("Screen", () => {
  function makeStream() {
    const chunks: string[] = [];
    return {
      written: chunks,
      write(s: string) {
        chunks.push(s);
        return true;
      },
    };
  }

  it("enter() writes alt-screen enter + clear", () => {
    const s = makeStream();
    const screen = new Screen(s as unknown as NodeJS.WritableStream);
    screen.enter();
    expect(s.written.join("")).toContain(ENTER_ALT_SCREEN);
    expect(s.written.join("")).toContain(CLEAR_SCREEN);
  });

  it("render() writes the diff on first render (prev is empty)", () => {
    const s = makeStream();
    const screen = new Screen(s as unknown as NodeJS.WritableStream);
    screen.enter();
    s.written.length = 0; // clear enter output
    screen.render(["hello", "world"]);
    const out = s.written.join("");
    // Both rows differ from empty prev
    expect(out).toContain("hello");
    expect(out).toContain("world");
  });

  it("render() only writes changed rows on subsequent calls", () => {
    const s = makeStream();
    const screen = new Screen(s as unknown as NodeJS.WritableStream);
    screen.enter();
    screen.render(["row0", "row1"]);
    s.written.length = 0;
    screen.render(["row0", "CHANGED"]);
    const out = s.written.join("");
    expect(out).not.toContain("row0");
    expect(out).toContain("CHANGED");
  });

  it("render() writes nothing when frame is identical", () => {
    const s = makeStream();
    const screen = new Screen(s as unknown as NodeJS.WritableStream);
    screen.enter();
    screen.render(["same"]);
    s.written.length = 0;
    screen.render(["same"]);
    expect(s.written.join("")).toBe("");
  });

  it("exit() writes the exit alt-screen sequence", () => {
    const s = makeStream();
    const screen = new Screen(s as unknown as NodeJS.WritableStream);
    screen.exit();
    expect(s.written.join("")).toContain(EXIT_ALT_SCREEN);
  });

  it("enter() resets prev frame so next render re-draws all rows", () => {
    const s = makeStream();
    const screen = new Screen(s as unknown as NodeJS.WritableStream);
    screen.enter();
    screen.render(["hello"]);
    screen.enter(); // reset
    s.written.length = 0;
    screen.render(["hello"]); // same content but prev is empty after re-enter
    const out = s.written.join("");
    expect(out).toContain("hello");
  });
});

// ---------------------------------------------------------------------------
// draw.ts — displayWidth
// ---------------------------------------------------------------------------

describe("displayWidth", () => {
  it("returns 0 for empty string", () => {
    expect(displayWidth("")).toBe(0);
  });

  it("counts plain ASCII characters", () => {
    expect(displayWidth("hello")).toBe(5);
  });

  it("ignores ANSI SGR escape sequences", () => {
    expect(displayWidth("\x1b[32mhello\x1b[0m")).toBe(5);
  });

  it("ignores complex ANSI sequences (256-color)", () => {
    expect(displayWidth("\x1b[38;5;46mgreen\x1b[0m")).toBe(5);
  });

  it("counts box-drawing chars as width 1", () => {
    expect(displayWidth("┌─┐")).toBe(3);
  });

  it("counts block char █ as width 1", () => {
    expect(displayWidth("███")).toBe(3);
  });

  it("counts sparkline chars as width 1", () => {
    expect(displayWidth("▁▂▃▄▅▆▇█")).toBe(8);
  });
});

// ---------------------------------------------------------------------------
// draw.ts — truncate
// ---------------------------------------------------------------------------

describe("truncate", () => {
  it("returns the string unchanged when it fits", () => {
    expect(truncate("hello", 10)).toBe("hello");
  });

  it("returns empty string for width 0", () => {
    expect(truncate("hello", 0)).toBe("");
  });

  it("truncates plain ASCII to exact width", () => {
    expect(truncate("hello world", 5)).toBe("hello");
  });

  it("truncates ANSI-colored string to visible width", () => {
    const colored = "\x1b[32mhello world\x1b[0m";
    const result = truncate(colored, 5);
    // Visible content should be exactly 5 chars
    expect(displayWidth(result)).toBe(5);
  });

  it("keeps escape sequences for the visible portion", () => {
    const colored = "\x1b[32mhello\x1b[0m world";
    const result = truncate(colored, 3);
    // Should contain color codes since the color started before the cut
    expect(result).toContain("\x1b[32m");
    expect(displayWidth(result)).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// draw.ts — padTo
// ---------------------------------------------------------------------------

describe("padTo", () => {
  it("pads left (default) with spaces on the right", () => {
    expect(padTo("hi", 5)).toBe("hi   ");
  });

  it("pads right with spaces on the left", () => {
    expect(padTo("hi", 5, "right")).toBe("   hi");
  });

  it("centers with even padding split (extra space on right)", () => {
    expect(padTo("hi", 6, "center")).toBe("  hi  ");
  });

  it("centers with odd padding — extra space goes right", () => {
    // total pad = 3: left=1, right=2
    expect(padTo("hi", 5, "center")).toBe(" hi  ");
  });

  it("returns unchanged string when already exact width", () => {
    expect(padTo("hello", 5)).toBe("hello");
  });

  it("truncates when string is wider than width", () => {
    expect(padTo("hello world", 5)).toBe("hello");
  });

  it("handles ANSI-colored string width correctly", () => {
    const colored = "\x1b[32mhi\x1b[0m";
    const result = padTo(colored, 5);
    // Visible width should be 5, with 3 padding spaces on right
    expect(displayWidth(result)).toBe(5);
    // Original colored part should still be there
    expect(result).toContain("\x1b[32m");
  });
});

// ---------------------------------------------------------------------------
// draw.ts — panel
// ---------------------------------------------------------------------------

describe("panel", () => {
  it("returns exactly `height` rows", () => {
    const rows = panel({ width: 20, height: 5, body: [] });
    expect(rows).toHaveLength(5);
  });

  it("each row has display width equal to `width`", () => {
    const rows = panel({ width: 20, height: 5, body: [] });
    for (const row of rows) {
      expect(displayWidth(row)).toBe(20);
    }
  });

  it("first row starts with top-left corner", () => {
    const rows = panel({ width: 20, height: 5, body: [] });
    expect(stripAnsi(rows[0] ?? "")).toMatch(/^┌/);
  });

  it("first row ends with top-right corner", () => {
    const rows = panel({ width: 20, height: 5, body: [] });
    expect(stripAnsi(rows[0] ?? "")).toMatch(/┐$/);
  });

  it("last row starts with bottom-left corner", () => {
    const rows = panel({ width: 20, height: 5, body: [] });
    expect(stripAnsi(rows[rows.length - 1] ?? "")).toMatch(/^└/);
  });

  it("last row ends with bottom-right corner", () => {
    const rows = panel({ width: 20, height: 5, body: [] });
    expect(stripAnsi(rows[rows.length - 1] ?? "")).toMatch(/┘$/);
  });

  it("middle rows start and end with vertical border", () => {
    const rows = panel({ width: 20, height: 5, body: ["line1", "line2", "line3"] });
    for (let i = 1; i < rows.length - 1; i++) {
      const raw = stripAnsi(rows[i] ?? "");
      expect(raw).toMatch(/^│/);
      expect(raw).toMatch(/│$/);
    }
  });

  it("includes title in top border", () => {
    const rows = panel({ width: 30, height: 5, body: [], title: "My Panel" });
    expect(stripAnsi(rows[0] ?? "")).toContain("My Panel");
  });

  it("truncates long body lines to inner width", () => {
    const longLine = "a".repeat(100);
    const rows = panel({ width: 10, height: 3, body: [longLine] });
    // inner width = 8
    for (const row of rows) {
      expect(displayWidth(row)).toBe(10);
    }
  });

  it("pads short body lines to inner width", () => {
    const rows = panel({ width: 10, height: 3, body: ["hi"] });
    // Each body row should have display width = 10
    for (const row of rows) {
      expect(displayWidth(row)).toBe(10);
    }
  });

  it("handles height=1 gracefully (no body, no bottom border)", () => {
    const rows = panel({ width: 10, height: 1, body: [] });
    expect(rows).toHaveLength(1);
    expect(displayWidth(rows[0] ?? "")).toBe(10);
  });

  it("handles height=2 (top + bottom border, no body rows)", () => {
    const rows = panel({ width: 10, height: 2, body: [] });
    expect(rows).toHaveLength(2);
    expect(stripAnsi(rows[0] ?? "")).toMatch(/^┌/);
    expect(stripAnsi(rows[1] ?? "")).toMatch(/^└/);
  });
});

// ---------------------------------------------------------------------------
// draw.ts — barH
// ---------------------------------------------------------------------------

describe("barH", () => {
  it("returns full bar when value equals max", () => {
    expect(barH(10, 10, 10)).toBe("█".repeat(10));
  });

  it("returns empty bar when value is 0", () => {
    expect(barH(0, 10, 10)).toBe("░".repeat(10));
  });

  it("returns half bar for 50%", () => {
    const result = barH(5, 10, 10);
    expect(result).toBe("█████░░░░░");
  });

  it("returns string of exact `width` chars", () => {
    const result = barH(3, 7, 15);
    expect(displayWidth(result)).toBe(15);
  });

  it("clamps value above max to full bar", () => {
    expect(barH(20, 10, 5)).toBe("█".repeat(5));
  });

  it("clamps negative value to empty bar", () => {
    expect(barH(-5, 10, 5)).toBe("░".repeat(5));
  });

  it("returns empty string for width 0", () => {
    expect(barH(5, 10, 0)).toBe("");
  });

  it("uses custom filled/empty chars", () => {
    const result = barH(5, 10, 10, { filled: "#", empty: "." });
    expect(result).toBe("#####.....");
  });
});

// ---------------------------------------------------------------------------
// draw.ts — sparkline
// ---------------------------------------------------------------------------

describe("sparkline", () => {
  it("returns empty string for empty input", () => {
    expect(sparkline([])).toBe("");
  });

  it("returns all mid chars for all-same values", () => {
    const result = sparkline([5, 5, 5, 5]);
    expect(result).toBe("▄▄▄▄");
  });

  it("maps min to ▁ and max to █", () => {
    const result = sparkline([0, 100]);
    expect(result[0]).toBe("▁");
    expect(result[1]).toBe("█");
  });

  it("returns correct length", () => {
    const values = [1, 2, 3, 4, 5, 6, 7, 8];
    expect(sparkline(values)).toHaveLength(8);
  });

  it("uses block chars from the sparkline set", () => {
    const chars = new Set(["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█"]);
    const result = sparkline([0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
    for (const ch of result) {
      expect(chars.has(ch)).toBe(true);
    }
  });

  it("single value returns mid char", () => {
    expect(sparkline([42])).toBe("▄");
  });
});

// ---------------------------------------------------------------------------
// draw.ts — kv
// ---------------------------------------------------------------------------

describe("kv", () => {
  it("pads to exact width", () => {
    const result = kv("Score", "42", 20);
    expect(displayWidth(result)).toBe(20);
  });

  it("key is on the left, value on the right", () => {
    const result = kv("Score", "42", 20);
    expect(result.startsWith("Score")).toBe(true);
    expect(result.endsWith("42")).toBe(true);
  });

  it("returns string of correct width when key is short", () => {
    const result = kv("A", "B", 10);
    expect(displayWidth(result)).toBe(10);
  });

  it("returns empty string for width 0", () => {
    expect(kv("key", "val", 0)).toBe("");
  });
});

// ---------------------------------------------------------------------------
// draw.ts — gauge
// ---------------------------------------------------------------------------

describe("gauge", () => {
  it("returns string of exact `width` chars", () => {
    const result = gauge(50, 20);
    expect(displayWidth(result)).toBe(20);
  });

  it("starts with [ and ends with ]", () => {
    const result = gauge(75, 15);
    expect(result[0]).toBe("[");
    expect(result[result.length - 1]).toBe("]");
  });

  it("contains percentage label", () => {
    expect(gauge(42, 20)).toContain("42%");
  });

  it("clamps to 0 minimum", () => {
    const result = gauge(-10, 20);
    expect(result).toContain("0%");
  });

  it("clamps to 100 maximum", () => {
    const result = gauge(150, 20);
    expect(result).toContain("100%");
  });

  it("returns empty string for width 0", () => {
    expect(gauge(50, 0)).toBe("");
  });

  it("full gauge at 100%", () => {
    const result = gauge(100, 20);
    expect(result).toContain("100%");
    // Should have filled chars
    expect(result).toContain("█");
  });

  it("empty gauge at 0%", () => {
    const result = gauge(0, 20);
    expect(result).toContain("0%");
  });
});

// ---------------------------------------------------------------------------
// layout.ts — splitV
// ---------------------------------------------------------------------------

describe("splitV", () => {
  const root: Rect = { top: 0, left: 0, width: 80, height: 24 };

  it("returns empty array for empty specs", () => {
    expect(splitV(root, [])).toEqual([]);
  });

  it("single fixed child fills the rect height", () => {
    const [child] = splitV(root, [24]);
    expect(child?.height).toBe(24);
    expect(child?.top).toBe(0);
    expect(child?.left).toBe(0);
    expect(child?.width).toBe(80);
  });

  it("two fixed children stack vertically", () => {
    const [top, bottom] = splitV(root, [10, 14]);
    expect(top?.top).toBe(0);
    expect(top?.height).toBe(10);
    expect(bottom?.top).toBe(10);
    expect(bottom?.height).toBe(14);
  });

  it("flex children share remaining space proportionally", () => {
    const [a, b] = splitV(root, [{ flex: 1 }, { flex: 1 }]);
    expect(a?.height).toBe(12);
    expect(b?.height).toBe(12);
  });

  it("flex children with 2:1 ratio", () => {
    const [a, b] = splitV(root, [{ flex: 2 }, { flex: 1 }]);
    expect((a?.height ?? 0) + (b?.height ?? 0)).toBe(24);
    expect(a?.height).toBe(16);
    expect(b?.height).toBe(8);
  });

  it("mixed fixed + flex: fixed reserves space, flex gets rest", () => {
    const [fixed, flex] = splitV(root, [4, { flex: 1 }]);
    expect(fixed?.height).toBe(4);
    expect(flex?.height).toBe(20);
  });

  it("children tile exactly (sum of heights = parent height, no gap)", () => {
    const rects = splitV(root, [{ flex: 1 }, { flex: 2 }, { flex: 1 }]);
    const total = rects.reduce((s, r) => s + r.height, 0);
    expect(total).toBe(root.height);
  });

  it("children tile exactly with gap (sum + gaps = parent height)", () => {
    const rects = splitV(root, [{ flex: 1 }, { flex: 1 }], 2);
    const total = rects.reduce((s, r) => s + r.height, 0);
    expect(total).toBe(root.height - 2); // 2 = 1 gap of 2 rows
  });

  it("preserves parent left and width", () => {
    const rects = splitV(root, [10, { flex: 1 }]);
    for (const r of rects) {
      expect(r.left).toBe(root.left);
      expect(r.width).toBe(root.width);
    }
  });

  it("top positions are contiguous", () => {
    const rects = splitV(root, [5, 10, 9]);
    expect(rects[0]?.top).toBe(0);
    expect(rects[1]?.top).toBe(5);
    expect(rects[2]?.top).toBe(15);
  });

  it("top positions include gap", () => {
    const rects = splitV(root, [5, 5], 4);
    expect(rects[0]?.top).toBe(0);
    expect(rects[1]?.top).toBe(9); // 5 + 4
  });
});

// ---------------------------------------------------------------------------
// layout.ts — splitH
// ---------------------------------------------------------------------------

describe("splitH", () => {
  const root: Rect = { top: 0, left: 0, width: 80, height: 24 };

  it("returns empty array for empty specs", () => {
    expect(splitH(root, [])).toEqual([]);
  });

  it("single fixed child fills the rect width", () => {
    const [child] = splitH(root, [80]);
    expect(child?.width).toBe(80);
    expect(child?.left).toBe(0);
    expect(child?.top).toBe(0);
    expect(child?.height).toBe(24);
  });

  it("two fixed children sit side by side", () => {
    const [left, right] = splitH(root, [30, 50]);
    expect(left?.left).toBe(0);
    expect(left?.width).toBe(30);
    expect(right?.left).toBe(30);
    expect(right?.width).toBe(50);
  });

  it("flex children share remaining width proportionally", () => {
    const [a, b] = splitH(root, [{ flex: 1 }, { flex: 1 }]);
    expect(a?.width).toBe(40);
    expect(b?.width).toBe(40);
  });

  it("flex with 3:1 ratio", () => {
    const [a, b] = splitH(root, [{ flex: 3 }, { flex: 1 }]);
    expect((a?.width ?? 0) + (b?.width ?? 0)).toBe(80);
    expect(a?.width).toBe(60);
    expect(b?.width).toBe(20);
  });

  it("mixed fixed + flex", () => {
    const [fixed, flex] = splitH(root, [20, { flex: 1 }]);
    expect(fixed?.width).toBe(20);
    expect(flex?.width).toBe(60);
  });

  it("children tile exactly (sum of widths = parent width)", () => {
    const rects = splitH(root, [{ flex: 1 }, { flex: 2 }, { flex: 1 }]);
    const total = rects.reduce((s, r) => s + r.width, 0);
    expect(total).toBe(root.width);
  });

  it("children tile exactly with gap", () => {
    const rects = splitH(root, [{ flex: 1 }, { flex: 1 }], 2);
    const total = rects.reduce((s, r) => s + r.width, 0);
    expect(total).toBe(root.width - 2);
  });

  it("preserves parent top and height", () => {
    const rects = splitH(root, [20, { flex: 1 }]);
    for (const r of rects) {
      expect(r.top).toBe(root.top);
      expect(r.height).toBe(root.height);
    }
  });

  it("left positions are contiguous", () => {
    const rects = splitH(root, [10, 20, 50]);
    expect(rects[0]?.left).toBe(0);
    expect(rects[1]?.left).toBe(10);
    expect(rects[2]?.left).toBe(30);
  });

  it("left positions include gap", () => {
    const rects = splitH(root, [10, 10], 5);
    expect(rects[0]?.left).toBe(0);
    expect(rects[1]?.left).toBe(15); // 10 + 5
  });
});

// ---------------------------------------------------------------------------
// input.ts — parseKey
// ---------------------------------------------------------------------------

describe("parseKey", () => {
  it("parses up arrow (CSI)", () => {
    expect(parseKey("\x1b[A")).toEqual({ name: "up" });
  });

  it("parses down arrow (CSI)", () => {
    expect(parseKey("\x1b[B")).toEqual({ name: "down" });
  });

  it("parses right arrow (CSI)", () => {
    expect(parseKey("\x1b[C")).toEqual({ name: "right" });
  });

  it("parses left arrow (CSI)", () => {
    expect(parseKey("\x1b[D")).toEqual({ name: "left" });
  });

  it("parses up arrow (SS3 / application mode)", () => {
    expect(parseKey("\x1bOA")).toEqual({ name: "up" });
  });

  it("parses down arrow (SS3)", () => {
    expect(parseKey("\x1bOB")).toEqual({ name: "down" });
  });

  it("parses right arrow (SS3)", () => {
    expect(parseKey("\x1bOC")).toEqual({ name: "right" });
  });

  it("parses left arrow (SS3)", () => {
    expect(parseKey("\x1bOD")).toEqual({ name: "left" });
  });

  it("parses Enter (\\r)", () => {
    expect(parseKey("\r")).toEqual({ name: "enter" });
  });

  it("parses Enter (\\n)", () => {
    expect(parseKey("\n")).toEqual({ name: "enter" });
  });

  it("parses Tab", () => {
    expect(parseKey("\t")).toEqual({ name: "tab" });
  });

  it("parses Escape", () => {
    expect(parseKey("\x1b")).toEqual({ name: "escape" });
  });

  it("parses Backspace (DEL)", () => {
    expect(parseKey("\x7f")).toEqual({ name: "backspace" });
  });

  it("parses Home (CSI H)", () => {
    expect(parseKey("\x1b[H")).toEqual({ name: "home" });
  });

  it("parses End (CSI F)", () => {
    expect(parseKey("\x1b[F")).toEqual({ name: "end" });
  });

  it("parses Home (CSI 1~)", () => {
    expect(parseKey("\x1b[1~")).toEqual({ name: "home" });
  });

  it("parses End (CSI 4~)", () => {
    expect(parseKey("\x1b[4~")).toEqual({ name: "end" });
  });

  it("parses Home (CSI 7~)", () => {
    expect(parseKey("\x1b[7~")).toEqual({ name: "home" });
  });

  it("parses End (CSI 8~)", () => {
    expect(parseKey("\x1b[8~")).toEqual({ name: "end" });
  });

  it("parses Ctrl-C as char with empty string char", () => {
    expect(parseKey("")).toEqual({ name: "char", char: "" });
  });

  it("parses printable ASCII char", () => {
    expect(parseKey("q")).toEqual({ name: "char", char: "q" });
  });

  it("parses space as char", () => {
    expect(parseKey(" ")).toEqual({ name: "char", char: " " });
  });

  it("parses digit as char", () => {
    expect(parseKey("1")).toEqual({ name: "char", char: "1" });
  });

  it("parses uppercase letter as char", () => {
    expect(parseKey("G")).toEqual({ name: "char", char: "G" });
  });

  it("parses slash as char", () => {
    expect(parseKey("/")).toEqual({ name: "char", char: "/" });
  });
});

// ---------------------------------------------------------------------------
// Helpers for this test file
// ---------------------------------------------------------------------------

/** Strip ANSI sequences (used in panel assertions). */
function stripAnsi(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\x1b(?:\[[0-9;]*[A-Za-z]|\][^\x07\x1b]*(?:\x07|\x1b\\))/g, "");
}
