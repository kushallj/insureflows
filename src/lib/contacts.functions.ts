import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type {
  Contact,
  ContactInput,
  PipelineStage,
  SortKey,
} from "./contact-fields";
import { emailKey, phoneKey } from "./contact-keys";

type ListArgs = {
  search?: string;
  stages?: PipelineStage[];
  tags?: string[];
  sort?: SortKey;
};

export const listContacts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: ListArgs) => data ?? {})
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    let q = supabase.from("contacts").select("*").eq("user_id", userId);

    if (data.stages && data.stages.length) q = q.in("pipeline_stage", data.stages);
    if (data.tags && data.tags.length) q = q.overlaps("tags", data.tags);
    if (data.search && data.search.trim()) {
      const s = data.search.trim().replace(/[%,]/g, "");
      const like = `%${s}%`;
      q = q.or(
        `name.ilike.${like},phone.ilike.${like},email.ilike.${like},city.ilike.${like}`,
      );
    }

    switch (data.sort ?? "lead_score_desc") {
      case "lead_score_asc":
        q = q.order("lead_score", { ascending: true });
        break;
      case "next_followup_asc":
        q = q.order("next_followup_at", { ascending: true, nullsFirst: false });
        break;
      case "next_followup_desc":
        q = q.order("next_followup_at", { ascending: false, nullsFirst: false });
        break;
      case "created_desc":
        q = q.order("created_at", { ascending: false });
        break;
      default:
        q = q.order("lead_score", { ascending: false });
    }
    q = q.limit(500);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows as Contact[];
  });

export const getContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("contacts")
      .select("*")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row as Contact | null;
  });

function cleanInput(input: ContactInput): Record<string, unknown> {
  const out: Record<string, unknown> = { ...input };
  for (const k of Object.keys(out)) {
    const v = out[k];
    if (v === "" || v === undefined) out[k] = null;
  }
  if (!out.tags) out.tags = [];
  return out;
}

export const createContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: ContactInput) => data)
  .handler(async ({ data, context }) => {
    if (!data.name || !data.name.trim()) throw new Error("Name is required");
    const payload = { ...cleanInput(data), user_id: context.userId, name: data.name.trim() };
    const { data: row, error } = await (context.supabase.from("contacts") as any)
      .insert(payload)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as Contact;
  });

export const updateContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string; patch: Partial<ContactInput> }) => data)
  .handler(async ({ data, context }) => {
    const patch = cleanInput(data.patch as ContactInput);
    delete patch.user_id;

    // Read prior stage to log stage_change activity
    let priorStage: string | null = null;
    if (patch.pipeline_stage) {
      const { data: prior } = await context.supabase
        .from("contacts")
        .select("pipeline_stage")
        .eq("id", data.id)
        .eq("user_id", context.userId)
        .maybeSingle();
      priorStage = (prior?.pipeline_stage as string | undefined) ?? null;
    }

    const { data: row, error } = await (context.supabase.from("contacts") as any)
      .update(patch)
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    if (patch.pipeline_stage && priorStage && priorStage !== patch.pipeline_stage) {
      await (context.supabase.from("activities") as any).insert({
        user_id: context.userId,
        contact_id: data.id,
        activity_type: "stage_change",
        description: `Stage changed from ${priorStage} to ${patch.pipeline_stage}`,
      });
    }
    return row as Contact;
  });

export const deleteContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("contacts")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getDistinctTags = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("contacts")
      .select("tags")
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    const set = new Set<string>();
    for (const r of data ?? []) for (const t of (r.tags as string[]) ?? []) set.add(t);
    return Array.from(set).sort();
  });

export const getDuplicateKeys = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Read every contact in pages: a single select stops at the API's 1,000-row limit, which missed duplicates.
    const data: { phone: string | null; email: string | null }[] = [];
    for (let from = 0; from < 50_000; from += 1000) {
      const { data: page, error } = await context.supabase
        .from("contacts")
        .select("phone,email")
        .eq("user_id", context.userId)
        .order("created_at", { ascending: true })
        .range(from, from + 999);
      if (error) throw new Error(error.message);
      data.push(...(page ?? []));
      if (!page || page.length < 1000) break;
    }
    const phones = new Set<string>();
    const emails = new Set<string>();
    for (const r of data ?? []) {
      // Normalised keys, so "+91 98765 43210" and "9876543210" count as the same number.
      const p = phoneKey(r.phone as string | null);
      const e = emailKey(r.email as string | null);
      if (p) phones.add(p);
      if (e) emails.add(e);
    }
    return { phones: Array.from(phones), emails: Array.from(emails) };
  });

export const bulkCreateContacts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { rows: ContactInput[] }) => data)
  .handler(async ({ data, context }) => {
    const rows = (data.rows ?? [])
      .filter((r) => r.name && r.name.trim())
      .map((r) => ({ ...cleanInput(r), user_id: context.userId, name: r.name.trim() }));
    if (!rows.length) return { inserted: 0 };
    let inserted = 0;
    for (let i = 0; i < rows.length; i += 200) {
      const chunk = rows.slice(i, i + 200);
      const { error, count } = await (context.supabase.from("contacts") as any)
        .insert(chunk, { count: "exact" });
      if (error) throw new Error(error.message);
      inserted += count ?? chunk.length;
    }
    return { inserted };
  });
