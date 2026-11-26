import { Check, ChevronDown, Globe, Heart, LayoutDashboard, Menu, User, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useRouter } from "~/lib/router";
import { useAppState } from "~/state/app-state";
import { cn } from "~/lib/utils";
import { Button } from "~/components/ui/button";
import { Logo } from "~/components/logo";
import { useI18n } from "~/i18n/language-context";
import type { Lang } from "~/i18n/types";

const NAV_LINKS = [
  { to: "/search", key: "nav.explore" },
  { to: "/#how-it-works", key: "nav.howItWorks" },
  { to: "/landlord", key: "nav.forLandlords" },
  { to: "/about", key: "nav.about" },
] as const;

const LANGUAGES: { code: Lang; label: string }[] = [
  { code: "en", label: "English" },
  { code: "vi", label: "Tiếng Việt" },
];

export function Header() {
  const { path, navigate } = useRouter();
  const { savedIds, session, logout } = useAppState();
  const { lang, setLang, t } = useI18n();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setLangOpen(false);
  }, [path]);

  const isActive = (to: string) => {
    const base = to.split("?")[0];
    if (base === "/search") return path === "/search";
    return path === base;
  };

  return (
    <header
      className={cn(
        "sticky top-0 z-50 border-b bg-background/95 backdrop-blur transition-shadow",
        scrolled ? "border-border shadow-[0_1px_8px_rgba(23,44,61,0.06)]" : "border-transparent",
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-4 py-3 md:px-6 lg:px-8">
        <Logo />

        <nav aria-label={t("aria.mainNav")} className="hidden flex-1 items-center justify-center gap-1 lg:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.key}
              to={link.to}
              className={cn(
                "rounded-lg px-3.5 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
                isActive(link.to) ? "text-link" : "text-foreground",
              )}
            >
              {t(link.key)}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1.5 lg:ml-0">
          <div className="relative hidden md:block">
            <button
              type="button"
              onClick={() => setLangOpen((v) => !v)}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-haspopup="listbox"
              aria-expanded={langOpen}
              aria-label={t("nav.changeLanguage")}
            >
              <Globe className="size-4" aria-hidden="true" />
              {lang.toUpperCase()}
              <ChevronDown className="size-3.5" aria-hidden="true" />
            </button>
            {langOpen ? (
              <div
                className="absolute right-0 top-full z-50 mt-2 w-44 overflow-hidden rounded-xl border border-border bg-popover p-1.5 animate-in fade-in slide-in-from-top-1"
                style={{ boxShadow: "var(--shadow-elevated)" }}
                role="listbox"
                aria-label={t("nav.interfaceLanguage")}
              >
                {LANGUAGES.map((l) => (
                  <button
                    key={l.code}
                    type="button"
                    role="option"
                    aria-selected={lang === l.code}
                    onClick={() => {
                      setLang(l.code);
                      setLangOpen(false);
                    }}
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
                      lang === l.code ? "font-semibold text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {l.label}
                    {lang === l.code ? <Check className="size-4 text-link" aria-hidden="true" /> : null}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          <Link
            to="/saved"
            className="relative hidden size-10 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-accent hover:text-accent-foreground sm:flex"
            aria-label={savedIds.length ? t("nav.savedAria", { count: savedIds.length }) : t("nav.saved")}
          >
            <Heart className="size-5" aria-hidden="true" />
            {savedIds.length > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 flex size-4.5 min-w-4.5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                {savedIds.length}
              </span>
            ) : null}
          </Link>

          {session ? (
            <div className="hidden items-center gap-1.5 md:flex">
              <span className="inline-flex size-9 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground">
                {session.user.avatarInitials}
              </span>
              <Button variant="ghost" size="sm" className="h-10" onClick={logout}>
                {t("nav.logout")}
              </Button>
            </div>
          ) : (
            <Link
              to="/login"
              className="hidden h-10 items-center rounded-lg px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground md:inline-flex"
            >
              {t("nav.login")}
            </Link>
          )}

          <Button className="hidden h-10 md:inline-flex" onClick={() => navigate("/landlord/listings/new")}>
            {t("nav.listProperty")}
          </Button>

          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            className="inline-flex size-10 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:hidden"
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
            aria-label={mobileOpen ? t("nav.closeMenu") : t("nav.openMenu")}
          >
            {mobileOpen ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
          </button>
        </div>
      </div>

      {mobileOpen ? (
        <div id="mobile-nav" className="border-t border-border bg-background lg:hidden">
          <nav aria-label={t("aria.mobileNav")} className="mx-auto max-w-7xl space-y-1 px-4 py-3 md:px-6">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.key}
                to={link.to}
                onClick={() => setMobileOpen(false)}
                className="block rounded-lg px-3 py-2.5 text-base font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                {t(link.key)}
              </Link>
            ))}
            <div className="my-2 border-t border-border" />
            <div className="flex items-center gap-2 px-3 py-2">
              <Globe className="size-4 text-muted-foreground" aria-hidden="true" />
              <span className="text-sm font-medium text-foreground">{t("nav.interfaceLanguage")}</span>
              <div className="ml-auto flex gap-1">
                {LANGUAGES.map((l) => (
                  <button
                    key={l.code}
                    type="button"
                    onClick={() => setLang(l.code)}
                    aria-pressed={lang === l.code}
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                      lang === l.code ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent",
                    )}
                  >
                    {l.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="my-2 border-t border-border" />
            <Link
              to="/saved"
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-base font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <Heart className="size-4" aria-hidden="true" /> {t("nav.saved")}
              {savedIds.length > 0 ? (
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-foreground">{savedIds.length}</span>
              ) : null}
            </Link>
            <Link
              to="/landlord"
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-base font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <LayoutDashboard className="size-4" aria-hidden="true" /> {t("nav.landlordDashboard")}
            </Link>
            {session ? (
              <button
                type="button"
                onClick={() => {
                  logout();
                  setMobileOpen(false);
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-base font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <User className="size-4" aria-hidden="true" /> {t("nav.logout")} ({session.user.name})
              </button>
            ) : (
              <Link
                to="/login"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-base font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                <User className="size-4" aria-hidden="true" /> {t("nav.login")}
              </Link>
            )}
            <div className="px-3 pb-1 pt-2">
              <Button
                className="w-full"
                onClick={() => {
                  setMobileOpen(false);
                  navigate("/landlord/listings/new");
                }}
              >
                {t("nav.listProperty")}
              </Button>
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
