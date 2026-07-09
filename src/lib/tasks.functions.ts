import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type TaskStatus = "open" | "done";
export type TaskPriority = "low" | "normal" | "high";
export const TASK_STATUSES: TaskStatus[] = ["open", "done"];
export const TASK_PRIORITIES: TaskPriority[] = ["low", "normal", "high"];

export type Task = {
  id: string;
  user_id: string;
  title: string;
  due_date: string | null;
  related_contact_id: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  created_at: string;
  updated_at: string;
};

export type TaskWithContact = Task & {
  contact: { id: string; name: string } | null;
};

export type TaskInput = {
  title: string;
  due_date?: string | null;
  related_contact_id?: string | null;
  status?: TaskStatus;
  priority?: TaskPriority;
};

function clean(input: Record<string, unknown>) {
  const out: Record<string, unknown> = { ...input };
  for (const k of Object.keys(out)) if (out[k] === "" || out[k] === undefined) out[k] = null;
  return out;
}

export const listMyTasks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { status?: TaskStatus | "all" } | undefined) => data ?? {})
  .handler(async ({ data, context }) => {
    let q = context.supabase
      .from("tasks")
      .select("*, contact:contacts!tasks_related_contact_id_fkey(id,name)")
      .eq("user_id", context.userId);
    if (data.status && data.status !== "all") q = q.eq("status", data.status);
    q = q
      .order("status", { ascending: true })
      .order("due_date", { ascending: true, nullsFirst: false })
      .limit(500);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows as unknown as TaskWithContact[];
  });

export const listTasksForContact = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { contact_id: string }) => data)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("tasks")
      .select("*")
      .eq("user_id", context.userId)
      .eq("related_contact_id", data.contact_id)
      .order("status", { ascending: true })
      .order("due_date", { ascending: true, nullsFirst: false });
    if (error) throw new Error(error.message);
    return rows as Task[];
  });

export const createTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: TaskInput) => data)
  .handler(async ({ data, context }) => {
    if (!data.title?.trim()) throw new Error("Title is required");
    const payload = {
      ...clean(data as unknown as Record<string, unknown>),
      user_id: context.userId,
      title: data.title.trim(),
    };
    const { data: row, error } = await (context.supabase.from("tasks") as any)
      .insert(payload)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as Task;
  });

export const updateTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string; patch: Partial<TaskInput> }) => data)
  .handler(async ({ data, context }) => {
    const patch = clean(data.patch as Record<string, unknown>);
    delete (patch as any).user_id;

    // Log activity when marking task done
    const wasDone = patch.status === "done";
    const { data: row, error } = await (context.supabase.from("tasks") as any)
      .update(patch)
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .select("*")
      .single();
    if (error) throw new Error(error.message);

    if (wasDone && row?.related_contact_id) {
      await (context.supabase.from("activities") as any).insert({
        user_id: context.userId,
        contact_id: row.related_contact_id,
        activity_type: "task_completed",
        description: `Task completed: ${row.title}`,
      });
    }
    return row as Task;
  });

export const deleteTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { id: string }) => data)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("tasks")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
