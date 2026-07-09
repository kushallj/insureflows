import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ActivityType = "note" | "stage_change" | "task_completed" | "message_sent" | "other";
export const ACTIVITY_TYPES: ActivityType[] = [
  "note",
  "stage_change",
  "task_completed",
  "message_sent",
  "other",
];

export type Activity = {
  id: string;
  user_id: string;
  contact_id: string;
  activity_type: ActivityType;
  description: string | null;
  created_at: string;
};

export const listActivities = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { contact_id: string }) => data)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("activities")
      .select("*")
      .eq("user_id", context.userId)
      .eq("contact_id", data.contact_id)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return rows as Activity[];
  });

export const addNote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { contact_id: string; description: string }) => data)
  .handler(async ({ data, context }) => {
    if (!data.description?.trim()) throw new Error("Note is required");
    const { data: row, error } = await (context.supabase.from("activities") as any)
      .insert({
        user_id: context.userId,
        contact_id: data.contact_id,
        activity_type: "note",
        description: data.description.trim(),
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as Activity;
  });
