/* Who checks and who approves a promise card (docs/PROMISE_STANDARD.md §5 and §6).

   Since 17 October 2026 one editor's approval publishes a card: the project owner, Pavel Guzhikov, after the AI
   Journalist (Claude, an AI) has checked each quote word for word against its source. Pavel decided it for all his
   projects: "for all projects now we have only ME, so make my approval the only needed from now, and also the AI
   Editor as a checker to mention". Before, the rule said two editors, and the two were the owner and the AI
   Journalist. The AI Journalist checks; it never approves, and nothing is published on its word alone.

   A card's `editor_check_required: true` means the editor has not yet approved it; `false` means the editor read
   each quote against its page and approved it, after the AI Journalist's check. Sign-offs already given stay valid. */

export const EDITORIAL = {
  /** Editors' approvals a card needs before it is published. */
  approvals: 1,
  /** The editor whose approval publishes a card. */
  editor: "Pavel Guzhikov",
  /** The checker named beside the editor: it checks every quote first, and never approves. */
  checker: "the AI Journalist",
} as const;

/** The mark a card carries while it waits for the editor. */
export const AWAITING_EDITOR_CHECK = "Awaiting editor check";

/** The mark a card carries once the editor has approved it. Plain words, no middle dot (CLAUDE.md invariant 10). */
export const CHECKED_AND_APPROVED = `Checked by ${EDITORIAL.checker} and approved by ${EDITORIAL.editor}`;

/**
 * What a card says about its checks: waiting for the editor, or checked and approved. Null when the card records
 * neither (it never claims an approval nobody recorded).
 */
export function editorialMark(card: { editor_check_required?: boolean }): { awaiting: boolean; text: string } | null {
  if (card.editor_check_required === true) return { awaiting: true, text: AWAITING_EDITOR_CHECK };
  if (card.editor_check_required === false) return { awaiting: false, text: CHECKED_AND_APPROVED };
  return null;
}
