# Privacy, follow and contribute

## Principles

1. No data about residents' finances. The bill calculator runs in the browser; band and discount choices are never sent.
2. No personal names except councillors and officers named in official publications.
3. Reading, calculating and sharing never need an account.

## Payments over £500

Councils redact payments to individuals (foster carers, direct-payment recipients, some sole traders). Rules:
* Drop or aggregate rows marked redacted, and rows whose payee looks like a private individual (no company or charity match and a personal-name pattern), per month and service.
* Never join payments with other data to infer who someone is.
* Supplier pages only for companies, charities and public bodies.

How `etl/payments.py` applies these rules (tested in `etl/tests/test_payments.py`):

* **Council redactions.** Rows the council marked "Personal Data - Name Redacted", "Individual Name redacted", "Redacted - Sensitive Supplier/Service", or with a location or address redacted, are matched as whole phrases and never reach `data/build/`. A real company with "redact" in its name is not caught.
* **People the council did not redact.** A payee is held back if it has a title (Mr, Mrs, Dr, Sir and so on) and no organisation word, or looks like a first name or initial and a surname and nothing else ("John Smith", "J Smith", "Smith, John").
* **Payments that usually go to individuals** (direct payments, foster and kinship allowances, help for children in need under section 17, support allowances): the payee is shown only if its name marks it as a company, charity or public body.
* **Sole traders** written as "Name T/A Business" appear by the trading name only.
* Held-back rows are added up per month, service group and reason (`redacted` or `person`), and only those totals are published. A month's total still adds back up to the council's file.
* Supplier pages only for names that mark a company (Ltd, plc, LLP, CIC), a charity or a public body. Other organisations appear in the month tables without a page.
* When in doubt, hold back: a business named after a person may be shown only as a total. That loses a little detail and never names anyone.

## Follow

* Channels: RSS (stores nothing), email (double opt-in; stores email + followed IDs).
* Follows can reveal political opinions, which are special category data under UK GDPR. Explicit consent at sign-up, minimal storage, no tracking in emails, one-click delete, DPIA before launch.
* Local numbers are small: show aggregate follower counts only above 50, and never per ward below 50.

## Contribute

* New pledge (link, photo of a leaflet, time in a video) or evidence for a card.
* Anonymous allowed; optional email for credit or updates.
* Photos: strip EXIF and location before storage; blur any residents' faces or addresses if visible.
* No IP addresses stored; rate limiting uses a daily-salted hash.

## Finding your ward by postcode

* The lookup runs in the reader's browser. The postcode goes straight to postcodes.io (a free, open service using ONS data) in the body of an encrypted POST request, with no cookies and no referrer, so it never appears in an address, in our logs or in the page's URL afterwards.
* We never see the postcode and nothing is stored. The ward page the reader lands on is the same for everyone in that ward.
* Readers who would rather not send a postcode anywhere can pick their ward on the map or the list.

## Replies and corrections by email

* The site shows one address, boroughs@guzh.uk, for corrections and for replies from anyone named on a card.
* A published reply shows its text, the sender's public role (councillor, party) and the date; never an email address.
* Emails from residents are used only to check and make the correction. Nothing from them is published without asking, and the inbox is not used for any mailing.

## Accounts (later, optional)

Passkey or email link. Sync follows, submission history, optional public handle. No public profiles, no comments.
