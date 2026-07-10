import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useNavigate } from "@tanstack/react-router";
import {
  createCampaign,
  updateCampaign,
  type CampaignStatus,
  type CampaignWithRelated,
} from "@/lib/campaigns.functions";
import { listTemplates, type Template, type TemplateChannel } from "@/lib/templates.functions";
import { listSegments, previewSegment, type Segment } from "@/lib/segments.functions";
import { renderTemplate, SAMPLE_VARS } from "@/lib/template-render";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { ChevronLeft, ChevronRight, Save, Send, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const CHANNELS: { value: TemplateChannel; label: string }[] = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "sms", label: "SMS" },
  { value: "email", label: "Email" },
];

type Draft = {
  name: string;
  channel: TemplateChannel;
  template_id: string | null;
  segment_id: string | null;
  scheduled_at: string | null;
};

export function CampaignWizard({
  initial,
  campaignId,
}: {
  initial?: CampaignWithRelated | null;
  campaignId?: string;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const createFn = useServerFn(createCampaign);
  const updateFn = useServerFn(updateCampaign);
  const previewFn = useServerFn(previewSegment);
  const listTemplatesFn = useServerFn(listTemplates);
  const listSegmentsFn = useServerFn(listSegments);

  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<Draft>({
    name: initial?.name ?? "",
    channel: initial?.channel ?? "whatsapp",
    template_id: initial?.template_id ?? null,
    segment_id: initial?.segment_id ?? null,
    scheduled_at: initial?.scheduled_at ?? null,
  });

  const templatesQ = useQuery({
    queryKey: ["templates"],
    queryFn: () => listTemplatesFn(),
  });
  const segmentsQ = useQuery({
    queryKey: ["segments"],
    queryFn: () => listSegmentsFn(),
  });

  const templates = (templatesQ.data ?? []).filter((t) => t.channel === draft.channel);
  const selectedTemplate: Template | undefined = templatesQ.data?.find(
    (t) => t.id === draft.template_id,
  );
  const selectedSegment: Segment | undefined = segmentsQ.data?.find(
    (s) => s.id === draft.segment_id,
  );

  const audienceQ = useQuery({
    queryKey: ["campaign-audience", draft.segment_id],
    queryFn: () =>
      selectedSegment
        ? previewFn({ data: { filters: selectedSegment.filter_criteria } })
        : Promise.resolve({ count: 0, sample: [] }),
    enabled: !!selectedSegment,
  });

  const preview = useMemo(
    () => (selectedTemplate ? renderTemplate(selectedTemplate.body, SAMPLE_VARS) : ""),
    [selectedTemplate],
  );

  const save = useMutation({
    mutationFn: async (status: CampaignStatus) => {
      const payload = {
        name: draft.name,
        channel: draft.channel,
        template_id: draft.template_id,
        segment_id: draft.segment_id,
        status,
        scheduled_at: status === "scheduled" ? draft.scheduled_at : draft.scheduled_at,
        audience_count_snapshot: audienceQ.data?.count ?? null,
      };
      if (campaignId) {
        return updateFn({ data: { id: campaignId, patch: payload } });
      }
      return createFn({ data: payload });
    },
    onSuccess: (row: any) => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      toast.success(campaignId ? "Campaign updated" : "Campaign created");
      navigate({ to: "/campaigns/$id", params: { id: campaignId ?? row.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canNext =
    (step === 1 && !!draft.name.trim() && !!draft.channel) ||
    (step === 2 && !!draft.template_id) ||
    (step === 3 && !!draft.segment_id) ||
    step === 4;

  return (
    <div className="flex flex-col h-full">
      <header className="h-14 border-b pl-14 pr-4 md:px-6 flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold tracking-tight">
            {campaignId ? "Edit campaign" : "New campaign"}
          </h1>
          <p className="text-xs text-muted-foreground">Step {step} of 4</p>
        </div>
        <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/campaigns" })}>
          Cancel
        </Button>
      </header>

      <div className="flex items-center gap-2 px-6 py-3 border-b bg-muted/30">
        {["Basics", "Template", "Segment", "Review"].map((label, i) => {
          const s = i + 1;
          return (
            <div key={label} className="flex items-center gap-2">
              <div
                className={cn(
                  "h-6 w-6 rounded-full text-xs flex items-center justify-center font-medium",
                  step === s
                    ? "bg-primary text-primary-foreground"
                    : step > s
                      ? "bg-emerald-500 text-white"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {s}
              </div>
              <span
                className={cn("text-xs", step === s ? "font-medium" : "text-muted-foreground")}
              >
                {label}
              </span>
              {s < 4 && <ChevronRight className="h-3 w-3 text-muted-foreground mx-1" />}
            </div>
          );
        })}
      </div>

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-2xl space-y-4">
          {step === 1 && (
            <>
              <div>
                <Label htmlFor="c-name">Campaign name</Label>
                <Input
                  id="c-name"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="August renewal push"
                />
              </div>
              <div>
                <Label>Channel</Label>
                <Select
                  value={draft.channel}
                  onValueChange={(v) =>
                    setDraft({ ...draft, channel: v as TemplateChannel, template_id: null })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CHANNELS.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <Label>Choose a {draft.channel} template</Label>
              {templatesQ.isLoading ? (
                <p className="text-sm text-muted-foreground">Loading templates…</p>
              ) : templates.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  No {draft.channel} templates yet.{" "}
                  <a href="/templates" className="text-primary underline">
                    Create one
                  </a>
                  .
                </div>
              ) : (
                <div className="space-y-2">
                  {templates.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setDraft({ ...draft, template_id: t.id })}
                      className={cn(
                        "w-full text-left rounded-lg border p-3 hover:border-primary/50 transition-colors",
                        draft.template_id === t.id && "border-primary bg-primary/5",
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className="font-medium text-sm">{t.name}</div>
                        <Badge variant="outline" className="capitalize">
                          {t.status}
                        </Badge>
                      </div>
                      {t.subject && (
                        <div className="text-xs text-muted-foreground mt-1">
                          Subject: {t.subject}
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground line-clamp-2 mt-1">
                        {t.body}
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {selectedTemplate && (
                <div className="rounded-lg border bg-muted/30 p-4 mt-3">
                  <div className="text-xs uppercase tracking-wide text-muted-foreground mb-2">
                    Preview
                  </div>
                  <div className="text-sm whitespace-pre-wrap">{preview}</div>
                </div>
              )}
            </>
          )}

          {step === 3 && (
            <>
              <Label>Choose a segment</Label>
              {segmentsQ.isLoading ? (
                <p className="text-sm text-muted-foreground">Loading segments…</p>
              ) : (segmentsQ.data ?? []).length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  No segments yet.{" "}
                  <a href="/segments/new" className="text-primary underline">
                    Create one
                  </a>
                  .
                </div>
              ) : (
                <div className="space-y-2">
                  {segmentsQ.data!.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => setDraft({ ...draft, segment_id: s.id })}
                      className={cn(
                        "w-full text-left rounded-lg border p-3 hover:border-primary/50 transition-colors",
                        draft.segment_id === s.id && "border-primary bg-primary/5",
                      )}
                    >
                      <div className="font-medium text-sm">{s.name}</div>
                      {s.description && (
                        <div className="text-xs text-muted-foreground mt-1">
                          {s.description}
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
              {selectedSegment && (
                <div className="rounded-lg border p-4 mt-3 flex items-center gap-3">
                  <Users className="h-5 w-5 text-primary" />
                  <div>
                    <div className="text-2xl font-semibold tabular-nums">
                      {audienceQ.isLoading ? "…" : (audienceQ.data?.count ?? 0)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      contacts match this segment right now
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {step === 4 && (
            <>
              <div className="rounded-lg border divide-y">
                <ReviewRow label="Name" value={draft.name} />
                <ReviewRow label="Channel" value={draft.channel} />
                <ReviewRow label="Template" value={selectedTemplate?.name ?? "—"} />
                <ReviewRow label="Segment" value={selectedSegment?.name ?? "—"} />
                <ReviewRow
                  label="Audience"
                  value={
                    audienceQ.isLoading
                      ? "…"
                      : `${audienceQ.data?.count ?? 0} contacts`
                  }
                />
              </div>
              <div>
                <Label htmlFor="c-schedule">Schedule (optional)</Label>
                <Input
                  id="c-schedule"
                  type="datetime-local"
                  value={draft.scheduled_at ? toLocalInput(draft.scheduled_at) : ""}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      scheduled_at: e.target.value
                        ? new Date(e.target.value).toISOString()
                        : null,
                    })
                  }
                />
                <p className="text-xs text-muted-foreground mt-1">
                  The external messaging service picks up campaigns with status
                  &quot;scheduled&quot; at or after this time.
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      <footer className="border-t px-6 py-3 flex items-center justify-between bg-background">
        <Button
          variant="outline"
          size="sm"
          disabled={step === 1}
          onClick={() => setStep((s) => Math.max(1, s - 1))}
        >
          <ChevronLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        {step < 4 ? (
          <Button size="sm" disabled={!canNext} onClick={() => setStep((s) => s + 1)}>
            Next <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={save.isPending}
              onClick={() => save.mutate("draft")}
            >
              <Save className="h-4 w-4 mr-1.5" /> Save as draft
            </Button>
            <Button
              size="sm"
              disabled={save.isPending || !draft.scheduled_at || !draft.template_id || !draft.segment_id}
              onClick={() => save.mutate("scheduled")}
            >
              <Send className="h-4 w-4 mr-1.5" /> Schedule
            </Button>
          </div>
        )}
      </footer>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-4 px-4 py-2.5">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm capitalize">{value}</div>
    </div>
  );
}

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
