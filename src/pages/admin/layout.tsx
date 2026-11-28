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
  PanelLeftClose,
  PanelLeftOpen,
  Languages,
  Settings,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "~/lib/router";
import { AdminProvider, useAdmin } from "~/state/admin-state";
import { useToast } from "~/components/ui/toast";
import { Button } from "~/components/ui/button";
import { Field, Input } from "~/components/ui/form";
import { useAppState } from "~/state/app-state";
import { cn } from "~/lib/utils";
import { OverviewPage } from "~/pages/admin/overview";
import { ListingsPage } from "~/pages/admin/listings";
import { UsersPage } from "~/pages/admin/users";
import { PromotionWorkspace } from "~/components/promotion-workspace";
import { ReportsPage } from "~/pages/admin/reports";
import { KpisPage } from "~/pages/admin/kpis";
import { AuditPage } from "~/pages/admin/audit";
import { AdminSettingsPage } from "~/pages/admin/settings";
import { LoadingRows } from "~/pages/admin/shared";
import { useI18n } from "~/i18n/language-context";


const NAV = [
  { to: "/admin", labelKey: "admin.nav.overview", icon: BarChart3, exact: true },
  { to: "/admin/listings", labelKey: "admin.nav.listings", icon: ClipboardCheck },
  { to: "/admin/users", labelKey: "admin.nav.users", icon: Building2 },
  { to: "/admin/reports", labelKey: "admin.nav.reports", icon: Flag },
  { to: "/admin/promotions", labelKey: "admin.nav.promotions", icon: Sparkles },
  { to: "/admin/kpis", labelKey: "admin.nav.kpis", icon: Gauge },
  { to: "/admin/audit", labelKey: "admin.nav.audit", icon: Eye },
  { to: "/admin/settings", labelKey: "admin.nav.settings", icon: Settings },
];

