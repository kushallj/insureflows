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

  async function guard(what: string, action: () => void) {
    try {
      const status = await getOwnerLockStatus();
      if (isUnlocked(status)) return action();
      pending.current = action;
      setPin("");
      setLabel(what);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't check the owner PIN");
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      if (!(await unlockOwnerActions(pin))) {
        toast.error("Wrong PIN");
        setPin("");
        return;
      }
      setLabel(null);
      const run = pending.current;
      pending.current = null;
      run?.();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Couldn't unlock");
    } finally {
      setBusy(false);
    }
  }

  const dialog = (
    <Dialog open={label != null} onOpenChange={(o) => !o && setLabel(null)}>
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
            <Button type="button" variant="outline" onClick={() => setLabel(null)}>
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
