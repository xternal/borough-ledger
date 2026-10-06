# PRD — Borough Ledger (Hammersmith & Fulham pilot)

## Problem

Residents pay £1,000–£3,000 a year in council tax and get a one-page bill. Budget reports run to hundreds of pages of committee PDFs. Promises are made on leaflets and at hustings and are never checked. Councils publish payments over £500, but as monthly spreadsheets nobody reads.

## Users

| User | Job | Success |
|---|---|---|
| Resident | "What does my council tax pay for, and why did it go up?" | Understands their bill in under a minute |
| Engaged resident / residents' association | "Is the council doing what it promised? What will next year's budget cut?" | Follows pledges and gets alerted on change |
| Local journalist (incl. Local Democracy Reporters) | "I need a sourced number and a chart for a story today." | Copies a chart and a cited figure |
| Councillor or candidate (any party) | "That card misstates our pledge." | Right of reply published within 5 working days |
| Editor (internal) | "Turn a leaflet photo into a card." | Card drafted from a submission in under 30 minutes |

## Features v0

### F1. Your bill
- Band picker A–H; single person discount toggle; Council Tax Support signposted.
- Total, monthly (10 and 12 instalments), split council vs Mayor of London (GLA), with what the GLA share funds.
- "Your £X to the council pays for": split by service in proportion to net budget, with the honest caveat that council tax pays only part of the budget.
- **Acceptance:** Band D figures match the council's published 2026/27 rates exactly; band ratios are statutory (6/9 … 18/9).

### F2. Budget flow
- Funding (council tax, business rates, core grants, social care grants, transitional relief, reserves) → net budget → services.
- Desktop: flow chart. Mobile: two ranked lists with a total row.
- Drill-down per service: sub-lines, five-year trend, gross vs net (fees and ring-fenced grants), sources.
- **Acceptance:** funding equals spending for each year; each line links to the page and table it came from.

### F3. The gap (this year)
- Waterfall: cost pressures, change in government funding, gap, then how it was closed (council tax, savings, reserves).
- Savings list: each named saving with its amount and the service affected.
- **Acceptance:** waterfall closes to £0; every bar sourced to the budget report.

### F4. Balance it (next year, with a 3-year view)
- Levers: council tax rise (with 4.99% referendum line), fees and parking, government settlement (labelled "decided by government"), savings, reserves.
- Service toggles linked to real pledges and options (e.g. free home care, weekly collections, library hours).
- Result: still to find / balanced / spare; composition bar; reserves left vs safe minimum; your bill next year for your band.
- Flags: referendum; reserves are one-off; section 114 explanation when unbalanced.
- Medium-term view (v0.1): years +1 to +3, showing reserves used reappearing as a gap.
- Shareable scenario link and share image.
- **Acceptance:** engine tests for the five reference scenarios; values recompute within 50 ms.

### F5. Promises
- Cards for administration and opposition pledges: quote, actor, date, venue, area, cost range, per Band D home, % of budget, status, timeline, sources, right of reply.
- Ladder: promised → in plan (cabinet or committee decision) → budgeted → delivering → delivered; terminal failed or quietly dropped; separate "opposition pledge" and "unscoreable".
- Filters: party, area, status, overdue, ward.
- Councillor pages: their pledges, ward, committee roles (from the democracy site).
- "Try it in Balance it" for pledges that map to a lever or toggle.
- **Acceptance:** schema validation blocks a card without a primary source (unless unscoreable); every card has a share image.

### F6. Payments over £500
- Search by supplier, filter by service and month; totals; supplier page with history.
- Service mapping from the council's cost-centre names to resident vocabulary.
- Redaction: rows with redacted or personal payees aggregated as "Payments to individuals (redacted)".
- **Acceptance:** monthly totals reconcile to the source file; no personal names appear.

### F7. Follow and Contribute (no account)
- Follow a pledge, councillor, ward or service by RSS or email.
- Contribute: send a leaflet photo, a link or evidence for a card. Photos have metadata stripped. Editors review everything.

### F8. Method and sources
- Council finance in plain English: balanced budget rule, referendum limit, reserves, why council tax covers only part of spending.
- Sources, data vintages, changelog.

## v1+
- Ward view (postcode → ward → councillors, pledges, FixMyStreet reports, local capital schemes).
- Council decisions tracker: cabinet and committee decisions from the democracy site, auto-linked to pledges (LLM-assisted, editor-confirmed).
- Second borough using government revenue returns only; then all London boroughs.
- Capital programme and council housing account (separate ring-fenced budget).

## Non-goals
- Official status or partnership that compromises independence.
- Comments or forums.
- Any data about residents.
