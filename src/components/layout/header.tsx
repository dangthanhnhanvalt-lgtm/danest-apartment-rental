import { Bell, Building2, CalendarDays, Check, ChevronDown, Languages, Heart, LayoutDashboard, LogOut, Menu, MessagesSquare, Plus, Settings, Sparkles, User, X } from "lucide-react";
import {useNoticeCounts} from "~/api/backend/live-notices";
import { useEffect, useRef, useState } from "react";
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
  { to: "/about", key: "nav.about" },
] as const;

const LANDLORD_LINKS = [
  { to: "/landlord", en: "Overview", vi: "Tổng quan", Icon: LayoutDashboard },
  { to: "/landlord/listings", en: "My properties", vi: "Căn hộ của tôi", Icon: Building2 },
  { to: "/landlord/requests", en: "Rental inquiries", vi: "Yêu cầu thuê", Icon: MessagesSquare },
  { to: "/landlord/viewings", en: "Viewings", vi: "Lịch xem", Icon: CalendarDays },
  { to: "/landlord/featured", en: "Featured & reports", vi: "Tin nổi bật & Báo cáo", Icon: Sparkles },
  { to: "/landlord/settings", en: "Account settings", vi: "Cài đặt tài khoản", Icon: Settings },
] as const;

const LANGUAGES: { code: Lang; label: string }[] = [
  { code: "en", label: "English" },
  { code: "vi", label: "Tiếng Việt" },
];

