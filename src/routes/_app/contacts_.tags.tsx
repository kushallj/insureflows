import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Pencil, Trash2 } from "lucide-react";
import { deleteTag, listTagCounts, renameTag } from "@/lib/network.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

export const Route = createFileRoute("/_app/contacts_/tags")({
  ssr: false,
  head: () => ({ meta: [{ title: "Manage tags — InsureFlow" }] }),
  component: TagsPage,
});

function TagsPage() {
  const countsFn = useServerFn(listTagCounts);
  const {
    data: tags,
    isLoading,
    error,
  } = useQuery({ queryKey: ["contacts", "tag-counts"], queryFn: () => countsFn() });

  return (
    <div className="flex flex-col h-full">
      <header className="h-14 border-b pl-14 pr-4 md:px-6 flex items-center gap-3 bg-background">
        <Link to="/contacts">
          <Button variant="ghost" size="icon" aria-label="Back to contacts">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-base font-semibold">Manage tags</h1>
          <p className="text-xs text-muted-foreground">
            Rename a tag on every contact at once. Renaming to an existing tag merges the two.
          </p>
        </div>
      </header>
      <div className="flex-1 overflow-auto p-4 md:p-6 max-w-2xl w-full mx-auto">
        {isLoading && <p className="text-sm text-muted-foreground">Loading tags…</p>}
        {error && <p className="text-sm text-destructive">{(error as Error).message}</p>}
        {tags && tags.length === 0 && (
          <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
            No tags yet. Add tags on a contact, or select contacts on the list and use “Add tag”.
          </div>
        )}
        {tags && tags.length > 0 && (
          <div className="rounded-lg border bg-card divide-y">
            {tags.map((t) => (
              <TagRow key={t.tag} tag={t.tag} count={t.count} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function TagRow({ tag, count }: { tag: string; count: number }) {
  const queryClient = useQueryClient();
  const renameFn = useServerFn(renameTag);
  const deleteFn = useServerFn(deleteTag);
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(tag);
  const [confirm, setConfirm] = useState(false);
  const done = (msg: string) => {
    queryClient.invalidateQueries({ queryKey: ["contacts"] });
    toast.success(msg);
  };
  const rename = useMutation({
    mutationFn: () => renameFn({ data: { from: tag, to: value } }),
    onSuccess: (r) => {
      setEditing(false);
      done(`Renamed on ${r.changed} contact${r.changed === 1 ? "" : "s"}`);
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: () => deleteFn({ data: { tag } }),
    onSuccess: (r) => done(`Removed from ${r.changed} contact${r.changed === 1 ? "" : "s"}`),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      {editing ? (
        <form
          className="flex flex-1 gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (value.trim() && value.trim() !== tag) rename.mutate();
            else setEditing(false);
          }}
        >
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="h-8"
            autoFocus
            maxLength={40}
          />
          <Button size="sm" type="submit" disabled={rename.isPending}>
            Save
          </Button>
          <Button size="sm" type="button" variant="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </form>
      ) : (
        <>
          <span className="flex-1 text-sm font-medium truncate">{tag}</span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {count} contact{count === 1 ? "" : "s"}
          </span>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            aria-label={`Rename ${tag}`}
            onClick={() => setEditing(true)}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8"
            aria-label={`Delete ${tag}`}
            onClick={() => setConfirm(true)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </>
      )}
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete the tag “{tag}”?</AlertDialogTitle>
            <AlertDialogDescription>
              It is removed from {count} contact{count === 1 ? "" : "s"}. The contacts themselves
              stay.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => del.mutate()}>Delete tag</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
