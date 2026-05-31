import { describe, it, expect } from "vitest";
import { Timer, formatHMS } from "../src/lib/timer.js";

/** A controllable clock for deterministic time math. */
function fakeClock(start = 0) {
  let t = start;
  const clock = () => t;
  return {
    clock,
    advance: (ms: number) => (t += ms),
    set: (ms: number) => (t = ms),
  };
}

describe("formatHMS", () => {
  it("zero-pads HH:MM:SS like flowtime.sh", () => {
    expect(formatHMS(0)).toBe("00:00:00");
    expect(formatHMS(9)).toBe("00:00:09");
    expect(formatHMS(61)).toBe("00:01:01");
    expect(formatHMS(3661)).toBe("01:01:01");
    expect(formatHMS(360000)).toBe("100:00:00");
  });
  it("clamps negatives to zero", () => {
    expect(formatHMS(-5)).toBe("00:00:00");
  });
});

describe("Timer count-up", () => {
  it("counts elapsed seconds from start", () => {
    const c = fakeClock(1000);
    const t = new Timer(c.clock);
    c.advance(5000);
    expect(t.elapsedS()).toBe(5);
    expect(t.display()).toBe("00:00:05");
  });

  it("excludes paused time (elapsed = now - start - totalPause)", () => {
    const c = fakeClock(0);
    const t = new Timer(c.clock);
    c.advance(10_000); // 10s active
    t.togglePause();
    c.advance(30_000); // 30s paused — must not count
    expect(t.isPaused).toBe(true);
    expect(t.elapsedS()).toBe(10); // frozen while paused
    t.togglePause();
    c.advance(5_000); // 5s more active
    expect(t.elapsedS()).toBe(15);
  });

  it("reset returns to zero and clears pauses", () => {
    const c = fakeClock(0);
    const t = new Timer(c.clock);
    c.advance(20_000);
    t.togglePause();
    t.togglePause();
    t.reset();
    expect(t.elapsedS()).toBe(0);
    const s = t.toSession({ source: "hud" });
    expect(s.pauses).toHaveLength(0);
  });

  it("builds a session record closing an open pause", () => {
    const c = fakeClock(0);
    const t = new Timer(c.clock);
    c.advance(60_000);
    t.togglePause();
    c.advance(10_000);
    const s = t.toSession({ source: "hud", label: "x" });
    expect(s.durationS).toBe(60);
    expect(s.pauses).toHaveLength(1);
    expect(s.pauses[0]!.durationS).toBe(10);
    expect(s.label).toBe("x");
    expect(s.source).toBe("hud");
  });
});
