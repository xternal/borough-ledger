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

## Name and domain (8 Oct 2026)

The project owner chose the name **Borough Book** and the domain **boroughbook.uk** (DNS at Cloudflare, served by Vercel; www redirects to the bare domain). It is general on purpose: later boroughs get their own section on the same site. The old address, borough-ledger.vercel.app, redirects every page to the same page on boroughbook.uk, so links, search ranking and RSS subscriptions carry over. The legal check covered the old name; the owner may want the same quick check of the new one. Code packages (`@borough-ledger/*`), the repo, the Vercel project and RSS item ids keep the old name, which readers never see.

Still to do: verify boroughbook.uk in Google Search Console as a Domain property (one DNS TXT record).

## M7, council decisions (8 Oct 2026)

`/decisions` lists every Cabinet and Full Council decision since January 2026 (45 at 11 meetings), from the council's own records, with a feed. Each day a workflow fetches new decisions and asks Claude which open pledges of the party running the council each one moves, quoting the decision word for word; the suggestions arrive as a pull request, and merging it confirms them and adds the events to the cards. The first 45 decisions were read by Claude in a session: three links are suggested (green schemes in a council plan, Jan 2026; the Pathway Bond being delivered, Jan 2026; affordable homes on the Avonmore site in a council plan, Sep 2026), in their own pull request for the owner to confirm. Pledge cards now show each timeline event's source and their Follow and Send evidence buttons work. Needs an `ANTHROPIC_API_KEY` repository secret for the daily suggestions; without it, decisions are still fetched daily.

## Search and AI search (8 Oct 2026)

- **Pledge pages answer the question.** The pledge is the page's `<h1>` (it was an `<h3>`), the title carries its status ("Labour pledge: ... (In plan)"), and each page has an "In short" paragraph and five questions answered from the card, the same way for every party. Structured data: an Article about the quotation (dates, author, sources, the status in words; not a fact-check rating), an FAQPage and breadcrumbs.
- **For AI tools:** every pledge as Markdown at `/promise/<id>.md` (canonical back to the page by HTTP header), `/llms-full.txt` with the whole site in one file (figures with sources and estimates marked), and `/llms.txt` pointing to both.
- **Crawlers:** robots.txt names the AI search crawlers (OpenAI, Anthropic, Perplexity, Google, Apple, Microsoft, DuckDuckGo, Mistral, Meta, Common Crawl); pages allow full snippets and large image previews; the sitemap gives a last-changed date wherever one is known; an Organization record and an icon on every page.
- **IndexNow:** after each production deploy, `.github/workflows/indexnow.yml` sends the pages that changed to IndexNow (Bing, which feeds ChatGPT search and Copilot, plus Yandex and others). The key file is `/cd99e6aa5d02a98cce4df8abc80445fb.txt`, public by design.
- Still to do by the owner: Google Search Console (Domain property) and Bing Webmaster Tools.

## Party and topic pages (8 Oct 2026)

`/party/<id>` (one per party with pledges) and `/topic/<slug>` (one per pledge topic, 10 so far) answer searches like "Labour Hammersmith manifesto pledges" or "Hammersmith parks". Each opens with where the pledges stand, lists them, shows the council decisions that moved them and answers a few questions, with structured data (CollectionPage, FAQPage, breadcrumbs) and its own feed. Topic pages show the council's budget for the topic only where a budget line honestly matches (six by name, community safety by hand); health, young people and jobs, and climate show none, because the matching budget would mislead (the hospital pledge is about the NHS). Every pledge card links its party and topic.

## Quality pass (8 Oct 2026)

