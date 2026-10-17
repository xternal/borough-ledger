import { describe, expect, it } from "vitest";
import { DATA } from "./data";
import { AWAITING_EDITOR_CHECK, CHECKED_AND_APPROVED, EDITORIAL, editorialMark } from "./editorial";

describe("who checks and approves a card (17 October 2026)", () => {
  it("needs one editor's approval, Pavel Guzhikov's, after the AI Journalist's check", () => {
    expect(EDITORIAL.approvals).toBe(1);
    expect(CHECKED_AND_APPROVED).toBe("Checked by the AI Journalist and approved by Pavel Guzhikov");
  });

  it("says a card waits for the editor, or names both the check and the approval", () => {
    expect(editorialMark({ editor_check_required: true })).toEqual({ awaiting: true, text: AWAITING_EDITOR_CHECK });
    expect(editorialMark({ editor_check_required: false })).toEqual({ awaiting: false, text: CHECKED_AND_APPROVED });
    expect(editorialMark({})).toBeNull();
  });

  it("gives every published card a mark: none claims an approval nobody recorded", () => {
    for (const p of DATA.content.promises) expect(editorialMark(p), p.id).not.toBeNull();
  });
});
