import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LeadScoreGauge } from "@/components/lead-score";
import { Sparkles, RefreshCw, Gauge } from "lucide-react";
import { toast } from "sonner";

async function invokeStub<T = any>(
  fn: "recompute-lead-score" | "regenerate-ai-summary",
  contact_id: string,
): Promise<T> {
  const { data, error } = await supabase.functions.invoke(fn, {
    body: { contact_id },
  });
  if (error) throw new Error(error.message);
  if (data && (data as any).ok === false) {
    throw new Error((data as any).error ?? "Unknown error");
  }
  return data as T;
}

export function AiPanel({
  contactId,
  leadScore,
  aiSummary,
}: {
  contactId: string;
  leadScore: number;
  aiSummary: string | null;
}) {
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["contacts"] });

  const recompute = useMutation({
    mutationFn: () => invokeStub("recompute-lead-score", contactId),
    onSuccess: () => {
      invalidate();
      toast.success("Lead score recomputed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const regenerate = useMutation({
    mutationFn: () => invokeStub("regenerate-ai-summary", contactId),
    onSuccess: () => {
      invalidate();
      toast.success("AI summary regenerated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      <LeadScoreGauge score={leadScore} />

      <div className="rounded-lg border bg-card p-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-medium">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            AI summary
          </div>
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Placeholder
          </span>
        </div>
        {aiSummary ? (
          <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
            {aiSummary}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground italic">
            No AI summary yet. Click &quot;Regenerate summary&quot; to create one.
          </p>
        )}
      </div>

      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          className="flex-1"
          disabled={recompute.isPending}
          onClick={() => recompute.mutate()}
        >
          <Gauge className="h-3.5 w-3.5 mr-1.5" />
          {recompute.isPending ? "Scoring…" : "Recompute score"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="flex-1"
          disabled={regenerate.isPending}
          onClick={() => regenerate.mutate()}
        >
          <RefreshCw
            className={`h-3.5 w-3.5 mr-1.5 ${regenerate.isPending ? "animate-spin" : ""}`}
          />
          {regenerate.isPending ? "Generating…" : "Regenerate summary"}
        </Button>
      </div>
    </div>
  );
}
