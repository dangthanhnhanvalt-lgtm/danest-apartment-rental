import { useState } from "react";
import { ArrowRight, CalendarDays, MapPin, Search, Sparkles, Wallet } from "lucide-react";
import { buildSearchUrl, useNavigate } from "~/lib/router";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/utils";
import { useI18n } from "~/i18n/language-context";
import { useLabels } from "~/i18n/use-labels";
import type { NeighborhoodId } from "~/types";

const BUDGETS = [400, 600, 800, 1000, 1500];

export function Hero() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const labels = useLabels();
  const [location, setLocation] = useState("");
  const [checkIn, setCheckIn] = useState("");
  const [duration, setDuration] = useState("3");
  const [budget, setBudget] = useState("800");
  const [bedrooms, setBedrooms] = useState("");

  const search = () => {
    navigate(
      buildSearchUrl({
        neighborhood: location || undefined,
        checkIn: checkIn || undefined,
        duration: duration || undefined,
        maxRent: budget || undefined,
        bedrooms: bedrooms || undefined,
      }),
    );
  };

  return (
    <section className="relative isolate overflow-hidden">
      <img
        src="/images/hero.jpg"
        alt={t("home.heroAlt")}
        className="absolute inset-0 -z-20 size-full object-cover"
      />
      <div className="absolute inset-0 -z-10" style={{ backgroundColor: "var(--overlay-bg)" }} aria-hidden="true" />
      <div
        className="absolute inset-x-0 bottom-0 -z-10 h-48"
        style={{ background: "linear-gradient(to top, rgba(0,0,0,0.35), transparent)" }}
        aria-hidden="true"
      />

      <div className="mx-auto max-w-7xl px-4 pb-16 pt-16 md:px-6 md:pb-24 md:pt-24 lg:px-8 lg:pt-28">
        <div className="max-w-2xl">
          <p className="inline-flex items-center gap-2 rounded-full border border-white/40 bg-black/20 px-3.5 py-1.5 text-xs font-medium uppercase tracking-[0.16em] text-white backdrop-blur-sm">
            <span className="size-1.5 rounded-full bg-white" aria-hidden="true" />
            {t("home.heroBadge")}
          </p>
          <h1 className="mt-6 font-heading text-5xl font-medium leading-[1.02] text-white text-balance sm:text-6xl lg:text-7xl">
            {t("home.heroTitleLine1")} <span className="italic">{t("home.heroTitleAccent")}</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-white">
            {t("home.heroDesc")}
          </p>
        </div>

        <div
          className="mt-10 rounded-2xl border border-border bg-card p-4 md:p-5"
          style={{ boxShadow: "var(--shadow-overlay)" }}
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-6">
            <div className="lg:col-span-2">
              <label htmlFor="hero-location" className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <MapPin className="size-3.5" aria-hidden="true" /> {t("home.location")}
              </label>
              <select
                id="hero-location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">{t("home.allOfDaNang")}</option>
                {labels.neighborhoods.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="hero-checkin" className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <CalendarDays className="size-3.5" aria-hidden="true" /> {t("home.checkIn")}
              </label>
              <input
                id="hero-checkin"
                type="date"
                value={checkIn}
                min={new Date().toISOString().slice(0, 10)}
                onChange={(e) => setCheckIn(e.target.value)}
                className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            <div>
              <label htmlFor="hero-duration" className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <CalendarDays className="size-3.5" aria-hidden="true" /> {t("home.duration")}
              </label>
              <select
                id="hero-duration"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>
                    {m} {m === 1 ? t("common.month") : t("common.months")}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="hero-budget" className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <Wallet className="size-3.5" aria-hidden="true" /> {t("home.budget")}
              </label>
              <select
                id="hero-budget"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                className="h-11 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="">{t("home.anyBudget")}</option>
                {BUDGETS.map((b) => (
                  <option key={b} value={b}>
                    {t("home.upTo", { amount: b })}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end">
              <Button size="lg" className="h-11 w-full" onClick={search}>
                <Search className="size-4" aria-hidden="true" />
                {t("home.searchApartments")}
              </Button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{t("home.bedrooms")}</span>
            {[t("home.bedroomsAny"), "1", "2", t("home.bedrooms3")].map((b) => {
              const val = b === t("home.bedroomsAny") ? "" : b === t("home.bedrooms3") ? "3" : b;
              const selected = bedrooms === val;
              return (
                <button
                  key={b}
                  type="button"
                  onClick={() => setBedrooms(val)}
                  aria-pressed={selected}
                  className={cn(
                    "rounded-full border px-3 py-1 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    selected
                      ? "border-primary-strong bg-primary text-primary-foreground"
                      : "border-input bg-background text-foreground hover:bg-accent hover:text-accent-foreground",
                  )}
                >
                  {b}
                </button>
              );
            })}
            {location ? (
              <span className="ml-auto text-xs text-muted-foreground">
                {t("home.searchingIn", { area: labels.neighborhood[location as NeighborhoodId] })}
              </span>
            ) : null}
          </div>
        </div>

        <div className="mt-5 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
          <Button
            size="lg"
            onClick={() => navigate("/match")}
            className="bg-primary text-primary-foreground hover:bg-primary hover:ring-2 hover:ring-primary-foreground hover:ring-offset-2 hover:ring-offset-transparent ring-offset-transparent"
          >
            <Sparkles className="size-4" aria-hidden="true" />
            {t("home.aiButton")}
          </Button>
          <span className="text-sm text-white">{t("home.aiHint")}</span>
        </div>
      </div>

      <div className="pointer-events-none absolute right-8 top-24 hidden lg:block" aria-hidden="true">
        <span className="flex items-center gap-2 rounded-full border border-white/40 bg-black/25 px-4 py-2 text-xs font-medium uppercase tracking-[0.18em] text-white backdrop-blur-sm">
          {t("home.heroCorner")} <ArrowRight className="size-3.5" />
        </span>
      </div>
    </section>
  );
}
