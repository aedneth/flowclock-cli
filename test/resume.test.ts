import { describe, it, expect } from "vitest";
import {
  emptyResumeState,
  openResumeState,
  resumeApplyKey,
  renderResume,
  type ResumeInfo,
} from "../src/tui/resume.js";
import { displayWidth } from "../src/lib/tui/draw.js";
import { humanDuration } from "../src/lib/format.js";

const info: ResumeInfo = {
  goal: "Ship the resume overlay",
  label: "deep work",
  focusS: 1500,
  breakS: 300,
  heartbeatISO: "2026-06-15T10:00:00.000Z",
};

const opened = openResumeState(info);

describe("resume state", () => {
  it("emptyResumeState is closed with null info", () => {
    const s = emptyResumeState();
    expect(s.open).toBe(false);
    expect(s.info).toBeNull();
  });

  it("openResumeState carries info and is open", () => {
    expect(opened.open).toBe(true);
    expect(opened.info).toEqual(info);
  });
});

describe("resumeApplyKey", () => {
  it("'r' resumes and closes", () => {
    const r = resumeApplyKey(opened, { name: "char", char: "r" });
    expect(r.action).toEqual({ type: "resume" });
    expect(r.state.open).toBe(false);
    expect(r.state.info).toBeNull();
  });

  it("'R' (uppercase) also resumes", () => {
    const r = resumeApplyKey(opened, { name: "char", char: "R" });
    expect(r.action?.type).toBe("resume");
    expect(r.state.open).toBe(false);
  });

  it("'d' discards and closes", () => {
    const r = resumeApplyKey(opened, { name: "char", char: "d" });
    expect(r.action).toEqual({ type: "discard" });
    expect(r.state.open).toBe(false);
  });

  it("'D' (uppercase) also discards", () => {
    const r = resumeApplyKey(opened, { name: "char", char: "D" });
    expect(r.action?.type).toBe("discard");
  });

  it("Esc discards", () => {
    expect(resumeApplyKey(opened, { name: "escape" }).action).toEqual({ type: "discard" });
  });

  it("Enter resumes (safe default — never discards)", () => {
    expect(resumeApplyKey(opened, { name: "enter" }).action).toEqual({ type: "resume" });
  });

  it("an unrelated key leaves the overlay open with no action", () => {
    const r = resumeApplyKey(opened, { name: "char", char: "x" });
    expect(r.action).toBeUndefined();
    expect(r.state.open).toBe(true);
    expect(r.state.info).toEqual(info);
  });

  it("does not mutate the input state", () => {
    const s = openResumeState(info);
    resumeApplyKey(s, { name: "char", char: "r" });
    expect(s.open).toBe(true);
    expect(s.info).toEqual(info);
  });
});

describe("renderResume", () => {
  it("returns a centered panel containing the goal, title and focus duration", () => {
    const o = renderResume(opened, 80, 24, "neon", false);
    const joined = o.rows.join("\n");
    expect(joined).toContain("Ship the resume overlay");
    expect(joined).toContain("Resume previous session?");
    expect(joined).toContain(humanDuration(1500));
    expect(o.top).toBeGreaterThan(0);
    expect(o.left).toBeGreaterThan(0);
  });

  it("includes the details line when label is set", () => {
    const o = renderResume(opened, 80, 24, "neon", false);
    expect(o.rows.join("\n")).toContain("details: deep work");
  });

  it("omits the details line when label is null", () => {
    const noLabel = openResumeState({ ...info, label: null });
    const o = renderResume(noLabel, 80, 24, "neon", false);
    expect(o.rows.join("\n")).not.toContain("details:");
  });

  it("shows a fallback when goal is null", () => {
    const noGoal = openResumeState({ ...info, goal: null });
    const o = renderResume(noGoal, 80, 24, "neon", false);
    const joined = o.rows.join("\n");
    expect(joined).not.toContain("Ship the resume overlay");
    expect(joined).toContain("(no goal)");
    expect(joined).toContain(humanDuration(1500));
  });

  it("does not throw with null info and stays a valid panel", () => {
    const o = renderResume(emptyResumeState(), 80, 24, "neon", false);
    expect(o.rows.length).toBeGreaterThan(0);
    const w = displayWidth(o.rows[0]!);
    for (const row of o.rows) expect(displayWidth(row)).toBe(w);
  });

  it("every overlay row is within the box width", () => {
    const o = renderResume(opened, 80, 24, "neon", true);
    const w = displayWidth(o.rows[0]!);
    for (const row of o.rows) expect(displayWidth(row)).toBe(w);
  });
});
