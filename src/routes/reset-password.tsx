import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Shield } from "lucide-react";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({ meta: [{ title: "Reset password — InsureFlow" }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Supabase parses the recovery hash automatically and emits PASSWORD_RECOVERY.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    // Also check an already-established recovery session on mount.
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) return toast.error("Password must be at least 6 characters.");
    if (password !== confirm) return toast.error("Passwords do not match.");
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Password updated. You're signed in.");
    navigate({ to: "/contacts", replace: true });
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center gap-2 font-semibold">
          <Shield className="h-5 w-5 text-primary" /> InsureFlow
        </div>
        <h2 className="text-2xl font-semibold tracking-tight">Set a new password</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {ready
            ? "Choose a new password for your account."
            : "Waiting for the reset link to be verified…"}
        </p>
        <form onSubmit={submit} className="space-y-4 pt-6">
          <div className="space-y-1.5">
            <Label>New password</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={6}
              required
              autoComplete="new-password"
              disabled={!ready}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Confirm new password</Label>
            <Input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              minLength={6}
              required
              autoComplete="new-password"
              disabled={!ready}
            />
          </div>
          <Button type="submit" className="w-full" disabled={!ready || loading}>
            {loading ? "Updating…" : "Update password"}
          </Button>
          {ready && (
            <Link
              to="/settings"
              className="block text-center text-sm text-muted-foreground underline underline-offset-2"
            >
              Keep my password and go to Settings (e.g. to remove a forgotten owner PIN)
            </Link>
          )}
          <Link
            to="/auth"
            className="text-sm text-muted-foreground hover:text-foreground block text-center"
          >
            Back to sign in
          </Link>
        </form>
      </div>
    </div>
  );
}
