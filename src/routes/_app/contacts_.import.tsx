import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import Papa from "papaparse";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { bulkCreateContacts, getDuplicateKeys } from "@/lib/contacts.functions";
import type { ContactInput, PipelineStage, PreferredChannel } from "@/lib/contact-fields";
import {
  IMPORTABLE_FIELDS,
  PIPELINE_STAGES,
  PREFERRED_CHANNELS,
} from "@/lib/contact-fields";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Upload } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/contacts_/import")({
  ssr: false,
  head: () => ({ meta: [{ title: "Import contacts — InsureFlow" }] }),
  component: ImportPage,
});

type FieldKey = keyof ContactInput | "__ignore";

type Row = {
  values: Record<string, string>;
  status: "ready" | "dup_phone" | "dup_email" | "invalid";
  reason?: string;
  include: boolean;
};

function normalize(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

const HEADER_ALIASES: Record<string, keyof ContactInput> = {
  name: "name",
  fullname: "name",
  contactname: "name",
  phone: "phone",
  phonenumber: "phone",
  mobile: "phone",
  email: "email",
  emailaddress: "email",
  gender: "gender",
  age: "age",
  dob: "date_of_birth",
  dateofbirth: "date_of_birth",
  birthday: "date_of_birth",
  occupation: "occupation",
  job: "occupation",
  city: "city",
  income: "income",
  language: "preferred_language",
  preferredlanguage: "preferred_language",
  leadsource: "lead_source",
  source: "lead_source",
  tags: "tags",
  whatsapp: "whatsapp_opt_in",
  whatsappoptin: "whatsapp_opt_in",
  sms: "sms_opt_in",
  smsoptin: "sms_opt_in",
  emailoptin: "email_opt_in",
  preferredchannel: "preferred_channel",
  channel: "preferred_channel",
  leadscore: "lead_score",
  score: "lead_score",
  stage: "pipeline_stage",
  pipeline: "pipeline_stage",
  pipelinestage: "pipeline_stage",
  notes: "notes",
};

function guessField(header: string): FieldKey {
  return HEADER_ALIASES[normalize(header)] ?? "__ignore";
}

function parseBool(v: string): boolean {
  const s = v.trim().toLowerCase();
  return s === "true" || s === "yes" || s === "y" || s === "1";
}

function ImportPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState<"upload" | "map" | "review">("upload");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<Record<string, string>[]>([]);
  const [mapping, setMapping] = useState<Record<string, FieldKey>>({});
  const [processed, setProcessed] = useState<Row[]>([]);

  const dupFn = useServerFn(getDuplicateKeys);
  const dupsQuery = useQuery({ queryKey: ["contacts", "duplicates"], queryFn: () => dupFn() });

  const bulkFn = useServerFn(bulkCreateContacts);
  const importMut = useMutation({
    mutationFn: (payload: ContactInput[]) => bulkFn({ data: { rows: payload } }),
    onSuccess: (res) => {
      toast.success(`Imported ${res.inserted} contact${res.inserted === 1 ? "" : "s"}`);
      navigate({ to: "/contacts" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const parsedHeaders = res.meta.fields ?? [];
        setHeaders(parsedHeaders);
        setRows(res.data);
        const initial: Record<string, FieldKey> = {};
        for (const h of parsedHeaders) initial[h] = guessField(h);
        setMapping(initial);
        setStep("map");
      },
      error: (err) => toast.error(err.message),
    });
  }

  function processRows(): Row[] {
    const phones = new Set(dupsQuery.data?.phones ?? []);
    const emails = new Set(dupsQuery.data?.emails ?? []);
    const seenPhones = new Set<string>();
    const seenEmails = new Set<string>();

    return rows.map((raw) => {
      const mapped: Record<string, string> = {};
      for (const [h, v] of Object.entries(raw)) {
        const field = mapping[h];
        if (!field || field === "__ignore") continue;
        mapped[field] = v ?? "";
      }
      const status: Row["status"] = (() => {
        if (!mapped.name || !mapped.name.trim()) return "invalid";
        const p = (mapped.phone ?? "").trim().toLowerCase();
        const e = (mapped.email ?? "").trim().toLowerCase();
        if (p) {
          if (phones.has(p) || seenPhones.has(p)) return "dup_phone";
          seenPhones.add(p);
        }
        if (e) {
          if (emails.has(e) || seenEmails.has(e)) return "dup_email";
          seenEmails.add(e);
        }
        return "ready";
      })();
      const reason = status === "invalid" ? "Missing name" : undefined;
      return {
        values: mapped,
        status,
        reason,
        include: status === "ready",
      };
    });
  }

  function toReview() {
    setProcessed(processRows());
    setStep("review");
  }

  function toPayload(): ContactInput[] {
    return processed
      .filter((r) => r.include)
      .map((r) => {
        const v = r.values;
        const input: ContactInput = { name: v.name?.trim() ?? "" };
        if (v.phone) input.phone = v.phone;
        if (v.email) input.email = v.email;
        if (v.gender) input.gender = v.gender;
        if (v.age) input.age = Number(v.age) || null;
        if (v.date_of_birth) input.date_of_birth = v.date_of_birth;
        if (v.occupation) input.occupation = v.occupation;
        if (v.city) input.city = v.city;
        if (v.income) input.income = Number(v.income) || null;
        if (v.preferred_language) input.preferred_language = v.preferred_language;
        if (v.lead_source) input.lead_source = v.lead_source;
        if (v.tags)
          input.tags = v.tags
            .split(/[,;]/)
            .map((t) => t.trim())
            .filter(Boolean);
        if (v.whatsapp_opt_in) input.whatsapp_opt_in = parseBool(v.whatsapp_opt_in);
        if (v.sms_opt_in) input.sms_opt_in = parseBool(v.sms_opt_in);
        if (v.email_opt_in) input.email_opt_in = parseBool(v.email_opt_in);
        if (v.preferred_channel && PREFERRED_CHANNELS.includes(v.preferred_channel as PreferredChannel))
          input.preferred_channel = v.preferred_channel as PreferredChannel;
        if (v.lead_score) input.lead_score = Number(v.lead_score) || 0;
        if (v.pipeline_stage && PIPELINE_STAGES.includes(v.pipeline_stage as PipelineStage))
          input.pipeline_stage = v.pipeline_stage as PipelineStage;
        if (v.notes) input.notes = v.notes;
        return input;
      });
  }

  const stats = useMemo(() => {
    return {
      total: processed.length,
      ready: processed.filter((r) => r.status === "ready").length,
      dup: processed.filter((r) => r.status === "dup_phone" || r.status === "dup_email").length,
      invalid: processed.filter((r) => r.status === "invalid").length,
      selected: processed.filter((r) => r.include).length,
    };
  }, [processed]);

  return (
    <div className="flex flex-col h-full">
      <header className="h-14 border-b pl-14 pr-4 md:px-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/contacts">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-base font-semibold">Import contacts</h1>
            <p className="text-xs text-muted-foreground capitalize">Step: {step}</p>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-auto p-6">
        {step === "upload" && (
          <div className="max-w-md mx-auto mt-16 text-center border-2 border-dashed rounded-lg p-10 bg-card">
            <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <h3 className="font-semibold">Upload a CSV file</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-4">
              First row should contain column headers.
            </p>
            <label className="inline-block">
              <input type="file" accept=".csv" className="hidden" onChange={onFile} />
              <span className="inline-flex items-center justify-center px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium cursor-pointer hover:bg-primary/90">
                Choose file
              </span>
            </label>
          </div>
        )}

        {step === "map" && (
          <div className="max-w-3xl mx-auto space-y-4">
            <div className="rounded-lg border bg-card">
              <div className="px-4 py-3 border-b flex items-center justify-between">
                <div>
                  <h3 className="font-semibold text-sm">Map columns to fields</h3>
                  <p className="text-xs text-muted-foreground">
                    {rows.length} rows detected. Auto-guessed mappings shown below.
                  </p>
                </div>
              </div>
              <div className="divide-y">
                {headers.map((h) => (
                  <div
                    key={h}
                    className="grid grid-cols-[1fr_auto_1fr] gap-3 items-center px-4 py-2.5"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{h}</div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        e.g. {rows.slice(0, 2).map((r) => r[h]).filter(Boolean).join(" · ") || "—"}
                      </div>
                    </div>
                    <div className="text-muted-foreground text-xs">→</div>
                    <Select
                      value={mapping[h] ?? "__ignore"}
                      onValueChange={(v) => setMapping({ ...mapping, [h]: v as FieldKey })}
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__ignore">Ignore this column</SelectItem>
                        {IMPORTABLE_FIELDS.map((f) => (
                          <SelectItem key={f.key} value={f.key}>
                            {f.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setStep("upload")}>
                Back
              </Button>
              <Button
                onClick={toReview}
                disabled={!Object.values(mapping).includes("name")}
              >
                Continue
              </Button>
            </div>
            {!Object.values(mapping).includes("name") && (
              <p className="text-xs text-destructive text-right">
                At least one column must map to Name.
              </p>
            )}
          </div>
        )}

        {step === "review" && (
          <div className="space-y-4">
            <div className="grid grid-cols-4 gap-3">
              <Stat label="Total rows" value={stats.total} />
              <Stat label="Ready" value={stats.ready} tone="ok" />
              <Stat label="Duplicates" value={stats.dup} tone="warn" />
              <Stat label="Invalid" value={stats.invalid} tone="err" />
            </div>
            <div className="rounded-lg border bg-card overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>City</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {processed.slice(0, 500).map((r, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <Checkbox
                          checked={r.include}
                          disabled={r.status === "invalid"}
                          onCheckedChange={(v) => {
                            const copy = processed.slice();
                            copy[i] = { ...copy[i], include: !!v };
                            setProcessed(copy);
                          }}
                        />
                      </TableCell>
                      <TableCell>
                        <StatusBadge status={r.status} />
                      </TableCell>
                      <TableCell>{r.values.name ?? "—"}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {r.values.phone ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {r.values.email ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {r.values.city ?? "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {processed.length > 500 && (
                <div className="text-xs text-muted-foreground px-4 py-2 border-t">
                  Showing first 500 of {processed.length} rows.
                </div>
              )}
            </div>
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm text-muted-foreground">
                {stats.selected} row{stats.selected === 1 ? "" : "s"} selected for import
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setStep("map")}>
                  Back
                </Button>
                <Button
                  disabled={stats.selected === 0 || importMut.isPending}
                  onClick={() => importMut.mutate(toPayload())}
                >
                  {importMut.isPending ? "Importing…" : `Import ${stats.selected}`}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "ok" | "warn" | "err";
}) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={cn(
          "text-2xl font-semibold tabular-nums mt-1",
          tone === "ok" && "text-stage-won-foreground",
          tone === "warn" && "text-stage-proposal-foreground",
          tone === "err" && "text-destructive",
        )}
      >
        {value}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: Row["status"] }) {
  const map: Record<Row["status"], { label: string; cls: string }> = {
    ready: { label: "Ready", cls: "bg-stage-won text-stage-won-foreground" },
    dup_phone: { label: "Duplicate phone", cls: "bg-stage-proposal text-stage-proposal-foreground" },
    dup_email: { label: "Duplicate email", cls: "bg-stage-proposal text-stage-proposal-foreground" },
    invalid: { label: "Invalid", cls: "bg-stage-lost text-stage-lost-foreground" },
  };
  const m = map[status];
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium", m.cls)}>
      {m.label}
    </span>
  );
}
