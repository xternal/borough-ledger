# Content: promises, parties, councillors

Edited by pull request. `pnpm --filter @borough-ledger/schema content:build` compiles everything here into `data/build/content.json`, which the app reads. CI fails if that file is stale, if a card breaks a rule, or if history was rewritten.

| Path | What | How it changes |
|---|---|---|
| `parties.yaml` | Each party's 2026 manifesto: URL, archive, date, SHA-256 | By hand |
| `promises/<id>.yaml` | One card per pledge; the file name is the id | By hand, append-only |
| `councillors/<id>.yaml`, `wards.yaml` | Councillors, wards and posts from the council's ModernGov service, ward codes from Democracy Club | `python3 etl/councillors.py`; never by hand |

Rules (docs/PROMISE_STANDARD.md, docs/DATA_MODEL.md):

* **Append-only.** Never edit or delete an entry in `versions`, `events` or `replies`; add a new one. Rewording a pledge is a new version. `content:append-only` checks this against `main`.
* **Every version and event needs a source** with a URL and, for PDFs, a page.
* **Status follows seats.** The party with more than half the seats is the administration. An opposition card must be `not_in_power` or `unscoreable`; an administration card cannot be `not_in_power`.
* **Deadlines.** A nightly job (`.github/workflows/nightly-deadlines.yml`) adds a `deadline_missed` event to any open administration pledge whose deadline has passed. An editor confirms "quietly dropped" after 30 days.
* **No personal data.** Councillors appear only in their public role: name, party, ward, posts and the link to their council profile. No photos, addresses, phone numbers or emails.

```bash
pnpm --filter @borough-ledger/schema content:build                  # compile after editing
pnpm --filter @borough-ledger/schema content:check                  # what CI runs
pnpm --filter @borough-ledger/schema content:append-only origin/main
pnpm --filter @borough-ledger/schema content:deadlines              # what the nightly job runs
```
