import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  TEMPLATE_VARIABLES,
  type Template,
  type TemplateChannel,
  type TemplateStatus,
} from "@/lib/templates.functions";
import { renderTemplate, SAMPLE_VARS } from "@/lib/template-render";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Plus, Trash2, MessageSquare, Mail, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/templates")({
  ssr: false,
  head: () => ({ meta: [{ title: "Templates — InsureFlow" }] }),
  component: TemplatesPage,
});

const CHANNELS: { value: TemplateChannel; label: string }[] = [
  { value: "whatsapp", label: "WhatsApp" },
  { value: "sms", label: "SMS" },
  { value: "email", label: "Email" },
];

function channelIcon(c: TemplateChannel) {
  if (c === "email") return <Mail className="h-3.5 w-3.5" />;
  if (c === "sms") return <Smartphone className="h-3.5 w-3.5" />;
  return <MessageSquare className="h-3.5 w-3.5" />;
}

function TemplatesPage() {
  const listFn = useServerFn(listTemplates);
  const q = useQuery({ queryKey: ["templates"], queryFn: () => listFn() });
  const [editing, setEditing] = useState<Template | "new" | null>(null);

  return (
    <div className="flex flex-col h-screen">
      <header className="h-14 border-b px-6 flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold tracking-tight">Templates</h1>
          <p className="text-xs text-muted-foreground">
            {q.data?.length ?? 0} template{(q.data?.length ?? 0) === 1 ? "" : "s"}
          </p>
        </div>
        <Button size="sm" onClick={() => setEditing("new")}>
          <Plus className="h-4 w-4 mr-1.5" /> New template
        </Button>
      </header>

      <div className="flex-1 overflow-auto">
        {q.isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-16">Loading…</p>
        ) : !q.data?.length ? (
          <EmptyState onCreate={() => setEditing("new")} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {q.data.map((t) => (
                <TemplateRow key={t.id} template={t} onEdit={() => setEditing(t)} />
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {editing !== null && (
        <TemplateEditor
          template={editing === "new" ? null : editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
        <MessageSquare className="h-5 w-5 text-primary" />
      </div>
      <h3 className="font-semibold">No templates yet</h3>
      <p className="text-sm text-muted-foreground mt-1 max-w-sm">
        Create reusable WhatsApp, SMS or email templates with variables like
        {" "}<code className="text-xs">{"{{name}}"}</code> and{" "}
        <code className="text-xs">{"{{renewal_date}}"}</code>.
      </p>
      <div className="mt-4">
        <Button size="sm" onClick={onCreate}>
          <Plus className="h-4 w-4 mr-1.5" /> New template
        </Button>
      </div>
    </div>
  );
}

function TemplateRow({ template, onEdit }: { template: Template; onEdit: () => void }) {
  const queryClient = useQueryClient();
  const delFn = useServerFn(deleteTemplate);
  const del = useMutation({
    mutationFn: () => delFn({ data: { id: template.id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      toast.success("Template deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <TableRow className="cursor-pointer" onClick={onEdit}>
      <TableCell className="font-medium">{template.name}</TableCell>
      <TableCell>
        <Badge variant="secondary" className="gap-1">
          {channelIcon(template.channel)}
          {template.channel}
        </Badge>
      </TableCell>
      <TableCell>
        <Badge
          variant={template.status === "approved" ? "default" : "outline"}
          className={cn(template.status === "approved" && "bg-emerald-600 hover:bg-emerald-600")}
        >
          {template.status}
        </Badge>
      </TableCell>
      <TableCell className="text-muted-foreground text-xs">
        {new Date(template.updated_at).toLocaleDateString()}
      </TableCell>
      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this template?</AlertDialogTitle>
              <AlertDialogDescription>
                {template.name} will be removed. Campaigns using it will keep their reference cleared.
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

function TemplateEditor({
  template,
  onClose,
}: {
  template: Template | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const createFn = useServerFn(createTemplate);
  const updateFn = useServerFn(updateTemplate);

  const [name, setName] = useState(template?.name ?? "");
  const [channel, setChannel] = useState<TemplateChannel>(template?.channel ?? "whatsapp");
  const [subject, setSubject] = useState(template?.subject ?? "");
  const [body, setBody] = useState(template?.body ?? "");
  const [status, setStatus] = useState<TemplateStatus>(template?.status ?? "draft");

  const preview = useMemo(() => renderTemplate(body, SAMPLE_VARS), [body]);
  const previewSubject = useMemo(() => renderTemplate(subject, SAMPLE_VARS), [subject]);

  const save = useMutation({
    mutationFn: async () => {
      if (template) {
        return updateFn({
          data: {
            id: template.id,
            patch: { name, channel, subject, body, status },
          },
        });
      }
      return createFn({ data: { name, channel, subject, body, status } });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      toast.success(template ? "Template updated" : "Template created");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function insertVar(v: string) {
    setBody((b) => `${b}{{${v}}}`);
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{template ? "Edit template" : "New template"}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-6 max-h-[70vh] overflow-y-auto pr-1">
          {/* Form */}
          <div className="space-y-3">
            <div>
              <Label htmlFor="tpl-name">Name</Label>
              <Input
                id="tpl-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Renewal reminder — 30 day"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Channel</Label>
                <Select value={channel} onValueChange={(v) => setChannel(v as TemplateChannel)}>
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
              <div>
                <Label>Status</Label>
                <Select value={status} onValueChange={(v) => setStatus(v as TemplateStatus)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="approved">Approved</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {channel === "email" && (
              <div>
                <Label htmlFor="tpl-subject">Subject</Label>
                <Input
                  id="tpl-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Hi {{name}}, your {{policy}} is up for renewal"
                />
              </div>
            )}
            <div>
              <Label htmlFor="tpl-body">Body</Label>
              <Textarea
                id="tpl-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={10}
                placeholder="Hi {{name}}, your {{policy}} renews on {{renewal_date}}. Premium: {{premium}}. — {{advisor_name}}"
                className="font-mono text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Insert variable</Label>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {TEMPLATE_VARIABLES.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => insertVar(v)}
                    className="text-[11px] rounded bg-accent text-accent-foreground hover:bg-accent/70 px-1.5 py-0.5 font-mono"
                  >
                    {`{{${v}}}`}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              Live preview (sample data)
            </Label>
            <div className="rounded-lg border bg-muted/30 p-4 space-y-2 min-h-[300px]">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="secondary" className="gap-1">
                  {channelIcon(channel)}
                  {channel}
                </Badge>
                <span>to {SAMPLE_VARS.name}</span>
              </div>
              {channel === "email" && (
                <div className="text-sm font-semibold border-b pb-2">
                  {previewSubject || <span className="text-muted-foreground italic">No subject</span>}
                </div>
              )}
              <div className="text-sm whitespace-pre-wrap">
                {preview || <span className="text-muted-foreground italic">Preview appears here…</span>}
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Sample: name={SAMPLE_VARS.name}, city={SAMPLE_VARS.city}, renewal_date={SAMPLE_VARS.renewal_date}, policy={SAMPLE_VARS.policy}, premium={SAMPLE_VARS.premium}.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || !name.trim()}>
            {save.isPending ? "Saving…" : template ? "Save changes" : "Create template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
