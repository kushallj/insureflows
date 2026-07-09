import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listActivities, addNote, type ActivityType } from "@/lib/activities.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  StickyNote,
  ArrowRightLeft,
  CheckCircle2,
  MessageSquare,
  Circle,
} from "lucide-react";
import { toast } from "sonner";

const ICONS: Record<ActivityType, React.ComponentType<{ className?: string }>> = {
  note: StickyNote,
  stage_change: ArrowRightLeft,
  task_completed: CheckCircle2,
  message_sent: MessageSquare,
  other: Circle,
};
const LABELS: Record<ActivityType, string> = {
  note: "Note",
  stage_change: "Stage changed",
  task_completed: "Task completed",
  message_sent: "Message sent",
  other: "Activity",
};

export function ActivityTimeline({ contactId }: { contactId: string }) {
  const listFn = useServerFn(listActivities);
  const q = useQuery({
    queryKey: ["activities", contactId],
    queryFn: () => listFn({ data: { contact_id: contactId } }),
  });

  const [note, setNote] = useState("");
  const queryClient = useQueryClient();
  const addFn = useServerFn(addNote);
  const mut = useMutation({
    mutationFn: () => addFn({ data: { contact_id: contactId, description: note } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activities", contactId] });
      setNote("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      <div className="rounded-lg border bg-card p-3 space-y-2">
        <Textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Add a note about this contact…"
          rows={3}
        />
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={() => note.trim() && mut.mutate()}
            disabled={!note.trim() || mut.isPending}
          >
            {mut.isPending ? "Adding…" : "Add note"}
          </Button>
        </div>
      </div>

      {q.isLoading ? (
        <p className="text-sm text-muted-foreground py-6 text-center">Loading…</p>
      ) : !q.data?.length ? (
        <div className="rounded-lg border border-dashed p-6 text-center">
          <p className="text-sm text-muted-foreground">No activity yet.</p>
        </div>
      ) : (
        <ol className="relative border-l ml-2 space-y-4 py-1">
          {q.data.map((a) => {
            const Icon = ICONS[a.activity_type] ?? Circle;
            return (
              <li key={a.id} className="ml-5 relative">
                <span className="absolute -left-[26px] top-0 flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Icon className="h-3 w-3" />
                </span>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{LABELS[a.activity_type]}</span>
                  <span>·</span>
                  <span className="tabular-nums">
                    {new Date(a.created_at).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </span>
                </div>
                {a.description && (
                  <p className="text-sm mt-0.5 whitespace-pre-wrap">{a.description}</p>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
