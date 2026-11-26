import { createFileRoute, Link, Outlet, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Shield,
  Users,
  LogOut,
  CalendarClock,
  ListTodo,
  Layers,
  FileText,
  Megaphone,
  BarChart3,
  Menu,
  Handshake,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/_app")({
  ssr: false,
  component: AppLayout,
});

const NAV_ITEMS = [
  { to: "/contacts", label: "Contacts", icon: Users },
  { to: "/referrals", label: "Referrals", icon: Handshake },
  { to: "/tasks", label: "My Tasks", icon: ListTodo },
  { to: "/renewals", label: "Renewals", icon: CalendarClock },
  { to: "/segments", label: "Segments", icon: Layers },
  { to: "/templates", label: "Templates", icon: FileText },
  { to: "/campaigns", label: "Campaigns", icon: Megaphone },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
] as const;

function AppLayout() {
  const navigate = useNavigate();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getUser().then(({ data }) => {
      if (!mounted) return;
      if (!data.user) {
        navigate({ to: "/auth", replace: true });
      } else {
        setEmail(data.user.email ?? null);
        setReady(true);
      }
    });
    return () => {
      mounted = false;
    };
  }, [navigate]);

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    router.invalidate();
    navigate({ to: "/auth", replace: true });
  }

  if (!ready) return null;

  const nav = (onNavigate?: () => void) => (
    <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
      {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
        <NavItem key={to} to={to} icon={<Icon className="h-4 w-4" />} onNavigate={onNavigate}>
          {label}
        </NavItem>
      ))}
    </nav>
  );

  const brand = (
    <div className="px-5 h-14 flex items-center gap-2 border-b shrink-0">
      <Shield className="h-5 w-5 text-primary" />
      <span className="font-semibold tracking-tight">InsureFlow</span>
    </div>
  );

  const footer = (
    <div className="p-3 border-t space-y-2 shrink-0">
      <div className="text-xs text-muted-foreground truncate px-1">{email}</div>
      <Link
        to="/settings"
        className="flex items-center rounded-md px-3 py-1.5 text-sm hover:bg-sidebar-accent"
        onClick={() => setMobileOpen(false)}
      >
        <Settings className="h-4 w-4 mr-2" /> Settings
      </Link>
      <Button variant="ghost" size="sm" className="w-full justify-start" onClick={signOut}>
        <LogOut className="h-4 w-4 mr-2" /> Sign out
      </Button>
    </div>
  );

  return (
    <div className="h-[100dvh] md:grid md:grid-cols-[220px_1fr]">
      {/* Mobile hamburger */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-2.5 left-2.5 z-40 h-9 w-9 grid place-items-center rounded-md border bg-background/95 backdrop-blur shadow-sm"
        aria-label="Open navigation"
      >
        <Menu className="h-4 w-4" />
      </button>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex border-r bg-sidebar text-sidebar-foreground flex-col">
        {brand}
        {nav()}
        {footer}
      </aside>

      {/* Mobile drawer */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          className="p-0 w-64 bg-sidebar text-sidebar-foreground flex flex-col"
        >
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          {brand}
          {nav(() => setMobileOpen(false))}
          {footer}
        </SheetContent>
      </Sheet>

      <main className="min-w-0 h-[100dvh] md:h-auto overflow-hidden">
        <Outlet />
      </main>
    </div>
  );
}

function NavItem({
  to,
  icon,
  children,
  onNavigate,
}: {
  to: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  onNavigate?: () => void;
}) {
  return (
    <Link
      to={to}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium",
        "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
      )}
      activeProps={{ className: "bg-sidebar-accent text-sidebar-accent-foreground" }}
    >
      {icon}
      {children}
    </Link>
  );
}
