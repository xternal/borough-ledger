# CLAUDE.md — Borough Book

You are building **Borough Book** (boroughbook.uk; called Borough Ledger until 8 Oct 2026, a name the code packages `@borough-ledger/*`, the repo, the Vercel project and the RSS item ids keep), an independent, resident-facing view of the London Borough of Hammersmith & Fulham's money and promises: your council tax bill, the council's budget, how this year's gap was closed, a tool to balance next year, a promise ledger, and the payments-over-£500 ledger. Read `README.md`, `docs/PRE_SHIP_REVIEW.md`, `docs/PRD.md`, `docs/DATA_MODEL.md` and `docs/MODEL.md` before writing code.

The reference for look and behaviour is `prototype/index.html` (built from `prototype/template.html` + `data/seed/*.json` by `build_prototype.py`). Port it, including the visual direction in `docs/DESIGN_HANDOFF.md`.

## Non-negotiable invariants

1. **Every number has provenance.** Values come from an `Observation` with `source_id`, `vintage` and `quality ∈ {sourced, approx, modelled, test}`. No literal numbers in components. `test` values must render a visible mark and must be blocked from production builds by CI.
2. **The budget balances.** For every year and every scenario, funding (including reserves drawn) equals net spending. A scenario that does not balance is shown as "still to find", never silently balanced.
3. **Council rules are encoded, not implied.** Referendum limit, band ratios, single person discount and the balanced-budget rule live in config with sources, and are unit-tested.
4. **Reserves are one-off.** Any reserves used in year N reappear in the year N+1 gap in the medium-term view.
5. **Not the council.** No council logo, crest, colours, fonts or phrasing that could be mistaken for an official council service. Every page states that the project is independent.
6. **No personal data about residents.** Payments rows with redacted or personal payees are dropped or aggregated, never re-identified. Only councillors and officers named in official publications appear by name.
7. **One standard for every party.** No code path treats one party differently.
8. **Append-only promise history.** Rewording creates a new version; timeline events are never edited.
9. **Reading never requires an account.**
10. **No middle-dot (·) separators** anywhere in the UI. Use layout or commas.

## Stack

- **App:** Next.js (App Router) + TypeScript strict + Tailwind. d3 (`d3-sankey`, `d3-scale`) for charts.
- **Engine:** `packages/engine` in TypeScript: bill calculator, balance-it, medium-term view, promise costing. Pure functions, Vitest.
- **Data:** Python ETL in `etl/` → normalised JSON/Parquet in `data/build/` with a manifest, committed to git. DuckDB for the payments ledger.
- **Promises:** YAML in `content/promises/`, councillors in `content/councillors/`, Zod-validated, edited by pull request.
- **Follow/Contribute:** small Postgres for subscriptions and submissions only.
- **Hosting:** Vercel for the app; ETL in GitHub Actions.

## Repo layout (target)

```
apps/web/            Next.js app
packages/engine/     bill, balance-it, medium-term, costing + tests
packages/schema/     Zod schemas
etl/                 sources/*.py, normalise.py, redact.py, build.py
content/promises/    one YAML per pledge
content/councillors/ one YAML per councillor (from the council's democracy site)
data/seed/           prototype data (mostly test)
data/build/          ETL output
docs/                specs
prototype/           reference prototype
```

## Working rules

- Work milestone by milestone from `docs/BUILD_PLAN.md`; finish tests and acceptance criteria before moving on.
- Missing number → add to seed with `quality: "test"` or `"approx"` and a `TODO(source)` note. Never invent silently.
- Budget PDFs are the hardest source. Extract tables into versioned CSVs under `data/manual/` with a note of page numbers, and have a human check each table once. Do not trust automated PDF extraction without a checksum against the report's own totals.
- Copy: plain British English, active voice, resident's vocabulary ("bins", "care for older people"), not council jargon ("RO lines", "MTFS"); tooltips may give the official term.
