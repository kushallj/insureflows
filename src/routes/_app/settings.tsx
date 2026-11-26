import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { KeyRound, Lock, LockOpen, Mail, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  getOwnerLockStatus,
  isUnlocked,
  lockOwnerActions,
  removeOwnerPin,
  setOwnerPin,
} from "@/lib/owner-lock";
import { useOwnerGuard } from "@/components/owner-guard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_app/settings")({
  ssr: false,
  head: () => ({ meta: [{ title: "Settings — InsureFlow" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const [email, setEmail] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  return (
    <div className="flex flex-col h-full">
      <header className="h-14 border-b pl-14 pr-4 md:px-6 flex items-center bg-background">
        <div>
          <h1 className="text-base font-semibold tracking-tight">Settings</h1>
          <p className="text-xs text-muted-foreground">{email}</p>
        </div>
      </header>
      <div className="flex-1 overflow-auto p-4 md:p-6">
        <div className="max-w-xl mx-auto space-y-6">
          <PasswordCard email={email} />
          <OwnerPinCard email={email} />
        </div>
      </div>
    </div>
  );
}

function Card({
  icon,
  title,
  text,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border bg-card">
      <div className="px-4 py-3 border-b">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          {icon} {title}
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">{text}</p>
      </div>
      <div className="p-4 space-y-4">{children}</div>
    </section>
  );
}

function PasswordCard({ email }: { email: string | null }) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const { guard, dialog } = useOwnerGuard();

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) return toast.error("Use at least 6 characters");
    if (password !== confirm) return toast.error("The two passwords don't match");
    // With an owner PIN set, changing the password inside the app needs the PIN too.
    guard("change your password", async () => {
      setBusy(true);
      const { error } = await supabase.auth.updateUser({ password });
      setBusy(false);
      if (error) return toast.error(error.message);
      setPassword("");
      setConfirm("");
      toast.success("Password changed");
    });
  }

  async function sendLink() {
    if (!email) return;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) return toast.error(error.message);
    toast.success(`Reset link sent to ${email}. Check spam if it doesn't arrive.`);
  }

  return (
    <Card
      icon={<KeyRound className="h-4 w-4" />}
      title="Password"
      text="Change the password you sign in with."
    >
      <form onSubmit={save} className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="new-password">New password</Label>
          <Input
            id="new-password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="confirm-password">Confirm new password</Label>
          <Input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="submit" size="sm" disabled={busy || !password}>
            {busy ? "Saving…" : "Change password"}
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={sendLink} disabled={!email}>
            <Mail className="h-4 w-4 mr-1.5" /> Email me a reset link instead
          </Button>
        </div>
      </form>
      {dialog}
    </Card>
  );
}

function OwnerPinCard({ email }: { email: string | null }) {
  const queryClient = useQueryClient();
  const { data: status, refetch } = useQuery({
    queryKey: ["owner-lock"],
    queryFn: getOwnerLockStatus,
  });
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);
  const digits = (v: string) => v.replace(/\D/g, "").slice(0, 8);

  async function run(fn: () => Promise<unknown>, ok: string) {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      setCurrent("");
      setNext("");
      await refetch();
      queryClient.invalidateQueries({ queryKey: ["owner-lock"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Something went wrong");
      await refetch();
    } finally {
      setBusy(false);
    }
  }

  async function sendRecoveryLink() {
    if (!email) return;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) return toast.error(error.message);
    toast.success(`Link sent to ${email}. Open it, then come back here to remove the PIN.`);
  }

  if (!status) return null;
  const unlocked = isUnlocked(status);

  return (
    <Card
      icon={<ShieldCheck className="h-4 w-4" />}
      title="Owner PIN"
      text="If someone else signs in with your password (an assistant or an AI agent), they can work with contacts but can't download CSVs, delete contacts or merge duplicates without this PIN."
    >
      {!status.enabled ? (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => setOwnerPin(next), "Owner PIN set. Exports and deletes now need it.");
          }}
        >
          <div className="space-y-1.5">
            <Label htmlFor="pin-new">Choose a PIN (4 to 8 digits)</Label>
            <Input
              id="pin-new"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              value={next}
              onChange={(e) => setNext(digits(e.target.value))}
              className="max-w-40"
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Don't share it with anyone who uses your login. Entering it unlocks only the browser you
            typed it in, for 5 minutes; anyone else signed in with your password stays locked. If
            you forget it, you can remove it with a link sent to your email.
          </p>
          <Button type="submit" size="sm" disabled={busy || next.length < 4}>
            Set PIN
          </Button>
        </form>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="flex items-center gap-2">
              {unlocked ? (
                <>
                  <LockOpen className="h-4 w-4 text-stage-proposal-foreground" /> Unlocked in this
                  browser until{" "}
                  {new Date(status.unlocked_until!).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4 text-stage-won-foreground" /> On: exports, deletes and
                  merges need the PIN
                </>
              )}
            </span>
            {unlocked && (
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => run(lockOwnerActions, "Locked")}
              >
                <Lock className="h-4 w-4 mr-1.5" /> Lock now
              </Button>
            )}
          </div>
          {status.blocked_until && (
            <p className="text-xs text-destructive">
              Too many wrong PINs. Try again after{" "}
              {new Date(status.blocked_until).toLocaleTimeString()}.
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="pin-current">Current PIN</Label>
              <Input
                id="pin-current"
                type="password"
                inputMode="numeric"
                autoComplete="off"
                value={current}
                onChange={(e) => setCurrent(digits(e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pin-next">New PIN</Label>
              <Input
                id="pin-next"
                type="password"
                inputMode="numeric"
                autoComplete="off"
                value={next}
                onChange={(e) => setNext(digits(e.target.value))}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={busy || current.length < 4 || next.length < 4}
              onClick={() => run(() => setOwnerPin(next, current), "PIN changed")}
            >
              Change PIN
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={busy || (!status.recovery_session && current.length < 4)}
              onClick={() => run(() => removeOwnerPin(current), "Owner PIN removed")}
            >
              Remove PIN
            </Button>
          </div>
          <div className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground space-y-2">
            {status.recovery_session ? (
              <p>
                You opened InsureFlow from an email link, so you can remove the PIN without entering
                it.
              </p>
            ) : (
              <>
                <p>
                  Forgot your PIN? We'll email a sign-in link to {email ?? "your address"}. Open it,
                  come back to Settings, and “Remove PIN” will work without the PIN.
                </p>
                <Button size="sm" variant="outline" onClick={sendRecoveryLink} disabled={!email}>
                  <Mail className="h-4 w-4 mr-1.5" /> Email me a link
                </Button>
              </>
            )}
          </div>
        </>
      )}
    </Card>
  );
}