- **Accessibility 100** (Lighthouse) on home, promises, a pledge, a party, decisions and payments, up from 91 to 96. Text colours darkened to pass WCAG AA (4.5:1) on every background they sit on: faint grey #6b6b74, red #b91c1c, amber #92400e, and darker ink for status pills. In dark mode the faint grey is #8291a0 rather than the navy palette's #7d8b99, which falls to 4.45:1 on raised surfaces. Links that sit side by side on /decisions and in the payments file table have room to tap. Performance 95 to 100, best practices and SEO 100 on every page audited.
- **Share images** for party and topic pages (status counts only, never money).
- **Uptime:** `.github/workflows/uptime.yml` checks the main pages, their content and the old address's redirect every 30 minutes; a failed run emails the owner.
- **Reminders:** `.github/workflows/reminders.yml` opens an issue on 1 Feb, May, Aug and Nov to add the council's new spend file by hand, and on 1 March to move the statement on to the new budget.
- **CI pinned to Ubuntu 24.04**, so GitHub moving `ubuntu-latest` to Ubuntu 26 (from 19 Oct 2026) cannot break a build unannounced; move up on purpose later.

## Weekly digest (8 Oct 2026)

Every Sunday evening (18:00 BST, 17:00 GMT; Fridays until 9 Oct 2026) `.github/workflows/weekly-digest.yml` opens an issue with a draft Substack post for Monday: the week's council decisions and any pledges they moved, replies, missed deadlines, new spend data, Cabinet and Full Council meetings in the next fortnight with their agendas (from the council's ModernGov service), pledge deadlines in the next 60 days, and a "number of the week" (building work in one ward, a different ward each week). Claude writes it in the owner's voice from those facts only; code rejects any draft with a number that is not one of the facts' numbers and falls back to a plain version. The facts are listed under the draft so it can be checked in a minute.


## Phase 1: tables, the Mayor's share, election results, home care history (8 Oct 2026)

- **B3 closed.** The free home care card now carries its history from primary sources, read in full: the 2014 Labour manifesto ("we will abolish home care charges", then £12 an hour; PDF page 18), Cabinet's approval on 2 February 2015 (the report gives £441,000 a year of income given up), the Full Council vote of 25 February 2015 (25 to 0, 15 not voting; the net £324,000 a year met from savings elsewhere) and the end of charges on 1 April 2015 (Full Council report, 17 October 2024). The events were appended; the card shows them by date, and feed items keep their identifiers. The Cabinet report names the budget meeting as 26 February; the council's meeting list and minutes give 25 February, which the card uses.
- **Table view for every chart.** The budget flow, the gap and the bill each have "Show as a table" under them: plain HTML tables with captions and row headers, rendered on the server, folded away by default. On a phone the budget flow is already a list, so its table is on wider screens only.
- **The Mayor of London's share by body.** Police £334.13, fire brigade £76.85, transport £77.09 and City Hall and the London Assembly £22.44 at Band D, from the Mayor's own decision (MD3472), with this year's rise (£15.00 more for police, £5.13 for the fire brigade). Any band and the single person discount split the same way, in whole pence that add back up to the Mayor's share. Shown as approx until the owner signs off `data/manual/gla_2026-27.csv`.
- **Ward election results.** Each ward page shows how it voted on 7 May 2026: seats, turnout, every candidate's party and votes, and who was elected, from Democracy Club (CC BY-SA 4.0) with a link to the council's declaration. Only councillors are named (invariant 6); every party is shown by its registered name the same way (invariant 7). Each councillor's page gives their own vote. Two wards were checked against the council's own pages; the build checks every ward has a result, the winners had the most votes and each is a councillor of that ward.

## Phase 2: suppliers on the companies register (8 Oct 2026)

- **Closes "New: Companies House".** 2,738 of the 3,408 companies and charities in the spend files now link to their entry on the companies register, from Companies House's free bulk file of live companies (no account, no API key): 2,577 by their exact name, 139 by a name they had while the council paid them, and 22 checked by hand. Supplier pages show the registered name and number (linked to Companies House), status (in liquidation and in administration are highlighted; 65 such), type, date formed, the company's own description of its business, and the local authority area of its registered office (150 are in Hammersmith & Fulham). Unmatched suppliers keep a Companies House search link and say why they may not match.
- **Certain, or checked.** Live company names are unique, so an exact name match is certain unless the name passed between companies: a company formed after the council last paid that name is refused (39), one renamed away from the name before the first payment is refused (42), and one formed during the payments is not linked automatically (14, all rejected on review, since part of the money predates the company). Matches on the name without its suffix (31) were decided one by one in `data/manual/companies_house_matches.csv`.
- **No people, no addresses.** Only register facts about the company are kept; the registered office is reduced to its local authority area and the postcode is dropped (docs/PRIVACY.md). Suppliers that could be a person are never matched. CI refuses any other field.
- **Refresh:** the quarterly spend-file reminder now includes downloading the month's Companies House file and re-running the match.

