import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { createSegment, type SegmentFilters } from "@/lib/segments.functions";
import { SegmentBuilder } from "@/components/segment-builder";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/segments_/new")({
  ssr: false,
  head: () => ({ meta: [{ title: "New segment — InsureFlow" }] }),
  component: NewSegmentPage,
});

function NewSegmentPage() {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [filters, setFilters] = useState<SegmentFilters>({});
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const createFn = useServerFn(createSegment);
  const mut = useMutation({
    mutationFn: () =>
      createFn({
        data: { name, description: description || null, filter_criteria: filters },
      }),
    onSuccess: (row) => {
      queryClient.invalidateQueries({ queryKey: ["segments"] });
      toast.success("Segment saved");
      navigate({ to: "/segments/$id", params: { id: row.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="flex flex-col h-full">
      <header className="h-14 border-b px-6 flex items-center gap-3">
        <Link to="/segments">
          <Button size="icon" variant="ghost" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-base font-semibold tracking-tight">New segment</h1>
        <div className="ml-auto flex items-center gap-2">
          <Link to="/segments">
            <Button variant="outline" size="sm">Cancel</Button>
          </Link>
          <Button
            size="sm"
            disabled={mut.isPending || !name.trim()}
            onClick={() => {
              if (!name.trim()) return toast.error("Name is required");
              mut.mutate();
            }}
          >
            {mut.isPending ? "Saving…" : "Save segment"}
          </Button>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl">
          <div className="space-y-1.5">
            <Label className="text-xs">Name*</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Motor renewals — Mumbai"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Description</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional short note"
            />
          </div>
        </div>

        <SegmentBuilder filters={filters} onChange={setFilters} />
      </div>
    </div>
  );
}
