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
