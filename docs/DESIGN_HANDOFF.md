# Design handoff

The prototype (`prototype/index.html`) sets the structure, interactions and visual direction. This brief covers what is agreed and what is open.

## Product in one line

Your council tax bill, turned into a readable account of your council's money and promises.

## Principles

1. **Start from the resident's own number.** The bill comes first; everything else explains it.
2. **The gap is the story.** Councils must balance every year. The orange gap (and hatched one-off reserves) is the visual thread from "the gap" to "balance it".
3. **Cleanest possible information design.** Numbers large, labels small and grey, hairlines instead of boxes, one typeface. Boxes only for the balance-it result and the promise detail.
4. **Never look official.** No council logo, crest, colours or typefaces. "Independent" on every page.
5. **Neutral.** No party colours anywhere. Red and green only for deltas and statuses.
6. **Provenance one glance away.** A coloured dot and a word: sourced (green), approx (amber), test (red).
7. **No middle-dot (·) separators.** Use layout, alignment, line breaks or commas.
8. **People always know where they are.** The top bar highlights the current section (`aria-current`): the page's section on its own pages and sub-pages (a promise card lights up Promises, a supplier lights up Payments), and on the long statement the section in view as you scroll. On a phone the highlighted item stays visible in the scrolling menu.

## Information architecture

```
/                     Your bill, budget, the gap, balance it, promises, payments (one page, sticky section nav)
/bill?band=D          Bill on its own (shareable)
/budget/[service]     Service drill-down: sub-lines, trend, gross vs net, savings, related pledges
/balance?s=…          Balance-it scenario (shareable, share image)
/promises             Ledger with filters
/promise/[id]         Card page (share image)
/councillor/[id]      Councillor: ward, roles, pledges
/ward/[id]            v1: councillors, ward pledges, local issues
/payments             Payments explorer
/supplier/[id]        Supplier history
/method               How council finance works, sources
```

## Screens in priority order

1. Your bill: desktop and mobile; band picker, discount, split, "your £X pays for".
2. Balance it: mobile as a bottom sheet of levers with the result pinned; desktop as in the prototype.
3. Promise card page + 1200×630 share image (quote, actor, status, £ per Band D home, "paid for by").
4. Service drill-down.
5. Ward page (postcode entry → ward).
6. Payments explorer and supplier page.
7. Councillor page.
8. Method page.

## Components and states

| Component | States |
|---|---|
| Band picker | A–H; discount on/off |
| Split bar | council vs GLA; GLA expanded into police, fire, transport when data exists |
| Ranked rows | default, hover, focus; quality dot on hover |
| Flow (desktop) / ranked lists (mobile) | base; hover link; drill-down |
| Waterfall | pressure (orange), funding/closing (blue), savings (grey), one-off (hatched orange), subtotal and total (ink) |
| Lever | at base, changed, over limit (red value), government-controlled label |
| Toggle | on/off with cost |
| Result panel | still to find (red), balanced (green), spare (blue); flags: referendum, one-off, below safe minimum, section 114 |
| Promise row | each status; test card mark; overdue |
| Ladder | 5 steps; single-message variant for opposition, unscoreable, failed, quietly dropped |
| Timeline | promised, in plan, budgeted, delivering, delivered, deadline, deadline missed, today |
| Payments table | loading, empty, filtered, redacted aggregate row |

## Tokens (from the prototype)

| Token | Light | Dark |
|---|---|---|
| bg | `#FFFFFF` | `#101820` (deep navy slate, never black) |
| sunk | `#F5F5F6` | `#1A2531` |
| line / line-strong | `#E7E7EA` / `#D4D4D8` | `#26323F` / `#364657` |
| ink / muted / faint | `#0B0B0D` / `#61616B` / `#9A9AA3` | `#E7EDF3` / `#A3B0BD` / `#7D8B99` |
| funding (accent) | `#2457F5` | `#7B9DFF` |
| services | `#52525B` | `#A3B0BD` |
| gap, reserves | `#F2600C` | `#FF7A2E` |
| GLA | `#A1A1AA` | `#4F5F71` |
| good / warn / bad | `#15803D` / `#B45309` / `#DC2626` | `#4ADE80` / `#FBBF24` / `#F87171` |

Type: Geist 400–700, self-hosted in production; tabular figures only on numbers (not body text, or hyphens widen). Scale 56 / 48 / 28 / 24 / 17 / 15 / 13 / 12. Radius 8 controls, 14 panels. Section spacing 72px.

## Copy

Resident's words: "bins", "care for older people", "running the council". Every figure has a unit and a year. Pledges quoted verbatim with date and venue.

## Deliverables

Figma or Claude Design canvas: screens above, desktop and mobile, light and dark; component sheet; share-image templates; tokens file.
