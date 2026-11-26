import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Bell, CheckCircle2, Circle, Handshake, Search, X } from "lucide-react";
import { REMINDER_AFTER_DAYS, getReferralOverview } from "@/lib/network.functions";
import { ReferralAskDialog, type AskTarget } from "@/components/referral-ask-dialog";
import { AskTable, fmtDate as fmt } from "@/components/referral-asks-table";
import { StageBadge } from "@/components/stage-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/referrals")({
  ssr: false,
  head: () => ({ meta: [{ title: "Referrals — InsureFlow" }] }),
  component: ReferralsPage,
});

const DISMISS_KEY = "insureflow:referrals-getting-started-dismissed";

function readDismissed() {
  try {
    return localStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

function ReferralsPage() {
  const overviewFn = useServerFn(getReferralOverview);
  const { data, isLoading, error } = useQuery({
    queryKey: ["referrals", "overview"],
    queryFn: () => overviewFn(),
  });
  const [target, setTarget] = useState<AskTarget | null>(null);
  const [filter, setFilter] = useState("");
  const [dismissed, setDismissed] = useState(readDismissed);

  const suggestions = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return (data?.suggestions ?? []).filter((c) => !q || c.name.toLowerCase().includes(q));
  }, [data, filter]);

  if (isLoading) return <div className="p-6 text-sm text-muted-foreground">Loading referrals…</div>;
  if (error || !data)
    return (
      <div className="p-6 text-sm text-destructive">
        Couldn't load referrals: {(error as Error)?.message}
      </div>
    );

  const p = data.progress;
  const steps = [
    {
      title: "Import your contacts",
      text: "Bring in your phone, Google, Outlook or LinkedIn contacts.",
      done: data.totalContacts > 0,
      to: "/contacts/import" as const,
    },
    {
      title: "Ask a happy client for a referral",
      text: "Pick a client below and send the message from your own WhatsApp, SMS or email.",
      done: p.asked > 0,
    },
    {
      title: "Record what happened",
      text: "Mark when they reply or introduce someone, and link the new contact to them.",
      done: p.replied + p.referred + p.declined > 0,
    },
  ];
  const showStart = !dismissed && steps.some((s) => !s.done);

  return (
    <div className="flex flex-col h-full">
      <header className="h-14 border-b pl-14 pr-4 md:px-6 flex items-center justify-between bg-background">
        <div>
          <h1 className="text-base font-semibold tracking-tight">Referrals</h1>
          <p className="text-xs text-muted-foreground">
            Ask existing clients to introduce people, and track the answers
          </p>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-4 md:p-6 space-y-6">
        {showStart && (
          <section className="rounded-lg border bg-card p-4">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-sm font-semibold">Getting started</h2>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                aria-label="Hide getting started"
                onClick={() => {
                  try {
                    localStorage.setItem(DISMISS_KEY, "1");
                  } catch {
                    /* blocked storage: it just shows again next time */
                  }
                  setDismissed(true);
                }}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <ol className="mt-3 grid gap-3 md:grid-cols-3">
              {steps.map((s) => (
                <li key={s.title} className="flex gap-2">
                  {s.done ? (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-stage-won-foreground" />
                  ) : (
                    <Circle className="h-5 w-5 shrink-0 text-muted-foreground" />
                  )}
                  <div>
                    <div
                      className={cn(
                        "text-sm font-medium",
                        s.done && "line-through text-muted-foreground",
                      )}
                    >
                      {s.to && !s.done ? (
                        <Link to={s.to} className="underline underline-offset-2">
                          {s.title}
                        </Link>
                      ) : (
                        s.title
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{s.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        )}

        <section className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Stat label="Asks sent" value={p.asked} />
          <Stat label="Replied" value={p.replied + p.referred} />
          <Stat label="Introduced someone" value={p.referred} tone="ok" />
          <Stat label="Referred contacts" value={p.referredContacts} />
          <Stat label="Referred and won" value={p.referredWon} tone="ok" />
        </section>

        {data.followUps.length > 0 && (
          <section className="rounded-lg border border-stage-proposal bg-card">
            <div className="px-4 py-3 border-b flex items-center gap-2">
              <Bell className="h-4 w-4 text-stage-proposal-foreground" />
              <h2 className="text-sm font-semibold">Follow up ({data.followUps.length})</h2>
              <span className="text-xs text-muted-foreground">
                No answer after {REMINDER_AFTER_DAYS} days
              </span>
            </div>
            <AskTable asks={data.followUps} followUp />
          </section>
        )}

        <section className="rounded-lg border bg-card">
          <div className="px-4 py-3 border-b flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold">Who to ask</h2>
              <p className="text-xs text-muted-foreground">
                Clients with an active policy or a won deal, not asked in the last 90 days
              </p>
            </div>
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Filter by name"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="pl-8 h-9"
              />
            </div>
          </div>
          {suggestions.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">
              No one to suggest yet. Clients appear here once they have an active policy or their
              stage is Won. You can also ask anyone from their contact page (Referrals tab).
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead className="text-right">Active policies</TableHead>
                  <TableHead className="w-32"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {suggestions.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>
                      <StageBadge stage={c.pipeline_stage} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{c.activePolicies}</TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="outline" onClick={() => setTarget(c)}>
                        <Handshake className="h-4 w-4 mr-1.5" /> Ask
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>

        <section className="rounded-lg border bg-card">
          <div className="px-4 py-3 border-b">
            <h2 className="text-sm font-semibold">All asks</h2>
          </div>
          {data.asks.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">
              You haven't recorded any referral asks yet.
            </p>
          ) : (
            <AskTable asks={data.asks} />
          )}
        </section>

        <section className="rounded-lg border bg-card">
          <div className="px-4 py-3 border-b">
            <h2 className="text-sm font-semibold">People your clients referred</h2>
            <p className="text-xs text-muted-foreground">
              Set “Referred by” on a contact's Referrals tab to link them to the client who
              introduced them
            </p>
          </div>
          {data.referred.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground">
              No referred contacts linked yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contact</TableHead>
                  <TableHead>Referred by</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead>Added</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.referred.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-muted-foreground">{c.referrer}</TableCell>
                    <TableCell>
                      <StageBadge stage={c.pipeline_stage} />
                    </TableCell>
                    <TableCell className="text-muted-foreground tabular-nums">
                      {fmt(c.created_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>
      </div>

      <ReferralAskDialog target={target} onOpenChange={(o) => !o && setTarget(null)} />
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "ok" }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={cn(
          "text-2xl font-semibold tabular-nums mt-1",
          tone === "ok" && "text-stage-won-foreground",
        )}
      >
        {value}
      </div>
    </div>
  );
}
