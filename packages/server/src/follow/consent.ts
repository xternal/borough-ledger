/**
 * The consent text shown next to every email follow form (docs/PRIVACY.md:
 * explicit consent in plain words, because follows can reveal political
 * opinions, UK GDPR Art. 9). It names the controller (FOLLOW_CONTROLLER) and
 * the service that delivers the emails, and the form links the privacy notice
 * at /privacy under it.
 *
 * Changing the words means a new version: bump CONSENT_VERSION (the date the
 * text changed). Each subscription records the version it agreed to and when.
 * If the mail provider changes from Resend, change the words and the version too.
 */
export const CONSENT_VERSION = "2026-10-09";

/** One point per line; the form shows them as a list. */
export function consentPoints(controller: string): string[] {
  return [
    `${controller} runs Borough Book, independently of any council or party, holds your data and is responsible for it.`,
    "We store your email address, encrypted, and the list of pledges you follow. Nothing else: no name, no IP address, no tracking.",
    "We use it only to email you when a pledge you follow changes. Resend delivers our emails, so it sees each alert.",
    "What you follow can reveal your political opinions, so we treat it as sensitive data. We never show who follows what, and never share or sell our list.",
    "Every email has a link to stop alerts. Stopping deletes everything at once.",
  ];
}

/** Where the privacy notice lives, relative to the site. */
export const PRIVACY_PATH = "/privacy";
