# Handover prompts

Paste prompt 1 as the first message in a new Claude Code session, after unzipping this pack into an empty git repo. Send prompt 2 to a designer with the prototype link or the repo.

---

## 1. Claude Code — kick-off

```
You are starting work on Borough Ledger: an independent, resident-facing view of Hammersmith & Fulham Council's money and promises. Modules: your council tax bill by band, the council's budget flow, a waterfall of how this year's gap opened and closed, a tool to balance next year's budget, a promise ledger for both parties, and a searchable ledger of payments over £500.

Before writing code, read in this order:
1. CLAUDE.md (invariants and stack; they override your defaults).
2. README.md (concept, and how this differs from a national budget tool).
3. docs/PRE_SHIP_REVIEW.md (known issues; most prototype numbers are test data).
4. docs/PRD.md, docs/DATA_MODEL.md, docs/MODEL.md.
5. prototype/index.html in a browser, and prototype/template.html as the reference implementation.

Then do milestone M0 from docs/BUILD_PLAN.md:
- pnpm monorepo: apps/web (Next.js App Router, TypeScript strict, Tailwind), packages/engine, packages/schema.
- Port the prototype into React components with the same look (docs/DESIGN_HANDOFF.md).
- Data only from data/seed/*.json through Zod schemas; no numeric literals in components.
- Engine tests (Vitest): funding equals spending; band ratios produce the published Band D split; single person discount is 25%; the 2026/27 waterfall closes to zero; balance-it reports the right remaining gap for five fixed scenarios; a council tax rise above 4.99% raises the referendum flag.
- A CI check that fails a production build if any rendered value has quality "test".

Working rules:
- Show a short plan first, then build. Commit after each green step.
- Never add council logos, colours or wording that could pass as official.
- Stop at the end of M0 and report: what works, test results, desktop and mobile screenshots, and what M1 must address first.
```

For later milestones, start a new session with: *"Read CLAUDE.md, README.md and docs/PRE_SHIP_REVIEW.md first."* followed by the milestone prompt from `docs/BUILD_PLAN.md`.

---

## 2. Designer — brief

```
Borough Ledger is an independent website that turns a London resident's council tax bill into a readable account of their council's money and promises. Pilot: Hammersmith & Fulham.

Start with the clickable prototype. Layout, sections and interactions are agreed. Your job is the polished system, the mobile versions and the screens not yet drawn.

Read docs/DESIGN_HANDOFF.md: principles, screens in priority order, component states, tokens and copy rules.

Direction: the cleanest possible information design. White page, one typeface, numbers first, hairlines instead of boxes, three data colours (funding blue, services grey, gap and reserves orange, hatched when one-off). It must never look like the council's own website, and must stay neutral between parties.

Highest priority:
1. "Your bill" on mobile, including the band picker and the split.
2. Balance-it on mobile (levers as a bottom sheet, result always visible).
3. Promise card page and its 1200×630 share image.
4. Ward page (postcode → your councillors, their pledges, local issues).

Deliver: Figma (or a Claude Design canvas) for desktop and mobile, light and dark; a component sheet with states; share-image templates; tokens.
```
