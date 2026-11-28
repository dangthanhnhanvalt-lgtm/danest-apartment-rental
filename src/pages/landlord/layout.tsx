import {
  BarChart3,
  CalendarDays,
  ChevronLeft,
  MessageSquare,
  PlusCircle,
  Settings,
  Sparkles,
  Building2,
  Menu,
  X,
} from "lucide-react";
import {useNoticeCounts} from "~/api/backend/live-notices";
import { useState } from "react";
import { Link, useNavigate } from "~/lib/router";
import { Logo } from "~/components/logo";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { useAppState } from "~/state/app-state";
import { OverviewPage } from "~/pages/landlord/overview";
import { PropertiesPage } from "~/pages/landlord/properties";
import { PropertyFormPage } from "~/pages/landlord/property-form";
import { RequestsPage } from "~/pages/landlord/requests";
import { SchedulePage } from "~/pages/landlord/schedule";
import { FeaturedPage } from "~/pages/landlord/featured";
import { SettingsPage } from "~/pages/landlord/settings";
import { useI18n } from "~/i18n/language-context";

const NAV = [
  { to: "/landlord", labelKey: "landlord.nav.overview", icon: BarChart3, exact: true },
  { to: "/landlord/listings", labelKey: "landlord.nav.properties", icon: Building2 },
  { to: "/landlord/listings/new", labelKey: "landlord.nav.new", icon: PlusCircle },
  { to: "/landlord/requests", labelKey: "landlord.nav.requests", icon: MessageSquare },
  { to: "/landlord/viewings", labelKey: "landlord.nav.viewings", icon: CalendarDays },
  { to: "/landlord/featured", labelKey: "landlord.nav.featured", icon: Sparkles },
  { to: "/landlord/settings", labelKey: "landlord.nav.settings", icon: Settings },
];

function NavList({ path, onNavigate, unread }: { path: string; onNavigate?: () => void; unread:number }) {
  const navigate = useNavigate();
  const { t } = useI18n();
  return (
    <nav aria-label={t("landlord.nav.aria")} className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
      {NAV.map((item) => {
        const active = item.exact ? path === item.to : path === item.to;
        if (item.to === "/landlord/listings/new") {
          return (
            <button
              key={item.to}
              type="button"
              onClick={() => {
                onNavigate?.();
                navigate(item.to);
              }}
              className="flex w-full items-center gap-3 rounded-lg bg-primary px-3 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <item.icon className="size-4" aria-hidden="true" />
              {t(item.labelKey)}
            </button>
          );
        }
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active
                ? "bg-[#E7F6FD] text-[#087EBD] font-semibold"
                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            )}
          >
            <item.icon className="size-4" aria-hidden="true" />
            {t(item.labelKey)} {item.to==="/landlord/requests"&&unread>0&&<span className="ml-auto rounded-full bg-primary px-2 text-xs text-primary-foreground">{unread}</span>}
          </Link>
        );
      })}
    </nav>
  );
}

function renderPage(path: string) {
  if (path === "/landlord/listings/new") return <PropertyFormPage mode="create" />;
  if (path.startsWith("/landlord/listings/edit/")) return <PropertyFormPage mode="edit" listingId={path.replace("/landlord/listings/edit/", "")} />;
  if (path === "/landlord/listings") return <PropertiesPage />;
  if (path === "/landlord/requests") return <RequestsPage />;
  if (path === "/landlord/viewings") return <SchedulePage />;
  if (path === "/landlord/featured") return <FeaturedPage />;
  if (path === "/landlord/settings") return <SettingsPage />;
  return <OverviewPage />;
}

function LandlordGate({ mode }: { mode: "guest" | "renter" }) {
  const navigate = useNavigate();
  const { t } = useI18n();
  return (
    <main className="flex min-h-[calc(100vh-4rem)] w-full items-center justify-center bg-[#F5FBFF] px-4 py-16 text-center">
      <div className="flex w-full max-w-xl flex-col items-center rounded-2xl border border-[#DCEAF0] bg-white px-6 py-12 shadow-[0_12px_40px_rgba(18,51,74,0.06)] sm:px-10">
      <span className="inline-flex rounded-full border border-[#DCEAF0] bg-[#E8F7FD] px-3 py-1 text-xs font-semibold uppercase tracking-wider text-[#087EBD]">
        {t("landlord.gate.eyebrow")}
      </span>
      <h1 className="mt-4 font-heading text-3xl font-semibold text-[#12334A]">
        {mode === "guest" ? t("landlord.gate.guestTitle") : t("landlord.gate.renterTitle")}
      </h1>
      <p className="mt-3 max-w-md text-base text-[#557083]">
        {mode === "guest" ? t("landlord.gate.guestHint") : t("landlord.gate.renterHint")}
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Button className="bg-[#087EBD] text-white hover:bg-[#066A9E]" onClick={() => navigate(mode === "guest" ? "/login" : "/register")}>
          {mode === "guest" ? t("landlord.gate.login") : t("landlord.gate.register")}
        </Button>
        <Button variant="outline" className="border-[#DCEAF0] bg-white text-[#12334A] hover:bg-[#E8F7FD]" onClick={() => navigate("/search")}>
          {t("common.browseApartments")}
        </Button>
        <Button variant="ghost" className="text-[#087EBD] hover:bg-[#E8F7FD]" onClick={() => navigate("/")}>
          {t("common.backToHome")}
        </Button>
      </div>
      <p className="mt-8 max-w-md text-xs text-[#557083]">
        {t("landlord.gate.demoNote")}
      </p>
      </div>
    </main>
  );
}

