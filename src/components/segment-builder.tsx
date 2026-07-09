import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  previewSegment,
  type SegmentFilters,
} from "@/lib/segments.functions";
import { PIPELINE_STAGES, STAGE_LABEL, type PipelineStage } from "@/lib/contact-fields";
import { POLICY_TYPES, type PolicyType } from "@/lib/policies.functions";
import { getDistinctTags } from "@/lib/contacts.functions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { StageBadge } from "@/components/stage-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

function useDebounced<T>(value: T, delay = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

export function SegmentBuilder({
  filters,
  onChange,
}: {
  filters: SegmentFilters;
  onChange: (f: SegmentFilters) => void;
}) {
  const debouncedFilters = useDebounced(filters, 300);
  const previewFn = useServerFn(previewSegment);
  const tagsFn = useServerFn(getDistinctTags);

  const preview = useQuery({
    queryKey: ["segment-preview", debouncedFilters],
    queryFn: () => previewFn({ data: { filters: debouncedFilters } }),
  });
  const tagsQ = useQuery({ queryKey: ["contacts", "tags"], queryFn: () => tagsFn() });

  const patch = (p: Partial<SegmentFilters>) => onChange({ ...filters, ...p });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,360px)_1fr] gap-6">
      <aside className="space-y-4">
        <FilterGroup title="Demographics">
          <RangeRow
            label="Age"
            min={filters.age_min ?? null}
            max={filters.age_max ?? null}
            onChange={(min, max) => patch({ age_min: min, age_max: max })}
          />
          <TextListRow
            label="City"
            values={filters.cities ?? []}
            onChange={(v) => patch({ cities: v })}
            placeholder="Add city…"
          />
          <TextListRow
            label="Language"
            values={filters.languages ?? []}
            onChange={(v) => patch({ languages: v })}
            placeholder="Add language…"
          />
          <TextListRow
            label="Occupation"
            values={filters.occupations ?? []}
            onChange={(v) => patch({ occupations: v })}
            placeholder="Add occupation…"
          />
          <RangeRow
            label="Income"
            min={filters.income_min ?? null}
            max={filters.income_max ?? null}
            onChange={(min, max) => patch({ income_min: min, income_max: max })}
          />
        </FilterGroup>

        <FilterGroup title="Lead">
          <div className="space-y-1.5">
            <Label className="text-xs">Pipeline stage</Label>
            <div className="flex flex-wrap gap-1.5">
              {PIPELINE_STAGES.map((s) => {
                const active = filters.pipeline_stages?.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      const cur = filters.pipeline_stages ?? [];
                      patch({
                        pipeline_stages: active
                          ? cur.filter((x) => x !== s)
                          : [...cur, s as PipelineStage],
                      });
                    }}
                    className={cn(
                      "rounded border px-2 py-0.5 text-xs",
                      active ? "bg-primary text-primary-foreground border-primary" : "hover:bg-accent",
                    )}
                  >
                    {STAGE_LABEL[s]}
                  </button>
                );
              })}
            </div>
          </div>
          <RangeRow
            label="Lead score"
            min={filters.lead_score_min ?? null}
            max={filters.lead_score_max ?? null}
            onChange={(min, max) => patch({ lead_score_min: min, lead_score_max: max })}
          />
          <div className="space-y-1.5">
            <Label className="text-xs">Tags (any of)</Label>
            <div className="flex flex-wrap gap-1.5">
              {(tagsQ.data ?? []).length === 0 ? (
                <span className="text-xs text-muted-foreground">No tags in use yet.</span>
              ) : (
                (tagsQ.data ?? []).map((t) => {
                  const active = filters.tags?.includes(t);
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => {
                        const cur = filters.tags ?? [];
                        patch({ tags: active ? cur.filter((x) => x !== t) : [...cur, t] });
                      }}
                      className={cn(
                        "rounded border px-2 py-0.5 text-xs",
                        active ? "bg-primary text-primary-foreground border-primary" : "hover:bg-accent",
                      )}
                    >
                      {t}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </FilterGroup>

        <FilterGroup title="Policies">
          <div className="space-y-1.5">
            <Label className="text-xs">Has policy of type</Label>
            <div className="flex flex-wrap gap-1.5">
              {POLICY_TYPES.map((t) => {
                const active = filters.has_policy_types?.includes(t);
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      const cur = filters.has_policy_types ?? [];
                      patch({
                        has_policy_types: active
                          ? cur.filter((x) => x !== t)
                          : [...cur, t as PolicyType],
                      });
                    }}
                    className={cn(
                      "rounded border px-2 py-0.5 text-xs capitalize",
                      active ? "bg-primary text-primary-foreground border-primary" : "hover:bg-accent",
                    )}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          </div>
          <DateRangeRow
            label="Renewal between"
            from={filters.renewal_from ?? ""}
            to={filters.renewal_to ?? ""}
            onChange={(from, to) => patch({ renewal_from: from || null, renewal_to: to || null })}
          />
        </FilterGroup>

        <FilterGroup title="Follow-up">
          <DateRangeRow
            label="Last contact between"
            from={filters.last_contact_from?.slice(0, 10) ?? ""}
            to={filters.last_contact_to?.slice(0, 10) ?? ""}
            onChange={(from, to) =>
              patch({
                last_contact_from: from ? new Date(from).toISOString() : null,
                last_contact_to: to ? new Date(`${to}T23:59:59`).toISOString() : null,
              })
            }
          />
        </FilterGroup>
      </aside>

      <section className="min-w-0 space-y-3">
        <div className="rounded-lg border bg-card p-4 flex items-center justify-between">
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider">
              Matching contacts
            </div>
            <div className="text-3xl font-semibold tabular-nums mt-1">
              {preview.isLoading ? "…" : preview.data?.count ?? 0}
            </div>
          </div>
          <p className="text-xs text-muted-foreground max-w-xs text-right">
            Showing preview of first 20. All filters use AND logic.
          </p>
        </div>

        <div className="rounded-lg border overflow-hidden">
          {preview.isLoading ? (
            <p className="text-sm text-muted-foreground text-center py-10">Loading…</p>
          ) : !preview.data?.sample.length ? (
            <p className="text-sm text-muted-foreground text-center py-10">
              No contacts match these filters.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>City</TableHead>
                  <TableHead>Stage</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.data.sample.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-muted-foreground">{c.phone ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{c.email ?? "—"}</TableCell>
                    <TableCell className="text-muted-foreground">{c.city ?? "—"}</TableCell>
                    <TableCell>
                      <StageBadge stage={c.pipeline_stage as PipelineStage} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{c.lead_score}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </section>
    </div>
  );
}

function FilterGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h4 className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
        {title}
      </h4>
      <div className="rounded-lg border bg-card p-3 space-y-3">{children}</div>
    </section>
  );
}

function RangeRow({
  label,
  min,
  max,
  onChange,
}: {
  label: string;
  min: number | null;
  max: number | null;
  onChange: (min: number | null, max: number | null) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          placeholder="Min"
          value={min ?? ""}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value), max)}
          className="h-8 tabular-nums"
        />
        <span className="text-muted-foreground text-xs">to</span>
        <Input
          type="number"
          placeholder="Max"
          value={max ?? ""}
          onChange={(e) => onChange(min, e.target.value === "" ? null : Number(e.target.value))}
          className="h-8 tabular-nums"
        />
      </div>
    </div>
  );
}

