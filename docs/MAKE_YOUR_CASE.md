# Make your case

A panel that turns a figure into something a resident can act on, live for Hammersmith & Fulham on three subjects: care for adults (under "What care for adults costs" on `/`), council tax next year (`/council-tax-rise`, "Have your say") and next year's budget (under Balance it, on `/` and `/balance`). Decided by the owner on 11 Oct 2026.

## What it shows

1. **Who decides.** What the law requires, what the government decides, what the council chooses, each with its source (`data/manual/make_your_case.csv`). This keeps residents from asking the council for what only Parliament can change, and the reverse.
2. **How it compares** (care only so far). The council's costs among similar councils from the government's own averages, and who the money is for. Costs only: satisfaction with care and the regulator's rating are not on the site yet, and the panel says so.
3. **What you can do, and by when.** The council's consultation, writing to councillors, a question to Full Council (the next open deadline, worked out in the reader's browser), petitions, deputations, Freedom of Information requests (pre-filled on WhatDoTheyKnow), and the MP where it is the government's part.
4. **A letter.** The reader chooses what they want, who to write to (their ward councillors by postcode, or those who lead on it for each side), which figures to include, and writes a sentence or two of their own. The letter lists each figure's source once, and ends with what is open now and when it is decided.

## Rules it keeps

- **The same for every view and every party** (CLAUDE.md invariant 7). Every option is offered on the same terms ("spend more" asks how to pay for it; "spend less" asks what it would mean for people who rely on it). The administration's lead and each opposition party's spokesperson are offered side by side, found by the same rule (their role title).
- **In the reader's own words.** No letter without at least a sentence of their own (`MIN_OWN` in `apps/web/lib/letter.ts`): councillors weigh personal letters more, and it keeps the site from being used to send copies.
- **Nothing sent, stored or counted** (docs/PRIVACY.md, "Make your case"). The reader sends it themselves.
- **Not the council.** Every step says where a message goes. The site runs no petitions and no campaigns of its own.
- **Every figure sourced.** Figures in the letter come from the same model as the page, never test values (`assertRenderable`).

## Each year

- Replace `data/manual/take_part_2026-27.csv` with the council's next deadlines when it publishes them; the panel says when this year's have passed.
- Link the council's consultation page in `budget_timetable_2027-28.csv` (`url` on the `engagement` row) when it opens.
- The owner reviews both tables once and marks the rows "yes".

## Later

Every service line and every council; results data (satisfaction, the regulator's ratings) beside costs; following a spending line by email (the Follow system handles pledges only today); an "Asked and answered" record of residents' questions at Full Council.
