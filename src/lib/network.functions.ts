/**
 * Network features on top of Contacts: duplicate finding and merging, bulk tags and the tag manager, full export, and
 * referral asks (ask an existing client to introduce people, track the answer, and link the people they referred).
 *
 * Every query is filtered by the signed-in advisor's user_id on top of RLS. Nothing here sends a message: a referral ask
 * is recorded only when the advisor clicks "I sent it" after sending it themselves.
 */
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Contact } from "./contact-fields";
import {
  ASK_AGAIN_AFTER_DAYS,
  daysAgo,
  groupDuplicates,
  mergedPatch,
  needsFollowUp,
  type ReferralStatus,
} from "./network-logic";

export { REMINDER_AFTER_DAYS, groupDuplicates, mergedPatch, needsFollowUp } from "./network-logic";
export type { DuplicateGroup, ReferralStatus } from "./network-logic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

const PAGE = 1000;
const MAX_CONTACTS = 50_000;
const MAX_IDS = 500;
const MAX_TAG = 40;

async function allContacts(db: Db, userId: string, columns = "*"): Promise<Contact[]> {
  const out: Contact[] = [];
  for (let from = 0; from < MAX_CONTACTS; from += PAGE) {
    const { data, error } = await db
      .from("contacts")
      .select(columns)
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    out.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return out;
}

/**
 * Protected actions (export, delete, merge) need the owner's PIN while one is set: the database says whether the PIN
 * was entered in the last few minutes. Contact deletes are also refused by the database itself (RLS).
 */
export async function requireOwnerUnlock(db: Db) {
  const { data, error } = await db.rpc("owner_actions_allowed");
  if (error) throw new Error(error.message);
  if (data === false) throw new Error("Owner PIN required: enter your PIN and try again.");
}

function checkIds(ids: unknown): string[] {
  if (!Array.isArray(ids) || !ids.length) throw new Error("Choose at least one contact");
  if (ids.length > MAX_IDS) throw new Error(`Choose at most ${MAX_IDS} contacts at a time`);
  const clean = Array.from(new Set(ids.map(String)));
  for (const id of clean) if (!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Invalid contact id");
  return clean;
}

function cleanTag(t: string): string {
  const v = String(t ?? "")
    .trim()
    .replace(/\s+/g, " ");
  if (!v) throw new Error("Tag can't be empty");
  if (v.length > MAX_TAG) throw new Error(`Tags can be at most ${MAX_TAG} characters`);
  return v;
}

// ── export ───────────────────────────────────────────────────────────────────────────────────────────────

export const exportAllContacts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireOwnerUnlock(context.supabase);
    return allContacts(context.supabase, context.userId);
  });

/** Lets the page check the PIN before exporting rows it already has (the "Export selected" button). */
export const checkOwnerUnlock = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireOwnerUnlock(context.supabase);
    return { ok: true };
  });

// ── duplicates ───────────────────────────────────────────────────────────────────────────────────────────

export const findDuplicateGroups = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const contacts = await allContacts(context.supabase, context.userId);
    return groupDuplicates(contacts).slice(0, 100);
  });

/**
 * Merge contacts into one. Nothing is lost: policies, tasks, activities and referral asks move to the kept contact,
 * people they referred now point at it, blanks are filled, tags combined and notes joined. The others are deleted last,
 * so a failure part-way leaves every record in place.
 */
