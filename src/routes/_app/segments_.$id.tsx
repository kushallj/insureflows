import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getSegment,
  updateSegment,
  deleteSegment,
  type SegmentFilters,
} from "@/lib/segments.functions";
import { SegmentBuilder } from "@/components/segment-builder";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { ArrowLeft, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/segments_/$id")({
  ssr: false,
  head: () => ({ meta: [{ title: "Segment — InsureFlow" }] }),
  component: EditSegmentPage,
});

function EditSegmentPage() {
  const { id } = Route.useParams();
  const getFn = useServerFn(getSegment);
  const updateFn = useServerFn(updateSegment);
  const deleteFn = useServerFn(deleteSegment);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const q = useQuery({
    queryKey: ["segments", id],
    queryFn: () => getFn({ data: { id } }),
  });

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [filters, setFilters] = useState<SegmentFilters>({});
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    if (!seeded && q.data) {
      setName(q.data.name);
      setDescription(q.data.description ?? "");
      setFilters(q.data.filter_criteria ?? {});
      setSeeded(true);
    }
  }, [q.data, seeded]);

  const save = useMutation({
    mutationFn: () =>
      updateFn({
        data: {
          id,
          patch: { name, description: description || null, filter_criteria: filters },
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["segments"] });
      toast.success("Segment updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: () => deleteFn({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["segments"] });
      toast.success("Segment deleted");
      navigate({ to: "/segments" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (q.isLoading || !seeded) {
    return <p className="text-sm text-muted-foreground text-center py-16">Loading…</p>;
  }
  if (!q.data) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-muted-foreground">Segment not found.</p>
        <Link to="/segments" className="text-primary text-sm underline mt-2 inline-block">
          Back to segments
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <header className="h-14 border-b px-6 flex items-center gap-3">
        <Link to="/segments">
          <Button size="icon" variant="ghost" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-base font-semibold tracking-tight truncate">{q.data.name}</h1>
        <div className="ml-auto flex items-center gap-2">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="ghost" className="text-destructive">
                <Trash2 className="h-4 w-4 mr-1.5" /> Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this segment?</AlertDialogTitle>
                <AlertDialogDescription>
                  Contacts are not affected. This can't be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => del.mutate()}>Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Button
            size="sm"
            disabled={save.isPending || !name.trim()}
            onClick={() => save.mutate()}
          >
            {save.isPending ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl">
          <div className="space-y-1.5">
            <Label className="text-xs">Name*</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Description</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
        </div>

        <SegmentBuilder filters={filters} onChange={setFilters} />
      </div>
    </div>
  );
}
