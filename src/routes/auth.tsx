import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Shield } from "lucide-react";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({ meta: [{ title: "Sign in — InsureFlow" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showForgot, setShowForgot] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/contacts", replace: true });
    });
  }, [navigate]);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return toast.error(error.message);
    navigate({ to: "/contacts", replace: true });
  }

  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: window.location.origin },
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Account created. You can sign in now.");
  }

  async function forgotPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return toast.error("Enter your email first.");
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("If an account exists, a reset link has been sent.");
    setShowForgot(false);
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between bg-gradient-to-br from-primary/95 to-primary p-10 text-primary-foreground">
        <div className="flex items-center gap-2 font-semibold text-lg">
          <Shield className="h-5 w-5" /> InsureFlow
        </div>
        <div className="space-y-4 max-w-md">
          <h1 className="text-3xl font-semibold leading-tight">
            The CRM for independent insurance advisors.
          </h1>
          <p className="text-primary-foreground/85 text-sm leading-relaxed">
            Track leads, stay on top of follow-ups, and grow your book — without the enterprise
            overhead.
          </p>
        </div>
        <p className="text-xs text-primary-foreground/70">© InsureFlow</p>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="lg:hidden mb-8 flex items-center gap-2 font-semibold">
            <Shield className="h-5 w-5 text-primary" /> InsureFlow
          </div>

          {showForgot ? (
            <>
              <h2 className="text-2xl font-semibold tracking-tight">Reset your password</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Enter your email and we'll send you a link to reset it.
              </p>
              <form onSubmit={forgotPassword} className="space-y-4 pt-6">
                <Field label="Email" type="email" value={email} onChange={setEmail} />
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Sending…" : "Send reset link"}
                </Button>
                <button
                  type="button"
                  onClick={() => setShowForgot(false)}
                  className="text-sm text-muted-foreground hover:text-foreground w-full text-center"
                >
                  Back to sign in
                </button>
              </form>
            </>
          ) : (
            <>
              <h2 className="text-2xl font-semibold tracking-tight">Welcome back</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Sign in to your advisor account, or create one.
              </p>
              <Tabs defaultValue="signin" className="mt-6">
                <TabsList className="grid grid-cols-2 w-full">
                  <TabsTrigger value="signin">Sign in</TabsTrigger>
                  <TabsTrigger value="signup">Sign up</TabsTrigger>
                </TabsList>
                <TabsContent value="signin">
                  <form onSubmit={signIn} className="space-y-4 pt-4">
                    <Field label="Email" type="email" value={email} onChange={setEmail} />
                    <Field label="Password" type="password" value={password} onChange={setPassword} />
                    <div className="text-right -mt-2">
                      <button
                        type="button"
                        onClick={() => setShowForgot(true)}
                        className="text-xs text-muted-foreground hover:text-foreground"
                      >
                        Forgot password?
                      </button>
                    </div>
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? "Signing in…" : "Sign in"}
                    </Button>
                  </form>
                </TabsContent>
                <TabsContent value="signup">
                  <form onSubmit={signUp} className="space-y-4 pt-4">
                    <Field label="Email" type="email" value={email} onChange={setEmail} />
                    <Field
                      label="Password"
                      type="password"
                      value={password}
                      onChange={setPassword}
                      minLength={6}
                    />
                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? "Creating account…" : "Create account"}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  minLength,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  minLength?: number;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        minLength={minLength}
        required
        autoComplete={type === "password" ? "current-password" : "email"}
      />
    </div>
  );
}