export const mergeContacts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { keep: string; merge: string[] }) => data)
  .handler(async ({ data, context }) => {
    const db: Db = context.supabase;
    const userId = context.userId;
    const keepId = checkIds([data.keep])[0];
    const mergeIds = checkIds(data.merge).filter((id) => id !== keepId);
    if (!mergeIds.length) throw new Error("Choose at least one contact to merge");
    if (mergeIds.length > 9) throw new Error("Merge at most 10 contacts at a time");
    // Checked first: a merge ends by deleting contacts, so a locked account must not move anything part-way.
    await requireOwnerUnlock(db);

    const { data: rows, error } = await db
      .from("contacts")
      .select("*")
      .eq("user_id", userId)
      .in("id", [keepId, ...mergeIds]);
    if (error) throw new Error(error.message);
    const keep = rows?.find((r: Contact) => r.id === keepId);
    const others = (rows ?? []).filter((r: Contact) => r.id !== keepId);
    if (!keep || others.length !== mergeIds.length)
      throw new Error("Some of these contacts no longer exist");

    const move = async (table: string, column: string) => {
      const { error: e } = await db
        .from(table)
        .update({ [column]: keepId })
        .eq("user_id", userId)
        .in(column, mergeIds);
      if (e) throw new Error(e.message);
    };
    await move("policies", "contact_id");
    await move("tasks", "related_contact_id");
    await move("activities", "contact_id");
    await move("referral_asks", "contact_id");
    await move("contacts", "referred_by_contact_id");

    const patch = mergedPatch(keep, others);
    if (patch.referred_by_contact_id === keepId) patch.referred_by_contact_id = null;
    const { error: upErr } = await db
      .from("contacts")
      .update(patch)
      .eq("id", keepId)
      .eq("user_id", userId);
    if (upErr) throw new Error(upErr.message);

    const { error: delErr } = await db
      .from("contacts")
      .delete()
      .eq("user_id", userId)
      .in("id", mergeIds);
    if (delErr) throw new Error(delErr.message);

    await db.from("activities").insert({
      user_id: userId,
      contact_id: keepId,
      activity_type: "other",
      description:
        `Merged ${others.length} duplicate contact${others.length === 1 ? "" : "s"}: ${others
          .map((o: Contact) => o.name)
          .join(", ")}`.slice(0, 500),
    });
    return { kept: keepId, merged: others.length };
  });

// ── tags ─────────────────────────────────────────────────────────────────────────────────────────────────

export const bulkUpdateTags = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { ids: string[]; add?: string[]; remove?: string[] }) => data)
  .handler(async ({ data, context }) => {
    const db: Db = context.supabase;
    const ids = checkIds(data.ids);
    const add = (data.add ?? []).map(cleanTag);
    const remove = new Set((data.remove ?? []).map((t) => t.trim()));
    if (!add.length && !remove.size) throw new Error("Choose a tag to add or remove");
    const { data: rows, error } = await db
      .from("contacts")
      .select("id,tags")
      .eq("user_id", context.userId)
      .in("id", ids);
    if (error) throw new Error(error.message);
    let changed = 0;
    for (const r of rows ?? []) {
      const before: string[] = r.tags ?? [];
      const next = Array.from(new Set([...before.filter((t) => !remove.has(t)), ...add]));
      if (next.length === before.length && next.every((t, i) => t === before[i])) continue;
      const { error: e } = await db
        .from("contacts")
        .update({ tags: next })
        .eq("id", r.id)
        .eq("user_id", context.userId);
      if (e) throw new Error(e.message);
      changed += 1;
    }
    return { changed };
  });

export const listTagCounts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const rows = await allContacts(context.supabase, context.userId, "id,tags");
    const counts = new Map<string, number>();
    for (const r of rows) for (const t of r.tags ?? []) counts.set(t, (counts.get(t) ?? 0) + 1);
    return Array.from(counts, ([tag, count]) => ({ tag, count })).sort((a, b) =>
      a.tag.localeCompare(b.tag),
    );
  });

async function rewriteTag(db: Db, userId: string, from: string, to: string | null) {
  let changed = 0;
  for (;;) {
    const { data: rows, error } = await db
      .from("contacts")
      .select("id,tags")
      .eq("user_id", userId)
      .contains("tags", [from])
      .limit(PAGE);
    if (error) throw new Error(error.message);
    if (!rows?.length) break;
    for (const r of rows) {
      const next = Array.from(
        new Set((r.tags as string[]).map((t) => (t === from ? to : t)).filter(Boolean)),
      );
      const { error: e } = await db
        .from("contacts")
        .update({ tags: next })
        .eq("id", r.id)
        .eq("user_id", userId);
      if (e) throw new Error(e.message);
      changed += 1;
    }
    if (rows.length < PAGE) break;
  }
  return changed;
}

