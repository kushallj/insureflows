import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type OrganizationKind = "family" | "business" | "other";
export const ORGANIZATION_KINDS: OrganizationKind[] = ["family", "business", "other"];

export type Organization = {
  id: string;
  user_id: string;
  name: string;
  kind: OrganizationKind;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export const listOrganizations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("organizations")
      .select("*")
      .eq("user_id", context.userId)
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return data as Organization[];
  });

export const createOrganization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { name: string; kind?: OrganizationKind; notes?: string | null }) => data)
  .handler(async ({ data, context }) => {
    if (!data.name?.trim()) throw new Error("Name is required");
    const { data: row, error } = await (context.supabase.from("organizations") as any)
      .insert({
        user_id: context.userId,
        name: data.name.trim(),
        kind: data.kind ?? "family",
        notes: data.notes ?? null,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as Organization;
  });
