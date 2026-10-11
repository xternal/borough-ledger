"use client";

import { useEffect, useId, useState, type ReactNode } from "react";
import type { CaseSetup } from "@/lib/makeYourCase";
import { FOI_BODY, WRITE_TO_THEM } from "@/lib/caseLinks";
import { MIN_OWN, closingLine, dayMonth, dayMonthYear, draftLetter, foiHref, listOf, londonNoon, mailtoHref, nextQuestion, type LetterFact } from "@/lib/letter";
import { lookupWard } from "@/lib/wardFinder";
import { QualityGroup } from "./QualityLegend";

export interface CaseWant {
  id: string;
  label: string;
  sentence: string;
}

const WHO_LABEL = { law: "The law", government: "The government", council: "The council" } as const;

/**
 * Make your case: who decides, how it compares, what a resident can do and by when, and a letter they write in their own
 * words. Everything happens in the reader's browser: the postcode goes only to postcodes.io (as on the rest of the site),
 * and the letter is copied, or handed to the reader's own email app or to WriteToThem. Borough Book never sees or sends
 * it (docs/PRIVACY.md). The same tools for every view: every choice of what to ask for, and both sides' councillors.
 */
export function MakeYourCase({
  id,
  setup,
  wants,
  facts,
  page,
  compare,
  intro,
  level = 2,
}: {
  id: string;
  setup: CaseSetup;
  wants: CaseWant[];
  facts: LetterFact[];
  /** The page the letter points to, so a councillor can check every figure. */
  page: string;
  compare?: ReactNode;
  intro?: ReactNode;
  level?: 2 | 3;
}) {
  const uid = useId();
  const H = level === 2 ? "h2" : "h3";
  const S = level === 2 ? "h3" : "h4";
  const [want, setWant] = useState<string | null>(null);
  const [to, setTo] = useState<"ward" | "leads">("ward");
  const [postcode, setPostcode] = useState("");
  const [ward, setWard] = useState<CaseSetup["wards"][number] | null>(null);
  const [finding, setFinding] = useState(false);
  const [found, setFound] = useState<string | null>(null);
  const [off, setOff] = useState<Record<string, boolean>>({});
  const [own, setOwn] = useState("");
  const [errors, setErrors] = useState<{ want?: string; to?: string; own?: string }>({});
  const [draft, setDraft] = useState<{ subject: string; body: string } | null>(null);
  const [copied, setCopied] = useState<"idle" | "copied" | "manual">("idle");
  // Dates that depend on today are worked out in the browser, so a page built days ago still says what is open now.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);

  const isOn = (f: LetterFact) => off[f.id] === undefined ? f.on : !off[f.id];
  const admin = setup.responsible.filter((r) => r.side === "administration");
  const opposition = setup.responsible.filter((r) => r.side === "opposition");
  const leads = [...admin, ...opposition];
  const q = now ? nextQuestion(setup.questions, now) : null;
  const today = now ? now.toISOString().slice(0, 10) : null;
  const e = setup.dates.engagement;
  const consultationState = !today || !e ? null : today < e.start ? "soon" : !e.end || today <= e.end ? "open" : "closed";

  const findWard = async () => {
    setFinding(true);
    setFound(null);
    const r = await lookupWard(postcode, setup.wards, setup.councilCode);
    setFinding(false);
    if (r.kind === "ward") {
      const w = setup.wards.find((x) => x.id === r.id) ?? null;
      setWard(w);
      setErrors((x) => ({ ...x, to: undefined }));
      setFound(w ? `${r.postcode} is in ${w.name} ward. Your councillors: ${listOf(w.councillors.map((c) => `${c.name} (${c.party})`))}.` : null);
    } else {
      setWard(null);
      setFound(
        r.kind === "elsewhere"
          ? `${r.postcode} is in ${r.district}, not Hammersmith & Fulham. You can still write to the councillors who lead on this.`
          : r.kind === "invalid"
            ? "That does not look like a full postcode, such as W6 9JU."
            : r.kind === "not_found"
              ? "We could not find that postcode. Check it and try again."
              : "The postcode service did not answer. Try again in a moment.",
      );
    }
  };

  const submit = () => {
    const next: typeof errors = {};
    if (!want) next.want = "Choose what you want first.";
    if (to === "ward" && !ward) next.to = "Find your ward by postcode, or choose the councillors who lead on this.";
    if (own.trim().length < MIN_OWN) next.own = "Add a sentence or two in your own words: what it means for you. Councillors give those letters most weight.";
    setErrors(next);
    if (Object.keys(next).length) {
      setDraft(null);
      return;
    }
    const w = wants.find((x) => x.id === want)!;
    setCopied("idle");
    setDraft(
      draftLetter({
        to: to === "ward" ? ward!.councillors.map((c) => c.name) : leads.map((c) => c.name),
        ward: to === "ward" ? ward!.name : null,
        subject: setup.subject,
        want: w.sentence,
        own,
        facts: facts.filter(isOn).map((f) => ({ text: f.text, source: f.source })),
        closing: closingLine(setup.dates, today ?? new Date().toISOString().slice(0, 10)),
        page,
      }),
    );
  };

  const copy = () => {
    if (!draft) return;
    navigator.clipboard?.writeText(`${draft.subject}\n\n${draft.body}`).then(
      () => setCopied("copied"),
      () => setCopied("manual"),
    ) ?? setCopied("manual");
  };

  const recipients = to === "ward" ? (ward?.councillors ?? []) : leads;

  return (
    <section id={id} aria-labelledby={`${id}-h`} className="myc">
      <div className="sec-head">
        <H id={`${id}-h`}>Make your case: {setup.subject.charAt(0).toLowerCase() + setup.subject.slice(1)}</H>
        <p>
          {intro ??
            "Want something to change? Here is who decides, how it compares, and how to tell the people who decide, in time for their decision."}
        </p>
      </div>
      <ol className="myc-steps">
        <li className="myc-step">
          <S>
            <span className="myc-n" aria-hidden="true">
              1
            </span>
            Who decides
          </S>
          <ul className="myc-who">
            {setup.who.map((w, i) => (
              <li key={i}>
                <span className={`myc-tag ${w.who}`}>{WHO_LABEL[w.who]}</span>
                <span>
                  {w.text}{" "}
                  <span className="small muted">
                    {w.sources.map((s, j) => (
                      <span key={s.url}>
                        {j ? ", " : ""}
                        <a href={s.url}>{s.title.split(":")[0]}</a>
                      </span>
                    ))}
                    {w.where ? `, ${w.where}` : ""}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <div className="qrow">
            <QualityGroup q={setup.whoQuality} text="Who decides: the law and the council's and government's own papers" />
          </div>
        </li>
        {compare ? (
          <li className="myc-step">
            <S>
              <span className="myc-n" aria-hidden="true">
                2
              </span>
              How it compares
            </S>
            {compare}
          </li>
        ) : null}
        <li className="myc-step">
          <S>
            <span className="myc-n" aria-hidden="true">
              {compare ? 3 : 2}
            </span>
            What you can do, and by when
          </S>
          <ul className="myc-actions">
            {e ? (
              <li>
                <b>Answer the council&rsquo;s consultation.</b>{" "}
                {consultationState === "closed"
                  ? `It ran from ${dayMonth(e.start)} to ${dayMonth(e.end ?? e.start)}.`
                  : `It runs from ${dayMonth(e.start)}${e.end ? ` to ${dayMonth(e.end)}` : ""}${consultationState === "open" ? ", and is open now" : ""}.`}{" "}
                {setup.consultationUrl ? <a href={setup.consultationUrl}>Take part</a> : "We will link the council's page here when it opens."}
              </li>
            ) : null}
            <li>
              <b>Write to your councillors,</b> or to those who lead on this for each side: the letter below.
              {leads.length ? (
                <>
                  {" "}
                  Leading on it:{" "}
                  {leads.map((r, i) => (
                    <span key={r.url}>
                      {i ? (i === leads.length - 1 ? "; and " : "; ") : ""}
                      <a href={r.url}>{r.name}</a> ({r.party}), {r.role}
                    </span>
                  ))}
                  .
                </>
              ) : null}
            </li>
            <li>
              <b>Ask a question at Full Council.</b> Anyone who lives, works or studies in the borough can put one question to the Leader or a Cabinet Member, in
              writing, by 12 noon seven working days before the meeting.{" "}
              {q ? (
                <>
                  Next: the meeting on {dayMonthYear(q.meeting)}, questions by 12 noon on {dayMonth(q.deadline)}. <a href={q.url}>Send a question</a>.
                </>
              ) : now ? (
                "There are no more meetings with public questions this year."
              ) : null}{" "}
              <a href={setup.takePart.url}>The council&rsquo;s rules</a>.
            </li>
            <li>
              <b>Start or sign a petition.</b>{" "}
              {setup.petitions.map((p, i) => (
                <span key={p.threshold}>
                  {i ? (i === setup.petitions.length - 1 ? " and " : ", ") : ""}
                  {p.threshold.toLocaleString("en-GB")}
                  {i ? "" : " signatures go"} to {p.leadsTo}
                </span>
              ))}
              . <a href={setup.petitions[0]!.url}>The council&rsquo;s petitions</a>.
            </li>
            <li>
              <b>Speak at a meeting.</b> Up to {setup.deputation.people} residents can {setup.deputation.what}. <a href={setup.deputation.url}>How</a>.
            </li>
            {setup.foi.length ? (
              <li>
                <b>Ask for a fact we do not have.</b> A Freedom of Information request must be answered within 20 working days. Ready to send, on WhatDoTheyKnow:{" "}
                {setup.foi.map((f, i) => (
                  <span key={f.title}>
                    {i ? ", " : ""}
                    <a href={foiHref(FOI_BODY, f.title, f.text)}>{f.label.charAt(0).toLowerCase() + f.label.slice(1)}</a>
                  </span>
                ))}
                .
              </li>
            ) : null}
            <li>
              <b>Where it is the government&rsquo;s part,</b> write to your MP. <a href={WRITE_TO_THEM}>WriteToThem</a> finds them from your postcode.
            </li>
          </ul>
          <div className="qrow">
            <QualityGroup q={setup.takePartQuality} text="Questions, petitions and deputations: the council's own rules and deadlines" />
          </div>
        </li>
      </ol>

      <form
        className="myc-letter"
        aria-labelledby={`${id}-letter-h`}
        noValidate
        onSubmit={(ev) => {
          ev.preventDefault();
          submit();
        }}
      >
        <S id={`${id}-letter-h`}>Write your letter</S>
        <p className="small muted">Written in your browser. We never see it or keep it: you send it yourself.</p>

        <fieldset>
          <legend>What do you want?</legend>
          <div className="seg" role="group" aria-label="What do you want?">
            {wants.map((w) => (
              <button
                key={w.id}
                type="button"
                aria-pressed={want === w.id}
                onClick={() => {
                  setWant(w.id);
                  setErrors((x) => ({ ...x, want: undefined }));
                }}
              >
                {w.label}
              </button>
            ))}
          </div>
          {errors.want ? <p className="myc-err">{errors.want}</p> : null}
        </fieldset>

        <fieldset>
          <legend>Who to</legend>
          <label className="check">
            <input type="radio" name={`${uid}-to`} checked={to === "ward"} onChange={() => setTo("ward")} />
            <span>Your ward councillors</span>
          </label>
          {to === "ward" ? (
            <div className="finder myc-finder">
              <label htmlFor={`${uid}-pc`}>Your postcode</label>
              <div className="finder-row">
                <input
                  id={`${uid}-pc`}
                  type="text"
                  autoComplete="postal-code"
                  autoCapitalize="characters"
                  spellCheck={false}
                  placeholder="Postcode, such as W6 9JU"
                  maxLength={10}
                  value={postcode}
                  onChange={(ev) => {
                    setPostcode(ev.target.value);
                    setFound(null);
                    setWard(null);
                  }}
                  onKeyDown={(ev) => {
                    if (ev.key === "Enter") {
                      ev.preventDefault();
                      void findWard();
                    }
                  }}
                />
                <button type="button" className="btn secondary" disabled={finding} onClick={() => void findWard()}>
                  {finding ? "Finding…" : "Find"}
                </button>
              </div>
              <p className={ward ? "finder-msg" : "finder-msg warn"} aria-live="polite">
                {found}
              </p>
              <p className="finder-note">Looked up in your browser with postcodes.io. We never see your postcode, and it is not put in the letter.</p>
            </div>
          ) : null}
          {leads.length ? (
            <label className="check">
              <input type="radio" name={`${uid}-to`} checked={to === "leads"} onChange={() => setTo("leads")} />
              <span>
                Those who lead on it: {listOf(leads.map((r) => `${r.name} (${r.party})`))}
              </span>
            </label>
          ) : null}
          {errors.to ? <p className="myc-err">{errors.to}</p> : null}
        </fieldset>

        {facts.length ? (
          <fieldset>
            <legend>Figures to include</legend>
            {facts.map((f) => (
              <label className="check" key={f.id}>
                <input type="checkbox" checked={isOn(f)} onChange={(ev) => setOff((x) => ({ ...x, [f.id]: !ev.target.checked }))} />
                <span>{f.label}</span>
              </label>
            ))}
          </fieldset>
        ) : null}

        <div className="myc-own">
          <label htmlFor={`${uid}-own`}>In your own words: what it means for you</label>
          <textarea
            id={`${uid}-own`}
            rows={4}
            value={own}
            onChange={(ev) => {
              setOwn(ev.target.value);
              setErrors((x) => ({ ...x, own: undefined }));
            }}
            aria-describedby={errors.own ? `${uid}-own-err` : undefined}
          />
          {errors.own ? (
            <p className="myc-err" id={`${uid}-own-err`}>
              {errors.own}
            </p>
          ) : null}
        </div>

        <div className="myc-row">
          <button type="submit" className="btn">
            Draft my letter
          </button>
        </div>
      </form>

      {draft ? (
        <div className="myc-draft" aria-live="polite">
          <p className="small muted">
            To: {listOf(recipients.map((r) => r.name))}. Subject: {draft.subject}
          </p>
          <pre>{draft.body}</pre>
          <div className="myc-row">
            <button type="button" className="btn" onClick={copy}>
              Copy the letter
            </button>
            <a className="btn secondary" href={mailtoHref(draft.subject, draft.body)}>
              Open in my email
            </a>
            <a className="btn secondary" href={WRITE_TO_THEM} target="_blank" rel="noopener noreferrer">
              Send with WriteToThem
            </a>
            <span className="small muted" aria-live="polite">
              {copied === "copied" ? "Copied" : copied === "manual" ? "Select the letter above and copy it." : null}
            </span>
          </div>
          <p className="small muted">
            Their email addresses are on their council pages:{" "}
            {recipients.map((r, i) => (
              <span key={r.url}>
                {i ? ", " : ""}
                <a href={r.url}>{r.name}</a>
              </span>
            ))}
            . WriteToThem sends it for you: paste the letter there, and it asks for your postcode and address itself.
          </p>
        </div>
      ) : null}
      {now && londonNoon(setup.questions[setup.questions.length - 1]?.deadline ?? "1970-01-01") < now ? (
        <p className="small muted">The council&rsquo;s deadlines here are for 2026/27; next year&rsquo;s come when the council publishes them.</p>
      ) : null}
    </section>
  );
}
