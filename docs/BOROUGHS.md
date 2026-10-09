# More boroughs

Plan items 11 (Kensington and Chelsea) and 12 (all 32 London boroughs). Started 9 Oct 2026.

## What a borough gets first

Everything that comes from data published the same way for every council, with Hammersmith & Fulham's checks:

| Part | From | Built by |
|---|---|---|
| The bill by band, the council's share and the Mayor of London's, split by body | Government council tax tables (Tables 9 and 10); the GLA's MD3472 | `etl/boroughs.py` (`statement()` in `etl/build.py`, shared with Hammersmith & Fulham) |
| The day-to-day budget by service and where the money comes from, balanced | Revenue account budget (RA) and specific grants (SG) returns, grouped with the same hand-checked mapping tables | `etl/boroughs.py` |
| Council tax over five years, budget and outturn history | Government returns | `etl/boroughs.py` |
| Wards, councillors with their posts, May 2026 results | The council's ModernGov web service; Democracy Club (CC BY-SA 4.0); ONS ward boundaries | `etl/borough_people.py` |

Each borough is one entry in `data/config/boroughs.json` (slug, council name, ONS code, ModernGov address, Democracy Club election id). Its page is `/<slug>`, built from `data/build/boroughs/<slug>/`. CI rebuilds every statement from the raw returns and checks every borough's councillors and results (`etl/boroughs.py --check`, `etl/borough_people.py --check`).

