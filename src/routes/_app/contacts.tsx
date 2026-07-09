import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useMutation, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  listContacts,
  getDistinctTags,
  createContact,
  updateContact,
  deleteContact,
} from "@/lib/contacts.functions";
import type {
  Contact,
  ContactInput,
  PipelineStage,
  PreferredChannel,
  SortKey,
} from "@/lib/contact-fields";
import { PIPELINE_STAGES, PREFERRED_CHANNELS, STAGE_LABEL } from "@/lib/contact-fields";
import { StageBadge } from "@/components/stage-badge";
import { LeadScoreBadge } from "@/components/lead-score";
import { AiPanel } from "@/components/ai-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { PoliciesTab } from "@/components/policies-tab";
import { TasksWidget } from "@/components/tasks-widget";
import { ActivityTimeline } from "@/components/activity-timeline";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
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
import { toast } from "sonner";
import {
  Filter,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
  ArrowUpDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

const contactsKey = (args: unknown) => ["contacts", args] as const;

export const Route = createFileRoute("/_app/contacts")({
  ssr: false,
  head: () => ({ meta: [{ title: "Contacts — InsureFlow" }] }),
  component: ContactsPage,
});

function ContactsPage() {
  const [search, setSearch] = useState("");
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [tagFilter, setTagFilter] = useState<string[]>([]);
  const [sort, setSort] = useState<SortKey>("lead_score_desc");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const listFn = useServerFn(listContacts);
  const tagsFn = useServerFn(getDistinctTags);

  const args = { search, stages, tags: tagFilter, sort };
  const listOptions = queryOptions({
    queryKey: contactsKey(args),
    queryFn: () => listFn({ data: args }),
  });
  const { data: contacts } = useSuspenseQuery(listOptions);
  const tagsQuery = useQuery({
    queryKey: ["contacts", "tags"],
    queryFn: () => tagsFn(),
  });

  const selected = useMemo(
    () => contacts.find((c) => c.id === selectedId) ?? null,
    [contacts, selectedId],
  );

  return (
    <div className="flex flex-col h-screen">
      <header className="h-14 border-b px-6 flex items-center justify-between bg-background">
        <div>
          <h1 className="text-base font-semibold tracking-tight">Contacts</h1>
          <p className="text-xs text-muted-foreground">
            {contacts.length} {contacts.length === 1 ? "contact" : "contacts"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/contacts/import">
            <Button variant="outline" size="sm">
              <Upload className="h-4 w-4 mr-1.5" /> Import CSV
            </Button>
          </Link>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> Add contact
          </Button>
        </div>
      </header>

      <div className="px-6 py-3 border-b bg-muted/30 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search name, phone, email, city…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9"
          />
        </div>
        <StageFilter value={stages} onChange={setStages} />
        <TagFilter value={tagFilter} onChange={setTagFilter} available={tagsQuery.data ?? []} />
        <SortMenu value={sort} onChange={setSort} />
      </div>

      <div className="flex-1 overflow-auto">
        {contacts.length === 0 ? (
          <EmptyState onAdd={() => setAddOpen(true)} />
        ) : (
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>City</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead className="text-right">Score</TableHead>
                <TableHead>Next follow-up</TableHead>
                <TableHead>Tags</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacts.map((c) => (
                <TableRow
                  key={c.id}
                  onClick={() => setSelectedId(c.id)}
                  className="cursor-pointer"
                >
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-muted-foreground">{c.phone ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{c.email ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">{c.city ?? "—"}</TableCell>
                  <TableCell>
                    <StageBadge stage={c.pipeline_stage} />
                  </TableCell>
                  <TableCell className="text-right"><LeadScoreBadge score={c.lead_score} /></TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">
                    {formatDate(c.next_followup_at)}
                  </TableCell>
                  <TableCell>
                    <TagChips tags={c.tags} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <ContactDrawer
        contact={selected}
        onClose={() => setSelectedId(null)}
      />
      <AddContactDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full py-20 text-center px-6">
      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
        <Plus className="h-5 w-5 text-primary" />
      </div>
      <h3 className="font-semibold">No contacts yet</h3>
      <p className="text-sm text-muted-foreground mt-1 max-w-sm">
        Add your first contact manually, or import a CSV to bring in your existing book.
      </p>
      <div className="mt-4 flex gap-2">
        <Button size="sm" onClick={onAdd}>
          <Plus className="h-4 w-4 mr-1.5" /> Add contact
        </Button>
        <Link to="/contacts/import">
          <Button variant="outline" size="sm">
            <Upload className="h-4 w-4 mr-1.5" /> Import CSV
          </Button>
        </Link>
      </div>
    </div>
  );
}

function StageFilter({
  value,
  onChange,
}: {
  value: PipelineStage[];
  onChange: (v: PipelineStage[]) => void;
}) {
  function toggle(s: PipelineStage) {
    onChange(value.includes(s) ? value.filter((x) => x !== s) : [...value, s]);
  }
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9">
          <Filter className="h-4 w-4 mr-1.5" /> Stage
          {value.length > 0 && (
            <span className="ml-1.5 rounded bg-primary/15 text-primary px-1.5 text-[10px] font-medium">
              {value.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-52 p-2">
        <div className="space-y-1">
          {PIPELINE_STAGES.map((s) => (
            <label
              key={s}
              className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer text-sm"
            >
              <Checkbox
                checked={value.includes(s)}
                onCheckedChange={() => toggle(s)}
              />
              <StageBadge stage={s} />
            </label>
          ))}
          {value.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-1"
              onClick={() => onChange([])}
            >
              Clear
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function TagFilter({
  value,
  onChange,
  available,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  available: string[];
}) {
  function toggle(t: string) {
    onChange(value.includes(t) ? value.filter((x) => x !== t) : [...value, t]);
  }
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9" disabled={available.length === 0}>
          <Filter className="h-4 w-4 mr-1.5" /> Tags
          {value.length > 0 && (
            <span className="ml-1.5 rounded bg-primary/15 text-primary px-1.5 text-[10px] font-medium">
              {value.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2 max-h-72 overflow-auto">
        <div className="space-y-1">
          {available.length === 0 ? (
            <p className="text-xs text-muted-foreground px-2 py-1">No tags yet.</p>
          ) : (
            available.map((t) => (
              <label
                key={t}
                className="flex items-center gap-2 px-2 py-1.5 rounded hover:bg-accent cursor-pointer text-sm"
              >
                <Checkbox checked={value.includes(t)} onCheckedChange={() => toggle(t)} />
                <span>{t}</span>
              </label>
            ))
          )}
          {value.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-1"
              onClick={() => onChange([])}
            >
              Clear
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function SortMenu({
  value,
  onChange,
}: {
  value: SortKey;
  onChange: (v: SortKey) => void;
}) {
  const labels: Record<SortKey, string> = {
    lead_score_desc: "Highest score",
    lead_score_asc: "Lowest score",
    next_followup_asc: "Follow-up soonest",
    next_followup_desc: "Follow-up latest",
    created_desc: "Recently added",
  };
  return (
    <Select value={value} onValueChange={(v) => onChange(v as SortKey)}>
      <SelectTrigger className="h-9 w-[180px]">
        <ArrowUpDown className="h-4 w-4 mr-1.5" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {(Object.keys(labels) as SortKey[]).map((k) => (
          <SelectItem key={k} value={k}>
            {labels[k]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function TagChips({ tags }: { tags: string[] }) {
  if (!tags?.length) return <span className="text-muted-foreground">—</span>;
  const shown = tags.slice(0, 3);
  const rest = tags.length - shown.length;
  return (
    <div className="flex flex-wrap gap-1">
      {shown.map((t) => (
        <span
          key={t}
          className="rounded bg-accent text-accent-foreground text-[11px] px-1.5 py-0.5"
        >
          {t}
        </span>
      ))}
      {rest > 0 && <span className="text-[11px] text-muted-foreground">+{rest}</span>}
    </div>
  );
}

function formatDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  const now = new Date();
  const same = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: same ? undefined : "numeric",
  });
}

function toDateInput(v: string | null) {
  if (!v) return "";
  return new Date(v).toISOString().slice(0, 10);
}
function toDateTimeInput(v: string | null) {
  if (!v) return "";
  const d = new Date(v);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function ContactDrawer({
  contact,
  onClose,
}: {
  contact: Contact | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const updateFn = useServerFn(updateContact);
  const deleteFn = useServerFn(deleteContact);

  const update = useMutation({
    mutationFn: (patch: Partial<ContactInput>) =>
      updateFn({ data: { id: contact!.id, patch } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: () => deleteFn({ data: { id: contact!.id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      toast.success("Contact deleted");
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const save = (patch: Partial<ContactInput>) => update.mutate(patch);

  return (
    <Sheet open={!!contact} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto p-0">
        {contact && (
          <>
            <SheetHeader className="px-6 pt-6">
              <SheetTitle className="text-lg">{contact.name}</SheetTitle>
              <SheetDescription className="flex items-center gap-2">
                <StageBadge stage={contact.pipeline_stage} />
                <span className="text-xs text-muted-foreground tabular-nums">
                  Score {contact.lead_score}
                </span>
              </SheetDescription>
            </SheetHeader>
            <Tabs defaultValue="details" className="px-6 pt-2 pb-4">
              <TabsList>
                <TabsTrigger value="details">Details</TabsTrigger>
                <TabsTrigger value="policies">Policies</TabsTrigger>
                <TabsTrigger value="tasks">Tasks</TabsTrigger>
                <TabsTrigger value="activity">Activity</TabsTrigger>
              </TabsList>
              <TabsContent value="details" className="pt-4 space-y-6">
                <Section title="Identity">
                <InlineText label="Name" value={contact.name} onSave={(v) => save({ name: v ?? "" })} />
                <InlineText
                  label="Gender"
                  value={contact.gender}
                  onSave={(v) => save({ gender: v })}
                />
                <InlineNumber
                  label="Age"
                  value={contact.age}
                  onSave={(v) => save({ age: v })}
                />
                <InlineDate
                  label="Date of birth"
                  value={contact.date_of_birth}
                  onSave={(v) => save({ date_of_birth: v })}
                />
                <InlineText
                  label="Occupation"
                  value={contact.occupation}
                  onSave={(v) => save({ occupation: v })}
                />
                <InlineText
                  label="City"
                  value={contact.city}
                  onSave={(v) => save({ city: v })}
                />
                <InlineNumber
                  label="Annual income"
                  value={contact.income}
                  onSave={(v) => save({ income: v })}
                />
                <InlineText
                  label="Preferred language"
                  value={contact.preferred_language}
                  onSave={(v) => save({ preferred_language: v })}
                />
              </Section>

              <Section title="Contact & channels">
                <InlineText
                  label="Phone"
                  value={contact.phone}
                  onSave={(v) => save({ phone: v })}
                />
                <InlineText
                  label="Email"
                  value={contact.email}
                  onSave={(v) => save({ email: v })}
                />
                <ToggleRow
                  label="WhatsApp opt-in"
                  value={contact.whatsapp_opt_in}
                  onSave={(v) => save({ whatsapp_opt_in: v })}
                />
                <ToggleRow
                  label="SMS opt-in"
                  value={contact.sms_opt_in}
                  onSave={(v) => save({ sms_opt_in: v })}
                />
                <ToggleRow
                  label="Email opt-in"
                  value={contact.email_opt_in}
                  onSave={(v) => save({ email_opt_in: v })}
                />
                <InlineSelect
                  label="Preferred channel"
                  value={contact.preferred_channel}
                  options={PREFERRED_CHANNELS.map((c) => ({ value: c, label: c }))}
                  onSave={(v) => save({ preferred_channel: v as PreferredChannel })}
                />
              </Section>

              <Section title="Lead">
                <InlineText
                  label="Lead source"
                  value={contact.lead_source}
                  onSave={(v) => save({ lead_source: v })}
                />
                <TagsField
                  value={contact.tags}
                  onSave={(v) => save({ tags: v })}
                />
                <InlineNumber
                  label="Lead score"
                  value={contact.lead_score}
                  onSave={(v) => save({ lead_score: v ?? 0 })}
                />
                <InlineSelect
                  label="Pipeline stage"
                  value={contact.pipeline_stage}
                  options={PIPELINE_STAGES.map((s) => ({ value: s, label: STAGE_LABEL[s] }))}
                  onSave={(v) => save({ pipeline_stage: v as PipelineStage })}
                />
              </Section>

              <Section title="Follow-up">
                <InlineDateTime
                  label="Last contact"
                  value={contact.last_contact_at}
                  onSave={(v) => save({ last_contact_at: v })}
                />
                <InlineDateTime
                  label="Next follow-up"
                  value={contact.next_followup_at}
                  onSave={(v) => save({ next_followup_at: v })}
                />
              </Section>

              <Section title="Notes">
                <NotesField value={contact.notes} onSave={(v) => save({ notes: v })} />
              </Section>
              </TabsContent>
              <TabsContent value="policies" className="pt-4">
                <PoliciesTab contactId={contact.id} />
              </TabsContent>
              <TabsContent value="tasks" className="pt-4">
                <TasksWidget contactId={contact.id} />
              </TabsContent>
              <TabsContent value="activity" className="pt-4">
                <ActivityTimeline contactId={contact.id} />
              </TabsContent>
            </Tabs>

            <SheetFooter className="px-6 py-4 border-t">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    <Trash2 className="h-4 w-4 mr-1.5" /> Delete contact
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete this contact?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This can't be undone. All information for {contact.name} will be removed.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => del.mutate()}>Delete</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h4 className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
        {title}
      </h4>
      <div className="rounded-lg border divide-y bg-card">{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[130px_1fr] items-center gap-3 px-3 py-2 text-sm">
      <div className="text-muted-foreground">{label}</div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function InlineText({
  label,
  value,
  onSave,
}: {
  label: string;
  value: string | null;
  onSave: (v: string | null) => void;
}) {
  const [v, setV] = useState(value ?? "");
  return (
    <Row label={label}>
      <Input
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => {
          const next = v.trim() === "" ? null : v.trim();
          if (next !== value) onSave(next);
        }}
        className="h-8"
      />
    </Row>
  );
}

function InlineNumber({
  label,
  value,
  onSave,
}: {
  label: string;
  value: number | null;
  onSave: (v: number | null) => void;
}) {
  const [v, setV] = useState(value == null ? "" : String(value));
  return (
    <Row label={label}>
      <Input
        type="number"
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => {
          const next = v === "" ? null : Number(v);
          if (next !== value && (next === null || !Number.isNaN(next))) onSave(next);
        }}
        className="h-8 tabular-nums"
      />
    </Row>
  );
}

function InlineDate({
  label,
  value,
  onSave,
}: {
  label: string;
  value: string | null;
  onSave: (v: string | null) => void;
}) {
  const [v, setV] = useState(toDateInput(value));
  return (
    <Row label={label}>
      <Input
        type="date"
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => {
          const next = v === "" ? null : v;
          if (next !== value) onSave(next);
        }}
        className="h-8"
      />
    </Row>
  );
}

function InlineDateTime({
  label,
  value,
  onSave,
}: {
  label: string;
  value: string | null;
  onSave: (v: string | null) => void;
}) {
  const [v, setV] = useState(toDateTimeInput(value));
  return (
    <Row label={label}>
      <Input
        type="datetime-local"
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => {
          const next = v === "" ? null : new Date(v).toISOString();
          if (next !== value) onSave(next);
        }}
        className="h-8"
      />
    </Row>
  );
}

function InlineSelect({
  label,
  value,
  options,
  onSave,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onSave: (v: string) => void;
}) {
  return (
    <Row label={label}>
      <Select value={value} onValueChange={(v) => v !== value && onSave(v)}>
        <SelectTrigger className="h-8">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Row>
  );
}

function ToggleRow({
  label,
  value,
  onSave,
}: {
  label: string;
  value: boolean;
  onSave: (v: boolean) => void;
}) {
  return (
    <Row label={label}>
      <div className="flex justify-start">
        <Switch checked={value} onCheckedChange={onSave} />
      </div>
    </Row>
  );
}

function TagsField({
  value,
  onSave,
}: {
  value: string[];
  onSave: (v: string[]) => void;
}) {
  const [input, setInput] = useState("");
  function commit(next: string) {
    const t = next.trim();
    if (!t || value.includes(t)) return;
    onSave([...value, t]);
    setInput("");
  }
  return (
    <Row label="Tags">
      <div className="flex flex-wrap gap-1.5">
        {value.map((t) => (
          <span
            key={t}
            className="inline-flex items-center gap-1 rounded bg-accent text-accent-foreground text-xs px-1.5 py-0.5"
          >
            {t}
            <button
              type="button"
              onClick={() => onSave(value.filter((x) => x !== t))}
              className="hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              commit(input);
            }
          }}
          onBlur={() => input && commit(input)}
          placeholder="Add tag…"
          className="h-7 w-28 text-xs"
        />
      </div>
    </Row>
  );
}

function NotesField({
  value,
  onSave,
}: {
  value: string | null;
  onSave: (v: string | null) => void;
}) {
  const [v, setV] = useState(value ?? "");
  return (
    <div className="p-3">
      <Textarea
        value={v}
        onChange={(e) => setV(e.target.value)}
        onBlur={() => {
          const next = v.trim() === "" ? null : v;
          if (next !== value) onSave(next);
        }}
        rows={4}
        placeholder="Add notes about this contact…"
      />
    </div>
  );
}

function AddContactDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const createFn = useServerFn(createContact);
  const [form, setForm] = useState<ContactInput>({
    name: "",
    phone: "",
    email: "",
    city: "",
    pipeline_stage: "new",
    preferred_channel: "whatsapp",
    lead_score: 0,
    tags: [],
  });
  const mut = useMutation({
    mutationFn: (input: ContactInput) => createFn({ data: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      toast.success("Contact added");
      onOpenChange(false);
      setForm({
        name: "",
        phone: "",
        email: "",
        city: "",
        pipeline_stage: "new",
        preferred_channel: "whatsapp",
        lead_score: 0,
        tags: [],
      });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return toast.error("Name is required");
    if (!form.phone?.trim() && !form.email?.trim())
      return toast.error("Phone or email is required");
    mut.mutate(form);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add contact</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid grid-cols-2 gap-3">
          <FormField label="Name*" span={2}>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              autoFocus
            />
          </FormField>
          <FormField label="Phone">
            <Input
              value={form.phone ?? ""}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </FormField>
          <FormField label="Email">
            <Input
              type="email"
              value={form.email ?? ""}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </FormField>
          <FormField label="City">
            <Input
              value={form.city ?? ""}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
            />
          </FormField>
          <FormField label="Lead source">
            <Input
              value={form.lead_source ?? ""}
              onChange={(e) => setForm({ ...form, lead_source: e.target.value })}
            />
          </FormField>
          <FormField label="Stage">
            <Select
              value={form.pipeline_stage}
              onValueChange={(v) =>
                setForm({ ...form, pipeline_stage: v as PipelineStage })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PIPELINE_STAGES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STAGE_LABEL[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Preferred channel">
            <Select
              value={form.preferred_channel}
              onValueChange={(v) =>
                setForm({ ...form, preferred_channel: v as PreferredChannel })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PREFERRED_CHANNELS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Notes" span={2}>
            <Textarea
              rows={3}
              value={form.notes ?? ""}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </FormField>
          <DialogFooter className="col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mut.isPending}>
              {mut.isPending ? "Adding…" : "Add contact"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function FormField({
  label,
  children,
  span,
}: {
  label: string;
  children: React.ReactNode;
  span?: number;
}) {
  return (
    <div className={cn("space-y-1.5", span === 2 && "col-span-2")}>
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
