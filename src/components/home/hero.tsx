import { useState } from "react";
import { CalendarDays, MapPin, Search, Sparkles, Wallet } from "lucide-react";
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
    <section className="bg-background">
      <div className="pb-10">
        <div className="relative isolate min-h-[570px] w-full overflow-hidden bg-[#0D354B] text-white md:min-h-[650px]">
          <img
            src="/images/hero.jpg"
            alt={t("home.heroAlt")}
            className="absolute inset-0 -z-20 h-full w-full object-cover object-center"
            fetchPriority="high"
          />
          <div className="absolute inset-0 -z-10 bg-gradient-to-r from-[#0B354D] via-[#0B354D]/90 to-transparent" />
          <div className="mx-auto flex min-h-[570px] max-w-7xl flex-col justify-center px-6 pb-20 pt-14 sm:px-10 md:min-h-[650px] md:px-12 lg:px-16">
            <div className="max-w-[850px]">
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#A4E5ED]">{t("home.heroBadge")}</p>
              <h1 className="mt-7 font-heading text-[clamp(3.3rem,6.2vw,6.6rem)] font-bold leading-[1.06] tracking-[-0.045em]">
                {t("home.heroTitleLine1") === "Find Your Home in" ? (
                  <>Find <span className="text-[#9CECF2]">Your Home</span><br />in <span className="text-[#7DDBE6]">Da Nang.</span></>
                ) : (
                  <>{t("home.heroTitleLine1")}<br /><span className="text-[#7DDBE6]">{t("home.heroTitleAccent")}</span></>
                )}
              </h1>
              <p className="mt-6 max-w-[570px] text-base leading-relaxed text-white/90 md:text-lg">{t("home.heroDesc")}</p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Button size="lg" className="bg-white px-5 text-[#12384D] hover:bg-[#E7F8FC]" onClick={() => navigate("/search")}>
                  <Search aria-hidden="true" />{t("common.exploreApartments")}
                </Button>
                <Button size="lg" className="border border-[#8BDDEB] bg-[#078CC4] px-5 text-white hover:bg-[#0679A8]" onClick={() => navigate("/match")}>
                  <Sparkles aria-hidden="true" />{t("home.aiButton")}
                </Button>
              </div>
            </div>
          </div>
        </div>
        <div className="mx-auto max-w-7xl px-4 md:px-6 lg:px-8">
        <div
          className="relative z-10 mx-0 -mt-10 rounded-2xl border border-border bg-card p-4 md:-mt-8 md:mx-8 md:p-6"
          style={{ boxShadow: "var(--shadow-elevated)" }}
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
            <div className="xl:col-span-2">
              <label htmlFor="hero-location" className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <MapPin className="size-3.5" aria-hidden="true" /> {t("home.location")}
              </label>
              <select
                id="hero-location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="h-11 min-w-0 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                className="h-11 min-w-0 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                className="h-11 min-w-0 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                className="h-11 min-w-0 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
              <Button size="lg" className="h-11 w-full px-2 whitespace-normal" onClick={search}>
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

        <p className="mt-3 text-center text-sm text-muted-foreground">{t("home.aiHint")}</p>
        </div>
      </div>
    </section>
  );
}
