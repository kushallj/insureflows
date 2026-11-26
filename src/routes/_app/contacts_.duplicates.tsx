import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Merge } from "lucide-react";
import { findDuplicateGroups, mergeContacts, type DuplicateGroup } from "@/lib/network.functions";
import { StageBadge } from "@/components/stage-badge";
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
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/contacts_/duplicates")({
  ssr: false,
  head: () => ({ meta: [{ title: "Duplicate contacts — InsureFlow" }] }),
  component: DuplicatesPage,
});

function DuplicatesPage() {
  const groupsFn = useServerFn(findDuplicateGroups);
  const {
    data: groups,
    isLoading,
    error,
  } = useQuery({
    queryKey: ["contacts", "duplicate-groups"],
    queryFn: () => groupsFn(),
  });

  return (
    <div className="flex flex-col h-full">
      <header className="h-14 border-b pl-14 pr-4 md:px-6 flex items-center gap-3 bg-background">
        <Link to="/contacts">
          <Button variant="ghost" size="icon" aria-label="Back to contacts">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-base font-semibold">Duplicate contacts</h1>
          <p className="text-xs text-muted-foreground">
            Same phone number, same email, or same name in the same city. Nothing is merged until
            you confirm.
          </p>
        </div>
      </header>
      <div className="flex-1 overflow-auto p-4 md:p-6 space-y-4 max-w-4xl w-full mx-auto">
        {isLoading && <p className="text-sm text-muted-foreground">Looking for duplicates…</p>}
        {error && <p className="text-sm text-destructive">{(error as Error).message}</p>}
        {groups && groups.length === 0 && (
          <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
            No duplicates found. Your contacts look clean.
          </div>
        )}
        {groups?.map((g) => (
          <GroupCard key={g.contacts.map((c) => c.id).join("-")} group={g} />
        ))}
      </div>
    </div>
  );
}

function GroupCard({ group }: { group: DuplicateGroup }) {
  const queryClient = useQueryClient();
  const mergeFn = useServerFn(mergeContacts);
  // Keep the most complete contact by default.
  const filled = (c: DuplicateGroup["contacts"][number]) =>
    Object.values(c).filter((v) => v != null && v !== "" && !(Array.isArray(v) && !v.length))
      .length;
  const [keep, setKeep] = useState(
    () => [...group.contacts].sort((a, b) => filled(b) - filled(a))[0].id,
  );
  const [confirm, setConfirm] = useState(false);
  const keepName = group.contacts.find((c) => c.id === keep)?.name;

  const merge = useMutation({
    mutationFn: () =>
      mergeFn({
        data: { keep, merge: group.contacts.filter((c) => c.id !== keep).map((c) => c.id) },
      }),
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      toast.success(`Merged ${r.merged} contact${r.merged === 1 ? "" : "s"} into ${keepName}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="rounded-lg border bg-card">
      <div className="px-4 py-3 border-b flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground">{group.reasons.join(" · ")}</div>
        <Button size="sm" onClick={() => setConfirm(true)} disabled={merge.isPending}>
          <Merge className="h-4 w-4 mr-1.5" />{" "}
          {merge.isPending ? "Merging…" : `Merge into ${keepName}`}
        </Button>
      </div>
      <div className="divide-y">
        {group.contacts.map((c) => (
          <label
            key={c.id}
            className={cn(
              "flex items-start gap-3 px-4 py-3 cursor-pointer",
              keep === c.id && "bg-muted/40",
            )}
          >
            <input
              type="radio"
              name={`keep-${group.contacts[0].id}`}
              checked={keep === c.id}
              onChange={() => setKeep(c.id)}
              className="mt-1 accent-primary"
            />
            <div className="min-w-0 flex-1 grid gap-1 sm:grid-cols-[1.4fr_1fr_1.4fr_1fr_auto] sm:items-center text-sm">
              <span className="font-medium truncate">
                {c.name}{" "}
                {keep === c.id && <span className="text-xs text-muted-foreground">(keep)</span>}
              </span>
              <span className="text-muted-foreground truncate">{c.phone ?? "—"}</span>
              <span className="text-muted-foreground truncate">{c.email ?? "—"}</span>
              <span className="text-muted-foreground truncate">{c.city ?? "—"}</span>
              <StageBadge stage={c.pipeline_stage} />
            </div>
          </label>
        ))}
      </div>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Merge into {keepName}?</AlertDialogTitle>
            <AlertDialogDescription>
              Policies, tasks, activity and referral asks move to {keepName}. Empty fields are
              filled from the others, tags are combined and notes joined. The other{" "}
              {group.contacts.length - 1} contact
              {group.contacts.length === 2 ? " is" : "s are"} then removed. This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => merge.mutate()}>Merge</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
