import {
  BarChart3,
  Building2,
  ClipboardCheck,
  Eye,
  Flag,
  Gauge,
  Lock,
  LogOut,
  Menu,
  Settings,
  X,
} from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";import { Link, useNavigate } from "~/lib/router";
import { AdminProvider } from "~/state/admin-state";
import { useToast } from "~/components/ui/toast";
import { Button } from "~/components/ui/button";
import { Field, Input } from "~/components/ui/form";
import { supabase } from "~/lib/supabase";
import { backendAuthRepository } from "~/api/backend/auth";
import { cn } from "~/lib/utils";
import { OverviewPage } from "~/pages/admin/overview";
import { ListingsPage } from "~/pages/admin/listings";
import { UsersPage } from "~/pages/admin/users";
import { ReportsPage } from "~/pages/admin/reports";
import { KpisPage } from "~/pages/admin/kpis";
import { AuditPage } from "~/pages/admin/audit";
import { AdminSettingsPage } from "~/pages/admin/settings";
import { useI18n } from "~/i18n/language-context";


const NAV = [
  { to: "/admin", labelKey: "admin.nav.overview", icon: BarChart3, exact: true },
  { to: "/admin/listings", labelKey: "admin.nav.listings", icon: ClipboardCheck },
  { to: "/admin/users", labelKey: "admin.nav.users", icon: Building2 },
  { to: "/admin/reports", labelKey: "admin.nav.reports", icon: Flag },
  { to: "/admin/kpis", labelKey: "admin.nav.kpis", icon: Gauge },
  { to: "/admin/audit", labelKey: "admin.nav.audit", icon: Eye },
  { to: "/admin/settings", labelKey: "admin.nav.settings", icon: Settings },
];

