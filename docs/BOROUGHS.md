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