function AdminLogin() {
  const { login } = useAppState();
  const { t, pick, lang, setLang } = useI18n();
  const { toast } = useToast();
  const [email, setEmail] = useState("");  
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

const submit = async (e: FormEvent) => {
  e.preventDefault();
  setError("");

  try {
    await login(
      email.trim(),
      password,
      "admin"
    );


    toast({
      title: pick("Signed in successfully", "Đăng nhập thành công"),
      description: pick("Welcome to the DaNest admin console.", "Chào mừng đến với trang quản trị DaNest."),
      tone: "success",
    });

  } catch (err) {
    setError(
      err instanceof Error
        ? err.message
        : pick("Sign-in failed. Please retry.", "Đăng nhập thất bại. Vui lòng thử lại.")
    );
  }
};

  return (
    <div className="flex min-h-screen items-center justify-center bg-section-alt px-4 py-12">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-border bg-card p-6 md:p-8" style={{ boxShadow: "var(--shadow-elevated)" }}>
          <div className="mb-3 flex justify-end"><button type="button" className="flex size-10 items-center justify-center rounded-lg border border-[#CDE5F0] text-[#087EBD] hover:bg-[#E8F7FD]" onClick={()=>setLang(lang==="vi"?"en":"vi")} aria-label={t("nav.changeLanguage")} title={pick("Switch to Vietnamese","Chuyển sang tiếng Anh")}><Languages className="size-5" /></button></div>
          <span className="flex size-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Lock className="size-5" aria-hidden="true" />
          </span>
          <h1 className="mt-4 font-heading text-2xl font-semibold text-card-foreground">{t("admin.login.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("admin.staffOnlyNote")}</p>
          <form className="mt-6 space-y-4" onSubmit={submit}>
            <Field label={t("admin.login.staffEmail")} htmlFor="admin-email">
              <Input id="admin-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
            </Field>
            <Field label={t("admin.login.password")} htmlFor="admin-password" error={error || undefined}>
              <Input id="admin-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" placeholder="••••••" />
            </Field>
            <Button type="submit" size="lg" className="w-full">
              {t("admin.login.submit")}
            </Button>
          </form>
          <Link to="/forgot-password" className="mt-4 block text-sm text-link underline">{pick("Forgot password?", "Quên mật khẩu?")}</Link>

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
  const { loading,loadError,refresh } = useAdmin();
  const { pick, lang, setLang } = useI18n();
  const [refreshing,setRefreshing] = useState(false);
  const reload=async()=>{setRefreshing(true);try{await refresh();}catch{/* displayed in loadError */}finally{setRefreshing(false);}};
  const [drawer, setDrawer] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const navigate = useNavigate();
  const dialogRef=useRef<HTMLDialogElement>(null);
  const menuRef=useRef<HTMLButtonElement>(null);
  useEffect(()=>{const el=dialogRef.current;if(drawer&&!el?.open)el?.showModal();if(!drawer&&el?.open)el.close();},[drawer]);
  useEffect(()=>{const media=window.matchMedia('(min-width: 1024px)');const close=()=>{if(media.matches)setDrawer(false);};media.addEventListener('change',close);return()=>media.removeEventListener('change',close);},[]);
  const groups=[{label:pick('Workspace','Không gian quản trị'),items:NAV.slice(0,1)},{label:pick('Operations & safety','Vận hành & an toàn'),items:NAV.slice(1,4)},{label:pick('Business insights','Kinh doanh & báo cáo'),items:NAV.slice(4,6)},{label:pick('System','Hệ thống'),items:NAV.slice(6)}];

  const nav = (
    <nav aria-label={t("admin.navAria")} className={cn("flex-1 space-y-1 overflow-y-auto px-3 py-4", sidebarCollapsed && "danest-admin-nav-collapsed")}>
      <button type="button" className="danest-admin-language mb-3 flex size-10 items-center justify-center rounded-xl border border-[#CDE5F0] bg-white text-[#087EBD] hover:bg-[#E8F7FD]" onClick={()=>setLang(lang==="vi"?"en":"vi")} aria-label={pick("Switch to Vietnamese","Chuyển sang tiếng Anh")} title={pick("Switch to Vietnamese","Chuyển sang tiếng Anh")}><Languages className="size-5" aria-hidden="true" /></button>
      {groups.map(group=><div key={group.label} className="space-y-1 pt-3"><p className={cn("px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground",sidebarCollapsed && "hidden")}>{group.label}</p>{group.items.map((item) => {
        const active = item.exact ? path === item.to : path.startsWith(item.to);
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={() => setDrawer(false)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              sidebarCollapsed && "lg:justify-center lg:px-2",
              active
                ? "bg-[#E8F7FD] text-[#087EBD] font-semibold"
                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            )}
          >
            <item.icon className="size-4" aria-hidden="true" />
            <span className={cn(sidebarCollapsed && "lg:hidden")}>{t(item.labelKey)}</span>
          </Link>
        );
      })}</div>)}
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
    if (path === "/admin/promotions") return <PromotionWorkspace admin />;
    if (path === "/admin/reports") return <ReportsPage />;
    if (path === "/admin/kpis") return <KpisPage />;
    if (path === "/admin/audit") return <AuditPage />;
    if (path === "/admin/settings") return <AdminSettingsPage />;
    return <OverviewPage />;
  };

  return (
    <div className="danest-admin-surface danest-admin-v13 min-h-screen bg-white">
      <aside className={cn("fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-200 lg:flex",sidebarCollapsed?"w-[76px]":"w-72")}>
        <div className={cn("overflow-hidden",sidebarCollapsed && "lg:hidden")}>{brand}</div>
        {sidebarCollapsed && <div className="hidden h-16 items-center justify-center border-b border-sidebar-border lg:flex"><Building2 className="size-6 text-[#087EBD]"/></div>}
        <div className={cn("border-b border-sidebar-border px-4 py-3",sidebarCollapsed && "lg:hidden")}>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
            <Lock className="size-3" aria-hidden="true" /> {t("admin.internalDemo")}
          </span>
        </div>
        {nav}
        <div className={cn("shrink-0 space-y-1 border-t border-sidebar-border p-3",sidebarCollapsed && "lg:hidden")}>
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

      <dialog ref={dialogRef} onCancel={()=>setDrawer(false)} onClose={()=>{setDrawer(false);menuRef.current?.focus({preventScroll:true});}} aria-label={t("admin.navAria")} className="danest-admin-dialog fixed inset-y-0 left-0 m-0 h-dvh max-h-none w-72 max-w-[90vw] border-r border-sidebar-border bg-sidebar p-0 text-sidebar-foreground" onClick={e=>{if(e.target===e.currentTarget)setDrawer(false);}}>
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between">
              {brand}
              <button type="button" onClick={() => setDrawer(false)} className="mr-3 flex size-10 items-center justify-center rounded-lg text-sidebar-foreground hover:bg-sidebar-accent" aria-label={t("admin.closeMenu")}>
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>
            {nav}
            <div className="shrink-0 space-y-2 border-t border-sidebar-border p-3"><Button variant="outline" className="w-full" asChild><Link to="/" onClick={()=>setDrawer(false)}><Eye className="size-4"/>{t("admin.viewPublicSite")}</Link></Button><Button variant="outline" className="w-full" onClick={()=>{setDrawer(false);onSignOut();}}><LogOut className="size-4"/>{t("admin.signOut")}</Button></div>
          </div>
        </dialog>

      <div className={cn("min-w-0 transition-[padding] duration-200",sidebarCollapsed?"lg:pl-[76px]":"lg:pl-72")}>
        <header className="danest-admin-topbar sticky top-0 z-30 flex h-16 items-center gap-1.5 border-b border-border bg-background px-2 sm:gap-3 sm:px-4 md:px-6">
          <button
            type="button"
            ref={menuRef} aria-expanded={drawer}
            onClick={() => setDrawer(true)}
            className="flex size-10 shrink-0 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-accent hover:text-accent-foreground lg:hidden"
            aria-label={t("admin.openMenu")}
          >
            <Menu className="size-5" aria-hidden="true" />
          </button>
          <button type="button" className="hidden size-10 shrink-0 items-center justify-center rounded-lg border border-[#D5E8F0] text-[#087EBD] hover:bg-[#E8F7FD] lg:flex" onClick={()=>setSidebarCollapsed(v=>!v)} aria-label={sidebarCollapsed?pick("Expand sidebar","Mở rộng thanh bên"):pick("Collapse sidebar","Thu gọn thanh bên")} title={sidebarCollapsed?pick("Expand sidebar","Mở rộng thanh bên"):pick("Collapse sidebar","Thu gọn thanh bên")}>{sidebarCollapsed?<PanelLeftOpen className="size-5"/>:<PanelLeftClose className="size-5"/>}</button>
          <p className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">{t(NAV.find(item=>item.to===path)?.labelKey??"admin.nav.overview")}</p>
          <span className="hidden rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground sm:inline-flex">
            {t("admin.internalRole")}
          </span>
          <div className="ml-auto flex shrink-0 gap-1 sm:gap-2"><Button variant="outline" size="sm" disabled={refreshing} onClick={()=>void reload()} aria-label={pick("Refresh","Làm mới")} className="px-2 sm:px-3">{pick("Refresh","Làm mới")}</Button>
            <Button variant="outline" size="sm" className="hidden sm:inline-flex" onClick={() => navigate("/")}>
              {t("admin.viewSite")}
            </Button>
          </div>
        </header>
        <main className="danest-admin-content mx-auto w-full min-w-0 max-w-[1500px] p-4 sm:p-6 lg:p-9">{loading ? <LoadingRows rows={4}/> : loadError ? <div role="alert" className="rounded-lg border border-destructive p-4"><p>{pick("Unable to load database data","Không tải được dữ liệu")}: {loadError}</p><Button className="mt-3" onClick={()=>void reload()} disabled={refreshing}>{pick("Retry","Thử lại")}</Button></div> : page()}</main>
      </div>
    </div>
  );
}

export function AdminApp({ path }: { path: string }) {
  const { session, backendReady, logout } = useAppState();
  const { pick } = useI18n();
  if (!backendReady) return <div className="flex min-h-screen items-center justify-center"><p>{pick("Checking access…", "Đang kiểm tra quyền quản trị…")}</p></div>;
  if (session?.user.role !== "admin" || session.user.accountStatus !== "active") return <AdminLogin />;
  return <AdminProvider key={session.user.id}><AdminShell path={path} onSignOut={() => { void logout().catch(err=>alert(String(err))); }} /></AdminProvider>;
}
