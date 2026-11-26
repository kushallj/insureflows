import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Check, Trash2 } from "lucide-react";
import {
  deleteReferralAsk,
  updateReferralAsk,
  type ReferralAsk,
  type ReferralStatus,
} from "@/lib/network.functions";
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

export type AskRow = Omit<ReferralAsk, "contact"> & { contact?: ReferralAsk["contact"] };

export const STATUS_LABEL: Record<ReferralStatus, string> = {
  asked: "Waiting",
  replied: "Replied",
  referred: "Referred someone",
  declined: "Declined",
};

export function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Referral asks with a status picker; on the follow-up list the action hides the reminder instead of deleting. */
export function AskTable({ asks, followUp = false }: { asks: AskRow[]; followUp?: boolean }) {
  const queryClient = useQueryClient();
  const updateFn = useServerFn(updateReferralAsk);
  const deleteFn = useServerFn(deleteReferralAsk);
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["referrals"] });
    queryClient.invalidateQueries({ queryKey: ["activities"] });
  };
  const update = useMutation({
    mutationFn: (v: { id: string; status?: ReferralStatus; dismissReminder?: boolean }) =>
      updateFn({ data: v }),
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      refresh();
      toast.success("Ask removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {asks.some((a) => a.contact !== undefined) && <TableHead>Client</TableHead>}
          <TableHead>Asked</TableHead>
          <TableHead>Channel</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="w-24"></TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {asks.map((a) => (
          <TableRow key={a.id}>
            {a.contact !== undefined && (
              <TableCell className="font-medium">{a.contact?.name ?? "—"}</TableCell>
            )}
            <TableCell className="tabular-nums text-muted-foreground">
              {fmtDate(a.asked_at)}
            </TableCell>
            <TableCell className="capitalize text-muted-foreground">{a.channel ?? "—"}</TableCell>
            <TableCell>
              <Select
                value={a.status}
                onValueChange={(v) => update.mutate({ id: a.id, status: v as ReferralStatus })}
              >
                <SelectTrigger className="h-8 w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(STATUS_LABEL) as ReferralStatus[]).map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </TableCell>
            <TableCell className="text-right whitespace-nowrap">
              {followUp ? (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  aria-label="Dismiss reminder"
                  title="I've followed up: hide this reminder"
                  onClick={() => update.mutate({ id: a.id, dismissReminder: true })}
                >
                  <Check className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-8 w-8"
                  aria-label="Remove this ask"
                  onClick={() => del.mutate(a.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
