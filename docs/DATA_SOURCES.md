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
| GLA budget | Precept and what it funds (police, fire, transport) | https://www.london.gov.uk (budget pages) |

## Places and people

| Source | What | URL |
|---|---|---|
| ONS Open Geography Portal | Ward boundaries and codes | https://geoportal.statistics.gov.uk |
| Postcodes.io | Postcode → ward (free, open data) | https://postcodes.io |
| ONS population estimates | Residents per ward/borough | https://www.ons.gov.uk |
| FixMyStreet (mySociety) | Street reports by area | https://www.fixmystreet.com |
| WhatDoTheyKnow (mySociety) | FOI responses as evidence | https://www.whatdotheyknow.com |
| Contracts Finder / Find a Tender | Contracts and tenders | https://www.contractsfinder.service.gov.uk and https://www.find-tender.service.gov.uk |
| Companies House API | Supplier matching | https://developer.company-information.service.gov.uk |

## Politics

| Source | What | URL |
|---|---|---|
| Council election results | Seats, wards, councillors | Council website; ✓ summary at https://en.wikipedia.org/wiki/2026_Hammersmith_and_Fulham_London_Borough_Council_election |
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