function DateRangeRow({
  label,
  from,
  to,
  onChange,
}: {
  label: string;
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          type="date"
          value={from}
          onChange={(e) => onChange(e.target.value, to)}
          className="h-8"
        />
        <span className="text-muted-foreground text-xs">to</span>
        <Input
          type="date"
          value={to}
          onChange={(e) => onChange(from, e.target.value)}
          className="h-8"
        />
      </div>
    </div>
  );
}

function TextListRow({
  label,
  values,
  onChange,
  placeholder,
}: {
  label: string;
  values: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
}) {
  const [input, setInput] = useState("");
  function commit() {
    const t = input.trim();
    if (!t || values.includes(t)) return;
    onChange([...values, t]);
    setInput("");
  }
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <div className="flex flex-wrap gap-1.5 items-center">
        {values.map((v) => (
          <span
            key={v}
            className="inline-flex items-center gap-1 rounded bg-accent text-accent-foreground text-xs px-1.5 py-0.5"
          >
            {v}
            <button type="button" onClick={() => onChange(values.filter((x) => x !== v))}>
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
              commit();
            }
          }}
          onBlur={() => input && commit()}
          placeholder={placeholder}
          className="h-7 w-32 text-xs"
        />
      </div>
    </div>
  );
}

export function emptyFilters(): SegmentFilters {
  return {};
}

export function filterSummary(f: SegmentFilters): string[] {
  const parts: string[] = [];
  if (f.age_min != null || f.age_max != null)
    parts.push(`Age ${f.age_min ?? "*"}–${f.age_max ?? "*"}`);
  if (f.cities?.length) parts.push(`Cities: ${f.cities.join(", ")}`);
  if (f.languages?.length) parts.push(`Language: ${f.languages.join(", ")}`);
  if (f.occupations?.length) parts.push(`Occupation: ${f.occupations.join(", ")}`);
  if (f.income_min != null || f.income_max != null)
    parts.push(`Income ${f.income_min ?? "*"}–${f.income_max ?? "*"}`);
  if (f.pipeline_stages?.length) parts.push(`Stage: ${f.pipeline_stages.join(", ")}`);
  if (f.lead_score_min != null || f.lead_score_max != null)
    parts.push(`Score ${f.lead_score_min ?? "*"}–${f.lead_score_max ?? "*"}`);
  if (f.tags?.length) parts.push(`Tags: ${f.tags.join(", ")}`);
  if (f.has_policy_types?.length) parts.push(`Has policy: ${f.has_policy_types.join(", ")}`);
  if (f.renewal_from || f.renewal_to)
    parts.push(`Renewal ${f.renewal_from ?? "*"}–${f.renewal_to ?? "*"}`);
  if (f.last_contact_from || f.last_contact_to)
    parts.push(
      `Last contact ${(f.last_contact_from ?? "*").slice(0, 10)}–${(f.last_contact_to ?? "*").slice(0, 10)}`,
    );
  return parts;
}

// re-export used in list page