## Phase 2: the building programme and council homes (9 Oct 2026)

- **/building** shows the council's four-year building programme (£135.0m, 2026/27 to 2029/30) by area, with every scheme folded underneath in residents' words (the council's name in a tooltip), how it is paid for (£75.4m borrowed), the debt for building work (falling from £375.8m to £356.5m), the schemes that are what a manifesto pledge names (Avonmore, green investment, parks, CCTV; any party's pledge is linked the same way), and a table of every scheme year by year.
- **/council-homes** shows the ring-fenced council homes account: where the £113.0m of rent and service charges goes in 2026/27 and how much of every £1 (37p on interest and wear and tear, 24p running the service, 22p repairs), the 4.8% rent rise, council rents against private rents (£136.50 against at least £476 a week for one bedroom), the £317.2m of building work on council homes, the reserve (£5.9m, about 3 weeks of rent) and the ten-year plan (198 new homes; borrowing per home from £49,100 to £72,500).
- **What does not add up in the council's papers, said openly:** the resolution approves £135.5m and £318.8m, but the report's own tables add up to £135.0m and £317.2m; one funding total is misprinted as a dash. Both are shown on /building.
- **Checks:** `etl/capital.py --check` in CI (every printed total, with rounding allowed; the account balances); a unit test proves a wrong figure, an undeclared misprint and an unbalanced account each stop the build. Every non-zero figure was matched against the report's text. Figures show as approx until the owner signs off both tables (`data/manual/README.md`).
- Both pages sit under "Budget" in the menu, which is highlighted on them; the home page's budget section links to both; sitemap, llms.txt and llms-full.txt include them.

## Phase 3: Kensington and Chelsea (9 Oct 2026, in review)

- **/kensington-and-chelsea**: the bill by band with the Mayor of London's split, the £378m day-to-day budget by service and funding (balanced, with the same checks), council tax over five years, and all 50 councillors in 18 wards with each ward's May 2026 result (Conservative 34, Labour 13, Liberal Democrats 3). Its own menu highlights the section in view. Pledges, payments, decisions and the gap come later from the council's own papers (docs/BOROUGHS.md).
- **Hammersmith & Fulham unchanged:** the shared build step and the shared page model were moved out of Hammersmith & Fulham's code with its build checked byte for byte and all its tests passing.
- **Found and fixed:** payments in lieu for armed forces homes in the tax base; housing benefit's remainder; a band lookup that searched for "Hammersmith".
- **Decision for the owner:** moving Hammersmith & Fulham's addresses under `/hammersmith-and-fulham` (plan item 12); not done (docs/BOROUGHS.md).

## First screen, borough selector and postcode finder (9 Oct 2026)

- **First screen:** the separate "Independent project" row and its spacing are gone. The first line now holds the borough selector and the independence note together ("Independent. Not run by or affiliated with ..."), which still appears on every page (invariant 5); the hero's top padding went from 52px to 28px and the gap under the figures row from 72px to 48px.
- **Borough selector:** a chip at the top of each borough's page listing every borough on the site, the current one marked (`aria-current`), as a plain disclosure of links that works without JavaScript; Escape or a click outside closes it.
- **Postcode finder on the first screen** of every borough's page, for every borough on the site: a Hammersmith & Fulham postcode opens its ward page, a Kensington and Chelsea one its ward on the borough page (highlighted), and any other says which borough it is in and which boroughs are covered. The finder on /wards and the home page's ward section use the same lookup. The ward lists come from a small bundled file (`data/build/boroughs/finder.json`, written and checked by `etl/borough_people.py`), so pages rendered on request read no files.
- Accessibility 100 on /, /kensington-and-chelsea and /wards (Lighthouse), with no experimental check failing.