/** Rename a tag on every contact. Renaming to a tag that already exists merges the two. */
export const renameTag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { from: string; to: string }) => data)
  .handler(async ({ data, context }) => {
    const to = cleanTag(data.to);
    if (to === data.from) return { changed: 0 };
    return { changed: await rewriteTag(context.supabase, context.userId, data.from, to) };
  });

export const deleteTag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { tag: string }) => data)
  .handler(async ({ data, context }) => ({
    changed: await rewriteTag(context.supabase, context.userId, data.tag, null),
  }));

// ── referrals ────────────────────────────────────────────────────────────────────────────────────────────

const REFERRAL_STATUSES: ReferralStatus[] = ["asked", "replied", "referred", "declined"];
export type Channel = "whatsapp" | "sms" | "email";

export type ReferralAsk = {
  id: string;
  contact_id: string;
  channel: Channel | null;
  status: ReferralStatus;
  asked_at: string;
  responded_at: string | null;
  reminder_dismissed_at: string | null;
  note: string | null;
  contact: { id: string; name: string; phone: string | null; email: string | null } | null;
};

type MiniContact = Pick<
  Contact,
  | "id"
  | "name"
  | "phone"
  | "email"
  | "pipeline_stage"
  | "tags"
  | "whatsapp_opt_in"
  | "sms_opt_in"
  | "email_opt_in"
  | "preferred_channel"
> & { referred_by_contact_id: string | null; created_at: string };

export type ReferralOverview = {
  asks: ReferralAsk[];
  followUps: ReferralAsk[];
  suggestions: (MiniContact & { activePolicies: number })[];
  referred: (MiniContact & { referrer: string })[];
  progress: {
    asked: number;
    replied: number;
    referred: number;
    declined: number;
    referredContacts: number;
    referredWon: number;
  };
  totalContacts: number;
};

export const getReferralOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ReferralOverview> => {
    const db: Db = context.supabase;
    const userId = context.userId;
    const now = Date.now();
    const { data: asks, error } = await db
      .from("referral_asks")
      .select("*, contact:contacts!referral_asks_contact_id_fkey(id,name,phone,email)")
      .eq("user_id", userId)
      .order("asked_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);

    const contacts = (await allContacts(
      db,
      userId,
      "id,name,phone,email,pipeline_stage,tags,whatsapp_opt_in,sms_opt_in,email_opt_in,preferred_channel,referred_by_contact_id,created_at",
    )) as unknown as MiniContact[];
    const byId = new Map(contacts.map((c) => [c.id, c]));

    const { data: policies, error: pErr } = await db
      .from("policies")
      .select("contact_id")
      .eq("user_id", userId)
      .eq("status", "active")
      .limit(PAGE * 20);
    if (pErr) throw new Error(pErr.message);
    const active = new Map<string, number>();
    for (const p of policies ?? []) active.set(p.contact_id, (active.get(p.contact_id) ?? 0) + 1);

    const recentlyAsked = new Set(
      (asks ?? [])
        .filter((a: ReferralAsk) => daysAgo(a.asked_at, now) < ASK_AGAIN_AFTER_DAYS)
        .map((a: ReferralAsk) => a.contact_id),
    );
    // Happy clients first: anyone with an active policy or a won deal who hasn't been asked in the last 90 days.
    const suggestions = contacts
      .filter((c) => !recentlyAsked.has(c.id) && (c.pipeline_stage === "won" || active.has(c.id)))
      .map((c) => ({ ...c, activePolicies: active.get(c.id) ?? 0 }))
      .sort((a, b) => b.activePolicies - a.activePolicies || a.name.localeCompare(b.name))
      .slice(0, 50);

    const referred = contacts
      .filter((c) => c.referred_by_contact_id)
      .map((c) => ({
        ...c,
        referrer: byId.get(c.referred_by_contact_id!)?.name ?? "Deleted contact",
      }))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));

    const list: ReferralAsk[] = asks ?? [];
    const count = (s: ReferralStatus) => list.filter((a) => a.status === s).length;
    return {
      asks: list,
      followUps: list.filter((a) => needsFollowUp(a, now)),
      suggestions,
      referred: referred.slice(0, 200),
      progress: {
        asked: list.length,
        replied: count("replied"),
        referred: count("referred"),
        declined: count("declined"),
        referredContacts: referred.length,
        referredWon: referred.filter((c) => c.pipeline_stage === "won").length,
      },
      totalContacts: contacts.length,
    };
  });

