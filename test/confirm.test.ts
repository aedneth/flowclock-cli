import { describe, it, expect } from "vitest";
import {
  emptyConfirmState,
  openConfirmState,
  confirmApplyKey,
  renderConfirm,
} from "../src/tui/confirm.js";
import { displayWidth } from "../src/lib/tui/draw.js";

const opened = openConfirmState({
  title: "Delete session",
  message: "Delete this session? This cannot be undone.",
  payload: "sess-123",
});

describe("confirm state", () => {
  it("emptyConfirmState is closed", () => {
    expect(emptyConfirmState().open).toBe(false);
  });

  it("openConfirmState carries title/message/payload and is open", () => {
    expect(opened.open).toBe(true);
    expect(opened.payload).toBe("sess-123");
    expect(opened.message).toContain("Delete this session");
  });
});

describe("confirmApplyKey", () => {
  it("'y' confirms and carries the payload", () => {
    const r = confirmApplyKey(opened, { name: "char", char: "y" });
    expect(r.action).toEqual({ type: "confirm", payload: "sess-123" });
    expect(r.state.open).toBe(false);
  });

  it("'Y' (uppercase) also confirms", () => {
    const r = confirmApplyKey(opened, { name: "char", char: "Y" });
    expect(r.action?.type).toBe("confirm");
  });

  it("'n' cancels", () => {
    const r = confirmApplyKey(opened, { name: "char", char: "n" });
    expect(r.action).toEqual({ type: "cancel" });
    expect(r.state.open).toBe(false);
  });

  it("Esc cancels", () => {
    expect(confirmApplyKey(opened, { name: "escape" }).action).toEqual({ type: "cancel" });
  });

  it("Enter cancels (safe default — never deletes)", () => {
    expect(confirmApplyKey(opened, { name: "enter" }).action).toEqual({ type: "cancel" });
  });

  it("an unrelated key leaves the modal open with no action", () => {
    const r = confirmApplyKey(opened, { name: "char", char: "x" });
    expect(r.action).toBeUndefined();
    expect(r.state.open).toBe(true);
  });
});

describe("renderConfirm", () => {
  it("returns a centered panel containing the message", () => {
    const o = renderConfirm(opened, 80, 24, "neon", false);
    const joined = o.rows.join("\n");
    expect(joined).toContain("Delete this session");
    expect(joined).toContain("[y] confirm");
    expect(o.top).toBeGreaterThan(0);
    expect(o.left).toBeGreaterThan(0);
  });

  it("every overlay row is within the box width", () => {
    const o = renderConfirm(opened, 80, 24, "neon", true);
    const w = displayWidth(o.rows[0]!);
    for (const row of o.rows) expect(displayWidth(row)).toBe(w);
  });
});
