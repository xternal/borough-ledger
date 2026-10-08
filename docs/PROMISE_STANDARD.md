# Promise standard (local)

Published and applied the same way to every party and councillor.

## 1. What counts

A commitment to a future, checkable change made by a party, councillor or candidate for the borough. Sources: manifestos, leaflets, hustings, council meetings, press statements, official social media.

## 2. Parameters

| Question | Example |
|---|---|
| Who benefits or pays | Older and disabled residents receiving home care |
| How much | £ a year (range), capital cost if any |
| When | Start date and/or deadline |
| From where | Named funding, or "not stated" |

Missing two or more, and not inferable from council documents within 7 days → **unscoreable**.

## 3. Ladder

```
promised → in plan → budgeted → delivering → delivered
                                      ↘ failed
       (any stage) ↘ quietly dropped
opposition pledge (separate)    unscoreable (separate)
```

| Status | Evidence |
|---|---|
| Promised | Archived primary source |
| In plan | Cabinet or committee decision, or a strategy adopted by the council |
| Budgeted | Line in the revenue budget or capital programme |
| Delivering | Service started, contract let, works on site |
| Delivered | Outcome met as worded |
| Failed | Deadline passed with evidence of non-delivery, or formally abandoned |
| Quietly dropped | Deadline passed, no statement, no evidence. Auto-flagged; confirmed by an editor after 30 days |
| Opposition pledge | Made by a party not in control. Costed; tracked if that party later takes control or the administration adopts it |

## 4. Costing

Use council figures first (budget report, cabinet papers). Otherwise a documented estimate with a range. Always show per Band D home and share of the net budget. A promise to freeze or cut council tax is costed as the income forgone.

## 5. Rewording, reply, process

* Rewording → new version, visible diff.
* Right of reply for any councillor or party, published within 5 working days. Replies and corrections go to boroughs@guzh.uk, which every card and footer shows; a reply is added to the card's `replies` as sent, with the sender's public role and the date.
* Two editors per merge. Reader submissions go to triage; volume never changes a status.
* Editors declare party membership and residence ward. Cards about a party an editor belongs to need a second editor from outside it.
* Quarterly audit of a 10% sample by someone outside the project.

## 6. Which pledges get a card

The same rule for every party, so nobody chooses the easy pledges for one side and the hard ones for the other.

* **Manifestos:** each party's own headline pledges, as the party marks them. For May 2026 that is the eight pledges on page 2 of Labour's manifesto and the nine "Key commitment" boxes in the Conservative manifesto. Other manifesto pledges get cards when an editor has capacity, taking each manifesto in page order.
* **Who is the administration** comes from seats in the council's own records (more than half the seats), never from a party name. With no overall control, every party's pledges are opposition pledges.
* **Starting status:** the administration's pledges start at "promised" and move up only on evidence from council papers. Opposition pledges are "opposition pledge" (`not_in_power`).
* **Quotes** are copied exactly as printed, typos included, with the PDF page. The manifesto is archived (Wayback Machine) and its SHA-256 recorded in `content/parties.yaml`.
* **Order on the site:** newest first, then by id. No party is listed first by design.
* **Editor check:** cards drafted by the build carry `editor_check_required: true` and show "Awaiting editor check" until two editors have read each quote against the page and applied the 7-day unscoreable rule (§2).
