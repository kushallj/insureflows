import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getCampaign,
  setCampaignStatus,
  cloneCampaign,
  deleteCampaign,
  type CampaignStatus,
} from "@/lib/campaigns.functions";
import { previewSegment } from "@/lib/segments.functions";
import { renderTemplate, SAMPLE_VARS } from "@/lib/template-render";
import { CampaignStatusBadge } from "@/components/campaign-status-badge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ChevronLeft,
  MoreHorizontal,
  Send,
  Pause,
  Play,
  XCircle,
  Copy,
  Trash2,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/campaigns_/$id")({
  ssr: false,
  head: () => ({ meta: [{ title: "Campaign — InsureFlow" }] }),
  component: CampaignDetailPage,
});

function CampaignDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const getFn = useServerFn(getCampaign);
  const previewFn = useServerFn(previewSegment);
  const statusFn = useServerFn(setCampaignStatus);
  const cloneFn = useServerFn(cloneCampaign);
  const delFn = useServerFn(deleteCampaign);

  const q = useQuery({
    queryKey: ["campaigns", id],
    queryFn: () => getFn({ data: { id } }),
  });
  const campaign = q.data;

  const audienceQ = useQuery({
    queryKey: ["campaign-audience", campaign?.segment?.id],
    queryFn: () =>
      campaign?.segment
        ? previewFn({ data: { filters: campaign.segment.filter_criteria } })
        : Promise.resolve({ count: 0, sample: [] }),
    enabled: !!campaign?.segment,
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["campaigns"] });
    queryClient.invalidateQueries({ queryKey: ["campaigns", id] });
  };
  const setStatus = useMutation({
    mutationFn: (status: CampaignStatus) => statusFn({ data: { id, status } }),
    onSuccess: (_r, s) => {
      invalidate();
      toast.success(`Campaign ${s}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const clone = useMutation({
    mutationFn: () => cloneFn({ data: { id } }),
    onSuccess: (row: any) => {
      invalidate();
      toast.success("Campaign cloned");
      navigate({ to: "/campaigns/$id", params: { id: row.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: () => delFn({ data: { id } }),
    onSuccess: () => {
      invalidate();
      toast.success("Campaign deleted");
      navigate({ to: "/campaigns" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (q.isLoading) {
    return <p className="text-sm text-muted-foreground p-6">Loading…</p>;
  }
  if (!campaign) {
    return (
      <div className="p-6">
        <p className="text-sm">Campaign not found.</p>
        <Link to="/campaigns" className="text-sm text-primary underline">Back to campaigns</Link>
      </div>
    );
  }

  const canPause = campaign.status === "scheduled" || campaign.status === "sending";
  const canResume = campaign.status === "paused";
  const canCancel = ["draft", "scheduled", "paused", "sending"].includes(campaign.status);
  const canSchedule =
    (campaign.status === "draft" || campaign.status === "cancelled") &&
    !!campaign.scheduled_at &&
    !!campaign.template_id &&
    !!campaign.segment_id;

  const preview = campaign.template
    ? renderTemplate(campaign.template.body, SAMPLE_VARS)
    : "";
  const previewSubject = campaign.template?.subject
    ? renderTemplate(campaign.template.subject, SAMPLE_VARS)
    : "";

  return (
    <div className="flex flex-col h-full">
      <header className="h-14 border-b pl-14 pr-4 md:px-6 flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/campaigns" className="text-muted-foreground hover:text-foreground">
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-base font-semibold tracking-tight truncate">
                {campaign.name}
              </h1>
              <CampaignStatusBadge status={campaign.status} />
            </div>
            <p className="text-xs text-muted-foreground capitalize">
              {campaign.channel} campaign
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => navigate({ to: "/campaigns/$id/edit", params: { id } })}
          >
            <Pencil className="h-4 w-4 mr-1.5" /> Edit
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="ghost">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {canSchedule && (
                <DropdownMenuItem onClick={() => setStatus.mutate("scheduled")}>
                  <Send className="h-4 w-4 mr-2" /> Schedule
                </DropdownMenuItem>
              )}
              {canPause && (
                <DropdownMenuItem onClick={() => setStatus.mutate("paused")}>
                  <Pause className="h-4 w-4 mr-2" /> Pause
                </DropdownMenuItem>
              )}
              {canResume && (
                <DropdownMenuItem onClick={() => setStatus.mutate("scheduled")}>
                  <Play className="h-4 w-4 mr-2" /> Resume
                </DropdownMenuItem>
              )}
              {canCancel && (
                <DropdownMenuItem onClick={() => setStatus.mutate("cancelled")}>
                  <XCircle className="h-4 w-4 mr-2" /> Cancel
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => clone.mutate()}>
                <Copy className="h-4 w-4 mr-2" /> Clone
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => del.mutate()}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" /> Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Overview */}
          <section className="rounded-lg border">
            <div className="px-4 py-3 border-b">
              <h2 className="text-sm font-semibold">Overview</h2>
            </div>
            <dl className="divide-y">
              <Row label="Segment">
                {campaign.segment ? (
                  <Link
                    to="/segments/$id"
                    params={{ id: campaign.segment.id }}
                    className="text-primary hover:underline"
                  >
                    {campaign.segment.name}
                  </Link>
                ) : (
                  <span className="text-muted-foreground italic">Not set</span>
                )}
              </Row>
              <Row label="Audience">
                <span className="text-lg font-semibold tabular-nums">
                  {audienceQ.isLoading ? "…" : (audienceQ.data?.count ?? 0)}
                </span>
                <span className="text-xs text-muted-foreground ml-1.5">
                  contacts match now
                </span>
                {campaign.audience_count_snapshot != null && (
                  <span className="text-xs text-muted-foreground ml-3">
                    (snapshot: {campaign.audience_count_snapshot})
                  </span>
                )}
              </Row>
              <Row label="Scheduled">
                {campaign.scheduled_at
                  ? new Date(campaign.scheduled_at).toLocaleString()
                  : <span className="text-muted-foreground italic">Not scheduled</span>}
              </Row>
              <Row label="Created">
                {new Date(campaign.created_at).toLocaleString()}
              </Row>
            </dl>
          </section>

          {/* Template */}
          <section className="rounded-lg border">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <h2 className="text-sm font-semibold">Template</h2>
              {campaign.template && (
                <Badge variant="outline" className="capitalize">
                  {campaign.template.channel}
                </Badge>
              )}
            </div>
            {campaign.template ? (
              <div className="p-4 space-y-2">
                <div className="text-sm font-medium">{campaign.template.name}</div>
                {previewSubject && (
                  <div className="text-sm border-b pb-2">
                    <span className="text-xs text-muted-foreground">Subject: </span>
                    {previewSubject}
                  </div>
                )}
                <div className="text-sm whitespace-pre-wrap bg-muted/30 rounded p-3">
                  {preview}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Rendered with sample data.
                </p>
              </div>
            ) : (
              <p className="p-4 text-sm text-muted-foreground italic">No template selected.</p>
            )}
          </section>
        </div>

        {/* Delivery stats */}
        <div className="space-y-6">
          <section className="rounded-lg border">
            <div className="px-4 py-3 border-b">
              <h2 className="text-sm font-semibold">Delivery stats</h2>
              <p className="text-[11px] text-muted-foreground">
                Populated by the external messaging service.
              </p>
            </div>
            <div className="p-4 grid grid-cols-2 gap-3">
              <StatCard label="Sent" value={campaign.sent_count} />
              <StatCard label="Delivered" value={campaign.delivered_count} />
              <StatCard label="Failed" value={campaign.failed_count} tone="danger" />
              <StatCard label="Opened" value={campaign.opened_count} />
              <StatCard label="Clicked" value={campaign.clicked_count} />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-4 px-4 py-2.5">
      <dt className="text-xs text-muted-foreground pt-0.5">{label}</dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "danger";
}) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div
        className={
          "text-2xl font-semibold tabular-nums " +
          (tone === "danger" ? "text-destructive" : "")
        }
      >
        {value}
      </div>
    </div>
  );
}
