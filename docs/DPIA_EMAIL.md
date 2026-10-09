# Data protection impact assessment: email alerts (draft)

**Status:** draft for the owner to complete and sign before `MAIL_PROVIDER=resend` is set (docs/EMAIL_ALERTS.md). Written 9 October 2026. Not legal advice.

## 1. What and why

Borough Book lets readers ask for an email when a council election pledge changes. A DPIA is needed because what someone follows can reveal their political opinions, which are special category data (UK GDPR Article 9), even though the pledges themselves are public.

* **Controller:** the person or company in `FOLLOW_CONTROLLER` (to be decided by the owner).
* **Processors:** Resend (email delivery; US company; sees each address and alert); Neon (database, London region); Vercel (hosting; request logs).
* **People affected:** members of the public who sign up. No one else: the alerts carry only public pledge information.
* **Lawful basis:** consent (Article 6(1)(a)), and explicit consent for the special category data (Article 9(2)(a)). PECR: the emails are only those the reader asked for, each with an unsubscribe link.

## 2. Data, and how long it is kept

| Data | Why | Kept |
|---|---|---|
| Email address, encrypted (AES-256-GCM) | to send alerts | until the reader stops; 7 days if never confirmed |
| HMAC of the address | to find a subscription without decrypting | as above |
| Pledges followed | to choose which alerts to send | as above |
| Consent wording version and time | to prove consent | as above |
| Confirmation and manage-link secrets (hashed) | double opt-in, manage without an account | as above |
| Which alerts went to whom | never to send twice | 35 days |
| Daily request counts per salted IP hash | to stop floods | one day; the salt is deleted |

Nothing else: no names, no IP addresses, no tracking pixels or rewritten links, no profiles, no follower counts shown.

## 3. Risks and measures

| # | Risk | Measures | Left over |
|---|---|---|---|
| R1 | A database leak reveals who follows which party's pledges | addresses encrypted, key held only in Vercel; lookups by keyed hash; no names | low |
| R2 | Someone signs up another person's address | double opt-in; additions to a confirmed address need the owner's confirmation; unconfirmed data deleted after 7 days | low |
| R3 | Someone floods an address or the form | 3 emails a day per address; 10 sign-ups a day per connection; proof-of-work spam check; replayed checks refused | low |
| R4 | The form reveals whether an address is subscribed | the same answer for every address | low |
| R5 | The email provider learns what readers follow | Resend sees each alert; contract and settings forbid other use; tracking off | medium: inherent in sending email |
| R6 | Transfer to the US (Resend) | owner to confirm Resend's transfer terms (UK Extension to the EU-US Data Privacy Framework, or IDTA) | owner to check |
| R7 | A manage link is forwarded | links say to keep them private; links can be revoked; they allow only removing or deleting | low |
| R8 | The encryption key is lost | owner keeps a copy offline; without it, readers can still delete via their links | low |
| R9 | Logs hold addresses | the code never logs an address or token; provider errors are scrubbed (`errorText`) | low |

## 4. Rights

Access and deletion through the manage link in every email, or by writing to the contact address; one-click unsubscribe deletes everything at once; complaints to the ICO, named in the privacy notice.

## 5. Sign-off (owner)

- [ ] Controller decided and set in `FOLLOW_CONTROLLER`
- [ ] ICO fee checked
- [ ] Resend's data processing terms and transfer basis checked (R6)
- [ ] Neon project created in London
- [ ] Open and click tracking off in Resend
- [ ] Encryption key copied somewhere safe offline
- [ ] Privacy notice (/privacy) read once with email on

Signed: ____________________ Date: ____________
