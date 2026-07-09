import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listRenewals, markContacted, type RenewalRow } from "@/lib/policies.functions";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/renewals")({
  ssr: false,
  head: () => ({ meta: [{ title: "Renewals — InsureFlow" }] }),
  component: RenewalsPage,
});

type Window = 30 | 60 | 90;
type SortKey = "renewal_asc" | "renewal_desc" | "premium_desc" | "premium_asc";

function RenewalsPage() {
  const [win, setWin] = useState<Window>(30);
  const [sort, setSort] = useState<SortKey>("renewal_asc");
  const listFn = useServerFn(listRenewals);
  const q = useQuery({
    queryKey: ["renewals", win],
    queryFn: () => listFn({ data: { withinDays: win } }),
  });

  const rows = useMemo(() => {
    const list = [...(q.data ?? [])];
    list.sort((a, b) => {
      switch (sort) {
        case "renewal_desc":
          return (b.renewal_date ?? "").localeCompare(a.renewal_date ?? "");
        case "premium_desc":
          return (b.premium_amount ?? 0) - (a.premium_amount ?? 0);
        case "premium_asc":
          return (a.premium_amount ?? 0) - (b.premium_amount ?? 0);
        default:
          return (a.renewal_date ?? "").localeCompare(b.renewal_date ?? "");
      }
    });
    return list;
  }, [q.data, sort]);

  return (
    <div className="flex flex-col h-screen">
      <header className="h-14 border-b px-6 flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold tracking-tight">Renewals</h1>
          <p className="text-xs text-muted-foreground">
            Policies due in the next {win} days
          </p>
        </div>
      </header>

      <div className="px-6 py-3 border-b bg-muted/30 flex items-center gap-3">
        <Tabs value={String(win)} onValueChange={(v) => setWin(Number(v) as Window)}>
          <TabsList>
            <TabsTrigger value="30">30 days</TabsTrigger>
            <TabsTrigger value="60">60 days</TabsTrigger>
            <TabsTrigger value="90">90 days</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="ml-auto">
          <SortSelect value={sort} onChange={setSort} />
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {q.isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-16">Loading…</p>
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <CheckCircle2 className="h-5 w-5 text-primary" />
            </div>
            <h3 className="font-semibold">Nothing coming up</h3>
            <p className="text-sm text-muted-foreground mt-1">
              No policies renew within the next {win} days.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead>Contact</TableHead>
                <TableHead>Policy</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Insurer</TableHead>
                <TableHead className="text-right">Premium</TableHead>
                <TableHead>Renewal</TableHead>
                <TableHead>Last contact</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <RenewalRowView key={r.id} row={r} />
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

function SortSelect({ value, onChange }: { value: SortKey; onChange: (v: SortKey) => void }) {
  const options: { key: SortKey; label: string }[] = [
    { key: "renewal_asc", label: "Renewal soonest" },
    { key: "renewal_desc", label: "Renewal latest" },
    { key: "premium_desc", label: "Premium highest" },
    { key: "premium_asc", label: "Premium lowest" },
  ];
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as SortKey)}
      className="h-9 rounded-md border bg-background px-2 text-sm"
    >
      {options.map((o) => (
        <option key={o.key} value={o.key}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function RenewalRowView({ row }: { row: RenewalRow }) {
  const queryClient = useQueryClient();
  const markFn = useServerFn(markContacted);
  const mut = useMutation({
    mutationFn: () => markFn({ data: { contact_id: row.contact?.id ?? "" } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["renewals"] });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      toast.success("Marked contacted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const daysUntil = row.renewal_date
    ? Math.round((new Date(row.renewal_date).getTime() - Date.now()) / 86400000)
    : null;

  return (
    <TableRow>
      <TableCell className="font-medium">{row.contact?.name ?? "—"}</TableCell>
      <TableCell className="text-muted-foreground">{row.policy_number}</TableCell>
      <TableCell className="text-muted-foreground">{row.policy_type}</TableCell>
      <TableCell className="text-muted-foreground">{row.insurer_name ?? "—"}</TableCell>
      <TableCell className="text-right tabular-nums">
        {row.premium_amount ?? "—"}
      </TableCell>
      <TableCell className="tabular-nums">
        {row.renewal_date}
        {daysUntil != null && (
          <span
            className={cn(
              "ml-2 text-[11px] rounded px-1.5 py-0.5",
              daysUntil <= 15
                ? "bg-red-100 text-red-800"
                : daysUntil <= 45
                  ? "bg-amber-100 text-amber-800"
                  : "bg-muted text-muted-foreground",
            )}
          >
            {daysUntil}d
          </span>
        )}
      </TableCell>
      <TableCell className="text-muted-foreground tabular-nums">
        {row.contact?.last_contact_at
          ? new Date(row.contact.last_contact_at).toLocaleDateString()
          : "—"}
      </TableCell>
      <TableCell className="text-right">
        <Button
          size="sm"
          variant="outline"
          disabled={mut.isPending || !row.contact}
          onClick={() => mut.mutate()}
        >
          <CheckCircle2 className="h-4 w-4 mr-1.5" />
          Mark contacted
        </Button>
      </TableCell>
    </TableRow>
  );
}
