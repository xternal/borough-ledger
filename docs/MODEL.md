# Council finance model

Simpler than the national model and stricter: a council must balance its day-to-day budget every year.

## 1. Council tax

```
council_element(band) = BandD_council × ratio(band) × (1 − 0.25 × single_person)
bill(band)            = (BandD_council + BandD_GLA) × ratio(band) × (1 − 0.25 × single_person)
ratio = {A:6/9, B:7/9, C:8/9, D:1, E:11/9, F:13/9, G:15/9, H:18/9}
yield = tax_base_BandD_equivalents × BandD_council × collection_rate
```
`tax_base` is after Council Tax Support and discounts, as set in the council's annual tax base report. 2026/27 Band D: council £1,009.00, GLA £510.51, total £1,519.51 (sourced). Tax base and collection rate are test values in the prototype.

## 2. Budget identity

```
Σ funding_i + reserves_drawn = Σ net_service_spend_j      (every year, every scenario)
```
Net spend = gross spend − fees and charges − ring-fenced grants (e.g. public health). Show gross on drill-down; the flow uses net.

## 3. The gap (current year waterfall)

```
gap = Σ pressures − Δ government funding
0   = gap − council_tax_increase − savings − reserves_used
```
All lines come from the budget report's medium-term financial strategy tables. The waterfall must close to £0.

## 4. Balance it (next year)

```
closed = ct_rise% × yield_per_1%  + fees% × fees_base × 1%
       + settlement% × core_grants × 1%
       + savings + reserves
       + Σ cost of service toggles switched off − Σ cost of toggles switched on
remaining = gap_next_year − closed
```
* `ct_rise` above the referendum limit (4.99% for London boroughs in 2026/27, set each year in the settlement) raises a flag; it is not blocked.
* Reserves: `reserves_left = general_reserves − reserves`; flag below the safe minimum the council's finance director sets in the budget report.
* Unbalanced (`remaining > 0`): explain the section 114 duty. Do not auto-balance.
* Static: no behavioural response to fee changes in v0. Fee elasticity is a v1 option with a source.

## 5. Medium-term view (v0.1)

```
gap_{t+1} = pressures_{t+1} − Δfunding_{t+1} + reserves_used_t + Σ one-off savings_t
```
Recurring choices (council tax rise, permanent savings) carry forward; one-off choices (reserves, one-off savings) come back.

How it is built (M2): the council's own medium-term forecast (budget Appendix B, Table 2) gives the cumulative gap for each year if nothing new is done: £31.4m in 2027/28 and £57.3m in 2028/29, assuming a 4.99% council tax rise each year. With choices made for next year:

```
year 1:    remaining = forecast_1 − recurring − one_off
year t>1:  remaining = forecast_t − recurring          (one-off money is not subtracted again, so it comes back)
recurring = council tax rise above the forecast's own + fees + settlement change + permanent savings + services stopped
one_off   = reserves used
reserves_left = general_reserves − reserves used        (spent once, stays spent)
```

This is the same as the formula above: the year-2 gap rises by the year-1 reserves. Simplifications: a higher council tax rise is carried forward as the same £ amount each year (no compounding), fee changes are static (no behavioural response, PRE_SHIP H5), and 2029/30 is shown as not forecast because the council does not publish it.

Scenario links: `/balance?s=ct:5.5,sv:3,rs:2,fe:2,st:-1,off:weekly_bins,on:extra_officers`. Only choices that differ from the start are written; unknown keys are ignored and values are clamped to each lever's range and snapped to its step.

## 6. Promise costing

* £ a year (range), per Band D equivalent home (`cost / tax_base`), share of net budget.
* Opposition pledges are costed the same way. A council tax freeze is costed as the income the expected rise would raise.
* Capital pledges (homes, trees, schemes) show capital cost and the annual borrowing cost (interest + minimum revenue provision) once the council's rate is sourced.

## 7. What is test data in the prototype

Funding lines except transitional relief; services except "Streets, waste, parks and transport"; the waterfall except the council tax line; all of balance-it (gap, yields, toggle costs, reserves); tax base; collection rate; all promises except free home care; all payments.
