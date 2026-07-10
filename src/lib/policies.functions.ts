import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type PolicyType = "life" | "health" | "motor" | "other";
export type PolicyStatus = "active" | "lapsed" | "cancelled";

export const POLICY_TYPES: PolicyType[] = ["life", "health", "motor", "other"];
export const POLICY_STATUSES: PolicyStatus[] = ["active", "lapsed", "cancelled"];

export type Policy = {
  id: string;
  user_id: string;
  contact_id: string;
  policy_number: string;
  policy_type: PolicyType;
  insurer_name: string | null;
  premium_amount: number | null;
  start_date: string | null;
  renewal_date: string | null;
  status: PolicyStatus;
  notes: string | null;
  document_path: string | null;
  created_at: string;
  updated_at: string;
};

export type PolicyInput = {
  contact_id: string;
  policy_number: string;
  policy_type?: PolicyType;
  insurer_name?: string | null;
  premium_amount?: number | null;
  start_date?: string | null;
  renewal_date?: string | null;
  status?: PolicyStatus;
  notes?: string | null;
  document_path?: string | null;
};

function clean(input: Record<string, unknown>) {
  const out: Record<string, unknown> = { ...input };
  for (const k of Object.keys(out)) {
    if (out[k] === "" || out[k] === undefined) out[k] = null;
  }
  return out;
}

export const listPoliciesForContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { contact_id: string }) => data)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("policies")
      .select("*")
      .eq("user_id", context.userId)
      .eq("contact_id", data.contact_id)
      .order("renewal_date", { ascending: true, nullsFirst: false });
    if (error) throw new Error(error.message);
    return rows as Policy[];
  });

export const createPolicy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: PolicyInput) => data)
  .handler(async ({ data, context }) => {
    if (!data.policy_number?.trim()) throw new Error("Policy number is required");
    if (!data.contact_id) throw new Error("Contact is required");
    const payload = {
      ...clean(data as unknown as Record<string, unknown>),
      user_id: context.userId,
      policy_number: data.policy_number.trim(),
      contact_id: data.contact_id,
    };
    const { data: row, error } = await (context.supabase.from("policies") as any)
      .insert(payload)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as Policy;
  });

export const updatePolicy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string; patch: Partial<PolicyInput> }) => data)
  .handler(async ({ data, context }) => {
    const patch = clean(data.patch as Record<string, unknown>);
    delete (patch as any).user_id;
    const { data: row, error } = await (context.supabase.from("policies") as any)
      .update(patch)
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as Policy;
  });

export const deletePolicy = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("policies")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export type RenewalRow = Policy & {
  contact: { id: string; name: string; phone: string | null; email: string | null; last_contact_at: string | null } | null;
};

export const listRenewals = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { withinDays: 30 | 60 | 90 }) => data)
  .handler(async ({ data, context }) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(today);
    end.setDate(end.getDate() + data.withinDays);
    const fmt = (d: Date) => d.toISOString().slice(0, 10);

    const { data: rows, error } = await context.supabase
      .from("policies")
      .select(
        "*, contact:contacts!policies_contact_id_fkey(id,name,phone,email,last_contact_at)",
      )
      .eq("user_id", context.userId)
      .not("renewal_date", "is", null)
      .gte("renewal_date", fmt(today))
      .lte("renewal_date", fmt(end))
      .order("renewal_date", { ascending: true });
    if (error) throw new Error(error.message);
    return rows as unknown as RenewalRow[];
  });

export const markContacted = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { contact_id: string }) => data)
  .handler(async ({ data, context }) => {
    const { error } = await (context.supabase.from("contacts") as any)
      .update({ last_contact_at: new Date().toISOString() })
      .eq("id", data.contact_id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getPolicyDocumentUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { path: string }) => data)
  .handler(async ({ data, context }) => {
    if (!data.path.startsWith(`${context.userId}/`)) {
      throw new Error("Not allowed");
    }
    const { data: signed, error } = await context.supabase.storage
      .from("policy-documents")
      .createSignedUrl(data.path, 60 * 10);
    if (error) throw new Error(error.message);
    return { url: signed.signedUrl };
  });

