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
| `gap_2026-27.csv` | This year's waterfall from Table 2 of the Full Council report (PDF pages 16 and 17); one `report_total` row with the report's bottom line | Lines add up to the report's bottom line, which must be zero | Extracted 6 Oct 2026. [x] Human check: checked against the PDF by the project owner, 6 Oct 2026 |
| `next_year_2027-28.csv` | 2027/28 gap £31.4m, the 4.99% council tax rise and £98.2m council tax it assumes, £8.0m planned savings (Appendix B Table 2, Cabinet pack page 57); safe minimum £19m (Full Council report, paragraph 83, page 35); fees and charges income £80.5m (Appendix I, pack page 128, added after the human check). Each row names its source | Source ids exist; values carry a page | Extracted 6 Oct 2026. [x] Human check: checked against the PDF by the project owner, 6 Oct 2026 |
| `savings_2026-27.csv` | Every named saving in Appendix C (Cabinet pack pages 61 to 66), £000, this year and next, with each directorate's total row | Lines add up to each directorate total in both years; service savings £9,524k match Table 2's £9.5m | Extracted 6 Oct 2026. [x] Human check: checked against the PDF by the project owner, 6 Oct 2026 |
| `toggles_2027-28.csv` | Toggle costs modelled from the report, e.g. 20 extra law enforcement officers from £4.6m for 72 (PDF page 23) | Toggle ids exist | [ ] Human check |

Columns:

```
gap_2026-27.csv         order,label,m,kind,page,note       kind ∈ pressure, funding, close, close_saving, close_oneoff, report_total, report_gap (optional)
next_year_2027-28.csv   key,value,source_id,page,note      key ∈ gap_m, ct_assumed_pct, council_tax_m, planned_savings_m, minimum_safe_m, fees_income_m
savings_2026-27.csv     id,directorate,service,label,k_2026_27,k_2027_28,kind,service_group,page   kind ∈ service, collection_fund, total
```

Signs follow the waterfall: pressures positive, extra government funding negative, closing lines negative.
