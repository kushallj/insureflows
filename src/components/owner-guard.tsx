import { useRef, useState } from "react";
import { toast } from "sonner";
import { Lock } from "lucide-react";
import { getOwnerLockStatus, isUnlocked, unlockOwnerActions } from "@/lib/owner-lock";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * `guard(label, action)` runs the action straight away when no owner PIN is set (or it was entered in the last few
 * minutes); otherwise it asks for the PIN first. Render `dialog` once in the page.
 */
export function useOwnerGuard() {
  const [label, setLabel] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const pending = useRef<(() => void) | null>(null);
  // Bumped whenever the dialog closes or opens for a new action, so a PIN check still in flight can't run a cancelled
  // or replaced action when its answer arrives.
  const attempt = useRef(0);

  function close() {
    attempt.current += 1;
    pending.current = null;
    setLabel(null);
  }

  async function guard(what: string, action: () => void) {
    try {
      const status = await getOwnerLockStatus();
      if (isUnlocked(status)) return action();
      attempt.current += 1;
      pending.current = action;
      setPin("");
      setLabel(what);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't check the owner PIN");
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const id = ++attempt.current;
    setBusy(true);
    try {
      const ok = await unlockOwnerActions(pin);
      if (id !== attempt.current) return;
      if (!ok) {
        toast.error("Wrong PIN");
        setPin("");
        return;
      }
      setLabel(null);
      const run = pending.current;
      pending.current = null;
      run?.();
    } catch (err) {
      if (id !== attempt.current) return;
      toast.error(err instanceof Error ? err.message : "Couldn't unlock");
    } finally {
      setBusy(false);
    }
  }

  const dialog = (
    <Dialog open={label != null} onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-sm">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-4 w-4" /> Owner PIN required
            </DialogTitle>
            <DialogDescription>
              Enter your owner PIN to {label}. It stays unlocked for 5 minutes.
            </DialogDescription>
          </DialogHeader>
          <Input
            type="password"
            inputMode="numeric"
            autoComplete="off"
            maxLength={8}
            autoFocus
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
            placeholder="PIN"
            aria-label="Owner PIN"
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={close}>
              Cancel
            </Button>
            <Button type="submit" disabled={pin.length < 4 || busy}>
              {busy ? "Checking…" : "Unlock"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );

  return { guard, dialog };
}