## 15 more boroughs (9 Oct 2026, in review)

Barking and Dagenham, Brent, Bromley, Camden, Hackney, Haringey, Harrow, Havering, Hounslow, Merton, Redbridge, Richmond upon Thames, Southwark, Sutton and Tower Hamlets join Kensington and Chelsea: bill, budget, council tax history, every councillor and ward result, the postcode finder and the borough selector, all from the same checked pipeline. Elected mayors (Hackney, Tower Hamlets), seats that changed hands since May, names written differently and missing turnout are handled without guessing (docs/BOROUGHS.md). Lambeth waits for its ModernGov service to answer.

## Lambeth (9 Oct 2026)

Lambeth joins: its councillor service answers, slowly (about 100 seconds), and lists an empty seat as "Vacancy", now read as an empty seat. 18 London boroughs on the site.

## Manchester and Birmingham (9 Oct 2026, in review)

The first councils outside London: Manchester City Council and Birmingham City Council, with their bills split into police, fire and the combined authority from the government's own tables (checked to the penny against the area Band D, this year and last), Birmingham's parish precepts shown apart, Manchester's elections by thirds and Birmingham's councillors from May's ballots (docs/BOROUGHS.md). 20 councils on the site.

## Leeds (9 Oct 2026, in review)

Leeds City Council's bill (police set by the Mayor of West Yorkshire, fire, 31 parishes shown apart), budget and five years of council tax, from the same returns and checks. No councillors yet: Leeds' democracy site turns automated requests away, and the page says so and links the council's own list (docs/BOROUGHS.md). The rounding allowance in one Table 10 check now scales with the council's size. 21 councils on the site.

## Seven more London boroughs (9 Oct 2026, in review)

Croydon, Ealing, Kingston upon Thames, Lewisham, Newham, Wandsworth and Westminster: 28 councils on the site. The council tax agreement check allows £5,000 (these differ by £1,200 to £3,100); a May winner can be shown as no longer on the council's list only where the ward held a by-election since May (docs/BOROUGHS.md).

## Glasgow (9 Oct 2026, in review)

The first Scottish council: Scotland's own returns, rules and Scottish Water's charges, with the same standard of checks (docs/BOROUGHS.md). For the owner: check `data/manual/scottish_water.csv` against the two leaflets once (it shows as approx until then), and the grouping in `data/manual/scot_service_groups.csv`. 29 councils on the site.

## Islington, Bexley and Waltham Forest (9 Oct 2026, in review)

Three London boroughs whose two returns differ on council tax by £23,227 to £305,538, published by the owner's decision with both figures shown on the page (docs/BOROUGHS.md). 32 councils on the site.

## Edinburgh, Highland and North Yorkshire (9 Oct 2026, in review)

Two more Scottish councils and North Yorkshire (docs/BOROUGHS.md); a "Counties and regions" heading in the picker; parished councils' history now outside a parish, as their bills. 35 councils.

## Cardiff (9 Oct 2026, in review)

The first Welsh council: Band I, the fire levy shown as its own calculated line, community councils as a total, councillors from 2022 with by-elections accounted for (docs/BOROUGHS.md). For the owner: check `data/manual/wales_service_groups.csv`, and the six community councils' names against Cardiff's council tax resolution of 5 March 2026 once. 36 councils.

## Belfast (9 Oct 2026, in review)

The first council in Northern Ireland: rates from a home's capital value instead of bands, the budget by committee, councillors by district electoral area (docs/BOROUGHS.md). For the owner: look once at `data/manual/ni_poundages.csv` (against the Department of Finance's page), `ni_rate_statistics.csv` (against the four circulars, pages 1 to 4) and `belfast_budget.csv` (against page 3 of the committee minutes), and mark each row "yes": until then every Belfast figure shows as approx. 37 councils. Checked by the owner against the sources and marked "yes" (10 October 2026): every figure is now sourced except the growth fund, which is the difference (approx), and bills on a given value, which are our arithmetic (modelled).

