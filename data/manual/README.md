# Hand-made tables

Everything here is read by `etl/build.py`. Each table is checked automatically against the source's own totals, and **each needs one human check** before launch (CLAUDE.md). Tick the box in a pull request when you have checked one.

## Mappings (from government returns)

| File | What | Automatic check | Human check |
|---|---|---|---|
| `ra_service_map.csv` | Every line of the RA 2026-27 revenue account return mapped to a resident service group | Each RA section adds up to its TOTAL line; all mapped lines add up to REVENUE EXPENDITURE (line 900) | [ ] Read the groups; are bins, parks, community safety and running the council where a resident would look? |
| `service_groups.csv` | Resident labels and descriptions for the service groups, with the official term | Every mapped group exists | [ ] Plain words, no council jargon |
| `funding_map.csv` | RA financing lines and SG grant lines mapped to funding groups | SG lines add up to SG line 699 and RA line 904; all funding adds up to line 900 | [ ] Which grants count as ring-fenced (schools, public health) |
| `funding_groups.csv` | Funding labels, ring-fencing and one-off flags | Ring-fenced groups point at real service groups | [ ] Labels |

## Budget report tables (to extract)

The council's budget papers are behind a firewall that blocks scripts, so they are downloaded by hand into `data/raw/` and extracted by reading them. Record the page for every figure.

| File | What | Automatic check | Status |
|---|---|---|---|
| `gap_2026-27.csv` | This year's waterfall: pressures, change in government funding, council tax rise, savings, reserves; one `report_gap` row with the gap as the report states it | Lines add up to the report's own gap; closing lines close it to zero | Waiting for `Revenue Budget and Council Tax Levels 2026-27.pdf` |
| `next_year_2027-28.csv` | `gap_m` (2027/28 gap from the medium-term plan) and `minimum_safe_m` (safe minimum level of reserves) | Values present with a page | Waiting for the same report |

Columns:

```
gap_2026-27.csv         order,label,m,kind,page,note       kind ∈ pressure, funding, close, close_saving, close_oneoff, report_gap
next_year_2027-28.csv   key,value,page,note                key ∈ gap_m, minimum_safe_m
```

Signs follow the waterfall: pressures positive, extra government funding negative, closing lines negative.
