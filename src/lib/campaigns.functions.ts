import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { TemplateChannel } from "./templates.functions";
import type { SegmentFilters } from "./segments.functions";

export type CampaignStatus =
  | "draft"
  | "scheduled"
  | "sending"
  | "paused"
  | "completed"
  | "cancelled";

export type Campaign = {
  id: string;
  user_id: string;
  name: string;
  channel: TemplateChannel;
  template_id: string | null;
  segment_id: string | null;
  status: CampaignStatus;
  scheduled_at: string | null;
  audience_count_snapshot: number | null;
  sent_count: number;
  delivered_count: number;
  failed_count: number;
  opened_count: number;
  clicked_count: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type CampaignWithRelated = Campaign & {
  template: { id: string; name: string; channel: TemplateChannel; subject: string | null; body: string } | null;
  segment: { id: string; name: string; filter_criteria: SegmentFilters } | null;
};

export const listCampaigns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("campaigns")
      .select("*, template:templates(id,name,channel,subject,body), segment:segments(id,name,filter_criteria)")
      .eq("user_id", context.userId)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as unknown as CampaignWithRelated[];
  });

export const getCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("campaigns")
      .select("*, template:templates(id,name,channel,subject,body), segment:segments(id,name,filter_criteria)")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row as unknown as CampaignWithRelated | null;
  });

type CampaignInput = {
  name: string;
  channel: TemplateChannel;
  template_id?: string | null;
  segment_id?: string | null;
  status?: CampaignStatus;
  scheduled_at?: string | null;
  audience_count_snapshot?: number | null;
};

export const createCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: CampaignInput) => data)
  .handler(async ({ data, context }) => {
    if (!data.name?.trim()) throw new Error("Name is required");
    const { data: row, error } = await (context.supabase.from("campaigns") as any)
      .insert({
        user_id: context.userId,
        created_by: context.userId,
        name: data.name.trim(),
        channel: data.channel,
        template_id: data.template_id ?? null,
        segment_id: data.segment_id ?? null,
        status: data.status ?? "draft",
        scheduled_at: data.scheduled_at ?? null,
        audience_count_snapshot: data.audience_count_snapshot ?? null,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as Campaign;
  });

export const updateCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string; patch: Partial<CampaignInput> }) => data)
  .handler(async ({ data, context }) => {
    const { data: row, error } = await (context.supabase.from("campaigns") as any)
      .update(data.patch)
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as Campaign;
  });

export const setCampaignStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string; status: CampaignStatus }) => data)
  .handler(async ({ data, context }) => {
    const { data: row, error } = await (context.supabase.from("campaigns") as any)
      .update({ status: data.status })
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as Campaign;
  });

export const deleteCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("campaigns")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const cloneCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    const { data: src, error: sErr } = await context.supabase
      .from("campaigns")
      .select("*")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (sErr) throw new Error(sErr.message);
    if (!src) throw new Error("Campaign not found");
    const s: any = src;
    const { data: row, error } = await (context.supabase.from("campaigns") as any)
      .insert({
        user_id: context.userId,
        created_by: context.userId,
        name: `${s.name} (copy)`,
        channel: s.channel,
        template_id: s.template_id,
        segment_id: s.segment_id,
        status: "draft",
        scheduled_at: null,
        audience_count_snapshot: s.audience_count_snapshot,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as Campaign;
  });
