import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type TemplateChannel = "whatsapp" | "sms" | "email";
export type TemplateStatus = "draft" | "approved";

export type Template = {
  id: string;
  user_id: string;
  name: string;
  channel: TemplateChannel;
  subject: string | null;
  body: string;
  status: TemplateStatus;
  created_at: string;
  updated_at: string;
};

export const TEMPLATE_VARIABLES = [
  "name",
  "city",
  "renewal_date",
  "policy",
  "advisor_name",
  "premium",
] as const;

export const listTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("templates")
      .select("*")
      .eq("user_id", context.userId)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data as unknown as Template[];
  });

export const getTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("templates")
      .select("*")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return row as unknown as Template | null;
  });

type TemplateInput = {
  name: string;
  channel: TemplateChannel;
  subject?: string | null;
  body: string;
  status?: TemplateStatus;
};

export const createTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: TemplateInput) => data)
  .handler(async ({ data, context }) => {
    if (!data.name?.trim()) throw new Error("Name is required");
    const { data: row, error } = await (context.supabase.from("templates") as any)
      .insert({
        user_id: context.userId,
        name: data.name.trim(),
        channel: data.channel,
        subject: data.channel === "email" ? data.subject ?? null : null,
        body: data.body ?? "",
        status: data.status ?? "draft",
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as Template;
  });

export const updateTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string; patch: Partial<TemplateInput> }) => data)
  .handler(async ({ data, context }) => {
    const src = (data.patch ?? {}) as Record<string, unknown>;
    const allowed = ["name","channel","subject","body","status"] as const;
    const patch: Record<string, unknown> = {};
    for (const k of allowed) if (k in src) patch[k] = src[k];
    if (patch.channel && patch.channel !== "email") patch.subject = null;
    const { data: row, error } = await (context.supabase.from("templates") as any)
      .update(patch)
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as Template;
  });

export const deleteTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("templates")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
