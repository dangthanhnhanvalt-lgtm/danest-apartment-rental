import { useEffect } from "react";
import { useRouter } from "~/lib/router";
import { Header } from "~/components/layout/header";
import { Footer } from "~/components/layout/footer";
import { HomePage } from "~/pages/home";
import { SearchPage } from "~/pages/search";
import { ApartmentDetailPage } from "~/pages/apartment-detail";
import { MatchPage } from "~/pages/match";
import { SavedPage } from "~/pages/saved";
import { LoginPage } from "~/pages/login";
import { AboutPage } from "~/pages/about";
import { LandlordLayout } from "~/pages/landlord/layout";
import { AdminApp } from "~/pages/admin/layout";
import { AssistantBubble } from "~/components/ai/assistant-bubble";
import { useI18n } from "~/i18n/language-context";

function NotFound() {
  const { navigate } = useRouter();
  const { t } = useI18n();
  return (
    <main className="mx-auto flex min-h-[60vh] max-w-3xl flex-col items-center justify-center px-4 py-20 text-center">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-link">{t("notfound.eyebrow")}</p>
      <h1 className="mt-3 font-heading text-4xl font-semibold text-foreground sm:text-5xl">{t("notfound.title")}</h1>
      <p className="mt-4 max-w-md text-base text-muted-foreground">
        {t("notfound.desc")}
      </p>
      <button
        type="button"
        onClick={() => navigate("/search")}
        className="mt-8 inline-flex h-11 items-center rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover"
      >
        {t("common.exploreApartments")}
      </button>
    </main>
  );
}

function Routes() {
  const { path, query, hash } = useRouter();

  const scrollTarget = hash || (query.get("scroll") === "how-it-works" ? "how-it-works" : "");

  useEffect(() => {
    if (!scrollTarget || path !== "/") return;
    const frame = window.requestAnimationFrame(() => {
      const el = document.getElementById(scrollTarget);
      if (!el) return;
      const header = document.querySelector("header");
      const offset = (header instanceof HTMLElement ? header.getBoundingClientRect().height : 72) + 16;
      const top = el.getBoundingClientRect().top + window.scrollY - offset;
      window.scrollTo({ top, behavior: "smooth" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [path, scrollTarget]);

  if (path === "/") return <HomePage />;
  if (path === "/search") return <SearchPage />;
  if (path.startsWith("/apartment/")) return <ApartmentDetailPage id={path.replace("/apartment/", "")} />;
  if (path === "/match") return <MatchPage />;
  if (path === "/saved") return <SavedPage />;
  if (path === "/login" || path === "/register") return <LoginPage />;
  if (path === "/about") return <AboutPage />;
  if (path.startsWith("/landlord")) return <LandlordLayout path={path} />;
  if (path.startsWith("/admin")) return <AdminApp path={path} />;
  return <NotFound />;
}

export default function App() {
  const { path } = useRouter();
  const isLandlord = path.startsWith("/landlord");
  const isAdmin = path.startsWith("/admin");

  if (isAdmin) {
    return (
      <>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:shadow-lg focus:outline-none"
        >
          Skip to content
        </a>
        <main id="main-content" tabIndex={-1}>
          <Routes />
        </main>
      </>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-primary-foreground focus:shadow-lg focus:outline-none"
      >
        Skip to content
      </a>
      <Header />
      <div id="main-content" className="flex-1" tabIndex={-1}>
        <Routes />
      </div>
      {!isLandlord ? <Footer /> : null}
      {!isLandlord ? <AssistantBubble /> : null}
    </div>
  );
}