What needs the council's own papers comes later, borough by borough, as for Hammersmith & Fulham: how this year's gap was closed, savings, next year's gap and "Balance it" (the budget report, extracted by hand into `data/manual/`), manifesto pledges (cards, with an editor's check), payments over £500 (each council's own spend file format) and decisions (ModernGov, where the council has it).

## What adding Kensington and Chelsea found

Two things the Hammersmith & Fulham code assumed, now handled for every borough with Hammersmith & Fulham's figures unchanged (CI checks its build byte for byte):

- **Payments in lieu for armed forces homes.** Table 10's tax base for setting council tax includes "contributions in lieu of Class O exempt dwellings" (Kensington and Chelsea: about 50 Band D homes, every year; Hammersmith & Fulham: none). The check is now tax base × collection rate + payments in lieu = setting base.
- **Housing benefit's remainder.** In Hammersmith & Fulham housing benefit nets to nothing against its government subsidy. In Kensington and Chelsea it leaves £0.5m; it is counted with housing, so funding still equals spending, and the housing line says so.
- The band table was found by searching for "Hammersmith"; it is now found by the council's ONS code.

## Addresses: decided by the owner before it changes

The plan's item 12 moves Hammersmith & Fulham under `/hammersmith-and-fulham/...` with permanent redirects from today's addresses, so every borough has the same shape. Not done yet, because it changes every live address (the Substack post, the emails to the parties and every share link use today's addresses; redirects keep them working, and RSS item ids do not change). Until then, Hammersmith & Fulham stays at `/` and other boroughs sit at `/<slug>`, which is already their final address.

Recommended order: (1) merge Kensington and Chelsea at `/kensington-and-chelsea`; (2) add the other 30 boroughs' statements and people the same way (data only, an hour or two, all automatic); (3) then move Hammersmith & Fulham under its own slug with redirects, and make `/` a borough finder (postcode to borough).

## All 32: a first run of the checks (9 Oct 2026, nothing published)

`statement()` was run for every London borough from the returns already downloaded. **18 pass every check unchanged** (Barking and Dagenham, Brent, Bromley, Camden, Hackney, Haringey, Harrow, Havering, Hounslow, Kensington and Chelsea, Lambeth, Merton, Redbridge, Richmond upon Thames, Southwark, Sutton, Tower Hamlets, and Hammersmith & Fulham). The other 14 stop on the check that the budget return's council tax (RA line 990, in £000) matches the council tax return (Table 10):

| Kind | Boroughs | Difference | Proposed handling |
|---|---|---|---|
| Rounding (the RA is in £000) | Croydon, Ealing, Kingston upon Thames, Lewisham, Newham, Wandsworth | £1,200 to £3,100 | Allow £5,000; each is under 0.005% |
| Small real difference | Islington (£23k), Bexley (£238k), Waltham Forest (−£306k) | 0.02% to 0.2% | Build with the council tax return's figure and say on the page that the two returns differ, by how much |
| Large difference | Barnet (£4.7m, 1.8%), Enfield (£13.5m, 7.3%) | | Read the council's own budget report before publishing; hold back until then |
| Return incomplete | Greenwich (no council tax line in its RA), Hillingdon (a line reported as "...") | | Hold back until the return is complete, or use the outturn return |
| Parish precept | Westminster (Queen's Park Community Council) | setting base × Band D is £0.2m below the requirement | Use Band D including local precepts for the identity where a borough has a parish |

So item 12's data side is mostly automatic, but six boroughs need a person's decision, and the page must say where returns disagree. The councillors' side needs each council's ModernGov address (most London boroughs use ModernGov; a few use other systems), found and checked one by one.

## 15 more boroughs (9 Oct 2026)

Live from this change, each at `/<slug>` with the same page as Kensington and Chelsea: Barking and Dagenham, Brent, Bromley, Camden, Hackney, Haringey, Harrow, Havering, Hounslow, Merton, Redbridge, Richmond upon Thames, Southwark, Sutton and Tower Hamlets: 15 more, so 16 boroughs beyond Hammersmith & Fulham and about 900 of their councillors. Every bill and budget passes the same checks as Hammersmith & Fulham's.

**Held back:** the 14 boroughs in the table above whose returns disagree. (Lambeth, held back at first because its ModernGov service timed out, was added the same day: it answers, but takes about 100 seconds.)

What the councils' own records needed, all handled in `etl/borough_people.py` with Hammersmith & Fulham's rules unchanged:

- **Elected mayors.** Hackney (Zoë Garbett, Green) and Tower Hamlets (Lutfur Rahman, Aspire) are run by a mayor elected on 7 May 2026. The page says so, from the mayoral ballot, and the mayor is not counted as a ward councillor (Hackney lists its mayor under her old ward).
- **Names written differently.** The ballot paper gives full legal names ("Christopher William Stuart Phillips"), the council's list the everyday one ("Chris Phillips"), sometimes with "Dr" or honours and degrees ("Amer Agha MB BS, MSc, PHCM"), or a different spelling ("Davies", "Davis"). Each of May's winners is paired with a councillor on the council's list for the ward: the same name; one name inside the other; the same first name and a near-identical surname; or a surname only one councillor and one winner in the ward share. Every pairing that was not an exact name (about 200 of about 900) was read by Claude: all correct.
- **Seats that changed hands since May.** Five winners are not on the council's current list (Camden: Regent's Park; Hackney: Dalston, where the new mayor gave up her seat, and Hackney Central; Haringey: Northumberland Park and Woodside), each matched by a different councillor now listed. They show as elected and "no longer on the council's list", not named. The build allows that only where an empty seat or a councillor who joined since accounts for it; anything else stops it.
- **A councillor listed without a party** (Hackney, De Beauvoir): her party comes from her May ballot, and the post listed with the entry, which is not a council post, is left out.
- **A candidate their party withdrew support from after nominations** is still on the ballot paper and can win (Harrow, North Harrow); they are kept. Hammersmith & Fulham's results had none, and are unchanged.
- **Party names.** "Labour and Co-operative Party" and "Labour And Co Op Party" count as Labour; "Local Conservatives" (Bromley) and "Conservative and Unionist Party" as Conservative; "The Reform UK Group" (Havering) as Reform UK. Local parties keep their own names as the council writes them.
- **Turnout or rejected papers not given** in some declarations (Brent, Harrow, Merton, Sutton, Tower Hamlets; Hackney's rejected papers): the page says the declaration gave none.
- **Democracy Club limits how fast it is asked:** requests wait 1.5 seconds and retry with a pause when told to slow down.

## Lambeth (9 Oct 2026)

Added once its ModernGov service answered: it takes about 100 seconds, so requests now wait up to three minutes. Its list shows an empty seat as a councillor called "Vacancy", which is read as the empty seat it is. 62 councillors in 25 wards (one seat empty); three of May's winners are not on the council's list (Clapham Park and Streatham St Leonard's, each with a different councillor now listed; Myatt's Fields, where the seat is empty). Every non-exact pairing read: all correct. With Lambeth, 17 boroughs beyond Hammersmith & Fulham, 956 of their councillors.

## Manchester and Birmingham (9 Oct 2026)

The largest councils in Greater Manchester and the West Midlands, at `/manchester` and `/birmingham`, from the same returns and checks. What outside London needed, with every London borough's build unchanged byte for byte:

- **No Mayor of London.** The rest of the bill is split by the bodies that set it, from the government's own Tables 8d to 8f, this year and last, and must add up to what the area Band D leaves after the council's share. Manchester: police £285.30 and fire and the Mayor of Greater Manchester's other services £153.95 (Greater Manchester's £439.25 includes its police functions, note aa). Birmingham: West Midlands Police £244.50 and fire and rescue £85.19.
- **Parish and town councils.** The council tax requirement in Table 10 includes parish precepts (Birmingham: Sutton Coldfield and New Frankley, £2.68m); the checks now take them out, and the bill shown is what a home outside a parish pays, with the parishes' average Band D (£68.69) said beside it. Birmingham's budget return counts the parish precepts in its council tax line; the check accepts that, exactly. This also clears Westminster's parish check (Queen's Park) for later.
- **Elections by thirds** (Manchester): one seat per ward was elected in May 2026; the ward's other councillors were elected earlier. A May winner missing from the council's list is allowed only where a seat is empty.
- **No ModernGov service** (Birmingham, which uses another system): the councillors are May's 101 winners, as on the ballot papers, linked to their Democracy Club pages, and the page says changes since are not shown.
- **History** starts in 2023/24 outside London, because the 2022/23 band table was taken from its London sheet only.
- **Budget lines below zero** (Birmingham's planning and the local economy, a council tax deficit) cannot be drawn as a flow; they are named under the chart and kept in the tables.
- Names: hyphenated surnames now pair ("Grace Worrall" and "Grace Tudor-Worrall"); no earlier pairing changed.

## Leeds (9 Oct 2026)

At `/leeds`, from the same returns and checks: Band D £2,271.51, of which the council's £1,903.74, police £278.28 (set by the Mayor of West Yorkshire, Table 8d; Table 8f's West Yorkshire figure is the same police precept, so it is not added again) and fire £89.49 (Table 8e). 31 parish and town councils add £46.32 on average at Band D. Budget £1,828.0m.

- **Rounding.** The check that setting base × Band D = council tax requirement allowed £1,000; Band D is published to the penny, so a council with 250,000 Band D homes can be out by up to £1,250 from rounding alone. The allowance is now half a penny a home, never less than £1,000, so nothing that passed before can fail.
- **No councillors yet.** Leeds' ModernGov site (democracy.leeds.gov.uk) answers 403 to any request that is not a person's browser, its web service included. We do not get round that. Democracy Club has every Leeds election, but rebuilding the 99 seats from three years of thirds needs to know who left at the three double elections of May 2026 and the by-elections since (Calverley and Farsley is vacant until 22 October), which only the council's notices say. So the page has no Councillors section: it says why and links the council's list (`councillors_from: "later"` and `councillors_later` in the config), and a Leeds postcode in the finder opens the Leeds page.

## Seven more London boroughs (9 Oct 2026)

Croydon, Ealing, Kingston upon Thames, Lewisham, Newham, Wandsworth and Westminster, at `/<slug>`: 25 London boroughs and 3 cities. Every check passes, with one allowance and one new rule:

- **Council tax in the two returns.** The budget return (RA line 990, in £000) and the council tax return (Table 10) differ by £1,246 (Newham) to £3,071 (Wandsworth) in these seven; Westminster's matches to £1,541 once its parish precept is counted. The check allowed £1,000 and now allows £5,000, under 0.005% of any of them. Still held back: Islington (£23k), Bexley (£238k), Waltham Forest (£306k), Barnet (£4.7m), Enfield (£13.5m), Greenwich (no council tax line in its budget return) and Hillingdon (a line reported as "...").
- **Mayors.** Croydon (Jason Perry, Conservative), Lewisham (Liam Shrivastava, Green) and Newham (Forhad Hussain, Labour) are run by mayors elected on 7 May 2026, from their ballots. Newham lists its mayor under a heading called just "Ward", now skipped like the other mayors' headings.
- **A councillor may only have left where there was a by-election.** A May winner who is not on the council's current list was shown as "no longer on the council's list" whenever a councillor who joined since could account for it. Now that is allowed only where the ward held a by-election since May, from Democracy Club's register of elections (fetched with the ballots, cited as a source on every borough). All 11 such winners are in wards that held one: Camden 1, Ealing 1, Hackney 2, Haringey 2, Lambeth 3, Lewisham 1 (the winner became mayor), Wandsworth 1. Where a ward held none, the one listed councillor we could not pair is May's winner under another name, and is paired with a note (Croydon, New Addington North: "Afuah Ahorgah-Dorfia" on the ballot, "Afuah Asantewaa Agyemang" on the council's list); more than one stops the build.
- **Smaller things.** Kingston writes every ward as "Alexandra Ward"; the word is dropped. Party groups written as "Lewisham Green Party Group" are Green and "Independent Member" is Independent. Where Democracy Club recorded a result as heard "At the count" (Ealing, North Hanwell) rather than with the declaration's address, the ward links Democracy Club's page for the ballot.

No earlier borough's figures or councillors changed; each gained the by-election register as a source.

## Glasgow: the first council in Scotland (9 Oct 2026)

Glasgow City Council at `/glasgow`, built by `etl/scotland.py` from Scotland's own sources, with Scotland's own rules (`data/config/rules_scotland.json`). Band D £2,358.32 = council £1,706.00 + Scottish Water £652.32 (water £301.95, sewerage £350.37). Budget £2,235.9m. 85 councillors in 23 wards; no overall control (SNP 37, Labour 31).

What differs from England, and how it is checked:

- **Council tax bands** use Scotland's ratios, 240 to 882 over 360 (Local Government Finance Act 1992 s.74, as changed by SSI 2016/368). Every band in the Scottish Government's table must be Band D times its ratio; Band D must equal the five-year series.
- **No police or fire precept.** The rest of the bill is Scottish Water's water and sewerage charges, read from its own leaflets (page 5 tables; the server refuses scripted downloads, so they were read in a browser and their sha256 recorded). They keep the older ratios (Band H is twice Band D), so the bill calculator now applies the rest of the bill's own ratios where a nation's rules give them (`others_band_ratios`). Water plus sewerage must equal the leaflet's combined row and every band Band D times its ratio. Kept in `data/manual/scottish_water.csv`, approx until a person checks it.
- **Budget** from the Scottish Government's Provisional Outturn and Budget Estimates (POBE 2026, revised 24 July 2026), Glasgow's sheet, 2026-27 budget estimate. It gives each service after its own grants, so no funding is ring-fenced. Services are grouped in `data/manual/scot_service_groups.csv`; Social Work (£653.4m, almost all passed to the Health and Social Care Partnership, which runs adult and children's care with the NHS) is one group, "Social work and care", because the return does not split the partnership's money. Environmental Services is split into waste (with streets) and regulation, which must add back to its total. Funding: council tax after Council Tax Reduction (£314.4m, the same basis as England's), General Revenue Grant, the business rates pool's distribution, and £137.0m one-off (General Fund £64.8m, capital fund £61.7m, capital money £8.6m, other reserves £1.8m), which must equal the return's own deficit.
- **No referendum limit**, and **ten instalments** (May to February) under the Scottish regulations (approx: two amendments are not yet consolidated on legislation.gov.uk).
- **History**: council tax for five years from the Band D series; the whole bill only for 2025/26 and 2026/27, because Scottish Water's 2024/25 leaflet is an image.
- **Councillors** from the council's own Northgate CoInS pages (every member's ward, and each party's members, which must add up to the same 85). Glasgow last elected in May 2022 by single transferable vote; Democracy Club has the winners but not the counts, so the page shows each ward's councillors and not how it voted. Scottish party names: Scottish Labour is Labour, the SNP is "SNP", Scottish Greens are Green.
- English pages are unchanged; `etl/boroughs.py` builds England's only.

## Islington, Bexley and Waltham Forest (9 Oct 2026)

Published by the owner's decision although their two returns differ on council tax by more than rounding: Islington £23,227, Bexley £238,000, Waltham Forest £305,538 (budget return, RA line 990, against the council tax return, Table 10). `returns_differ: true` in the config records the decision; the build then requires the returns still to differ (once they agree, the flag must go) and keeps both figures in the statement. The budget uses the budget return's figure, so it adds up, and cites it; the bill uses the council tax return's; the page says both, to the pound, under the budget chart, and that we have not found the explanation. 28 London boroughs and 4 cities: 32 councils. Still held back: Barnet (£4.7m), Enfield (£13.5m), Greenwich (no council tax line in its budget return) and Hillingdon (a line reported as "...").

Councillors: Bexley Conservative (28 of 45), Islington Labour (32 of 51), Waltham Forest Green (31 of 60); every May winner paired with the council's list, and every pairing that was not an exact name read by a person (Claude): all the same people, written with middle names, titles or short forms.

## Edinburgh, Highland and North Yorkshire (9 Oct 2026)

35 councils: 28 London boroughs, 5 cities (Manchester, Birmingham, Leeds, Glasgow and Edinburgh) and 2 counties and regions (Highland and North Yorkshire), now a heading of their own in the picker ("Area" on their pages).

- **Edinburgh** (City of Edinburgh Council) and **Highland** (The Highland Council, headquarters in Inverness), by `etl/scotland.py` as Glasgow. Edinburgh budgets a £37.8m surplus that goes into its reserves; its note says "Put into council reserves". Highland runs adult care through NHS Highland rather than a joint board, has £4.6m of trading services surplus (now with "Running the council") and moves £2.0m into its council housing account (now in the reserves sum). Coast protection (Edinburgh) joined flood defence. Councillors: Edinburgh from its ModernGov ("Ward 1 - Almond"), Highland from its own councillors page; both elected in 2022 by single transferable vote, so no counts.
- **North Yorkshire** (North Yorkshire Council, since April 2023: Richmond, Northallerton, the Dales and the rest of the county), by `etl/boroughs.py`. Band D £2,488.80: council £2,036.32, police £335.86 and the rest of the Mayor of York and North Yorkshire's share £116.62 (the table does not say whether it is all fire, so it is not called that). 533 parishes, £56.97 on average. Two checks needed the government's rounding allowed for (the collection rate is published to four places: up to 13 Band D equivalents here); its first year, 2023-24, is revised in the next release to figures that do not add up, so that year's own release is used; 2022-23, before it existed, is left out. Councillors from its ModernGov: its 2022 counts are only partly on Democracy Club, so the page shows each division's councillors and says why; two councillors with no party are shown by the group the council lists them in ("NY Independent").
- **History**: where a council has parishes, the "whole bill" in the history table is now outside a parish, as the bill shows it (Birmingham, Leeds, Westminster, North Yorkshire: before, it averaged parish precepts in).

## Cardiff: the first council in Wales (9 Oct 2026)

Cardiff Council at `/cardiff`, built by `etl/wales.py` from StatsWales (its new service: `api.stats.gov.wales`, one filtered download per table, fingerprinted) with Wales's own rules (`data/config/rules_wales.json`). Band D £2,008.86 outside a community council: council £1,603.72, South Wales Police £405.14. Budget £1,238.1m. 79 councillors in 28 wards; Labour 50, in control. 36 councils.

- **Nine bands, A to I** (Local Government Finance Act 1992 s.5(1A), SI 2003/3046). The band list now has I, and each nation's rules say which bands it uses; England's and Scotland's stay A to H. 1,453 Cardiff homes are in Band I.
- **No fire precept.** The council pays South Wales Fire and Rescue a levy out of its own share, which StatsWales nets off the service lines. It is shown as its own line, "Fire and rescue (levy)", worked out as the financing table's gross revenue expenditure less the spending table's total (£25.5m, matching the fire authority's own figure), so the budget still balances.
- **Community councils.** Six of Cardiff's 36 communities have one (Lisvane, Old St Mellons, Pentyrch, Radyr and Morganstown, St Fagans, Tongwynlais). The official average Band D (£2,013.18) spreads them over every home; the bill shown is what a home outside them pays, and the note gives what they raise in all (£673,734) rather than an average no household pays. Their names are kept in the config as the council lists them.
- **Spending before specific grants.** StatsWales gives each service including what specific grants pay for (£318.1m, one funding line, not split by service), so the page says the "your bill pays for" split covers everything the council spends. Council tax is counted after Council Tax Reduction (£210.6m), as in England and Scotland. Business rates are Wales's shared pot, less the relief the council gives. Cardiff puts £7.2m into reserves this year.
- **Councillors** from Cardiff's ModernGov, paired with May 2022's winners from Democracy Club (votes for everyone, no turnout); the page says these are 2022's results and the next election is in May 2027. Six by-elections since; six 2022 winners are shown, not named, as no longer on the council's list. "Radyr and Morganstown" is the ballots' "Radyr" (`ward_aliases`). Welsh bilingual party names are read ("Welsh Labour / Llafur Cymru" is Labour) and shown by their English half.
- **A fix for every council, found here:** Democracy Club leaves ballot-paper names empty in some records (all of Cardiff's 2022; two 2026 wards), and an empty name used to match every councillor, so two winners in Ealing and Newham were named against each other's votes (fixed separately, PR #57). A test now checks every named winner against the ballot entry with their votes.

## Belfast: the first council in Northern Ireland (9 Oct 2026)

Belfast City Council at `/belfast`, built by `etl/northern_ireland.py` with Northern Ireland's own rules (`data/config/rules_northern_ireland.json`). 37 councils.

- **Rates, not council tax, and no bands.** A home's bill is its capital value (what it would have sold for on 1 January 2005, capped at £400,000) times two poundages: Belfast's district rate (0.4492p in the pound in 2026/27), which the council keeps, and the Executive's regional rate (0.5559p), which pays for the Executive's services. The page asks for the home's value, starting on the Department of Finance's average for Northern Ireland, £123,000 (there is none for Belfast): £1,236.27, of which the council keeps £552.52 (45%). The cap and the 20% Lone Pensioner Allowance (70 or over, living alone, by application) are in `packages/engine` (`ratesBill`) with tests. Bills on a given value are our arithmetic, marked modelled.
- **A narrower council.** No schools, care, roads, housing or libraries: the Executive runs them. The budget is the amount the council must raise from rates and grants after its own fees, charges and other grants: £227,760,695, by committee (People and Communities £111.2m, Strategic Policy and Resources £59.7m, capital financing £25.8m, City Growth and Regeneration £24.0m, a growth fund of £4.2m, Planning £3.0m), paid for by district rates (£220.4m, homes and businesses together) and the de-rating grant (£7.4m). No reserves used. The council's own report was a restricted item, so the lines are the committee's resolution in its minutes.
- **Sources read by hand, checked against each other.** The Department of Finance's rate poundages (an HTML table; 2022/23 and 2023/24 from the Internet Archive's copy), the Department for Communities' rate statistics circulars for four years (PDFs) and the committee's minutes (PDF), in `data/manual/ni_poundages.csv`, `ni_rate_statistics.csv` and `belfast_budget.csv` with page numbers. Every year's district rate must match in the Department of Finance's table and in two circulars; the domestic rate must be the business rate times Belfast's conversion factor; the penny product times the rate must give what the rate raises; the rate and the grants must add up to the amount to be raised; each year's amount must match in two circulars; and the committees must add up to it, with the growth fund (given only as "4.2m") as the difference. Rows are marked "checked" (by Claude), so every figure is approx until the owner looks at each table once and marks it "yes".
- **Councillors by district electoral area.** Belfast's 60 councillors represent 10 areas of five to seven seats, elected in May 2023 by single transferable vote; the next election is on 6 May 2027. From the council's ModernGov web service (`minutes.belfastcity.gov.uk`), whose snapshots also hold councillors' phone numbers and email addresses: they stay in `data/raw` (not committed), and only names, areas, parties and civic offices (Lord Mayor, Deputy Lord Mayor, High Sheriff) are published. A seat left empty is filled by the party's nominee, not a by-election, so the list includes them. Sinn Féin 22, DUP 14, Alliance 10, SDLP 4, Green 3, Independent 3, UUP 2, People Before Profit 1, TUV 1: no overall control. Northern Ireland's parties are matched by their full names, so the Social Democratic and Labour Party is the SDLP, not Labour.
- **Areas on the map and in the postcode finder.** postcodes.io gives a postcode's ward, not its area, so NISRA's ward to area lookup (`data/manual/ni_ward_dea.csv`) maps each of Belfast's 60 wards to its area (every ward lies wholly inside one); the finder says "area" there. Each area is drawn as its wards from the ONS boundaries, merged into one outline.