export function LandlordLayout({ path }: { path: string }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { session, isLandlord, backendReady, logout } = useAppState();
  const { t, pick } = useI18n();
  const counts=useNoticeCounts(session?.user.accountStatus==="active"&&isLandlord?session.user.id:undefined);

  // Client-side gate (NOT server RBAC — see RBAC-SPEC §7). A guest must log in;
  // a signed-in renter is told this area is for landlord accounts.
  if (!backendReady) return <main className="p-8 text-center">{pick("Checking account…", "Đang kiểm tra tài khoản…")}</main>;
  if (!session) return <LandlordGate mode="guest" />;
  if (!isLandlord) return <LandlordGate mode="renter" />;
  if (session.user.accountStatus !== "active") return (
    <main className="mx-auto max-w-xl space-y-5 px-4 py-24 text-center">
      <h1 className="font-heading text-3xl">{pick("Account awaiting approval", "Tài khoản đang chờ xét duyệt")}</h1>
      <p>{pick("An administrator must approve your landlord account before you can post listings. Return to this page after approval.", "Admin phải xét duyệt tài khoản chủ nhà trước khi bạn được đăng tin. Hãy quay lại trang này sau khi được duyệt.")}</p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button asChild><Link to="/search">{t("common.browseApartments")}</Link></Button>
        <Button variant="outline" onClick={() => window.location.reload()}>{pick("Check again", "Kiểm tra lại")}</Button>
        <Button variant="ghost" onClick={() => { void logout().then(() => window.location.assign("/login")).catch((e) => alert(String(e))); }}>{pick("Sign out", "Đăng xuất")}</Button>
      </div>
    </main>
  );

  const sidebarInner = (
    <>
      <div className="flex h-16 shrink-0 items-center border-b border-sidebar-border px-4">
        <Logo />
      </div>
      <div className="border-b border-sidebar-border px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("landlord.layout.landlord")}</p>
        <p className="mt-0.5 text-sm font-medium text-sidebar-foreground">{session?.user.name || "—"}</p>
      </div>
      <NavList unread={counts.messages} path={path} onNavigate={() => setDrawerOpen(false)} />
      <div className="shrink-0 border-t border-sidebar-border p-3">
        <Link
          to="/"
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <ChevronLeft className="size-4" aria-hidden="true" />
          {t("landlord.layout.backToSite")}
        </Link>
      </div>
    </>
  );

  return (
    <div className="danest-landlord-surface danest-landlord-v14 min-h-screen bg-white">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex">
        {sidebarInner}
      </aside>

      {drawerOpen ? (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <div
            className="absolute inset-0"
            style={{ backgroundColor: "var(--overlay-bg)" }}
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[90vw] flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
            <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4">
              <Logo />
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="flex size-10 items-center justify-center rounded-lg text-sidebar-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                aria-label={t("nav.closeMenu")}
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>
            {sidebarInner}
          </div>
        </div>
      ) : null}

      <div className="lg:pl-72">
        {/* Keep the navigation drawer accessible on small screens without a duplicate dashboard toolbar. */}
        <div className="border-b border-[#DCEAF0] bg-white px-4 py-2 lg:hidden">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-[#12334A] hover:bg-[#E8F7FD] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#087EBD]"
            aria-label={t("landlord.layout.openMenu")}
          >
            <Menu className="size-5" aria-hidden="true" />
            {t("landlord.layout.openMenu")}
          </button>
        </div>

        <main className="danest-landlord-content mx-auto w-full max-w-[1500px] p-4 md:p-6 lg:p-9"><div key={session.user.id}>{renderPage(path)}</div></main>
      </div>
    </div>
  );
}
