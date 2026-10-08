# Hand-made tables

Everything here is read by `etl/build.py`. Each table is checked automatically against the source's own totals, and **each needs one human check** before launch (CLAUDE.md). Tick the box in a pull request when you have checked one.

## Mappings (from government returns)

| File | What | Automatic check | Human check |
|---|---|---|---|
| `ra_service_map.csv` | Every line of the RA 2026-27 revenue account return mapped to a resident service group | Each RA section adds up to its TOTAL line; all mapped lines add up to REVENUE EXPENDITURE (line 900) | [x] Read the groups; are bins, parks, community safety and running the council where a resident would look?. Signed off by the project owner, 8 Oct 2026, after Claude's pre-check (PR #18). |
| `service_groups.csv` | Resident labels and descriptions for the service groups, with the official term | Every mapped group exists | [x] Plain words, no council jargon. Signed off by the project owner, 8 Oct 2026, after Claude's pre-check (PR #18). |
| `funding_map.csv` | RA financing lines and SG grant lines mapped to funding groups | SG lines add up to SG line 699 and RA line 904; all funding adds up to line 900 | [x] Which grants count as ring-fenced (schools, public health). Signed off by the project owner, 8 Oct 2026, after Claude's pre-check (PR #18). |
| `rs_outturn_map.csv` | Every line of the 2024/25 revenue summary outturn return (RS) mapped to a service group; environmental services split with RO5 detail | Service lines add up to TOTAL SERVICE EXPENDITURE; all lines to REVENUE EXPENDITURE; RO5 environmental total matches RS | [x] Same groups as the budget mapping?. Signed off by the project owner, 8 Oct 2026, after Claude's pre-check (PR #18). |
| `funding_groups.csv` | Funding labels, ring-fencing and one-off flags | Ring-fenced groups point at real service groups | [x] Labels. Signed off by the project owner, 8 Oct 2026, after Claude's pre-check (PR #18). |
| `payment_groups.csv` | Extra groups for payments outside the day-to-day budget: council homes (the ring-fenced housing account), building projects (capital) and "not yet classified" | Every group in the payments mapping exists | [x] Labels. Signed off by the project owner, 8 Oct 2026, after Claude's pre-check (PR #18). |
| `payments_service_map.csv` | Every service area in the council's spend files mapped to a service group. Drafted by `python3 etl/payments.py --draft-map` from keyword rules (`note` says which words matched); `reviewed` is `no` (keyword draft; a re-run re-drafts it), `checked` (read against the spend, kept) or `yes` (signed off by a person); `rows` and `total` show what each line moves | The build fails if any service area in a file has no line; every month adds back up to its file | Checked by Claude on 7 Oct 2026 (`reviewed=checked`): every line against what was bought and who was paid (the 299 lines that hold 99% of the money) or by name (the rest); 40 groups corrected, 26 lines noted `unsure:`. [x] Human check: the project owner read the 26 `unsure:` lines and signed off every line, 7 Oct 2026 (`reviewed=yes`). New lines from new files start as `reviewed=no` and need the same check |

Pre-check, 7 Oct 2026: Claude read every line of `ra_service_map.csv`, `rs_outturn_map.csv`, `funding_map.csv`, `funding_groups.csv`, `service_groups.csv` and `payment_groups.csv` against the 2026/27 RA and 2024/25 RS returns. One fix: the RS line for the dedicated schools grant reserve now sits under schools, as in the budget mapping (it is £0.0 in 2024/25, so no figure changed). Five doubts, all under £2.3m, are listed in PR #18 for the human checks above: climate change costs, Supporting People, housing benefit administration, the coroner's court and the London levies.

## Budget report tables (to extract)

The council's budget papers are behind a firewall that blocks scripts, so they are downloaded by hand into `data/raw/` and extracted by reading them. Record the page for every figure.

| File | What | Automatic check | Status |
|---|---|---|---|
| `gap_2026-27.csv` | This year's waterfall from Table 2 of the Full Council report (PDF pages 16 and 17); one `report_total` row with the report's bottom line | Lines add up to the report's bottom line, which must be zero | Extracted 6 Oct 2026. [x] Human check: checked against the PDF by the project owner, 6 Oct 2026 |
| `next_year_2027-28.csv` | 2027/28 gap £31.4m, the 4.99% council tax rise and £98.2m council tax it assumes, £8.0m planned savings (Appendix B Table 2, Cabinet pack page 57); safe minimum £19m (Full Council report, paragraph 83, page 35); fees and charges income £80.5m (Appendix I, pack page 128, added after the human check). Each row names its source | Source ids exist; values carry a page | Extracted 6 Oct 2026. [x] Human check: checked against the PDF by the project owner, 6 Oct 2026 |
| `savings_2026-27.csv` | Every named saving in Appendix C (Cabinet pack pages 61 to 66), £000, this year and next, with each directorate's total row | Lines add up to each directorate total in both years; service savings £9,524k match Table 2's £9.5m | Extracted 6 Oct 2026. [x] Human check: checked against the PDF by the project owner, 6 Oct 2026 |
| `toggles_2027-28.csv` | Toggle costs modelled from the report, e.g. 20 extra law enforcement officers from £4.6m for 72 (PDF page 23) | Toggle ids exist | [x] Human check: the £4.6m for 72 officers checked against PDF page 23 by Claude; signed off by the project owner, 8 Oct 2026 |

Columns:

```
gap_2026-27.csv         order,label,m,kind,page,note       kind ∈ pressure, funding, close, close_saving, close_oneoff, report_total, report_gap (optional)
next_year_2027-28.csv   key,value,source_id,page,note      key ∈ gap_m, ct_assumed_pct, council_tax_m, planned_savings_m, minimum_safe_m, fees_income_m
savings_2026-27.csv     id,directorate,service,label,k_2026_27,k_2027_28,kind,service_group,page   kind ∈ service, collection_fund, total
```

Signs follow the waterfall: pressures positive, extra government funding negative, closing lines negative.
