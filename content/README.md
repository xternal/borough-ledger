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
* **One editor approves.** The AI Journalist (Claude, an AI) checks each quote word for word against its source; then the editor, Pavel Guzhikov, reads the card and approves it, and only then is `editor_check_required` set to `false`. One editor's approval is enough since 17 October 2026 (it was two editors, the owner and the AI Journalist, before; sign-offs already given stay valid). An approved card reads "Checked by the AI Journalist and approved by Pavel Guzhikov" (`packages/schema/src/editorial.ts`).
* **No personal data.** Councillors appear only in their public role: name, party, ward, posts and the link to their council profile. No photos, addresses, phone numbers or emails.

```bash
pnpm --filter @borough-ledger/schema content:build                  # compile after editing
pnpm --filter @borough-ledger/schema content:check                  # what CI runs
pnpm --filter @borough-ledger/schema content:append-only origin/main
pnpm --filter @borough-ledger/schema content:deadlines              # what the nightly job runs
pnpm --filter @borough-ledger/schema promises:quotes origin/main    # new quotes are in their sources word for word
pnpm --filter @borough-ledger/schema promises:manifesto conservative 10 12   # a manifesto's pages, SHA-256 checked
```

New pledges are found every two weeks by the pledge finder (`docs/PLEDGE_FINDER.md`), which opens a pull request for the editor.
