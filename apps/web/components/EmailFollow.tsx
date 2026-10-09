"use client";

import { useCallback, useId, useRef, useState, type FormEvent } from "react";
import { SpamCheck } from "./SpamCheck";

/**
 * Follow a pledge, or every pledge, by email: double opt-in, no account. The
 * consent points sit above the button, because what someone follows can reveal
 * their political opinions. Shown only when the site sends email
 * (MAIL_PROVIDER, docs/EMAIL_ALERTS.md); otherwise pages offer RSS only.
 */
export interface FollowTarget {
  kind: "promise" | "all";
  id: string;
}

type SendState = { kind: "idle" } | { kind: "sending" } | { kind: "sent"; message: string } | { kind: "error"; message: string; field?: "email" };
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function EmailFollow({ target, consent, heading }: { target: FollowTarget; consent: string[]; heading: string }) {
  const id = useId();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<SendState>({ kind: "idle" });
  // A solved spam check is accepted once; a new widget (new key) solves a fresh one for the next try.
  const [spamKey, setSpamKey] = useState(0);
  const payload = useRef<string | null>(null);
  const onPayload = useCallback((p: string | null) => {
    payload.current = p;
  }, []);
  const input = useRef<HTMLInputElement>(null);

  const waitForSpamCheck = async (ms = 10_000) => {
    const until = Date.now() + ms;
    while (!payload.current && Date.now() < until) await new Promise((r) => setTimeout(r, 150));
    return payload.current;
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (state.kind === "sending") return;
    if (!EMAIL.test(email.trim())) {
      setState({ kind: "error", field: "email", message: "Enter an email address, like name@example.com." });
      input.current?.focus();
      return;
    }
    setState({ kind: "sending" });
    const altcha = await waitForSpamCheck();
    if (!altcha) {
      setState({ kind: "error", message: "The spam check did not finish. Wait a moment and press the button again." });
      return;
    }
    payload.current = null;
    setSpamKey((k) => k + 1);
    try {
      const res = await fetch("/api/follow", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: email.trim(), targets: [target], altcha }),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string; field?: string };
      if (res.ok) setState({ kind: "sent", message: data.message ?? "Check your inbox to confirm." });
      else setState({ kind: "error", field: data.field === "email" ? "email" : undefined, message: data.message ?? "Something went wrong. Please try again." });
    } catch {
      setState({ kind: "error", message: "We could not reach the server. Check your connection and try again." });
    }
  };

  if (state.kind === "sent")
    return (
      <div className="email-follow">
        <p className="email-follow-done" role="status">
          {state.message}
        </p>
      </div>
    );

  return (
    <form className="email-follow" onSubmit={submit} noValidate aria-labelledby={`${id}-h`}>
      <p id={`${id}-h`} className="email-follow-h">
        {heading}
      </p>
      <ul className="email-follow-consent">
        {consent.map((c) => (
          <li key={c}>{c}</li>
        ))}
      </ul>
      <label htmlFor={`${id}-email`}>Your email address</label>
      <div className="finder-row">
        <input
          ref={input}
          id={`${id}-email`}
          type="email"
          autoComplete="email"
          spellCheck={false}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={state.kind === "error" && state.field === "email" ? true : undefined}
          aria-describedby={`${id}-msg`}
        />
        <button type="submit" className="btn" aria-disabled={state.kind === "sending" || undefined} disabled={state.kind === "sending"}>
          {state.kind === "sending" ? "Sending…" : "Email me"}
        </button>
      </div>
      <SpamCheck key={spamKey} onPayload={onPayload} />
      <p id={`${id}-msg`} className={state.kind === "error" ? "finder-msg warn" : "finder-msg"} aria-live="polite">
        {state.kind === "error" ? state.message : null}
      </p>
      <p className="finder-note">
        We send a link to confirm first. Who holds your data, and your rights: <a href="/privacy">privacy notice</a>.
      </p>
    </form>
  );
}
