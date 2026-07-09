import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import {
  getAnalyticsSummary,
  getCampaignPerformance,
  getContactBreakdowns,
  getMonthStats,
} from "@/lib/analytics.functions";
import { STAGE_LABEL, PIPELINE_STAGES } from "@/lib/contact-fields";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Users,
  CalendarClock,
  Megaphone,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Filter,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  Cell,
} from "recharts";

export const Route = createFileRoute("/_app/analytics")({
  ssr: false,
  head: () => ({ meta: [{ title: "Analytics — InsureFlow" }] }),
  component: AnalyticsPage,
});

type Range = { from: string; to: string; label: string };

const PRESETS: { label: string; days: number }[] = [
  { label: "7 days", days: 7 },
  { label: "30 days", days: 30 },
  { label: "90 days", days: 90 },
  { label: "1 year", days: 365 },
];

function isoFromDaysAgo(days: number): Range {
  const to = endOfDay(new Date()).toISOString();
  const from = startOfDay(subDays(new Date(), days - 1)).toISOString();
  return { from, to, label: `Last ${days} days` };
}

function AnalyticsPage() {
  const [range, setRange] = useState<Range>(() => isoFromDaysAgo(30));

  const summaryFn = useServerFn(getAnalyticsSummary);
  const perfFn = useServerFn(getCampaignPerformance);
  const breakdownFn = useServerFn(getContactBreakdowns);
  const monthFn = useServerFn(getMonthStats);

  const summaryQ = useQuery({
    queryKey: ["analytics", "summary", range.from, range.to],
    queryFn: () => summaryFn({ data: { range } }),
  });
  const perfQ = useQuery({
    queryKey: ["analytics", "perf", range.from, range.to],
    queryFn: () => perfFn({ data: { range } }),
  });
  const breakdownQ = useQuery({
    queryKey: ["analytics", "breakdown", range.from, range.to],
    queryFn: () => breakdownFn({ data: { range } }),
  });
  const monthQ = useQuery({
    queryKey: ["analytics", "month"],
    queryFn: () => monthFn(),
  });

  const stageChartData = useMemo(() => {
    const map = summaryQ.data?.contacts_by_stage ?? {};
    return PIPELINE_STAGES.map((s) => ({
      key: STAGE_LABEL[s],
      stage: s,
      count: map[s] ?? 0,
    }));
  }, [summaryQ.data]);

  return (
    <div className="flex flex-col h-screen">
      <header className="h-14 border-b px-6 flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold tracking-tight">Analytics</h1>
          <p className="text-xs text-muted-foreground">{range.label}</p>
        </div>
        <RangeFilter range={range} onChange={setRange} />
      </header>

      <div className="flex-1 overflow-auto p-6 space-y-6">
        {/* Summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard
            icon={<Users className="h-4 w-4" />}
            label="Total contacts"
            value={summaryQ.data?.total_contacts ?? 0}
            hint="added in range"
          />
          <StatCard
            icon={<BarChart3 className="h-4 w-4" />}
            label="In pipeline"
            value={
              PIPELINE_STAGES.filter((s) => s !== "won" && s !== "lost").reduce(
                (a, s) => a + (summaryQ.data?.contacts_by_stage[s] ?? 0),
                0,
              )
            }
            hint="active contacts"
          />
          <StatCard
            icon={<CalendarClock className="h-4 w-4" />}
            label="Upcoming renewals"
            value={summaryQ.data?.upcoming_renewals_30d ?? 0}
            hint="next 30 days"
          />
          <StatCard
            icon={<Megaphone className="h-4 w-4" />}
            label="Active campaigns"
            value={summaryQ.data?.active_campaigns ?? 0}
            hint="scheduled or sending"
          />
        </div>

        {/* Month comparison */}
        <section className="rounded-lg border">
          <div className="px-4 py-3 border-b">
            <h2 className="text-sm font-semibold">This month vs last month</h2>
            <p className="text-xs text-muted-foreground">
              {format(new Date(), "MMMM yyyy")}
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 divide-y sm:divide-y-0 sm:divide-x">
            <MonthCompareCell
              label="Tasks completed"
              current={monthQ.data?.this_month.tasks_completed ?? 0}
              previous={monthQ.data?.last_month.tasks_completed ?? 0}
            />
            <MonthCompareCell
              label="Contacts converted to Won"
              current={monthQ.data?.this_month.contacts_won ?? 0}
              previous={monthQ.data?.last_month.contacts_won ?? 0}
            />
          </div>
        </section>

        {/* Campaign performance */}
        <ChartSection title="Campaign performance" subtitle="Sent, delivered, opened & clicked">
          {perfQ.isLoading ? (
            <ChartSkeleton />
          ) : (perfQ.data?.length ?? 0) === 0 ? (
            <EmptyChart label="No campaign activity in this range" />
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={perfQ.data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="date"
                  fontSize={11}
                  tickFormatter={(d) => format(new Date(d), "MMM d")}
                />
                <YAxis fontSize={11} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  labelFormatter={(d) => format(new Date(d), "PPP")}
                />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="sent" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="delivered" stroke="#10b981" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="opened" stroke="#f59e0b" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="clicked" stroke="#8b5cf6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </ChartSection>

        {/* Breakdown charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartSection title="Contacts by lead source" subtitle="Where new contacts came from">
            {breakdownQ.isLoading ? (
              <ChartSkeleton />
            ) : (breakdownQ.data?.by_source.length ?? 0) === 0 ? (
              <EmptyChart label="No contacts in this range" />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  data={breakdownQ.data!.by_source}
                  layout="vertical"
                  margin={{ top: 4, right: 20, left: 40, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" horizontal={false} />
                  <XAxis type="number" fontSize={11} allowDecimals={false} />
                  <YAxis
                    dataKey="key"
                    type="category"
                    fontSize={11}
                    width={100}
                    tickFormatter={(v) => (v.length > 14 ? v.slice(0, 12) + "…" : v)}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartSection>

          <ChartSection title="Contacts by pipeline stage" subtitle="Current snapshot">
            {summaryQ.isLoading ? (
              <ChartSkeleton />
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={stageChartData} margin={{ top: 4, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                  <XAxis dataKey="key" fontSize={11} />
                  <YAxis fontSize={11} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      background: "hsl(var(--popover))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                    {stageChartData.map((d) => (
                      <Cell key={d.stage} fill={STAGE_COLORS[d.stage] ?? "hsl(var(--primary))"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartSection>
        </div>
      </div>
    </div>
  );
}

const STAGE_COLORS: Record<string, string> = {
  new: "#3b82f6",
  contacted: "#6366f1",
  qualified: "#8b5cf6",
  proposal: "#f59e0b",
  won: "#10b981",
  lost: "#ef4444",
};

function StatCard({
  icon,
  label,
  value,
  hint,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex items-center gap-2 text-muted-foreground text-xs">
        {icon}
        {label}
      </div>
      <div className="text-2xl font-semibold tabular-nums mt-2">{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}

function MonthCompareCell({
  label,
  current,
  previous,
}: {
  label: string;
  current: number;
  previous: number;
}) {
  const delta = current - previous;
  const pct = previous > 0 ? Math.round((delta / previous) * 100) : current > 0 ? 100 : 0;
  const up = delta >= 0;
  return (
    <div className="p-5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="flex items-baseline gap-3 mt-1">
        <div className="text-3xl font-semibold tabular-nums">{current}</div>
        <div
          className={`text-xs flex items-center gap-1 ${
            up ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
          }`}
        >
          {up ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
          {up ? "+" : ""}
          {delta} ({up ? "+" : ""}
          {pct}%)
        </div>
      </div>
      <div className="text-[11px] text-muted-foreground mt-1">
        Last month: <span className="tabular-nums">{previous}</span>
      </div>
    </div>
  );
}

function ChartSection({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border bg-card">
      <div className="px-4 py-3 border-b">
        <h2 className="text-sm font-semibold">{title}</h2>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function ChartSkeleton() {
  return <div className="h-[260px] bg-muted/30 rounded animate-pulse" />;
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="h-[260px] flex items-center justify-center text-sm text-muted-foreground">
      {label}
    </div>
  );
}

function RangeFilter({ range, onChange }: { range: Range; onChange: (r: Range) => void }) {
  const [open, setOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState(range.from.slice(0, 10));
  const [customTo, setCustomTo] = useState(range.to.slice(0, 10));

  function apply(days: number) {
    onChange(isoFromDaysAgo(days));
    setOpen(false);
  }
  function applyCustom() {
    if (!customFrom || !customTo) return;
    onChange({
      from: startOfDay(new Date(customFrom)).toISOString(),
      to: endOfDay(new Date(customTo)).toISOString(),
      label: `${format(new Date(customFrom), "MMM d")} – ${format(new Date(customTo), "MMM d")}`,
    });
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          <Filter className="h-3.5 w-3.5 mr-1.5" />
          {range.label}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 pointer-events-auto">
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Presets</Label>
            <div className="grid grid-cols-2 gap-1.5 mt-1">
              {PRESETS.map((p) => (
                <Button
                  key={p.days}
                  variant="outline"
                  size="sm"
                  onClick={() => apply(p.days)}
                  className="justify-start"
                >
                  Last {p.label}
                </Button>
              ))}
            </div>
          </div>
          <div className="border-t pt-3">
            <Label className="text-xs">Custom range</Label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              <Input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
              />
              <Input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
              />
            </div>
            <Button size="sm" className="w-full mt-2" onClick={applyCustom}>
              Apply
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
