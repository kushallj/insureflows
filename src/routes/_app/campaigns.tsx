import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listCampaigns,
  cloneCampaign,
  deleteCampaign,
  setCampaignStatus,
  type CampaignStatus,
  type CampaignWithRelated,
} from "@/lib/campaigns.functions";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CampaignStatusBadge } from "@/components/campaign-status-badge";
import { Plus, MoreHorizontal, Send, Pause, Play, Copy, Trash2, XCircle, Megaphone } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";

export const Route = createFileRoute("/_app/campaigns")({
  ssr: false,
  head: () => ({ meta: [{ title: "Campaigns — InsureFlow" }] }),
  component: CampaignsPage,
});

function CampaignsPage() {
  const listFn = useServerFn(listCampaigns);
  const navigate = useNavigate();
  const q = useQuery({ queryKey: ["campaigns"], queryFn: () => listFn() });

  return (
    <div className="flex flex-col h-screen">
      <header className="h-14 border-b px-6 flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold tracking-tight">Campaigns</h1>
          <p className="text-xs text-muted-foreground">
            {q.data?.length ?? 0} campaign{(q.data?.length ?? 0) === 1 ? "" : "s"}
          </p>
        </div>
        <Button size="sm" onClick={() => navigate({ to: "/campaigns/new" })}>
          <Plus className="h-4 w-4 mr-1.5" /> New campaign
        </Button>
      </header>

      <div className="flex-1 overflow-auto">
        {q.isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-16">Loading…</p>
        ) : !q.data?.length ? (
          <EmptyState onCreate={() => navigate({ to: "/campaigns/new" })} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Template</TableHead>
                <TableHead>Segment</TableHead>
                <TableHead>Scheduled</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {q.data.map((c) => (
                <CampaignRow key={c.id} campaign={c} />
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
        <Megaphone className="h-5 w-5 text-primary" />
      </div>
      <h3 className="font-semibold">No campaigns yet</h3>
      <p className="text-sm text-muted-foreground mt-1 max-w-sm">
        Create a campaign to schedule a message to a segment. Sending is handled
        by a separate service that reads scheduled campaigns.
      </p>
      <div className="mt-4">
        <Button size="sm" onClick={onCreate}>
          <Plus className="h-4 w-4 mr-1.5" /> New campaign
        </Button>
      </div>
    </div>
  );
}

function CampaignRow({ campaign }: { campaign: CampaignWithRelated }) {
  const queryClient = useQueryClient();
  const statusFn = useServerFn(setCampaignStatus);
  const cloneFn = useServerFn(cloneCampaign);
  const delFn = useServerFn(deleteCampaign);
  const [confirmDel, setConfirmDel] = useState(false);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["campaigns"] });

  const setStatus = useMutation({
    mutationFn: (status: CampaignStatus) => statusFn({ data: { id: campaign.id, status } }),
    onSuccess: (_r, s) => {
      invalidate();
      toast.success(`Campaign ${s}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const clone = useMutation({
    mutationFn: () => cloneFn({ data: { id: campaign.id } }),
    onSuccess: () => {
      invalidate();
      toast.success("Campaign cloned");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: () => delFn({ data: { id: campaign.id } }),
    onSuccess: () => {
      invalidate();
      toast.success("Campaign deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canPause = campaign.status === "scheduled" || campaign.status === "sending";
  const canResume = campaign.status === "paused";
  const canCancel = ["draft", "scheduled", "paused", "sending"].includes(campaign.status);
  const canSchedule = campaign.status === "draft" || campaign.status === "cancelled";

  return (
    <TableRow>
      <TableCell className="font-medium">
        <Link
          to="/campaigns/$id"
          params={{ id: campaign.id }}
          className="hover:underline"
        >
          {campaign.name}
        </Link>
      </TableCell>
      <TableCell className="capitalize">{campaign.channel}</TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {campaign.template?.name ?? <span className="italic">—</span>}
      </TableCell>
      <TableCell className="text-sm text-muted-foreground">
        {campaign.segment?.name ?? <span className="italic">—</span>}
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {campaign.scheduled_at ? new Date(campaign.scheduled_at).toLocaleString() : "—"}
      </TableCell>
      <TableCell>
        <CampaignStatusBadge status={campaign.status} />
      </TableCell>
      <TableCell className="text-right">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {canSchedule && campaign.scheduled_at && (
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
              onClick={() => setConfirmDel(true)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        <AlertDialog open={confirmDel} onOpenChange={setConfirmDel}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this campaign?</AlertDialogTitle>
              <AlertDialogDescription>
                {campaign.name} will be removed. This does not affect any messages
                already sent by the external service.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => del.mutate()}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </TableCell>
    </TableRow>
  );
}
