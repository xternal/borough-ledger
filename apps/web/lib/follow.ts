import "server-only";
import { emailEnabled, loadConfig } from "@borough-ledger/server";
import { consentPoints, type AlertItem, type DescribeTarget, type Target } from "@borough-ledger/server/follow";
import { promiseItems } from "./feeds";
import { buildModel } from "./model";
import { shorten } from "./rss";

/**
 * Email alerts about pledges (packages/server). Off unless MAIL_PROVIDER is set
 * (docs/EMAIL_ALERTS.md); while off, pages offer RSS only and nothing here
 * touches a database.
 */
export const EMAIL_ALERTS = emailEnabled();

/** What the email form shows above its button, naming who holds the data. Only called when email is on. */
export function consentForForm(): string[] {
  return consentPoints(loadConfig().controller);
}

const promises = () => new Map(buildModel().promises.map((p) => [p.id, p]));

/** A target's name in emails and on the manage page: the pledge's party and words. */
export const describeTarget: DescribeTarget = (t) => {
  if (t.kind === "all") return "Every pledge on Borough Book";
  const p = promises().get(t.id);
  return p ? `${p.partyShort} pledge: “${shorten(p.text, 90)}”` : `A pledge that has since been removed (${t.id})`;
};

/** Only pledges on the site can be followed. */
export function isKnownTarget(t: Target): boolean {
  return t.kind === "all" || promises().has(t.id);
}

export function targetHref(t: Target): string {
  return t.kind === "all" ? "/promises" : `/promise/${t.id}`;
}

/** Every pledge change the site publishes, as the pledge feeds give it: the daily alerts job's input. */
export function alertItems(): AlertItem[] {
  return buildModel().promises.flatMap((p) => promiseItems(p).map((i) => ({ guid: i.guid, promiseId: p.id, title: i.title, path: i.path, description: i.description })));
}
