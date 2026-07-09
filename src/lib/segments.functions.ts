import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { PipelineStage } from "./contact-fields";
import type { PolicyType } from "./policies.functions";

export type SegmentFilters = {
  age_min?: number | null;
  age_max?: number | null;
  cities?: string[];
  languages?: string[];
  occupations?: string[];
  income_min?: number | null;
  income_max?: number | null;
  tags?: string[]; // any-of
  pipeline_stages?: PipelineStage[];
  lead_score_min?: number | null;
  lead_score_max?: number | null;
  has_policy_types?: PolicyType[]; // contact has ≥1 policy of any of these types
  renewal_from?: string | null; // YYYY-MM-DD, applied to policy renewal_date
  renewal_to?: string | null;
  last_contact_from?: string | null; // ISO date
  last_contact_to?: string | null;
};

export type Segment = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  filter_criteria: SegmentFilters;
  created_at: string;
  updated_at: string;
};

async function idsFromPolicies(
  supabase: any,
  userId: string,
  f: SegmentFilters,
): Promise<string[] | null> {
  const needsPolicies =
    (f.has_policy_types && f.has_policy_types.length > 0) ||
    !!f.renewal_from ||
    !!f.renewal_to;
  if (!needsPolicies) return null;

  let q = supabase.from("policies").select("contact_id").eq("user_id", userId);
  if (f.has_policy_types && f.has_policy_types.length) q = q.in("policy_type", f.has_policy_types);
  if (f.renewal_from) q = q.gte("renewal_date", f.renewal_from);
  if (f.renewal_to) q = q.lte("renewal_date", f.renewal_to);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return Array.from(new Set((data ?? []).map((r: any) => r.contact_id as string)));
}

function applyContactFilters(query: any, f: SegmentFilters) {
  let q = query;
  if (f.age_min != null) q = q.gte("age", f.age_min);
  if (f.age_max != null) q = q.lte("age", f.age_max);
  if (f.cities && f.cities.length) q = q.in("city", f.cities);
  if (f.languages && f.languages.length) q = q.in("preferred_language", f.languages);
  if (f.occupations && f.occupations.length) q = q.in("occupation", f.occupations);
  if (f.income_min != null) q = q.gte("income", f.income_min);
  if (f.income_max != null) q = q.lte("income", f.income_max);
  if (f.tags && f.tags.length) q = q.overlaps("tags", f.tags);
  if (f.pipeline_stages && f.pipeline_stages.length) q = q.in("pipeline_stage", f.pipeline_stages);
  if (f.lead_score_min != null) q = q.gte("lead_score", f.lead_score_min);
  if (f.lead_score_max != null) q = q.lte("lead_score", f.lead_score_max);
  if (f.last_contact_from) q = q.gte("last_contact_at", f.last_contact_from);
  if (f.last_contact_to) q = q.lte("last_contact_at", f.last_contact_to);
  return q;
}

export type SegmentPreview = {
  count: number;
  sample: Array<{
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    city: string | null;
    pipeline_stage: string;
    lead_score: number;
    tags: string[];
  }>;
};

export const previewSegment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { filters: SegmentFilters }) => data)
  .handler(async ({ data, context }): Promise<SegmentPreview> => {
    const { supabase, userId } = context;
    const f = data.filters ?? {};
    const policyIds = await idsFromPolicies(supabase, userId, f);
    if (policyIds && policyIds.length === 0) return { count: 0, sample: [] };

    let countQ = supabase
      .from("contacts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);
    countQ = applyContactFilters(countQ, f);
    if (policyIds) countQ = countQ.in("id", policyIds);
    const { count, error: cErr } = await countQ;
    if (cErr) throw new Error(cErr.message);

    let sampleQ = supabase
      .from("contacts")
      .select("id,name,phone,email,city,pipeline_stage,lead_score,tags")
      .eq("user_id", userId)
      .order("lead_score", { ascending: false })
      .limit(20);
    sampleQ = applyContactFilters(sampleQ, f);
    if (policyIds) sampleQ = sampleQ.in("id", policyIds);
    const { data: sample, error: sErr } = await sampleQ;
    if (sErr) throw new Error(sErr.message);

    return { count: count ?? 0, sample: (sample as unknown as SegmentPreview["sample"]) ?? [] };
  });

export const listSegments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("segments")
      .select("*")
      .eq("user_id", context.userId)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data as unknown as Segment[];
  });

export const getSegment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("segments")
      .select("*")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row as unknown as Segment | null;
  });

export const createSegment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { name: string; description?: string | null; filter_criteria: SegmentFilters }) =>
      data,
  )
  .handler(async ({ data, context }) => {
    if (!data.name?.trim()) throw new Error("Name is required");
    const { data: row, error } = await (context.supabase.from("segments") as any)
      .insert({
        user_id: context.userId,
        name: data.name.trim(),
        description: data.description ?? null,
        filter_criteria: data.filter_criteria ?? {},
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as Segment;
  });

export const updateSegment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      id: string;
      patch: { name?: string; description?: string | null; filter_criteria?: SegmentFilters };
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const src = (data.patch ?? {}) as Record<string, unknown>;
    const patch: Record<string, unknown> = {};
    if (typeof src.name === "string") patch.name = src.name;
    if (src.description === null || typeof src.description === "string") patch.description = src.description;
    if (src.filter_criteria && typeof src.filter_criteria === "object") patch.filter_criteria = src.filter_criteria;
    const { data: row, error } = await (context.supabase.from("segments") as any)
      .update(patch)
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as Segment;
  });

export const deleteSegment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("segments")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const countSegments = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { segments: Array<{ id: string; filter_criteria: SegmentFilters }> }) => data)
  .handler(async ({ data, context }) => {
    const results: Record<string, number> = {};
    for (const s of data.segments ?? []) {
      const f = s.filter_criteria ?? {};
      const policyIds = await idsFromPolicies(context.supabase, context.userId, f);
      if (policyIds && policyIds.length === 0) {
        results[s.id] = 0;
        continue;
      }
      let q = context.supabase
        .from("contacts")
        .select("id", { count: "exact", head: true })
        .eq("user_id", context.userId);
      q = applyContactFilters(q, f);
      if (policyIds) q = q.in("id", policyIds);
      const { count, error } = await q;
      if (error) throw new Error(error.message);
      results[s.id] = count ?? 0;
    }
    return results;
  });
