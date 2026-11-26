/**
 * Pure rules behind the Network features (no I/O, unit-tested in tests/network.test.ts): which contacts are probably
 * the same person, what a merged contact keeps, and when a referral ask needs a follow-up.
 */
import type { Contact } from "./contact-fields.ts";
import { emailKey, nameKey, phoneKey } from "./contact-keys.ts";

export const REMINDER_AFTER_DAYS = 7;
export const ASK_AGAIN_AFTER_DAYS = 90;

export type ReferralStatus = "asked" | "replied" | "referred" | "declined";

export type DuplicateGroup = {
  reasons: string[];
  contacts: Contact[];
};

/**
 * Groups of contacts that are probably one person: same phone number (last 10 digits), same email, or the same name in
 * the same city. A name alone is never enough. Contacts linked through any of these end up in one group.
 */
export function groupDuplicates(contacts: Contact[]): DuplicateGroup[] {
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    let r = x;
    while (parent.get(r) !== r) r = parent.get(r)!;
    parent.set(x, r);
    return r;
  };
  const union = (a: string, b: string) => parent.set(find(a), find(b));
  for (const c of contacts) parent.set(c.id, c.id);

  const reasons = new Map<string, Set<string>>();
  const link = (key: string, reason: string, map: Map<string, string>, id: string) => {
    if (!key) return;
    const first = map.get(key);
    if (!first) return void map.set(key, id);
    union(first, id);
    for (const x of [first, id]) {
      if (!reasons.has(x)) reasons.set(x, new Set());
      reasons.get(x)!.add(reason);
    }
  };
  const byPhone = new Map<string, string>();
  const byEmail = new Map<string, string>();
  const byNameCity = new Map<string, string>();
  for (const c of contacts) {
    link(phoneKey(c.phone), "Same phone", byPhone, c.id);
    link(emailKey(c.email), "Same email", byEmail, c.id);
    const n = nameKey(c.name);
    const city = nameKey(c.city);
    if (n && city) link(`${n}|${city}`, "Same name and city", byNameCity, c.id);
  }

  const groups = new Map<string, Contact[]>();
  for (const c of contacts) {
    const r = find(c.id);
    if (!groups.has(r)) groups.set(r, []);
    groups.get(r)!.push(c);
  }
  return Array.from(groups.values())
    .filter((g) => g.length > 1)
    .map((g) => ({
      contacts: g.slice(0, 10),
      reasons: Array.from(new Set(g.flatMap((c) => Array.from(reasons.get(c.id) ?? [])))).sort(),
    }))
    .sort((a, b) => b.contacts.length - a.contacts.length);
}

const FILLABLE = [
  "phone",
  "email",
  "gender",
  "age",
  "date_of_birth",
  "occupation",
  "city",
  "income",
  "preferred_language",
  "lead_source",
  "last_contact_at",
  "next_followup_at",
  "organization_id",
  "referred_by_contact_id",
] as const;

/** What the kept contact looks like after a merge: blanks filled, tags combined, notes joined, best score, opt-ins kept. */
export function mergedPatch(
  keep: Record<string, unknown>,
  others: Record<string, unknown>[],
): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  const otherIds = new Set(others.map((o) => o.id));
  for (const f of FILLABLE) {
    if (keep[f] != null && keep[f] !== "") continue;
    const from = others.find(
      (o) => o[f] != null && o[f] !== "" && !(f === "referred_by_contact_id" && otherIds.has(o[f])),
    );
    if (from) patch[f] = from[f];
  }
  const tags = new Set<string>([
    ...((keep.tags as string[]) ?? []),
    ...others.flatMap((o) => (o.tags as string[]) ?? []),
  ]);
  patch.tags = Array.from(tags);
  const notes = [keep.notes, ...others.map((o) => o.notes)].filter(
    (n) => typeof n === "string" && n.trim(),
  ) as string[];
  if (notes.length > 1) patch.notes = Array.from(new Set(notes)).join("\n\n---\n\n");
  patch.lead_score = Math.max(
    Number(keep.lead_score) || 0,
    ...others.map((o) => Number(o.lead_score) || 0),
  );
  return patch;
}

export const daysAgo = (iso: string, now: number) => (now - new Date(iso).getTime()) / 86_400_000;

/** A standing ask (no answer recorded, reminder not dismissed) older than REMINDER_AFTER_DAYS needs a follow-up. */
export function needsFollowUp(
  a: { status: ReferralStatus; asked_at: string; reminder_dismissed_at: string | null },
  now = Date.now(),
) {
  return (
    a.status === "asked" &&
    !a.reminder_dismissed_at &&
    daysAgo(a.asked_at, now) >= REMINDER_AFTER_DAYS
  );
}