function AdminLogin({ onSignedIn }: { onSignedIn: () => void }) {
  const { t } = useI18n();
  const { toast } = useToast();
  const [email, setEmail] = useState("");  
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

const submit = async (e: FormEvent) => {
  e.preventDefault();
  setError("");

  try {
    const session = await backendAuthRepository.login(
      email.trim(),
      password
    );

    if (session.user.role !== "admin") {
      await backendAuthRepository.logout();
      setError("Tài khoản này không có quyền quản trị.");
      return;
    }

    toast({
      title: "Đăng nhập thành công",
      description: "Chào mừng đến với trang quản trị DaNest.",
      tone: "success",
    });

    onSignedIn();
  } catch (err) {
    setError(
      err instanceof Error
        ? err.message
        : "Đăng nhập thất bại. Vui lòng thử lại."
    );
  }
};

  return (
    <div className="flex min-h-screen items-center justify-center bg-section-alt px-4 py-12">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-border bg-card p-6 md:p-8" style={{ boxShadow: "var(--shadow-elevated)" }}>
          <span className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Lock className="size-5" aria-hidden="true" />
          </span>
          <h1 className="mt-4 font-heading text-2xl font-semibold text-card-foreground">{t("admin.login.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("admin.staffOnlyNote")}</p>
          <form className="mt-6 space-y-4" onSubmit={submit}>
            <Field label={t("admin.login.staffEmail")} htmlFor="admin-email" hint={t("admin.login.demoAccountHint")}>
              <Input id="admin-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
            </Field>
            <Field label={t("admin.login.password")} htmlFor="admin-password" error={error || undefined} hint={t("admin.login.anyPasswordHint")}>
              <Input id="admin-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" placeholder="••••••" />
            </Field>
            <Button type="submit" size="lg" className="w-full">
              {t("admin.login.submit")}
            </Button>
          </form>
          <p className="mt-4 rounded-xl border border-border bg-muted p-3 text-xs leading-relaxed text-muted-foreground">
            {t("admin.login.simulatedNote")}
          </p>
        </div>
        <p className="mt-4 text-center text-sm">
          <Link to="/" className="text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
            {t("admin.login.returnToPublic")}
          </Link>
        </p>
      </div>
    </div>
  );
}

function AdminShell({ path, onSignOut }: { path: string; onSignOut: () => void }) {
  const { t } = useI18n();
  const [drawer, setDrawer] = useState(false);
  const navigate = useNavigate();

  const nav = (
    <nav aria-label={t("admin.navAria")} className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
      {NAV.map((item) => {
        const active = item.exact ? path === item.to : path.startsWith(item.to);
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={() => setDrawer(false)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            )}
          >
            <item.icon className="size-4" aria-hidden="true" />
            {t(item.labelKey)}
          </Link>
        );
      })}
    </nav>
  );

  const brand = (
    <div className="flex h-16 shrink-0 items-center gap-3 border-b border-sidebar-border px-4">
      <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
        <Building2 className="size-4" aria-hidden="true" />
      </span>
      <div className="leading-tight">
        <p className="font-heading text-lg font-semibold tracking-[0.04em] text-foreground">DaNest</p>
        <p className="text-[0.625rem] font-medium uppercase tracking-[0.18em] text-muted-foreground">{t("admin.console")}</p>
      </div>
    </div>
  );

  const page = () => {
    if (path === "/admin/listings") return <ListingsPage />;
    if (path === "/admin/users") return <UsersPage />;
    if (path === "/admin/reports") return <ReportsPage />;
    if (path === "/admin/kpis") return <KpisPage />;
    if (path === "/admin/audit") return <AuditPage />;
    if (path === "/admin/settings") return <AdminSettingsPage />;
    return <OverviewPage />;
  };

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex">
        {brand}
        <div className="border-b border-sidebar-border px-4 py-3">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
            <Lock className="size-3" aria-hidden="true" /> {t("admin.internalDemo")}
          </span>
        </div>
        {nav}
        <div className="shrink-0 space-y-1 border-t border-sidebar-border p-3">
          <button
            type="button"
            onClick={onSignOut}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <LogOut className="size-4" aria-hidden="true" /> {t("admin.signOut")}
          </button>
          <Link
            to="/"
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <Eye className="size-4" aria-hidden="true" /> {t("admin.viewPublicSite")}
          </Link>
        </div>
      </aside>

      {drawer ? (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <div className="absolute inset-0" style={{ backgroundColor: "var(--overlay-bg)" }} onClick={() => setDrawer(false)} aria-hidden="true" />
          <div className="absolute inset-y-0 left-0 flex w-72 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
            <div className="flex items-center justify-between">
              {brand}
              <button type="button" onClick={() => setDrawer(false)} className="mr-3 flex size-10 items-center justify-center rounded-lg text-sidebar-foreground hover:bg-sidebar-accent" aria-label={t("admin.closeMenu")}>
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>
            {nav}
          </div>
        </div>
      ) : null}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background px-4 md:px-6">
          <button
            type="button"
            onClick={() => setDrawer(true)}
            className="flex size-10 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-accent hover:text-accent-foreground lg:hidden"
            aria-label={t("admin.openMenu")}
          >
            <Menu className="size-5" aria-hidden="true" />
          </button>
          <p className="text-sm font-semibold text-foreground">{t("admin.title")}</p>
          <span className="hidden rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground sm:inline-flex">
            {t("admin.internalRole")}
          </span>
          <div className="ml-auto">
            <Button variant="outline" onClick={() => navigate("/")}>
              {t("admin.viewSite")}
            </Button>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl p-4 md:p-6 lg:p-8">{page()}</main>
      </div>
    </div>
  );
}

export function AdminApp({ path }: { path: string }) {
  const [signedIn, setSignedIn] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;

    const checkAdmin = async () => {
      try {
        const session = await backendAuthRepository.current();

        if (active) {
          setSignedIn(session?.user.role === "admin");
        }
      } catch (error) {
        console.error("Admin authentication error:", error);

        if (active) {
          setSignedIn(false);
        }
      } finally {
        if (active) {
          setChecking(false);
        }
      }
    };

    void checkAdmin();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (event) => {
        if (event === "SIGNED_OUT") {
          setSignedIn(false);
        }
      }
    );

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const handleSignOut = async () => {
    try {
      await backendAuthRepository.logout();
      setSignedIn(false);
    } catch (error) {
      console.error("Admin logout error:", error);
    }
  };

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p>Đang kiểm tra quyền quản trị...</p>
      </div>
    );
  }

  if (!signedIn) {
    return (
      <AdminLogin
        onSignedIn={() => setSignedIn(true)}
      />
    );
  }

  return (
    <AdminProvider>
      <AdminShell
        path={path}
        onSignOut={() => {
          void handleSignOut();
        }}
      />
    </AdminProvider>
  );
}