import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import {
  listSegments,
  countSegments,
  deleteSegment,
  type Segment,
} from "@/lib/segments.functions";
import { filterSummary } from "@/components/segment-builder";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Trash2, Layers } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/segments")({
  ssr: false,
  head: () => ({ meta: [{ title: "Segments — InsureFlow" }] }),
  component: SegmentsListPage,
});

function SegmentsListPage() {
  const listFn = useServerFn(listSegments);
  const countFn = useServerFn(countSegments);
  const navigate = useNavigate();

  const q = useQuery({ queryKey: ["segments"], queryFn: () => listFn() });

  const countInput = useMemo(
    () =>
      (q.data ?? []).map((s) => ({ id: s.id, filter_criteria: s.filter_criteria })),
    [q.data],
  );
  const counts = useQuery({
    queryKey: ["segments", "counts", countInput],
    queryFn: () => countFn({ data: { segments: countInput } }),
    enabled: (q.data?.length ?? 0) > 0,
  });

  return (
    <div className="flex flex-col h-full">
      <header className="h-14 border-b pl-14 pr-4 md:px-6 flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold tracking-tight">Segments</h1>
          <p className="text-xs text-muted-foreground">
            {q.data?.length ?? 0} saved
          </p>
        </div>
        <Button size="sm" onClick={() => navigate({ to: "/segments/new" })}>
          <Plus className="h-4 w-4 mr-1.5" /> New segment
        </Button>
      </header>

      <div className="flex-1 overflow-auto p-6">
        {q.isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-16">Loading…</p>
        ) : !q.data?.length ? (
          <EmptyState />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {q.data.map((s) => (
              <SegmentCard
                key={s.id}
                segment={s}
                count={counts.data?.[s.id]}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
        <Layers className="h-5 w-5 text-primary" />
      </div>
      <h3 className="font-semibold">No segments yet</h3>
      <p className="text-sm text-muted-foreground mt-1 max-w-sm">
        Build a segment to define an audience — e.g. all clients in Mumbai with a
        motor policy renewing this quarter.
      </p>
      <div className="mt-4">
        <Link to="/segments/new">
          <Button size="sm">
            <Plus className="h-4 w-4 mr-1.5" /> New segment
          </Button>
        </Link>
      </div>
    </div>
  );
}

function SegmentCard({ segment, count }: { segment: Segment; count?: number }) {
  const queryClient = useQueryClient();
  const delFn = useServerFn(deleteSegment);
  const del = useMutation({
    mutationFn: () => delFn({ data: { id: segment.id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["segments"] });
      toast.success("Segment deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const parts = filterSummary(segment.filter_criteria);

  return (
    <div className="rounded-lg border bg-card p-4 flex flex-col gap-2 hover:border-primary/50 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <Link
          to="/segments/$id"
          params={{ id: segment.id }}
          className="min-w-0 flex-1"
        >
          <h3 className="font-semibold text-sm truncate">{segment.name}</h3>
          {segment.description && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
              {segment.description}
            </p>
          )}
        </Link>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this segment?</AlertDialogTitle>
              <AlertDialogDescription>
                {segment.name} will be removed. Contacts are not affected.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => del.mutate()}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <div className="text-2xl font-semibold tabular-nums">
        {count == null ? "…" : count}
        <span className="text-xs text-muted-foreground font-normal ml-1.5">
          {count === 1 ? "contact" : "contacts"}
        </span>
      </div>

      {parts.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {parts.slice(0, 4).map((p, i) => (
            <span
              key={i}
              className="text-[11px] rounded bg-accent text-accent-foreground px-1.5 py-0.5"
            >
              {p}
            </span>
          ))}
          {parts.length > 4 && (
            <span className="text-[11px] text-muted-foreground">+{parts.length - 4}</span>
          )}
        </div>
      )}
    </div>
  );
}
