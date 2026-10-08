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
