import { useState, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listPoliciesForContact,
  createPolicy,
  updatePolicy,
  deletePolicy,
  getPolicyDocumentUrl,
  POLICY_TYPES,
  POLICY_STATUSES,
  type Policy,
  type PolicyInput,
  type PolicyType,
  type PolicyStatus,
} from "@/lib/policies.functions";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Plus, Pencil, Trash2, Upload, FileText, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const STATUS_STYLE: Record<PolicyStatus, string> = {
  active: "bg-emerald-100 text-emerald-800",
  lapsed: "bg-amber-100 text-amber-800",
  cancelled: "bg-muted text-muted-foreground",
};

export function PoliciesTab({ contactId }: { contactId: string }) {
  const listFn = useServerFn(listPoliciesForContact);
  const q = useQuery({
    queryKey: ["policies", "contact", contactId],
    queryFn: () => listFn({ data: { contact_id: contactId } }),
  });
  const [editing, setEditing] = useState<Policy | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {q.data?.length ?? 0} {q.data?.length === 1 ? "policy" : "policies"}
        </p>
        <Button size="sm" variant="outline" onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" /> Add policy
        </Button>
      </div>

      {q.isLoading ? (
        <p className="text-sm text-muted-foreground py-6 text-center">Loading…</p>
      ) : !q.data?.length ? (
        <div className="rounded-lg border border-dashed p-6 text-center">
          <p className="text-sm text-muted-foreground">No policies yet for this contact.</p>
        </div>
      ) : (
        <div className="rounded-lg border divide-y bg-card">
          {q.data.map((p) => (
            <PolicyRow
              key={p.id}
              policy={p}
              onEdit={() => setEditing(p)}
            />
          ))}
        </div>
      )}

      <PolicyDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        contactId={contactId}
      />
      <PolicyDialog
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        contactId={contactId}
        policy={editing}
      />
    </div>
  );
}

function PolicyRow({ policy, onEdit }: { policy: Policy; onEdit: () => void }) {
  const queryClient = useQueryClient();
  const delFn = useServerFn(deletePolicy);
  const del = useMutation({
    mutationFn: () => delFn({ data: { id: policy.id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["policies"] });
      toast.success("Policy deleted");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="p-3 flex items-start gap-3">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium text-sm">{policy.policy_number}</span>
          <span className="text-[11px] uppercase tracking-wide rounded bg-accent text-accent-foreground px-1.5 py-0.5">
            {policy.policy_type}
          </span>
          <span className={cn("text-[11px] rounded px-1.5 py-0.5", STATUS_STYLE[policy.status])}>
            {policy.status}
          </span>
        </div>
        <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
          {policy.insurer_name && <span>{policy.insurer_name}</span>}
          {policy.premium_amount != null && (
            <span className="tabular-nums">Premium {policy.premium_amount}</span>
          )}
          {policy.renewal_date && (
            <span className="tabular-nums">Renewal {policy.renewal_date}</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete this policy?</AlertDialogTitle>
              <AlertDialogDescription>
                {policy.policy_number} will be removed. This can't be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => del.mutate()}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

function PolicyDialog({
  open,
  onOpenChange,
  contactId,
  policy,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  contactId: string;
  policy?: Policy | null;
}) {
  const queryClient = useQueryClient();
  const createFn = useServerFn(createPolicy);
  const updateFn = useServerFn(updatePolicy);
  const isEdit = !!policy;

  const [form, setForm] = useState<PolicyInput>(() => ({
    contact_id: contactId,
    policy_number: policy?.policy_number ?? "",
    policy_type: policy?.policy_type ?? "other",
    insurer_name: policy?.insurer_name ?? "",
    premium_amount: policy?.premium_amount ?? null,
    start_date: policy?.start_date ?? "",
    renewal_date: policy?.renewal_date ?? "",
    status: policy?.status ?? "active",
    notes: policy?.notes ?? "",
  }));

  // reset when policy changes
  const key = policy?.id ?? "new";
  const [seedKey, setSeedKey] = useState(key);
  if (seedKey !== key) {
    setSeedKey(key);
    setForm({
      contact_id: contactId,
      policy_number: policy?.policy_number ?? "",
      policy_type: policy?.policy_type ?? "other",
      insurer_name: policy?.insurer_name ?? "",
      premium_amount: policy?.premium_amount ?? null,
      start_date: policy?.start_date ?? "",
      renewal_date: policy?.renewal_date ?? "",
      status: policy?.status ?? "active",
      notes: policy?.notes ?? "",
    });
  }

  const mut = useMutation({
    mutationFn: async (input: PolicyInput) => {
      if (isEdit && policy) {
        return updateFn({ data: { id: policy.id, patch: input } });
      }
      return createFn({ data: input });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["policies"] });
      toast.success(isEdit ? "Policy updated" : "Policy added");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.policy_number?.trim()) return toast.error("Policy number is required");
    mut.mutate(form);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit policy" : "Add policy"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid grid-cols-2 gap-3">
          <Field label="Policy number*" span={2}>
            <Input
              value={form.policy_number}
              onChange={(e) => setForm({ ...form, policy_number: e.target.value })}
              autoFocus
            />
          </Field>
          <Field label="Type">
            <Select
              value={form.policy_type}
              onValueChange={(v) => setForm({ ...form, policy_type: v as PolicyType })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {POLICY_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Status">
            <Select
              value={form.status}
              onValueChange={(v) => setForm({ ...form, status: v as PolicyStatus })}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {POLICY_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Insurer">
            <Input
              value={form.insurer_name ?? ""}
              onChange={(e) => setForm({ ...form, insurer_name: e.target.value })}
            />
          </Field>
          <Field label="Premium amount">
            <Input
              type="number"
              value={form.premium_amount ?? ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  premium_amount: e.target.value === "" ? null : Number(e.target.value),
                })
              }
            />
          </Field>
          <Field label="Start date">
            <Input
              type="date"
              value={form.start_date ?? ""}
              onChange={(e) => setForm({ ...form, start_date: e.target.value })}
            />
          </Field>
          <Field label="Renewal date">
            <Input
              type="date"
              value={form.renewal_date ?? ""}
              onChange={(e) => setForm({ ...form, renewal_date: e.target.value })}
            />
          </Field>
          <Field label="Notes" span={2}>
            <Textarea
              rows={3}
              value={form.notes ?? ""}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </Field>
          <DialogFooter className="col-span-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mut.isPending}>
              {mut.isPending ? "Saving…" : isEdit ? "Save changes" : "Add policy"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
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
