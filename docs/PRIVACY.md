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

## Suppliers on the companies register

Supplier pages for companies and charities link to their entry on the companies register (`etl/companies_house.py`, from Companies House's free bulk file of live companies). Only register facts about the company are kept: its number, name, status, type, date formed and its own description of its business. The bulk file has no directors or other people. Of the registered office only the local authority area is kept, looked up from its postcode with postcodes.io; the address and postcode are never kept or shown, because a small company's registered office can be someone's home. Suppliers with no page (names that could be a person) are never matched.

## Ward election results

Ward pages show each candidate's party and votes at the May 2026 election. Only the candidates elected, who are councillors, are named, through the council's councillor records; everyone else appears as their party's candidate (`etl/elections.py`, checked in CI).

## Other boroughs

Every borough added (docs/BOROUGHS.md) follows the same rules: councillors from the council's own records with their public role only, election results naming only the councillors elected, and nothing about residents.

## Follow

* Channels: RSS (stores nothing) and email about pledges (double opt-in; stores the address, encrypted, and the pledges followed).
* RSS is live (8 Oct 2026): every feed is a static file built with the site, so nobody is logged as following anything, and feed links carry no tracking codes.
* Email is built (9 Oct 2026, ported from LedgerGov.uk) and switched off until the owner sets it up: docs/EMAIL_ALERTS.md says how it works and what to set, and docs/DPIA_EMAIL.md is the impact assessment to finish first. The privacy notice at /privacy names the controller once email is on.
* Follows can reveal political opinions, which are special category data under UK GDPR. Explicit consent at sign-up (the consent points sit above the button), minimal storage, no tracking in emails, one-click delete, a DPIA before launch.
* Follower counts are not shown anywhere. If they ever are: aggregate only, above 50, and never per ward below 50.

## Contribute

* New pledge (link, photo of a leaflet, time in a video) or evidence for a card.
* Anonymous allowed; optional email for credit or updates.
* Photos: strip EXIF and location before storage; blur any residents' faces or addresses if visible.
* No IP addresses stored; rate limiting uses a daily-salted hash.

## Finding your ward by postcode

* The lookup runs in the reader's browser. The postcode goes straight to postcodes.io (a free, open service using ONS data) in the body of an encrypted POST request, with no cookies and no referrer, so it never appears in an address, in our logs or in the page's URL afterwards.
* We never see the postcode and it is never stored. The ward page the reader lands on is the same for everyone in that ward.
* The same finder is the first thing on every council's page and works for every council on the site. A postcode in the council already open opens its ward. A postcode in another covered council opens that council's page at the top, and the name of the ward it found (never the postcode) is kept in the browser tab's session storage so the page can say "Your ward is ..."; it stays in that tab only, is never sent to us, and goes when the tab is closed. A postcode elsewhere is told which council it is in. The list of wards it checks against is part of the page, so nothing about the postcode is sent to us at any step.
* Readers who would rather not send a postcode anywhere can pick their ward on the map or the list.

## Council decisions

* Only the formal decision is kept: Cabinet's decision text, or for Full Council the resolution (the words after "RESOLVED"). The debate in the minutes, which can name members of the public who spoke, is never stored or shown.
* A name after a courtesy title (Mr, Mrs, Ms, Miss, Mx, Dr) is replaced with "[name removed]"; councillors and officers named in their role stay. CI checks this on every build.
* Decision text is sent to the Claude API only to suggest links; it is the council's published record and contains no personal data beyond that.

## Replies and corrections by email

* The site shows one address, boroughs@guzh.uk, for corrections and for replies from anyone named on a card.
* A published reply shows its text, the sender's public role (councillor, party) and the date; never an email address.
* Emails from residents are used only to check and make the correction. Nothing from them is published without asking, and the inbox is not used for any mailing.

## Accounts (later, optional)

Passkey or email link. Sync follows, submission history, optional public handle. No public profiles, no comments.
