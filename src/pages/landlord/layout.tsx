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
  ExternalLink,
} from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "~/lib/router";
import { Logo } from "~/components/logo";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { LANDLORD_PROFILE } from "~/data/listings";
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

function NavList({ path, onNavigate }: { path: string; onNavigate?: () => void }) {
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
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center px-4 py-20 text-center">
      <span className="inline-flex rounded-full border border-border bg-muted px-3 py-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {t("landlord.gate.eyebrow")}
      </span>
      <h1 className="mt-4 font-heading text-3xl font-semibold text-foreground">
        {mode === "guest" ? t("landlord.gate.guestTitle") : t("landlord.gate.renterTitle")}
      </h1>
      <p className="mt-3 max-w-md text-base text-muted-foreground">
        {mode === "guest" ? t("landlord.gate.guestHint") : t("landlord.gate.renterHint")}
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Button onClick={() => navigate(mode === "guest" ? "/login" : "/register")}>
          {mode === "guest" ? t("landlord.gate.login") : t("landlord.gate.register")}
        </Button>
        <Button variant="outline" onClick={() => navigate("/search")}>
          {t("common.browseApartments")}
        </Button>
        <Button variant="ghost" onClick={() => navigate("/")}>
          {t("common.backToHome")}
        </Button>
      </div>
      <p className="mt-8 max-w-md text-xs text-muted-foreground">
        {t("landlord.gate.demoNote")}
      </p>
    </main>
  );
}

export function LandlordLayout({ path }: { path: string }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { session, isLandlord } = useAppState();
  const { t } = useI18n();

  // Client-side gate (NOT server RBAC — see RBAC-SPEC §7). A guest must log in;
  // a signed-in renter is told this area is for landlord accounts.
  if (!session) return <LandlordGate mode="guest" />;
  if (!isLandlord) return <LandlordGate mode="renter" />;

  const sidebarInner = (
    <>
      <div className="flex h-16 shrink-0 items-center border-b border-sidebar-border px-4">
        <Logo />
      </div>
      <div className="border-b border-sidebar-border px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("landlord.layout.landlord")}</p>
        <p className="mt-0.5 text-sm font-medium text-sidebar-foreground">{session?.user.name || LANDLORD_PROFILE.displayName}</p>
      </div>
      <NavList path={path} onNavigate={() => setDrawerOpen(false)} />
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
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground lg:flex">
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
          <div className="absolute inset-y-0 left-0 flex w-72 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
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

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-background px-4 md:px-6">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="flex size-10 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
            aria-label={t("landlord.layout.openMenu")}
          >
            <Menu className="size-5" aria-hidden="true" />
          </button>
          <p className="text-sm font-semibold text-foreground">{t("landlord.layout.title")}</p>
          <span className="hidden rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground sm:inline-flex">
            {t("landlord.layout.demoAccount")}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <Link
              to="/search"
              className="inline-flex h-10 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              {t("landlord.layout.viewSite")} <ExternalLink className="size-3.5" aria-hidden="true" />
            </Link>
            <Button className="hidden sm:inline-flex" asChild>
              <Link to="/landlord/listings/new">{t("landlord.layout.addListing")}</Link>
            </Button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl p-4 md:p-6 lg:p-8">{renderPage(path)}</main>
      </div>
    </div>
  );
}
