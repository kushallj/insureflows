import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Copy, Mail, MessageCircle, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { recordReferralAsk, type Channel } from "@/lib/network.functions";
import { buildReferralMessage, mailtoLink, smsLink, whatsappLink } from "@/lib/referral-message";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type AskTarget = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  whatsapp_opt_in?: boolean;
  sms_opt_in?: boolean;
  email_opt_in?: boolean;
};

/**
 * Draft a referral request, open it in the advisor's own WhatsApp / SMS / email, then record it with "I sent it".
 * Nothing is sent from InsureFlow, and nothing is recorded until the advisor clicks.
 */
export function ReferralAskDialog({
  target,
  onOpenChange,
}: {
  target: AskTarget | null;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [channel, setChannel] = useState<Channel | null>(null);
  const recordFn = useServerFn(recordReferralAsk);

  useEffect(() => {
    if (!target) return;
    setChannel(null);
    setText(buildReferralMessage({ clientName: target.name }));
    let live = true;
    supabase.auth.getUser().then(({ data }) => {
      const meta = (data.user?.user_metadata ?? {}) as Record<string, unknown>;
      const name = (meta.full_name ?? meta.name ?? "") as string;
      if (live && name)
        setText(buildReferralMessage({ clientName: target.name, advisorName: name }));
    });
    return () => {
      live = false;
    };
  }, [target]);

  const record = useMutation({
    mutationFn: () => recordFn({ data: { contact_id: target!.id, channel } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["referrals"] });
      queryClient.invalidateQueries({ queryKey: ["activities"] });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      toast.success(`Recorded your referral ask to ${target!.name}`);
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!target) return null;
  const wa = whatsappLink(target.phone, text);
  const sms = smsLink(target.phone, text);
  const mail = mailtoLink(target.email, text);
  const optOut =
    (channel === "whatsapp" && target.whatsapp_opt_in === false) ||
    (channel === "sms" && target.sms_opt_in === false) ||
    (channel === "email" && target.email_opt_in === false);

  const open = (c: Channel, href: string | null) => {
    if (!href) return;
    setChannel(c);
    window.open(href, "_blank", "noopener,noreferrer");
  };

  return (
    <Dialog open={!!target} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Ask {target.name} for a referral</DialogTitle>
          <DialogDescription>
            Edit the message, open it in your own app and send it there. Then come back and click “I
            sent it” so the follow-up reminder works.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={10}
          className="text-sm"
        />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!wa}
            onClick={() => open("whatsapp", wa)}
          >
            <MessageCircle className="h-4 w-4 mr-1.5" /> WhatsApp
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!sms}
            onClick={() => open("sms", sms)}
          >
            <MessageSquare className="h-4 w-4 mr-1.5" /> SMS
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!mail}
            onClick={() => open("email", mail)}
          >
            <Mail className="h-4 w-4 mr-1.5" /> Email
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() =>
              navigator.clipboard.writeText(text).then(
                () => toast.success("Message copied"),
                () => toast.error("Couldn't copy: select the text and copy it"),
              )
            }
          >
            <Copy className="h-4 w-4 mr-1.5" /> Copy
          </Button>
        </div>
        {!target.phone && !target.email && (
          <p className="text-xs text-muted-foreground">
            This contact has no phone or email yet. Copy the message, or add their number first.
          </p>
        )}
        {optOut && (
          <p className="text-xs text-stage-proposal-foreground">
            This contact hasn't opted in to{" "}
            {channel === "email" ? "email" : channel === "sms" ? "SMS" : "WhatsApp"}. A personal 1:1
            message to your own client is usually fine, but check your agency's consent rules.
          </p>
        )}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={() => record.mutate()} disabled={record.isPending}>
            {record.isPending ? "Saving…" : "I sent it"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
