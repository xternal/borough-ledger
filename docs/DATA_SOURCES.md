# Data sources

✓ = URL seen on 6 Oct 2026. Others are from memory and must be checked when the ETL module is written.

## Council (Hammersmith & Fulham)

| Source | What | URL |
|---|---|---|
| Revenue Budget and Council Tax Levels 2026/27 | Net budget, funding, savings, growth, reserves, medium-term strategy | ✓ https://democracy.lbhf.gov.uk/documents/s133753/Revenue%20Budget%20and%20Council%20Tax%20Levels%202026-27.pdf |
| Budget 2026/27 committee paper | Committee-level budgets and savings (e.g. Streets etc. £41.3m net; transitional relief £6.0m) | ✓ https://democracy.lbhf.gov.uk/documents/s133637/Budget%202026-27.pdf |
| Council Tax Base and Collection Rate 2026/27 | Tax base and collection rate | ✓ https://democracy.lbhf.gov.uk/documents/s133440/Council%20Tax%20Base%20and%20Collection%20Rate%202026-27%20and%20Delegation%20of%20the%20Business%20Rate%20Estimate.pdf |
| Council Tax Support Scheme 2026/27 | Who gets support | ✓ https://democracy.lbhf.gov.uk/documents/s133556/Council+Tax+Support+Scheme+2026-27.pdf |
| Democracy site (ModernGov) | Councillors, wards, committees, decisions, agendas, webcasts. ModernGov sites usually expose a web service (`mgWebService.asmx`); check | ✓ https://democracy.lbhf.gov.uk |
| Transparency: payments over £500, contracts over £5,000, procurement cards | Quarterly files under the Transparency Code | ✓ https://www.lbhf.gov.uk/councillors-and-democracy/data-and-information/transparency/procurement-and-financial-data |
| Statement of accounts | Outturn, reserves, balance sheet | Council website |

## Central government (same for every English council)

| Source | What | URL |
|---|---|---|
| Local Government Transparency Code 2015 | What councils must publish | https://www.gov.uk/government/publications/local-government-transparency-code-2015 |
| Local authority revenue expenditure and financing | Revenue budget (RA) and outturn (RO) returns by standard service line, all councils | https://www.gov.uk/government/collections/local-authority-revenue-expenditure-and-financing |
| Council tax statistics | Band D levels and tax base for every council | https://www.gov.uk/government/collections/council-tax-statistics |
| Local government finance settlement | Core funding, referendum principles | gov.uk, per year |

## London and the GLA

| Source | What | URL |
|---|---|---|
| GLA council tax decision (MD3472, 26 Feb 2026) | The Mayor of London's Band D amount by body: police, fire, transport, City Hall | https://www.london.gov.uk/md3472-approval-2026-27-council-tax-and-precepts-and-communication-council-taxpayers ✓ in use |

## Places and people

| Source | What | URL |
|---|---|---|
| ONS Open Geography Portal | Ward boundaries and codes | https://geoportal.statistics.gov.uk |
| Postcodes.io | Postcode → ward (free, open data) | https://postcodes.io |
| ONS population estimates | Residents per ward/borough | https://www.ons.gov.uk |
| FixMyStreet (mySociety) | Street reports by area | https://www.fixmystreet.com |
| WhatDoTheyKnow (mySociety) | FOI responses as evidence | https://www.whatdotheyknow.com |
| Contracts Finder / Find a Tender | Contracts and tenders | https://www.contractsfinder.service.gov.uk and https://www.find-tender.service.gov.uk |
| Companies House, Free Company Data Product | Supplier matching: number, status, type, date formed, business | https://download.companieshouse.gov.uk/en_output.html ✓ in use (bulk file, no account) |

## Politics

| Source | What | URL |
|---|---|---|
| Council election results | Votes, turnout and winners by ward | Democracy Club API, copied from the council's declarations ✓ in use; council pages at https://www.lbhf.gov.uk/councillors-and-democracy/elections |
| Party manifestos 2026 | Pledges | Party websites; archive every copy |
| Leaflets | Ward-level pledges | Reader submissions (photos), ElectionLeaflets.org archive if available |
| Local press | Statements and coverage | Local outlets, Local Democracy Reporting Service |

## Reused figures in the prototype

| Figure | Value | Source |
|---|---|---|
| Band D 2026/27 | £1,519.51 = £1,009.00 council + £510.51 GLA; 2025/26 £1,451.44 | ✓ https://councildata.co.uk/council-tax/london-borough-of-hammersmith-and-fulham/ (replace with the council's own page or the government table) |
| Council tax increase | 2.99% plus 2% social care precept | Budget 2026/27 committee paper |
| Streets, waste, parks and transport | £41.3m net (committee) | Budget 2026/27 committee paper |
| Transitional relief | £6.0m | Budget 2026/27 committee paper |
| Council tax resources | +£7.7m year on year | Budget 2026/27 committee paper |
| Seats | Labour 38, Conservative 12 of 50; leader Stephen Cowan | Wikipedia (verify with council) |

