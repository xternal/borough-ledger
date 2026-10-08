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

## Payments update (7 Oct 2026)

All seven newer quarters the council lists are in (Q3 2024/25 to Q1 2026/27), downloaded through a browser from the council's page. The ledger has 241,195 payments in 45 months, up to June 2026, with 2024/25 and 2025/26 as complete years. 41,549 rows are held back as council redactions and 266 by our rules.

B7 closed: the redaction rules ran on two full years. Reviewing the names they let through found one private individual paid a fee ("first name and surname" with a first name the list did not know); the forename list now covers names common across London's communities, and that payment is a total only. Keep the review step (`etl/tests/test_payments.py` and a look at short names without an organisation word) each time new files are added.

## Public alpha (7 Oct 2026)

The project owner decided to publish the site as a public alpha at https://borough-ledger.vercel.app, open to search engines and AI crawlers, **before** the legal advice in B6 (third-party campaigning rules and naming councillors) and before the editor checks of the promise cards and the payments mapping. The site says "Alpha" next to its name, every promise card still says "Awaiting editor check", and payments mark service groups as approx.

To publish with no test values, the three "Balance it" switches without a sourced cost (free home care, weekly bins, library hours) are held back and named on the page as coming later. The two free home care cards no longer link to a switch until it returns. Production builds now pass the gate, which still blocks any test value from reaching them.

Still open before calling it a launch: B5 and B6 (legal), the editor checks, the human checks of the mapping tables, the Conservative manifesto archive link and B3.

## Payments mapping signed off (7 Oct 2026)

Claude checked all 642 lines of `data/manual/payments_service_map.csv` against what was bought and who was paid (40 groups corrected) and listed 26 lines it was unsure of; the project owner read those and signed off every line. Services in payments are now shown as sourced rather than approx. When new spend files add service areas, `--draft-map` adds them as `reviewed=no` and the site goes back to approx until they are checked.

## Manifesto archive and card check (7 Oct 2026)

- **Conservative manifesto archived.** The Wayback Machine copy of 26 March 2026, and a fresh one made today, are byte-identical (same SHA-256) to the file the cards quote; a May capture was cut off at 5 MB and is not used. Both parties' manifestos now have an archived copy. Closes the "Conservative archive" item.
- **Editor check prepared.** `docs/editor-checks/2026-manifesto-cards.md` sets each of the 18 quotes against its manifesto page (all 18 are on the cited page word for word; Labour's parks pledge runs across two columns on page 5 and is also in the page 2 list), with each status and its reason, and two leads from the spend files. docs/PROMISE_STANDARD.md asks for two editors per card before the "Awaiting editor check" mark comes off.

## Legal check done (7 Oct 2026)

The project owner reports that the legal check is done with no issues: B5 (the name and not looking official) and B6 (third-party campaigning rules and naming councillors). B6 says to take advice again before the May 2030 election period.

Still open before calling it a launch:

- **Editor check of the 18 promise cards** by two editors (docs/editor-checks/2026-manifesto-cards.md).
- **B3**: the free home care history before 2026 (not shown on the card until sourced).
- **Decide**: the final name, whether to tell the council before launch (recommended: yes, offering a right of reply on the data), and saying on the site who funds it (now: the owner, with a Ko-fi link).
- **Search Console**: the verification code goes in NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION on Vercel.

## Budget mapping signed off (8 Oct 2026)

The project owner signed off every budget mapping table after Claude's pre-check (PR #18): ra_service_map, service_groups, funding_map, rs_outturn_map, funding_groups, payment_groups and the toggle cost in toggles_2027-28. Every hand-made table in data/manual/ now has its human check. The five small differences between the budget's government grouping and the payments ledger's team grouping (climate change costs, Supporting People, housing benefit administration, the coroner's court and the London levies) stay as they are.

## Cards signed off, contact address, open repository (8 Oct 2026)

