import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type {
  Contact,
  ContactInput,
  PipelineStage,
  SortKey,
} from "./contact-fields";

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
    const { data: row, error } = await context.supabase
      .from("contacts")
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
    const { data: row, error } = await context.supabase
      .from("contacts")
      .update(patch)
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
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
    const { data, error } = await context.supabase
      .from("contacts")
      .select("phone,email")
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    const phones = new Set<string>();
    const emails = new Set<string>();
    for (const r of data ?? []) {
      if (r.phone) phones.add(String(r.phone).trim().toLowerCase());
      if (r.email) emails.add(String(r.email).trim().toLowerCase());
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
      const { error, count } = await context.supabase
        .from("contacts")
        .insert(chunk, { count: "exact" });
      if (error) throw new Error(error.message);
      inserted += count ?? chunk.length;
    }
    return { inserted };
  });