## ETL notes

* Budget PDFs: extract tables to `data/manual/*.csv` with page references; validate against report totals; human check once per year.
* Payments files: monthly CSV/XLSX with inconsistent columns across years. Normalise headers, keep raw files with hashes, map cost centres to services with a reviewed mapping table.
* Government returns: ODS/XLSX with stable line codes. Best source for comparing councils.

## In use (M1)

`etl/sources.json` lists every file the ETL reads, with its download URL and SHA-256. Council tax tables for 2022/23 to 2026/27, the RA budget return (parts 1 and 2) and the SG grants return for 2026/27 come from gov.uk under the Open Government Licence. The referendum principles report for 2026/27 is cited in `data/config/rules.json`.

The council's democracy site (democracy.lbhf.gov.uk) sits behind an Azure firewall with a JavaScript challenge. Scripts get a 403, and the ETL does not try to get around it. Budget papers are downloaded by hand into `data/raw/` and extracted into `data/manual/` (see its README).

## In use (M4)

`etl/payments_sources.json` lists every quarterly spend file with the council's URL, the Internet Archive's copy where there is one, its SHA-256, and the rows and total recorded from it. The council's page lists the latest nine quarters (April 2024 onwards). Older files were taken down; the Internet Archive kept Q4 2023/24 and five quarters from 2015 to 2017, which `python3 etl/payments.py --fetch` downloads from there.

The council's website answers scripts with "page not found", even with an honest user agent, and the ETL does not pretend to be a browser. Newer files are downloaded by hand from the page above into `data/raw/payments/`, then `--fetch` records their hash, rows and total. Two layouts so far: 2015 to 2017 (14 columns, every payment including under £500, ending with the council's own total row) and 2023/24 onwards (7 columns, over £500 only). Both are read by header name, and a file with unknown headers stops the build.

DuckDB is not used: the whole ledger adds up in Python in a few seconds, and the output is plain JSON that DuckDB can query directly (`read_json`) if anyone wants SQL.

## In use (M6)