export const listReferralsForContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { contact_id: string }) => data)
  .handler(async ({ data, context }) => {
    const db: Db = context.supabase;
    const id = checkIds([data.contact_id])[0];
    const [{ data: asks, error: e1 }, { data: referred, error: e2 }] = await Promise.all([
      db
        .from("referral_asks")
        .select("*")
        .eq("user_id", context.userId)
        .eq("contact_id", id)
        .order("asked_at", { ascending: false }),
      db
        .from("contacts")
        .select("id,name,pipeline_stage,created_at")
        .eq("user_id", context.userId)
        .eq("referred_by_contact_id", id)
        .order("created_at", { ascending: false }),
    ]);
    if (e1) throw new Error(e1.message);
    if (e2) throw new Error(e2.message);
    return {
      asks: (asks ?? []) as Omit<ReferralAsk, "contact">[],
      referred: (referred ?? []) as Pick<
        Contact,
        "id" | "name" | "pipeline_stage" | "created_at"
      >[],
    };
  });

/** Record an ask the advisor already sent themselves. */
export const recordReferralAsk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { contact_id: string; channel?: Channel | null; note?: string | null }) => data,
  )
  .handler(async ({ data, context }) => {
    const db: Db = context.supabase;
    const id = checkIds([data.contact_id])[0];
    const { data: c, error: cErr } = await db
      .from("contacts")
      .select("id,name")
      .eq("id", id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!c) throw new Error("Contact not found");
    const channel =
      data.channel && ["whatsapp", "sms", "email"].includes(data.channel) ? data.channel : null;
    const { data: row, error } = await db
      .from("referral_asks")
      .insert({
        user_id: context.userId,
        contact_id: id,
        channel,
        note: data.note?.slice(0, 2000) || null,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    await db.from("activities").insert({
      user_id: context.userId,
      contact_id: id,
      activity_type: "other",
      description: `Asked for a referral${channel ? ` on ${channel}` : ""}`,
    });
    await db
      .from("contacts")
      .update({ last_contact_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", context.userId);
    return row;
  });

export const updateReferralAsk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      id: string;
      status?: ReferralStatus;
      note?: string | null;
      dismissReminder?: boolean;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const db: Db = context.supabase;
    const id = checkIds([data.id])[0];
    const patch: Record<string, unknown> = {};
    if (data.status) {
      if (!REFERRAL_STATUSES.includes(data.status)) throw new Error("Unknown status");
      patch.status = data.status;
      patch.responded_at = data.status === "asked" ? null : new Date().toISOString();
    }
    if (data.note !== undefined) patch.note = data.note?.slice(0, 2000) || null;
    if (data.dismissReminder) patch.reminder_dismissed_at = new Date().toISOString();
    const { data: row, error } = await db
      .from("referral_asks")
      .update(patch)
      .eq("id", id)
      .eq("user_id", context.userId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    if (data.status && data.status !== "asked") {
      await db.from("activities").insert({
        user_id: context.userId,
        contact_id: row.contact_id,
        activity_type: "other",
        description: `Referral ask marked "${data.status}"`,
      });
    }
    return row;
  });

export const deleteReferralAsk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    const id = checkIds([data.id])[0];
    const { error } = await context.supabase
      .from("referral_asks" as never)
      .delete()
      .eq("id", id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Link a contact to the client who referred them (or clear it). A contact can't refer themselves. */
export const setReferredBy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string; referred_by: string | null }) => data)
  .handler(async ({ data, context }) => {
    const db: Db = context.supabase;
    const id = checkIds([data.id])[0];
    let by: string | null = null;
    if (data.referred_by) {
      by = checkIds([data.referred_by])[0];
      if (by === id) throw new Error("A contact can't refer themselves");
      const { data: r } = await db
        .from("contacts")
        .select("id")
        .eq("id", by)
        .eq("user_id", context.userId)
        .maybeSingle();
      if (!r) throw new Error("Referrer not found");
    }
    const { error } = await db
      .from("contacts")
      .update({ referred_by_contact_id: by })
      .eq("id", id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
