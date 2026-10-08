# Shared core with Public Ledger

Borough Book and Public Ledger (the national version) share ideas, a design system and a promise standard. Share code only once both exist and the overlap is proven ("rule of two").

## Build order

1. Build Borough Book as its own repo, mirroring Public Ledger's structure (`apps/web`, `packages/engine`, `packages/schema`).
2. When both have reached their M3 (promise ledger), extract a `ledger-core` package set:

| Package | Contents | Notes |
|---|---|---|
| `@ledger/schema` | Source, Observation, Quality, Range, Promise, PromiseVersion, PromiseEvent, Reply | Local adds Councillor, Ward, Payment; national adds Lever.controlled_by central_bank |
| `@ledger/promises` | Status ladders (configurable), append-only validator, deadline_missed job, share-image templates | Ladders differ: national "legislated, funded"; local "budgeted" plus "opposition pledge" |
| `@ledger/ui` | Tokens, quality marks, ranked rows, flow chart, waterfall, ladder, timeline, result panel | Same tokens; local adds GLA grey |
| `@ledger/alerts` | Change detection and fan-out (RSS, email, Telegram) | Identical |
| `@ledger/intake` | Submissions, archiving, quote matching, triage | Local adds leaflet photo handling |

## What stays separate

* Engines. National: static costings, debt path, macro ranges. Local: balanced-budget rule, council tax, reserves, medium-term gap. Different rules; forcing one engine would leak complexity both ways.
* ETL and sources.
* Brand, entity, funding and governance. Keep the borough project clear of any national political organisation.
