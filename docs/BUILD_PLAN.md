# Build plan

Start each session with: *"Read CLAUDE.md, README.md and docs/PRE_SHIP_REVIEW.md first."* Then paste the milestone prompt.

## M0 — Scaffold and port (3 days)

See `HANDOVER_PROMPT.md` prompt 1.

**Done when:** the app matches the prototype on desktop and mobile; engine tests pass; production build fails while any `test` value is rendered.

## M1 — Real budget data (1 week)

> Build etl/ for H&F 2026/27 and the previous four years. Sources in docs/DATA_SOURCES.md. (1) From the Revenue Budget and Council Tax Levels report and committee papers, extract funding lines, net budgets by service, pressures, savings (named, with amounts and recurring flag), reserves and the safe minimum into data/manual/*.csv with page references; validate each table against the report's own totals. (2) Load government revenue budget (RA) and outturn (RO) returns for H&F and map our service lines to RO codes. (3) Council tax: Band D components and tax base from the tax base report and the government table. (4) Replace every test value in data/seed with sourced or approx values and a method note. Write manifest.json. Fail CI if the budget does not balance, the waterfall does not close or any value lacks a source.

## M2 — Balance it, properly (3 days)

> Extend packages/engine with the medium-term view in docs/MODEL.md §5: years +1 to +3, recurring vs one-off choices, reserves balance. UI: a 3-year strip under the result panel. Scenario encoding in the URL and a share image via next/og. Source lever coefficients (yield of 1% council tax, fees base, core grants) from M1 data. Tests for five reference scenarios, including reserves used in 2027/28 reappearing in 2028/29.

## M3 — Promises and councillors (1 week)

> Implement content/promises and content/councillors per docs/DATA_MODEL.md and docs/PROMISE_STANDARD.md. Import councillors, wards and committee roles from the democracy site (try the ModernGov web service; fall back to HTML). Create cards for both parties' 2026 manifestos with archived sources; replace all test cards. Pages: /promises, /promise/[id], /councillor/[id]. Map pledges to balance-it toggles where possible. CI: append-only history, required sources, share image per card. Nightly job: deadline_missed events.

## M4 — Payments over £500 (4 days)

> Ingest the council's monthly payments files (all available years). Normalise headers, keep raw files with hashes, map cost centres to services with a reviewed mapping CSV, match suppliers to Companies House where confident. Apply docs/PRIVACY.md redaction rules. DuckDB for queries; static JSON per month for the app. Pages: /payments (search, filters, monthly totals), /supplier/[id]. Reconcile monthly totals to source files in tests.

## M5 — Follow and Contribute (4 days)

> RSS feeds per pledge, councillor, ward and service; email alerts (double opt-in, no tracking) on status changes; submission form for links, leaflet photos (strip EXIF, blur check) and evidence, into an editor triage view that creates draft PRs. Follow docs/PRIVACY.md.

## M6 — Ward view (4 days)

> Postcode → ward via postcodes.io; ward pages with councillors, ward-level pledges, FixMyStreet reports (link out, respect their terms), capital schemes located in the ward where the council publishes locations.

## M7 — Council decisions (4 days)

> Daily fetch of cabinet and council decisions from the democracy site. Store as Decision records. Use the Claude API to suggest links between decisions and pledges (quote the decision text that matches); editors confirm. Confirmed links add timeline events.

## M8 — Second borough (3 days)

> Make the council a config. Using only government returns and council tax statistics, produce Your bill, budget flow and a basic gap view for a second London borough. List what is missing without local budget-report parsing.
