import type { Config } from "./config";
import type { Db } from "./db";
import { encrypt } from "./crypto";

/**
 * Plain-text transactional mail. No HTML, no images, no tracking pixels, no
 * link rewriting (docs/PRIVACY.md). Every alert carries a one-click
 * unsubscribe header (RFC 8058).
 */
export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  /** One-click unsubscribe link for List-Unsubscribe; required for alerts. */
  unsubscribeUrl?: string;
}

export interface Mailer {
  send(message: MailMessage): Promise<void>;
}

function headers(m: MailMessage): Record<string, string> {
  return m.unsubscribeUrl
    ? { "List-Unsubscribe": `<${m.unsubscribeUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" }
    : {};
}

/** Development and tests: write to the mail_outbox table (address encrypted, like everywhere else). */
export function outboxMailer(db: Db, config: Config): Mailer {
  return {
    async send(m) {
      await db.query("INSERT INTO mail_outbox (to_enc, subject, body_text, headers) VALUES ($1, $2, $3, $4)", [
        encrypt(config.encryptionKey, m.to),
        m.subject,
        m.text,
        JSON.stringify(headers(m)),
      ]);
    },
  };
}

/**
 * Resend (MAIL_PROVIDER=resend): one HTTPS call per message, plain text only.
 * Open and click tracking are settings on the sending domain in Resend; keep
 * both off (docs/EMAIL_ALERTS.md). The error never includes the address.
 */
export function resendMailer(config: Config, fetchImpl: typeof fetch = fetch): Mailer {
  return {
    async send(m) {
      const res = await fetchImpl("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${config.mail.resendApiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: config.mail.from,
          to: [m.to],
          subject: m.subject,
          text: m.text,
          ...(config.mail.replyTo ? { reply_to: config.mail.replyTo } : {}),
          headers: headers(m),
        }),
      });
      if (!res.ok) {
        // Resend answers {"name": "...", "message": "..."}; keep the name only, as messages can echo the recipient.
        const name = await res
          .json()
          .then((b: unknown) => {
            const n = (b as { name?: unknown } | null)?.name;
            return typeof n === "string" ? n : "";
          })
          .catch(() => "");
        throw new Error(`Resend refused the message: HTTP ${res.status}${name ? ` ${name}` : ""}`);
      }
    },
  };
}

/** Email switched off (MAIL_PROVIDER=off): every send fails loudly, and the site hides its email options. */
export class MailDisabledError extends Error {
  constructor() {
    super("email is switched off on this site (MAIL_PROVIDER=off)");
    this.name = "MailDisabledError";
  }
}

export function offMailer(): Mailer {
  return {
    async send() {
      throw new MailDisabledError();
    },
  };
}

export function mailerFor(config: Config, db: Db): Mailer {
  if (config.mail.provider === "off") return offMailer();
  if (config.mail.provider === "resend") return resendMailer(config);
  return outboxMailer(db, config);
}