- **Promise cards signed off.** The project owner and The Robot signed off all 18 cards against docs/editor-checks/2026-manifesto-cards.md, and the "Awaiting editor check" mark is off every card. The free home care card keeps its note about the history before 2026 (B3).
- **Contact address.** Every footer, every promise card's right of reply, the FAQ and llms.txt now give boroughs@guzh.uk for corrections and replies (docs/PRIVACY.md, "Replies and corrections by email").
- **Repository public.** GitHub stopped running Actions on the private repository on 8 Oct (billing). The project owner made it public, which makes Actions free. Before that the whole history was checked: no keys, tokens or key files, and no person's name in any earlier payments build. Commits so far carry the owner's own email address as author, as GitHub shows for any public repository.

Still open before calling it a launch:

- **B3**: the free home care history before 2026.
- **Decide**: the final name (and with it a domain), whether to tell the council before launch (recommended: yes, offering a right of reply on the data), and a licence for the code and data now the repository is public.
- **Search Console**: the verification code goes in NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION on Vercel.

## Status after M6, ward view (8 Oct 2026)

- **Your ward** is a new menu item and a section on the home page. Readers find their ward by postcode (looked up in their own browser at postcodes.io, docs/PRIVACY.md) or on a map drawn from the ONS boundaries, and land on a page for the ward: its councillors and their posts, pledges about the ward, the wards next to it, where to report street problems (FixMyStreet, linked only) and a reminder that council tax is the same in every ward.
- `/councillors` became `/wards`, with a permanent redirect so old links keep working.
- **Not yet:** council building schemes by ward. The spend files name places in about 200 capital projects ("Frank Banfield Park", "Edward Woods Fire Safety works"), but matching each to a ward needs a hand-checked table, like the payments mapping. Planned as the next change, shown as approx until checked.
- No pledge card is about one ward yet. Ward pages say so and ask for ward leaflets at the contact address.

## Building schemes by ward (8 Oct 2026)

Each ward page now shows the building work the council's spend files say it paid for there, from January 2024 to June 2026: £346.8m across 308 schemes. £251.6m is placed in one ward, £18.9m on roads and blocks across wards (shown on each, not split), £44.0m on programmes everywhere (footways, street lights, void repairs) and £32.3m on schemes whose name gives no place. Hammersmith Broadway has the most, £85.6m, mostly the Town Hall.

The ward for each scheme is ours, from its name (`data/manual/capital_scheme_wards.csv`). Claude checked all 308 lines: OpenStreetMap matches against the name and the nearest postcodes, roads by their whole length; several were moved (Olympia is in Avonmore, Normand Park in Lillie). Six lines are left for the project owner (Lillie Road and Farm Lane housing sites, which Queensmill school, Normand Croft school, North Kensington Gate). Until every line is signed off, the ward figures are marked approx.

Update, 8 Oct 2026: the project owner asked Claude to settle the six open lines with its best judgement rather than check them. Claude found each site in the council's own project pages (Lillie Road: 42 homes at 70-80 Lillie Road, West Kensington; Farm Lane: 31 homes at 11 Farm Lane, Walham Green), the DfE school register (Queensmill is now only at 1 Askham Road, Wormholt; Normand Croft is W14 9PA, West Kensington) and OPDC planning records (North Kensington Gate, Scrubs Lane, College Park and Old Oak). Every line is now checked by Claude, but no person has checked the table, so the ward figures stay marked approx until someone does.

## M5, first part: follow by RSS (8 Oct 2026)

Every pledge, ward and councillor has an RSS feed, plus feeds for everything, every pledge and payments (92 feeds, all static files built with the site). Pledge items are new cards, each dated event and replies; ward feeds add each month's building work in the ward (marked as our estimate of the ward); the payments feed has one item a month. `/follow` explains RSS in plain words and lists the main feeds; pages link their own feed and declare it in the page head. No accounts, no email, nothing stored. Still to do in M5: email alerts (needs a small database and double opt-in) and the contribute form.

Ward schemes signed off (8 Oct 2026): the project owner signed off `data/manual/capital_scheme_wards.csv`. Ward building figures are now marked sourced. Every hand-made table in `data/manual/` has its human check.
