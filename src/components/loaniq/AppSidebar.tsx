import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Search,
  Calculator,
  Users,
  FileBarChart,
  Settings as SettingsIcon,
  Database,
  Brain,
  LogOut,
  Activity,
  Briefcase,
  Inbox,
  Webhook,
  Receipt,
  Wallet,
  TrendingUp,
  UserCog,
  Target,
} from "lucide-react";
import { useAuth } from "@/lib/auth/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean };

const NAV: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/loan-search", label: "Loan Search", icon: Search },
  { to: "/income-analyzer", label: "Income Analyzer", icon: Calculator },
  { to: "/reports", label: "Reports", icon: FileBarChart },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

const OPS_NAV: NavItem[] = [
  { to: "/ops", label: "Pipeline", icon: Briefcase, exact: true },
  { to: "/ops/leads", label: "Lead Intake", icon: Inbox },
  { to: "/ops/loans", label: "Tracked Loans", icon: Briefcase },
];

const OPS_ADMIN_NAV: NavItem[] = [
  { to: "/ops/admin/production", label: "Production", icon: TrendingUp },
  { to: "/ops/admin/lead-sources", label: "Lead Source ROI", icon: Target },
  { to: "/ops/admin/expenses", label: "Expenses", icon: Receipt },
  { to: "/ops/admin/payroll", label: "Payroll", icon: Wallet },
  { to: "/ops/admin/users", label: "Users & Roles", icon: UserCog },
  { to: "/ops/admin/webhooks", label: "Webhooks", icon: Webhook },
];

const ADMIN_NAV: NavItem[] = [
  { to: "/catalog", label: "Lender Catalog", icon: Database },
  { to: "/knowledge", label: "Knowledge", icon: Brain },
];

export function AppSidebar() {
  const loc = useLocation();
  const navigate = useNavigate();
  const { session, isAdmin } = useAuth();

  async function signOut() {
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/auth" });
  }

  const isActive = (to: string, exact?: boolean) =>
    exact ? loc.pathname === to : loc.pathname === to || loc.pathname.startsWith(to + "/");

  return (
    <aside className="flex h-screen w-60 flex-shrink-0 flex-col border-r border-border bg-panel/80 backdrop-blur sticky top-0">
      {/* Logo */}
      <Link to="/" className="flex items-center gap-3 px-5 py-5 border-b border-border">
        <div className="relative h-8 w-8">
          <div className="absolute inset-0 rounded-sm border border-cyan/60 animate-pulse-glow" />
          <div className="absolute inset-1 rounded-sm bg-cyan/20" />
          <div className="absolute inset-2 rounded-sm bg-cyan animate-data-pulse" />
        </div>
        <div className="flex flex-col leading-none">
          <span className="text-display text-lg font-bold text-cyan glow-cyan">
            LOAN<span className="text-foreground">IQ</span>
          </span>
          <span className="text-hud text-[9px] text-muted-foreground">MPS MORTGAGE</span>
        </div>
      </Link>

      {/* Status */}
      <div className="px-5 py-3 border-b border-border">
        <div className="flex items-center gap-2 text-hud text-[10px]">
          <div className="h-1.5 w-1.5 rounded-full bg-success animate-data-pulse" />
          <span className="text-success">JARVIS ONLINE</span>
          <Activity className="h-3 w-3 text-muted-foreground ml-auto" />
        </div>
      </div>

      {/* Main nav */}
      <nav className="flex-1 overflow-y-auto py-3">
        <div className="px-3 mb-1 text-hud text-[10px] text-muted-foreground">PLATFORM</div>
        <div className="space-y-0.5 px-2">
          {NAV.map((item) => {
            const active = isActive(item.to, item.exact);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to as never}
                className={`flex items-center gap-3 rounded-sm px-3 py-2 text-sm transition-all ${
                  active
                    ? "bg-cyan/10 text-cyan border-l-2 border-cyan"
                    : "text-muted-foreground hover:bg-panel hover:text-foreground border-l-2 border-transparent"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="text-hud text-xs">{item.label}</span>
              </Link>
            );
          })}
        </div>

        <div className="px-3 mt-5 mb-1 text-hud text-[10px] text-muted-foreground">OPERATIONS</div>
        <div className="space-y-0.5 px-2">
          {OPS_NAV.map((item) => {
            const active = isActive(item.to, item.exact);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to as never}
                className={`flex items-center gap-3 rounded-sm px-3 py-2 text-sm transition-all ${
                  active
                    ? "bg-cyan/10 text-cyan border-l-2 border-cyan"
                    : "text-muted-foreground hover:bg-panel hover:text-foreground border-l-2 border-transparent"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span className="text-hud text-xs">{item.label}</span>
              </Link>
            );
          })}
        </div>

        {isAdmin && (
          <>
            <div className="px-3 mt-5 mb-1 text-hud text-[10px] text-muted-foreground">OPS ADMIN</div>
            <div className="space-y-0.5 px-2">
              {OPS_ADMIN_NAV.map((item) => {
                const active = isActive(item.to);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to as never}
                    className={`flex items-center gap-3 rounded-sm px-3 py-2 text-sm transition-all ${
                      active
                        ? "bg-cyan/10 text-cyan border-l-2 border-cyan"
                        : "text-muted-foreground hover:bg-panel hover:text-foreground border-l-2 border-transparent"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-hud text-xs">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </>
        )}

        {isAdmin && (
          <>
            <div className="px-3 mt-5 mb-1 text-hud text-[10px] text-muted-foreground">ADMIN</div>
            <div className="space-y-0.5 px-2">
              {ADMIN_NAV.map((item) => {
                const active = isActive(item.to);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to as never}
                    className={`flex items-center gap-3 rounded-sm px-3 py-2 text-sm transition-all ${
                      active
                        ? "bg-cyan/10 text-cyan border-l-2 border-cyan"
                        : "text-muted-foreground hover:bg-panel hover:text-foreground border-l-2 border-transparent"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-hud text-xs">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </>
        )}
      </nav>

      {/* User footer */}
      {session && (
        <div className="border-t border-border p-3 space-y-2">
          <div className="text-mono text-[10px] text-muted-foreground truncate px-1">
            {session.user.email}
          </div>
          <button
            onClick={signOut}
            className="w-full flex items-center gap-2 rounded-sm border border-border bg-panel/50 px-3 py-2 text-hud text-xs text-muted-foreground transition hover:border-warn/60 hover:text-warn"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign Out
          </button>
        </div>
      )}
    </aside>
  );
}