export function Header() {
  const { path, navigate } = useRouter();
  const { savedIds, session, logout } = useAppState();
  const { lang, setLang, t, pick } = useI18n();
  const isLandlord = session?.user.role === "landlord";
  const isRenter = session?.user.role === "tenant";
  const hasAccountMenu = isRenter || isLandlord;
  const navLinks = NAV_LINKS;
  const navLabel = (link: (typeof NAV_LINKS)[number]) => {
    switch (link.key) {
      case "nav.explore": return pick("Explore", "Khám phá");
      case "nav.howItWorks": return pick("How it works", "Cách hoạt động");
      case "nav.about": return pick("About us", "Về DaNest");
    }
  };
  const counts=useNoticeCounts(session?.user.accountStatus==="active"?session.user.id:undefined);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const langRef = useRef<HTMLDivElement>(null);
  const accountRef = useRef<HTMLDivElement>(null);
  const accountButtonRef = useRef<HTMLButtonElement>(null);
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
    setAccountOpen(false);
  }, [path, session?.user.id, session?.user.role]);

  useEffect(() => {
    if (!accountOpen && !langOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!accountRef.current?.contains(event.target as Node)) setAccountOpen(false);
      if (!langRef.current?.contains(event.target as Node)) setLangOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setAccountOpen(false);
        setLangOpen(false);
        if (accountOpen) accountButtonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [accountOpen, langOpen]);

  const isActive = (to: string) => {
    const base = to.split("?")[0];
    if (base === "/search") return path === "/search";
    return path === base;
  };

  return (
    <header
      className={cn(
        "danest-site-header sticky top-0 z-50 border-b border-[#E2EBEF] bg-white/95 backdrop-blur-xl transition-all duration-200",
        scrolled ? "danest-header-scrolled shadow-[0_6px_24px_rgba(18,51,74,0.09)]" : "",
      )}
    >
      <div className="mx-auto flex h-16 max-w-screen-2xl items-center justify-between gap-2 px-3 py-3 sm:px-4 md:px-6 lg:px-8">
        <div data-header-group="left" className="flex min-w-0 items-center gap-1 sm:gap-3 xl:gap-8">
          <button
            type="button"
            onClick={() => { setAccountOpen(false); setLangOpen(false); setMobileOpen((v) => !v); }}
            className="inline-flex size-8 sm:size-10 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring xl:hidden"
            aria-expanded={mobileOpen}
            aria-controls="mobile-nav"
            aria-label={mobileOpen ? t("nav.closeMenu") : t("nav.openMenu")}
          >
            {mobileOpen ? <X className="size-5" aria-hidden="true" /> : <Menu className="size-5" aria-hidden="true" />}
          </button>
          <Logo className="shrink-0 whitespace-nowrap max-sm:gap-1.5 max-sm:[&>span:first-child]:size-7 max-sm:[&>span:first-child>svg]:size-4 max-sm:[&>span:last-child>span:first-child]:text-xl max-sm:[&>span:last-child>span:last-child]:text-[8px]" />

        <nav aria-label={t("aria.mainNav")} className="hidden min-w-0 items-center justify-start gap-1 xl:flex">
          {navLinks.map((link) => (
            <Link
              key={link.key}
              to={link.to}
              className={cn(
                "shrink-0 whitespace-nowrap rounded-lg px-2.5 py-2 text-sm font-semibold transition-colors hover:bg-accent hover:text-accent-foreground",
                isActive(link.to) ? "bg-[#E9EFE9] text-[#365844] dark:bg-accent dark:text-accent-foreground" : "text-foreground",
              )}
            >
              {navLabel(link)}
            </Link>
          ))}
        </nav>
        </div>

        <div data-header-group="right" className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
          <div ref={langRef} className="relative hidden sm:block">
            <button
              type="button"
              onClick={() => { setAccountOpen(false); setMobileOpen(false); setLangOpen((v) => !v); }}
              className="danest-language-trigger inline-flex size-10 items-center justify-center rounded-xl border border-[#CDE5F0] bg-[#E8F7FD] text-[#087EBD] transition-colors hover:bg-[#D5F0FB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#087EBD]"
              aria-haspopup="listbox"
              aria-expanded={langOpen}
              aria-label={t("nav.changeLanguage")}
            >
              <Languages className="size-5" aria-hidden="true" />
            </button>
            {langOpen ? (
              <div
                className="danest-language-menu absolute right-0 top-full z-50 mt-2 w-44 overflow-hidden rounded-xl border border-[#CDE5F0] bg-white p-1.5 animate-in fade-in slide-in-from-top-1"
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
                      lang === l.code ? "bg-[#E8F7FD] font-semibold text-[#087EBD]" : "text-[#47687A]",
                    )}
                  >
                    {l.label}
                    {lang === l.code ? <Check className="size-4 text-link" aria-hidden="true" /> : null}
                  </button>
                ))}
              </div>
            ) : null}
          </div>

          {!isLandlord && <Link
            to="/saved"
            className="relative flex size-8 sm:size-10 items-center justify-center rounded-lg text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
            aria-label={savedIds.length ? t("nav.savedAria", { count: savedIds.length }) : t("nav.saved")}
          >
            <Heart className="size-5" aria-hidden="true" />
            {savedIds.length > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 flex size-4.5 min-w-4.5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                {savedIds.length}
              </span>
            ) : null}
          </Link>}

          {session && <Link to="/notifications" aria-label={pick("Notifications","Thông báo")} className="relative flex size-8 sm:size-10 items-center justify-center rounded-lg hover:bg-accent"><Bell className="size-5" />{counts.notifications>0&&<span className="absolute -right-1 -top-1 rounded-full bg-primary px-1.5 text-xs text-primary-foreground">{Math.min(counts.notifications,99)}{counts.notifications>99?"+":""}</span>}</Link>}
          {session && hasAccountMenu ? (
            <div ref={accountRef} className="relative shrink-0" onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setAccountOpen(false);
            }}>
              <button
                ref={accountButtonRef}
                type="button"
                aria-label={pick("Account menu", "Menu tài khoản") + (counts.messages > 0 ? ` (${counts.messages} ${pick("unread messages", "tin nhắn chưa đọc")})` : "")}
                aria-expanded={accountOpen}
                aria-controls={accountOpen ? "account-panel" : undefined}
                onClick={() => { setLangOpen(false); setMobileOpen(false); setAccountOpen(v => !v); }}
                className="relative inline-flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="relative inline-flex size-8 sm:size-9 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground">
                  {session.user.avatarInitials}
                  {counts.messages > 0 && <span aria-hidden="true" className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground ring-2 ring-card">{counts.messages > 99 ? "99+" : counts.messages}</span>}
                </span>
              </button>
              {accountOpen && (
                <div id="account-panel" className="danest-account-menu absolute right-0 top-full z-50 mt-2 w-72 max-w-[calc(100vw-6rem)] max-h-[calc(100dvh-5rem)] overflow-y-auto rounded-2xl border border-border bg-white p-2 text-popover-foreground shadow-xl">
                  <div className="border-b border-border px-3 py-2.5">
                    <p className="truncate text-sm font-semibold">{session.user.name}</p>
                    <p className="text-xs text-muted-foreground">{isLandlord ? pick("Landlord", "Chủ căn hộ") : pick("Renter", "Người thuê")}</p>
                  </div>
                  {isRenter && <>
                  <Link to="/requests" onClick={() => setAccountOpen(false)} className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <MessagesSquare className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="flex-1">{pick("My requests", "Yêu cầu của tôi")}</span>
                    {counts.messages > 0 && <span className="rounded-full bg-primary px-1.5 text-xs text-primary-foreground" aria-label={`${counts.messages} ${pick("unread messages", "tin nhắn chưa đọc")}`}>{counts.messages > 99 ? "99+" : counts.messages}</span>}
                  </Link>
                  <Link to="/profile" onClick={() => setAccountOpen(false)} className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <User className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" /> {pick("Profile", "Hồ sơ")}
                  </Link>
                  </>}
                  {isLandlord && LANDLORD_LINKS.map(({to, en, vi, Icon}) => (
                    <Link key={to} to={to} onClick={() => setAccountOpen(false)} className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <span className="flex-1">{pick(en, vi)}</span>
                      {to === "/landlord/requests" && counts.messages > 0 && <span className="rounded-full bg-primary px-1.5 text-xs text-primary-foreground" aria-label={`${counts.messages} ${pick("unread messages", "tin nhắn chưa đọc")}`}>{counts.messages > 99 ? "99+" : counts.messages}</span>}
                    </Link>
                  ))}
                  <div className="my-1 border-t border-border" />
                  <button type="button" onClick={() => { setAccountOpen(false); void logout().catch(err => alert(String(err))); }} className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <LogOut className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" /> {t("nav.logout")}
                  </button>
                </div>
              )}
            </div>
          ) : session ? (
            <div className="hidden shrink-0 items-center gap-1.5 whitespace-nowrap xl:flex">
              <span className="inline-flex size-9 items-center justify-center rounded-full bg-secondary text-sm font-semibold text-secondary-foreground">
                {session.user.avatarInitials}
              </span>
              <Button variant="ghost" size="sm" className="h-10 whitespace-nowrap" onClick={() => { void logout().catch((err) => alert(String(err))); }}>
                {t("nav.logout")}
              </Button>
            </div>
          ) : (
            <Link
              to="/login"
              className="inline-flex size-8 sm:h-10 sm:w-auto items-center justify-center rounded-lg sm:px-3 text-sm font-medium bg-primary text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={t("nav.login")}
            >
              <User className="size-5 sm:hidden" aria-hidden="true" />
              <span className="hidden sm:inline">{t("nav.login")}</span>
            </Link>
          )}

          {isLandlord && <Button className="h-8 w-8 sm:h-10 sm:w-auto shrink-0 whitespace-nowrap p-0 sm:px-3" aria-label={pick("List property", "Đăng tin")} onClick={() => navigate("/landlord/listings/new")}>
            <Plus className="size-5 sm:hidden" aria-hidden="true" />
            <span className="hidden sm:inline">{pick("List property", "Đăng tin")}</span>
          </Button>}


        </div>
      </div>

      {mobileOpen ? (
        <div id="mobile-nav" className="max-h-[calc(100dvh-4rem)] overflow-y-auto overscroll-contain border-t border-border bg-background xl:hidden">
          <nav aria-label={t("aria.mobileNav")} className="mx-auto max-w-7xl space-y-1 px-4 py-3 md:px-6">
            {navLinks.map((link) => (
              <Link
                key={link.key}
                to={link.to}
                onClick={() => setMobileOpen(false)}
                className="block rounded-lg px-3 py-2.5 text-base font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              >
                {navLabel(link)}
              </Link>
            ))}
            <div className="my-2 border-t border-border" />
            <div className="flex flex-wrap items-center gap-2 px-3 py-2">
              <Languages className="size-5 text-[#087EBD]" aria-hidden="true" />
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
            {session && !hasAccountMenu && (
              <button type="button" onClick={() => { void logout().then(() => setMobileOpen(false)).catch(err => alert(String(err))); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-base font-medium text-foreground hover:bg-accent">
                <LogOut className="size-4" aria-hidden="true" /> {t("nav.logout")}
              </button>
            )}
          </nav>
        </div>
      ) : null}
    </header>
  );
}