- **Ward boundaries:** the ONS Open Geography Portal's Wards (December 2024) Boundaries UK BGC, generalised to 20 m, queried for the borough's 21 wards. `python3 etl/ward_map.py` saves the answer to `data/raw/` with its SHA-256 and projects it to SVG paths in `data/build/ward_map.json`, with each ward's neighbours (wards sharing a stretch of boundary). H&F's wards have not changed since May 2022; the May 2026 file is not served for queries yet. Open Government Licence; the map carries the ONS and Ordnance Survey attribution. The schema checks that every ward on the site has exactly one shape, matched by ONS code.
- **Postcode to ward:** postcodes.io, called from the reader's browser, never from our servers (docs/PRIVACY.md). It answers with the ONS ward code, which matches the codes in `content/wards.yaml`; the names differ slightly ("College Park & Old Oak", "Shepherd's Bush Green"), so the site matches on codes only.
- **FixMyStreet:** linked, never fetched or copied. Its ward pages use the ONS ward names; all 21 links were checked on 8 Oct 2026 (each page's heading names the ward), and an unknown name answers "Moved".
- **Building schemes by ward:** the spend files name each capital scheme ("Capital - Frank Banfield Park") but never its address. `python3 etl/capital_wards.py --draft` searches OpenStreetMap's Nominatim for the place in each name (bounded to the borough, one request a second, cached, as its usage policy asks) and finds the ward with the ONS boundaries. Claude's check then compared each point with the ward of the nearest postcodes from postcodes.io and placed schemes on roads by every segment of the road. The results, with what OpenStreetMap found, are in `data/manual/capital_scheme_wards.csv` (© OpenStreetMap contributors, ODbL); `python3 etl/capital_wards.py` adds up the month files by ward into `data/build/ward_spend.json`. Two service areas in the capital group are not schemes ("Finance and Resources", "Head of Capital Delivery", £15.7m) and are left out.

## In use (M7)

- **Council decisions:** the council's ModernGov web service (`mgWebService.asmx`, `GetMeetings` and `GetMeeting`) for Cabinet (committee 116) and Full Council (114) since 1 January 2026. The council's web pages refuse scripts, but its web service answers them; `etl/decisions.py` identifies itself honestly, keeps raw snapshots in `data/raw/decisions/` and writes `data/build/decisions.json` with a SHA-256 per meeting. Links on the site go to the council's own decision and meeting pages, which open normally in a browser.
- **Suggested links:** the Claude API (model in `CLAUDE_MODEL`, default `claude-opus-5-5`), asked once per decision; `data/build/decision_assessments.json` records which decisions it has seen. The first 45 decisions were read by Claude in a working session on 8 Oct 2026 instead.

## In use (Phase 1, 8 Oct 2026)

- **The Mayor of London's share by body:** Mayoral Decision MD3472, Appendices (london.gov.uk/media/112084/download, SHA-256 in `etl/sources.json`; the file downloads by script but is marked manual so CI never depends on it). Appendix B's Band D table (PDF page 4) gives police £334.13, fire brigade £76.85, transport £77.09 and City Hall £22.44 for 2026/27, and last year's figures; Appendix A line 9 (page 1) gives the £510.51 total. Extracted by hand into `data/manual/gla_2026-27.csv`; `etl/build.py` checks that the parts add up to the total in both years and that the total equals the GLA element of the government's council tax tables (area Band D less the council's own). Other bands are split in proportion, in whole pence that add back up (`splitPence` in the engine).
- **Ward election results:** Democracy Club's API (`/api/next/ballots/?election_id=local.hammersmith-and-fulham.2026-05-07`), CC BY-SA 4.0. Democracy Club copies each declaration from the council's result page and keeps its address. `python3 etl/elections.py` writes `data/build/elections.json`: seats, ballots, turnout, rejected papers and each candidate's party and votes. Only the elected are named, through the council's councillor records, matched by surname within the ward (the declarations use legal names, "Alexandra Sanderson" for Alex Sanderson). Addison and Palace and Hurlingham were read against the council's own result pages on 8 Oct 2026: every figure matched.
- **Free home care history:** the 2014 Labour manifesto (held by the council as document s50600, PDF page 18), the Cabinet report of 2 February 2015 (s60121) with its decision from the ModernGov web service, the Full Council minutes of 25 February 2015 (vote 25 to 0, from the web service) and the Full Council report of 17 October 2024 (s129307). The council's documents refuse scripts; they were read in a browser.

## In use (Phase 2, 8 Oct 2026)

- **Suppliers on the companies register:** Companies House's Free Company Data Product, the snapshot of 1 October 2026 (`BasicCompanyDataAsOneFile-2026-10-01.zip`, 471 MB, about 5.7 million live companies; SHA-256 in `etl/companies_house.py`). No account or API key. `python3 etl/companies_house.py --scan` streams it once and keeps the 2,931 companies whose name, now or before, could be a supplier's; `python3 etl/companies_house.py` matches and writes `data/build/companies.json`. A supplier is linked automatically only when its tidied name is exactly one live company's name, now or (if it still had that name when the council started paying it) before a change of name, and the company existed before the council first paid that name. Looser candidates (only the suffix differs, or the company was formed during the payments) are listed in `data/manual/companies_house_matches.csv` and linked only when checked. The registered office's local authority comes from postcodes.io; the postcode is not kept. Companies House states no formal licence for the file and says there are no restrictions on its use; we republish register facts only.

## In use (Phase 2, item 7, 9 Oct 2026)

- **The building programme:** Four Year Capital Programme 2026-30 and Capital Strategy 2026/27, the version Full Council adopted on 25 February 2026 (`mgConvert2PDF.aspx?ID=134079`, 28 pages, SHA-256 in `etl/sources.json`). The council's site refuses scripts, so it was read in a browser; its Appendix 1 matches the Cabinet version in the downloaded Cabinet pack (pages 152 to 156) line for line. Extracted by hand into `data/manual/capital_2026-30.csv` and checked by `etl/capital.py` against every printed total. The resolution names £135.5m and £318.8m while the report's tables add up to £135.0m and £317.2m; the site shows the tables and says so.
- **Council homes:** the Housing Revenue Account budget report to Cabinet, 9 February 2026, in the Cabinet pack already downloaded (pages 157 to 178). Table 1 and the quoted facts are in `data/manual/council_homes_2026-27.csv`, each with its page.

## In use (Kensington and Chelsea, 9 Oct 2026)

- **Bill, budget, history:** the same government returns already downloaded for Hammersmith & Fulham (they cover every council), read for ONS code E09000020 by `etl/boroughs.py` with the same checks.
- **Councillors:** the Royal Borough's ModernGov web service (`https://www.rbkc.gov.uk/committees/mgWebService.asmx`, `GetCouncillorsByWard`), which answers scripts.
- **Ward codes, seats and results:** Democracy Club, `local.kensington-and-chelsea.2026-05-07` (18 wards), CC BY-SA 4.0.
- **Ward boundaries:** the ONS Wards (December 2024) service already used, for LAD24CD E09000020.

## In use (15 more boroughs, 9 Oct 2026)

The same returns, Democracy Club and ONS sources as Kensington and Chelsea; each council's ModernGov web service for its councillors, listed in `data/config/boroughs.json` (Barking and Dagenham and Camden answer scripts only at their `*.moderngov.co.uk` address; Hackney's is at `hackney.moderngov.co.uk`). Hackney's and Tower Hamlets' mayoral results come from Democracy Club's mayoral ballots.

