import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type DateRange = { from: string; to: string }; // ISO dates

type Ctx = { supabase: any; userId: string };

async function countTable(
  ctx: Ctx,
  table: string,
  extra?: (q: any) => any,
): Promise<number> {
  let q = ctx.supabase.from(table).select("id", { count: "exact", head: true }).eq("user_id", ctx.userId);
  if (extra) q = extra(q);
  const { count, error } = await q;
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export type Summary = {
  total_contacts: number;
  contacts_by_stage: Record<string, number>;
  upcoming_renewals_30d: number;
  active_campaigns: number;
};

export const getAnalyticsSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { range: DateRange }) => data)
  .handler(async ({ data, context }): Promise<Summary> => {
    const ctx = { supabase: context.supabase, userId: context.userId };
    const from = data.range.from;
    const to = data.range.to;

    // Total contacts (created in range)
    const total_contacts = await countTable(ctx, "contacts", (q) =>
      q.gte("created_at", from).lte("created_at", to),
    );

    // Contacts by pipeline stage (all-time; snapshot of current pipeline state)
    const { data: stageRows, error: stageErr } = await context.supabase
      .from("contacts")
      .select("pipeline_stage")
      .eq("user_id", context.userId);
    if (stageErr) throw new Error(stageErr.message);
    const contacts_by_stage: Record<string, number> = {};
    for (const r of stageRows ?? []) {
      const s = (r as any).pipeline_stage as string;
      contacts_by_stage[s] = (contacts_by_stage[s] ?? 0) + 1;
    }

    // Upcoming renewals in the next 30 days
    const today = new Date().toISOString().slice(0, 10);
    const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
    const upcoming_renewals_30d = await countTable(ctx, "policies", (q) =>
      q
        .gte("renewal_date", today)
        .lte("renewal_date", in30)
        .eq("status", "active"),
    );

    // Active campaigns (scheduled or sending)
    const active_campaigns = await countTable(ctx, "campaigns", (q) =>
      q.in("status", ["scheduled", "sending"]),
    );

    return {
      total_contacts,
      contacts_by_stage,
      upcoming_renewals_30d,
      active_campaigns,
    };
  });

export type CampaignPerfPoint = {
  date: string;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
};

export const getCampaignPerformance = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { range: DateRange }) => data)
  .handler(async ({ data, context }): Promise<CampaignPerfPoint[]> => {
    const { data: rows, error } = await context.supabase
      .from("campaigns")
      .select("scheduled_at,created_at,sent_count,delivered_count,opened_count,clicked_count")
      .eq("user_id", context.userId)
      .gte("created_at", data.range.from)
      .lte("created_at", data.range.to)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    const bucket = new Map<string, CampaignPerfPoint>();
    for (const r of rows ?? []) {
      const row = r as any;
      const iso: string = row.scheduled_at ?? row.created_at;
      const day = iso.slice(0, 10);
      const existing = bucket.get(day) ?? {
        date: day,
        sent: 0,
        delivered: 0,
        opened: 0,
        clicked: 0,
      };
      existing.sent += row.sent_count ?? 0;
      existing.delivered += row.delivered_count ?? 0;
      existing.opened += row.opened_count ?? 0;
      existing.clicked += row.clicked_count ?? 0;
      bucket.set(day, existing);
    }
    return Array.from(bucket.values()).sort((a, b) => a.date.localeCompare(b.date));
  });

export type BreakdownPoint = { key: string; count: number };

export const getContactBreakdowns = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { range: DateRange }) => data)
  .handler(async ({ data, context }): Promise<{
    by_source: BreakdownPoint[];
    by_stage: BreakdownPoint[];
  }> => {
    const { data: rows, error } = await context.supabase
      .from("contacts")
      .select("lead_source,pipeline_stage")
      .eq("user_id", context.userId)
      .gte("created_at", data.range.from)
      .lte("created_at", data.range.to);
    if (error) throw new Error(error.message);

    const srcMap = new Map<string, number>();
    const stageMap = new Map<string, number>();
    for (const r of rows ?? []) {
      const row = r as any;
      const src = (row.lead_source as string | null) || "Unknown";
      srcMap.set(src, (srcMap.get(src) ?? 0) + 1);
      const stage = row.pipeline_stage as string;
      stageMap.set(stage, (stageMap.get(stage) ?? 0) + 1);
    }
    return {
      by_source: Array.from(srcMap.entries())
        .map(([key, count]) => ({ key, count }))
        .sort((a, b) => b.count - a.count),
      by_stage: Array.from(stageMap.entries()).map(([key, count]) => ({ key, count })),
    };
  });

export type MonthStats = {
  this_month: { tasks_completed: number; contacts_won: number };
  last_month: { tasks_completed: number; contacts_won: number };
};

function monthBounds(offset: number): { from: string; to: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 1);
  return { from: start.toISOString(), to: end.toISOString() };
}

export const getMonthStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MonthStats> => {
    const cur = monthBounds(0);
    const prev = monthBounds(-1);

    async function tasksCompleted(from: string, to: string): Promise<number> {
      const { count, error } = await context.supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .eq("user_id", context.userId)
        .eq("status", "done")
        .gte("updated_at", from)
        .lt("updated_at", to);
      if (error) throw new Error(error.message);
      return count ?? 0;
    }
    async function contactsWon(from: string, to: string): Promise<number> {
      const { count, error } = await context.supabase
        .from("contacts")
        .select("id", { count: "exact", head: true })
        .eq("user_id", context.userId)
        .eq("pipeline_stage", "won")
        .gte("updated_at", from)
        .lt("updated_at", to);
      if (error) throw new Error(error.message);
      return count ?? 0;
    }

    const [tc, tl, wc, wl] = await Promise.all([
      tasksCompleted(cur.from, cur.to),
      tasksCompleted(prev.from, prev.to),
      contactsWon(cur.from, cur.to),
      contactsWon(prev.from, prev.to),
    ]);
    return {
      this_month: { tasks_completed: tc, contacts_won: wc },
      last_month: { tasks_completed: tl, contacts_won: wl },
    };
  });
