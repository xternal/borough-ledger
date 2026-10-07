# Pre-ship review

Self-review of the prototype and pack, 6 Oct 2026. Handing the pack to a developer or designer: fine now. Publishing: not before every blocker is closed.

## Blockers

| # | Issue | Fix | Owner |
|---|---|---|---|
| B1 | Most numbers are test data: funding lines (except transitional relief), six of seven services, the waterfall (except the council tax line), all of balance-it, tax base, collection rate, all payments, all promises except free home care | ETL M1, M3, M4; CI blocks production while any test value renders | Data |
| B2 | Band D figures come from a third-party site (councildata.co.uk) | Re-source from the council's own council tax page or the government council tax table | Data |
| B3 | Free home care card dates (pledge 2014, charges scrapped 2015) are from memory | Editor sources both dates | Editor |
| B4 | Test promise cards use "Party A / Party B" with invented pledges and statuses | Never publish; replace with real manifesto cards | Editor |
| B5 | Looking official | Independent name, no council marks, disclaimer on every page; legal check on the name | Legal |
| B6 | Local election rules on third-party spending, and defamation risk for named councillors | Legal advice before launch and before May 2030 | Legal |
| B7 | Personal data in payments files | Redaction rules in docs/PRIVACY.md, tested on a full year of files before launch | Engineering |

## High

| # | Issue | Fix |
|---|---|---|
| H1 | The committee paper lists business rates −£30.7m and grants +£13.2m for 2026/27; the prototype does not use them because the funding reform reshuffles several lines and I could not reconcile them from the summary | Rebuild the funding waterfall from the full report in M1 |
| H2 | "Council tax covers 36%" is computed from test funding totals | Recompute from sourced totals; it may move a lot |
| H3 | "Streets, waste, parks and transport £41.3m" is the net budget of one committee, which may not match the service grouping used elsewhere | Use one consistent classification (RO service lines) |
| H4 | GLA share shown as one line | Break down into police, fire, transport etc. from the GLA budget |
| H5 | Balance-it fee changes ignore behaviour (higher parking charges can reduce use) | Label as static; add a sourced elasticity later |
| H6 | No table view for charts | Add for flow, waterfall and bill split |
| H7 | Payments explorer shows 48 invented rows | Real files in M4 |

## Medium

* Labour 38 / Conservative 12 seats and leader from Wikipedia; confirm with the council site.
* Instalments assume 10 or 12 monthly payments; councils vary. Check H&F's default.
* Council Tax Support is mentioned in docs, not yet in the bill UI.
* Self-host Geist in production (Google Fonts sends visitor IPs to Google).

## Decide

* Name. "Borough Ledger" is a working title; make sure nothing suggests it is the council's.
* Whether to tell the council before launch. Recommended: yes, with an offer of right of reply on the data, without asking permission.
* Who funds it, and publishing that on the site.

## Status after M1 (6 Oct 2026)

| # | Status |
|---|---|
| B1 | Partly closed. Council tax, the 2026/27 budget (funding and services), reserves and their safe minimum, the tax base, the referendum rule and this year's gap waterfall are now sourced (`etl/`, `data/build/`, `data/manual/`). Next year's gap (£31.4m, Appendix B) and every named saving (Appendix C) are sourced too. Still test: the fees lever, three service toggle costs, pledge costs, all promises except free home care, all payments. `pnpm --filter @borough-ledger/schema report:test-values` lists them |
| B2 | Closed. Band D from the government council tax tables (Table 9 and Table 10, 2026/27); all eight bands match to the penny. The third-party figure for 2025/26 was 2p out |
| H1 | Closed. The waterfall is rebuilt from Table 2 of the budget report (PDF page 17), which closes to zero: business rates +£30.7m, grants −£13.2m, transitional relief −£6.0m, council tax −£7.7m, savings −£9.5m. No reserves were used in 2026/27 |
| H2 | Closed. Council tax covers 23% of day-to-day spending including schools, and 36% of the £255.3m the council funds itself |
| H3 | Closed. One classification: the government revenue account (RA) lines, grouped in `data/manual/ra_service_map.csv` |
| Medium: instalments | Open |
| Medium: Geist | Closed in M0 (self-hosted) |
| New: referendum 2027/28 | Government confirmed it will set no referendum principles for 2027-28 and 2028-29 for H&F and five other low council tax authorities (settlement consultation response, section 3). Balance-it no longer warns at 5% for 2027/28; marked approx until the 2027-28 principles report is laid |
| New: source version | The adopted budget is the Full Council report of 25 Feb 2026; figures match the Cabinet version of 9 Feb. Citations use the Full Council version and its page numbers |
| New: outturn 2024/25 | What was actually spent comes from the RS and RO5 outturn returns, in the same service groups (`history.outturn`). Housing and homelessness was budgeted at £11.9m and cost £30.8m, so the £44.4m 2025/26 budget reflects real temporary accommodation costs. Outturn includes grants received during the year, so a gap between budget and outturn is not by itself an overspend. Earlier outturn years need their own adapters |
| New: fees lever | Sourced from £80.5m of fees and charges income (Appendix I); approx and static (H5) |

## Status after M3 (7 Oct 2026)

| # | Status |
|---|---|
| B1 | Promises closed. 18 real cards from both parties' 2026 manifestos replace every test card. Still test: three service toggle costs (free home care, weekly bins, library hours) and all payments (M4) |
| B3 | Open. The free home care card now cites the 2026/27 budget report (PDF page 22) and both 2026 manifestos; the 2014 pledge and the 2015 end of charges are kept out of the timeline until an editor sources them |
| B4 | Closed. No "Party A / Party B" cards remain; CI fails if a promise card has quality "test" |
| New: card check | Every card is marked "Awaiting editor check" until two editors read each quote against the manifesto page (docs/PROMISE_STANDARD.md §6) |
| New: Conservative archive | The Conservative manifesto is saved with its SHA-256, but the Wayback Machine had not archived it by 7 Oct 2026. Submit it at web.archive.org/save and add `archive_url` to `content/parties.yaml` |
| Medium: seats | Closed. Labour 38 of 50 seats, the leader and every councillor now come from the council's ModernGov service (retrieved 7 Oct 2026), not Wikipedia |

## Status after M4 (7 Oct 2026)

| # | Status |
|---|---|
| B1 | Payments closed. The 48 invented payments are gone; the ledger is built from the council's own spend files (124,548 payments in 24 months so far). Only three service toggle costs remain test (free home care, weekly bins, library hours), so the production gate still blocks |
| B7 | Mostly closed. Redaction rules are in code and tested (docs/PRIVACY.md): council redactions, people the council did not redact, payments that usually go to individuals, and sole traders' own names. 19,700 rows are held back as council redactions and 256 more by our rules, shown only as totals. Run once on a full year: 2024/25 needs the Q3 and Q4 files, which the council's site serves only to a browser |
| H7 | Closed. Real files, reconciled: every month adds back up to its file to the penny, and the three older files with a total row match it |
| New: payments mapping | `data/manual/payments_service_map.csv` (500 lines) is a keyword draft. Until a person checks it, services in payments are marked approx. Largest lines first: an hour or two |
| New: missing quarters | Seven quarters listed by the council (Q3 2024/25 to Q1 2026/27) are not in the build yet. Download them by hand from the council's procurement and financial data page into `data/raw/payments/`, then run `--fetch`, `--draft-map` and a build |
| New: Companies House | Not matched yet. Supplier pages link to a Companies House search; a confident automatic match needs the free bulk company file (about 470 MB) or an API key, and is left for a later change |

