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

