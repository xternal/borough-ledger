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
| `gap_2026-27.csv` | This year's waterfall from Table 2 (PDF page 17); one `report_total` row with the report's bottom line | Lines add up to the report's bottom line, which must be zero | Extracted 6 Oct 2026. [ ] Human check against page 17 |
| `next_year_2027-28.csv` | `minimum_safe_m` (bottom of the £19m to £23m optimal range, paragraph 83, PDF page 34) and `gap_m` (2027/28 gap) | Values present with a page | Safe minimum extracted. Gap waiting for Appendix B (medium term financial forecast), a separate document. [ ] Human check |
| `toggles_2027-28.csv` | Toggle costs modelled from the report, e.g. 20 extra law enforcement officers from £4.6m for 72 (PDF page 23) | Toggle ids exist | [ ] Human check |

Columns:

```
gap_2026-27.csv         order,label,m,kind,page,note       kind ∈ pressure, funding, close, close_saving, close_oneoff, report_total, report_gap (optional)
next_year_2027-28.csv   key,value,page,note                key ∈ gap_m, minimum_safe_m
```

Signs follow the waterfall: pressures positive, extra government funding negative, closing lines negative.
