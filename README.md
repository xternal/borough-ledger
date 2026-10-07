# Borough Ledger: Hammersmith & Fulham

Working title. An independent, open view of a London borough's money and promises, built for residents. Separate project from Public Ledger (the national version), sharing its ideas and later its code.

Read `docs/PRE_SHIP_REVIEW.md` before anything goes public. Almost every number in the prototype is test data.

## 1. The idea

Your council tax bill is the only statement most residents ever get from their council, and it says almost nothing. Borough Ledger turns it into a readable account:

1. **Your bill.** Pick your band, see what you pay, how much goes to the council and how much to the Mayor of London, and what your share pays for.
2. **The budget.** Where the council's money comes from (council tax, business rates, government grants, reserves) and what it pays for.
3. **The gap.** Each year costs rise faster than funding. One chart shows what opened the gap and how it was closed: council tax, savings, reserves.
4. **Balance it.** Next year's gap, with the real levers a council has. Residents see the trade-offs councillors face, including the 4.99% referendum limit and the one-off nature of reserves.
5. **Promises.** Every pledge from the administration and the opposition, costed per Band D home, with a timeline that ends in delivery or in silence.
6. **Payments over £500.** The council's monthly transparency files, searchable.

## 2. Why a borough, and why this one

* **People feel it.** Bins, parking, potholes, care for parents and council tax are more personal than national debt.
* **The data is standardised.** Every English council publishes payments over £500 under the Local Government Transparency Code and files the same revenue returns with central government. A product built for one borough can be switched on for others.
* **The council is a clean test.** Labour has run H&F since 2014 and held it in May 2026 with Stephen Cowan as leader, so the 2026 manifesto runs to 2030. The opposition has its own pledges to cost.
* **There's a hook.** In 2010 the council said it wanted to be "Britain's most transparent council".

## 3. What is different from the national version

| | National (Public Ledger) | Borough (this project) |
|---|---|---|
| The gap | Borrowed, adds to debt | Must be closed every year by law. Failure means a section 114 notice |
| Visual of the gap | Hatched borrowing flow | Waterfall: pressures → gap → council tax, savings, reserves |
| Who controls the levers | Government (and Bank of England) | Council controls council tax (capped), fees, savings, reserves. Government controls most funding |
| Your share | Income tax and NI | Council tax by band, with single person discount |
| Promise cost unit | £ per household | £ per Band D home and % of the council's budget |
| Opposition pledges | Costed | Costed and marked "Opposition pledge": cannot be delivered from opposition |
| Extra modules | Demography, macro | Payments over £500, ward view, council decisions |

## 4. MVP

In:
* Your bill, budget flow, gap waterfall for the current year, sourced from the budget report and government returns.
* Balance-it for next year with a 3-year medium-term view, so reserves visibly come back as a gap.
* Promise ledger: both parties' 2026 manifestos, costed, with timelines. Free home care as the first fully sourced card.
* Payments over £500 explorer from the monthly files, with service mapping and a redaction filter.
* Follow (RSS, email) and Contribute (send a leaflet photo, a link or evidence), no accounts.
* Methodology and sources page. Every figure labelled sourced, approx or test.

Out for v1: ward view (postcode → ward, councillors, local spend), council decisions tracker, other boroughs, accounts.

## 5. Roadmap

| Stage | Time | Result |
|---|---|---|
| M0 | 3 days | App scaffold, prototype ported, engine tests |
| M1 | 1 week | Real budget data: budget report tables, government revenue returns, council tax, settlement |
| M2 | 3 days | Balance-it with 3-year view and shareable scenarios |
| M3 | 1 week | Promise ledger with both manifestos and councillor pages |
| M4 | 4 days | Payments explorer on real monthly files, supplier pages, redaction rules |
| M5 | 4 days | Follow and Contribute (leaflet photos) |
| M6 | 4 days | Ward view: postcode lookup, councillors, ward promises, local reports |
| M7 | 4 days | Council decisions tracker from committee papers, linked to promises |
| M8 | 3 days | Second borough from the government returns alone |

Estimates are low-confidence until M0 is done.

## 6. Risks in one place

* Looking like the council. No council logo, colours or wording that suggests it is official. "Independent" on every page.
* Local election rules. Rules on third-party spending in local elections are tight. Get advice before the run-up to May 2030.
* Personal data in payments files. Some payments go to individuals (foster carers, direct-payment recipients, sole traders). Councils redact them; we must never re-identify them.
* Being "the resident scoring the council". One standard for both parties, right of reply, evidence for every status.
* Overlap with Public Ledger's political backers. Separate brand, separate entity, funding disclosed.

## 7. What is in the pack

| File | For | What |
|---|---|---|
| `HANDOVER_PROMPT.md` | Claude Code, designer | The kick-off prompts to paste or send |
| `CLAUDE.md` | Claude Code | Rules, stack, invariants |
| `docs/PRE_SHIP_REVIEW.md` | Everyone | What must change before public launch |
| `docs/PRD.md` | Product, engineering | Users, features, acceptance criteria |
| `docs/DATA_MODEL.md` | Engineering | Schemas |
| `docs/MODEL.md` | Engineering | Council finance rules and the balance-it engine |
| `docs/DATA_SOURCES.md` | Engineering | Where every dataset comes from |
| `docs/PROMISE_STANDARD.md` | Editors | How local pledges become cards |
| `docs/PRIVACY.md` | Product, legal | Personal data, follow, contribute |
| `docs/DESIGN_HANDOFF.md` | Designer | Screens, components, tokens |
| `docs/BUILD_PLAN.md` | Claude Code | Milestones with prompts |
| `docs/SHARED_CORE.md` | Engineering | What to share with Public Ledger, and when |
| `data/seed/*.json` | All | Prototype data, mostly test |
| `prototype/` | Design, engineering | Clickable prototype; `index.html` is built by `build_prototype.py` |

## 8. Running it

Node 22 (`.nvmrc`) and pnpm (version pinned in `package.json`).

```bash
pnpm install
pnpm dev                 # http://localhost:3000, test data allowed and marked
pnpm test                # schema, engine and web tests
pnpm typecheck
pnpm build:preview       # production build that may render test data, each value underlined in red, noindex
pnpm build:prod          # fails while any rendered value has quality "test"
pnpm --filter @borough-ledger/schema report:test-values   # every test value still in the data
pnpm --filter @borough-ledger/schema content:build        # compile content/ (promises, councillors) into data/build
python3 etl/councillors.py                                # refresh councillors and wards from the council's ModernGov service
```

| Path | What |
|---|---|
| `apps/web` | Next.js app. Every number renders through `<Num>`, which carries its quality and blocks test values in `build:prod` |
| `packages/schema` | Zod schemas for `data/seed` and `data/config/rules.json`, cross-checks, quality helpers |
| `packages/engine` | Bill, budget identity, waterfall, balance-it and costing. Pure functions with Vitest tests |
| `content/` | Promise cards, parties, councillors and wards in YAML, edited by pull request; see `content/README.md` |
| `data/config/rules.json` | Band ratios, single person discount, balanced budget rule, referendum limit, instalments, each with its legal source |

Vercel: set the build command to `pnpm --filter @borough-ledger/web vercel-build`. Production deployments run `build:prod`; previews run `build:preview`. Set `NEXT_PUBLIC_SITE_URL` once the domain is chosen.
