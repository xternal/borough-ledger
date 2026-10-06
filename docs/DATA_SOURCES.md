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
| Transparency: payments over £500, contracts over £5,000, senior salaries | Monthly / quarterly files under the Transparency Code | Council website transparency section (find exact URL) |
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
