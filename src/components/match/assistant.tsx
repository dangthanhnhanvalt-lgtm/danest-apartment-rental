import { Sparkles, Send, RotateCcw, MapPin, CheckCircle2, ArrowRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { AMENITIES, NEIGHBORHOODS } from "~/data/constants";
import { formatRent, summarizeCosts } from "~/lib/format";
import { Link, useRouter } from "~/lib/router";
import { useAppState } from "~/state/app-state";
import { Button } from "~/components/ui/button";
import { Chip, Input } from "~/components/ui/form";
import { ListingCard, SampleDataNote } from "~/components/ui/listing-card";
import { useI18n } from "~/i18n/language-context";
import { useLabels } from "~/i18n/use-labels";
import type { AmenityId, FurnishingStatus, Listing, NeighborhoodId } from "~/types";
import { cn } from "~/lib/utils";

type StepId =
  | "intro"
  | "budget"
  | "neighborhood"
  | "duration"
  | "moveIn"
  | "bedrooms"
  | "furnishing"
  | "lifestyle"
  | "amenities"
  | "done";

type Translate = (key: string, vars?: Record<string, string | number>) => string;

interface Preferences {
  budget: number | null;
  neighborhood: NeighborhoodId | "any" | null;
  duration: number | null;
  moveIn: string | null;
  bedrooms: number | null;
  furnishing: FurnishingStatus | null;
  lifestyle: string[];
  amenities: AmenityId[];
}

const EMPTY: Preferences = {
  budget: null,
  neighborhood: null,
  duration: null,
  moveIn: null,
  bedrooms: null,
  furnishing: null,
  lifestyle: [],
  amenities: [],
};

interface Message {
  from: "assistant" | "user";
  text: string;
}

const STEPS: StepId[] = [
  "intro",
  "budget",
  "neighborhood",
  "duration",
  "moveIn",
  "bedrooms",
  "furnishing",
  "lifestyle",
  "amenities",
  "done",
];

// Lifestyle tags use stable internal ids so matching never depends on the UI language.
const STYLE_TAG_IDS = ["quiet", "cafes", "beach", "remote", "social", "family"] as const;
type StyleTagId = (typeof STYLE_TAG_IDS)[number];

const STYLE_TAG_LABEL: Record<StyleTagId, string> = {
  quiet: "ai.tag.quiet",
  cafes: "ai.tag.cafes",
  beach: "ai.tag.beach",
  remote: "ai.tag.remote",
  social: "ai.tag.social",
  family: "ai.tag.family",
};

function parsePrompt(prompt: string): Partial<Preferences> {
  const result: Partial<Preferences> = {};
  const budget = prompt.match(/\$\s?(\d{3,4})|(\d{3,4})\s?(?:\$|usd|dollars?|đô|usd)/i);
  if (budget) result.budget = Number(budget[1] ?? budget[2]);
  const beds = prompt.match(/(\d)\s*[-\s]?(?:bedroom|phòng ngủ|pn)/i);
  if (beds) result.bedrooms = Number(beds[1]);
  if (/remote|work|quiet|desk|office|làm việc|yên tĩnh/i.test(prompt)) result.lifestyle = ["remote"];
  if (/beach|my khe|biển|mỹ khê/i.test(prompt)) result.lifestyle = [...(result.lifestyle ?? []), "beach"];
  const hood = NEIGHBORHOODS.find((n) => prompt.toLowerCase().includes(n.name.toLowerCase()));
  if (hood) result.neighborhood = hood.id;
  return result;
}

function scoreListing(
  listing: Listing,
  prefs: Preferences,
  t: Translate,
  labels: ReturnType<typeof useLabels>,
): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;
  const costs = summarizeCosts(listing);

  if (prefs.budget !== null) {
    if (costs.estimatedMonthly <= prefs.budget) {
      score += 30;
      reasons.push(t("ai.reason.budgetIn", { estimate: formatRent(costs.estimatedMonthly), budget: formatRent(prefs.budget) }));
    } else if (listing.monthlyRent <= prefs.budget) {
      score += 15;
      reasons.push(t("ai.reason.budgetBase", { rent: formatRent(listing.monthlyRent) }));
    }
  }
  if (prefs.neighborhood && prefs.neighborhood !== "any") {
    if (listing.neighborhood === prefs.neighborhood) {
      score += 25;
      reasons.push(t("ai.reason.area", { area: labels.neighborhood[listing.neighborhood] }));
    }
  }
  if (prefs.duration) {
    if (prefs.duration >= listing.rentalDurationMonths[0] && prefs.duration <= listing.rentalDurationMonths[1]) {
      score += 15;
      reasons.push(
        t("ai.reason.duration", {
          months: prefs.duration,
          min: listing.rentalDurationMonths[0],
          max: listing.rentalDurationMonths[1],
        }),
      );
    } else {
      score -= 10;
    }
  }
  if (prefs.bedrooms) {
    if (listing.bedrooms === prefs.bedrooms) {
      score += 15;
      reasons.push(t("ai.reason.bedrooms", { count: listing.bedrooms }));
    } else if (listing.bedrooms > prefs.bedrooms) {
      score += 6;
      reasons.push(t("ai.reason.bedroomsMore", { count: listing.bedrooms, wanted: prefs.bedrooms }));
    } else {
      score -= 8;
    }
  }
  if (prefs.furnishing) {
    if (listing.furnishing === prefs.furnishing) {
      score += 8;
      reasons.push(labels.furnishing[listing.furnishing]);
    } else {
      score -= 4;
    }
  }
  if (prefs.lifestyle.includes("remote")) {
    if (listing.amenities.includes("workspace") || listing.amenities.includes("wifi")) {
      score += 8;
      reasons.push(t("ai.reason.remote"));
    }
  }
  if (prefs.lifestyle.includes("beach")) {
    const match = listing.distanceToBeach.match(/([\d.,]+)\s*(km|m)\b/i);
    const meters = match ? Number(match[1].replace(",", ".")) * (match[2].toLowerCase() === "km" ? 1000 : 1) : 9999;
    if (meters <= 800) {
      score += 6;
      reasons.push(listing.distanceToBeach);
    }
  }
  if (prefs.lifestyle.includes("quiet")) {
    if (listing.neighborhood === "my-an" || listing.neighborhood === "son-tra") {
      score += 5;
      reasons.push(t("ai.reason.quiet"));
    }
  }
  const amenityHits = prefs.amenities.filter((a) => listing.amenities.includes(a));
  if (prefs.amenities.length > 0 && amenityHits.length > 0) {
    score += amenityHits.length * 3;
    reasons.push(t("ai.reason.amenities", { list: amenityHits.map((a) => labels.amenity[a].toLowerCase()).join(", ") }));
  }
  if (listing.verificationBadge) {
    score += 4;
    reasons.push(t("ai.reason.verified"));
  }
  if (listing.availability === "available") score += 3;

  return { score, reasons: reasons.slice(0, 4) };
}

function matchListings(
  listings: Listing[],
  prefs: Preferences,
  t: Translate,
  labels: ReturnType<typeof useLabels>,
): { listing: Listing; reasons: string[]; score: number }[] {
  return listings
    .filter((l) => l.status === "published")
    .map((listing) => ({ listing, ...scoreListing(listing, prefs, t, labels) }))
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4);
}

export function MatchAssistant({ variant = "page" }: { variant?: "page" | "compact" }) {
  const compact = variant === "compact";
  const { query } = useRouter();
  const { listings } = useAppState();
  const { t } = useI18n();
  const labels = useLabels();
  const [step, setStep] = useState<StepId>("intro");
  const [prefs, setPrefs] = useState<Preferences>(EMPTY);
  const [messages, setMessages] = useState<Message[]>([{ from: "assistant", text: t("ai.welcome") }]);
  const [input, setInput] = useState("");
  const [budgetInput, setBudgetInput] = useState("");
  const [moveIn, setMoveIn] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const started = useRef(false);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, step]);

  const push = (from: Message["from"], text: string) => setMessages((m) => [...m, { from, text }]);
  const goTo = (next: StepId) => setStep(next);

  const begin = (prompt?: string) => {
    if (prompt) {
      const parsed = parsePrompt(prompt);
      setPrefs((p) => ({ ...p, ...parsed }));
      push("user", prompt);
    }
    push("assistant", t("ai.askBudget"));
    goTo("budget");
  };

  useEffect(() => {
    const prompt = query.get("prompt");
    if (prompt && !started.current) {
      started.current = true;
      begin(prompt);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const chooseBudget = (value: number | null) => {
    setPrefs((p) => ({ ...p, budget: value }));
    push("user", value ? t("ai.userBudget", { value }) : t("ai.flexible"));
    push("assistant", t("ai.askNeighborhood"));
    goTo("neighborhood");
  };

  const chooseNeighborhood = (id: NeighborhoodId | "any") => {
    setPrefs((p) => ({ ...p, neighborhood: id }));
    push("user", id === "any" ? t("ai.anywhere") : labels.neighborhood[id]);
    push("assistant", t("ai.askDuration"));
    goTo("duration");
  };

  const chooseDuration = (months: number) => {
    setPrefs((p) => ({ ...p, duration: months }));
    push("user", t("ai.userMonths", { count: months }));
    push("assistant", t("ai.askMoveIn"));
    goTo("moveIn");
  };

  const submitMoveIn = () => {
    if (!moveIn) return;
    setPrefs((p) => ({ ...p, moveIn }));
    push("user", new Date(`${moveIn}T00:00:00`).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" }));
    push("assistant", t("ai.askBedrooms"));
    goTo("bedrooms");
  };

  const chooseBedrooms = (n: number) => {
    setPrefs((p) => ({ ...p, bedrooms: n }));
    push("user", n >= 3 ? t("ai.userBedrooms3") : t("ai.userBedrooms", { count: n }));
    push("assistant", t("ai.askFurnishing"));
    goTo("furnishing");
  };

  const chooseFurnishing = (f: FurnishingStatus) => {
    setPrefs((p) => ({ ...p, furnishing: f }));
    push("user", labels.furnishing[f]);
    push("assistant", t("ai.askLifestyle"));
    goTo("lifestyle");
  };

  const toggleLifestyle = (tag: StyleTagId) => {
    setPrefs((p) => ({
      ...p,
      lifestyle: p.lifestyle.includes(tag) ? p.lifestyle.filter((t2) => t2 !== tag) : [...p.lifestyle, tag],
    }));
  };

  const toggleAmenity = (id: AmenityId) => {
    setPrefs((p) => ({
      ...p,
      amenities: p.amenities.includes(id) ? p.amenities.filter((a) => a !== id) : [...p.amenities, id],
    }));
  };

  const finishLifestyle = () => {
    push(
      "user",
      prefs.lifestyle.length > 0
        ? prefs.lifestyle.map((id) => t(STYLE_TAG_LABEL[id as StyleTagId] ?? "ai.noPreference")).join(", ")
        : t("ai.noPreference"),
    );
    push("assistant", t("ai.askAmenities"));
    goTo("amenities");
  };

  const finish = () => {
    push(
      "user",
      prefs.amenities.length > 0 ? prefs.amenities.map((a) => labels.amenity[a]).join(", ") : t("ai.noAmenities"),
    );
    push("assistant", t("ai.thanks"));
    goTo("done");
  };

  // Single submit action: works both to start a free-text search and to answer mid-flow.
  const sendFreeText = () => {
    const text = input.trim();
    if (!text) return;
    const parsed = parsePrompt(text);
    if (step === "intro") {
      setInput("");
      begin(text);
      return;
    }
    setPrefs((p) => ({ ...p, ...parsed }));
    push("user", text);
    setInput("");
    if (step === "budget") {
      push("assistant", parsed.budget ? t("ai.askNeighborhood") : t("ai.askNeighborhood"));
      goTo("neighborhood");
    }
  };

  const restart = () => {
    setPrefs(EMPTY);
    setStep("intro");
    setMessages([{ from: "assistant", text: t("ai.welcomeRestart") }]);
    setInput("");
    setBudgetInput("");
    setMoveIn("");
  };

  const matches = step === "done" ? matchListings(listings, prefs, t, labels) : [];
  const stepIndex = STEPS.indexOf(step);

  const header = (
    <div className={compact ? "flex items-center gap-3 border-b border-border px-4 py-3" : "flex items-center gap-3 border-b border-border p-4"}>
      <span className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <Sparkles className="size-4" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-card-foreground">{t("ai.title")}</p>
        <p className="text-xs text-muted-foreground">{t("ai.subtitle")}</p>
      </div>
      <button
        type="button"
        onClick={restart}
        className="flex size-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={t("common.startOver")}
      >
        <RotateCcw className="size-4" aria-hidden="true" />
      </button>
    </div>
  );

  const progress = (
    <div className="border-b border-border px-4 py-2">
      <div className="flex items-center gap-1" role="progressbar" aria-valuemin={0} aria-valuemax={STEPS.length - 2} aria-valuenow={Math.max(0, stepIndex - 1)} aria-label={t("ai.title")}>
        {STEPS.slice(1, -1).map((s, i) => (
          <span key={s} className={cn("h-1 flex-1 rounded-full", stepIndex > i + 1 ? "bg-primary" : "bg-muted")} />
        ))}
      </div>
    </div>
  );

  const conversation = (
    <div className="space-y-3 p-4">
      {messages.map((m, i) => (
        <div key={i} className={cn("flex", m.from === "user" ? "justify-end" : "justify-start")}>
          <p
            className={cn(
              "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
              m.from === "user" ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-tl-sm bg-muted text-foreground",
            )}
          >
            {m.text}
          </p>
        </div>
      ))}
    </div>
  );

  const controls = (
    <div className="border-t border-border p-4">
      {step === "intro" ? (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault();
            sendFreeText();
          }}
        >
          <label htmlFor="match-input" className="sr-only">
            {t("ai.describeLabel")}
          </label>
          <div className="flex gap-2">
            <Input id="match-input" value={input} onChange={(e) => setInput(e.target.value)} placeholder={t("ai.inputPlaceholder")} />
            <Button type="submit" disabled={!input.trim()} aria-label={t("common.send")}>
              <Send className="size-4" aria-hidden="true" />
            </Button>
          </div>
          <Button type="button" variant="ghost" className="w-full" onClick={() => begin()}>
            {t("ai.start")}
          </Button>
        </form>
      ) : null}

      {step === "budget" ? (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {[400, 600, 800, 1200].map((b) => (
              <Chip key={b} selected={budgetInput === String(b)} onClick={() => setBudgetInput(String(b))}>
                ${b}
              </Chip>
            ))}
            <Chip selected={budgetInput === "flex"} onClick={() => setBudgetInput("flex")}>
              {t("ai.flexible")}
            </Chip>
          </div>
          <div className="flex gap-2">
            <Input
              type="number"
              min={100}
              value={budgetInput === "flex" ? "" : budgetInput}
              onChange={(e) => setBudgetInput(e.target.value)}
              placeholder={t("ai.budgetPlaceholder")}
              aria-label={t("ai.budgetPlaceholder")}
            />
            <Button onClick={() => chooseBudget(budgetInput === "flex" || !budgetInput ? null : Number(budgetInput))} disabled={!budgetInput}>
              {t("common.next")}
            </Button>
          </div>
        </div>
      ) : null}

      {step === "neighborhood" ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {labels.neighborhoods.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => chooseNeighborhood(n.id)}
              className="rounded-lg border border-input bg-background px-3 py-2 text-left text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {n.name}
            </button>
          ))}
          <button
            type="button"
            onClick={() => chooseNeighborhood("any")}
            className="rounded-lg border border-input bg-background px-3 py-2 text-left text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:col-span-2"
          >
            {t("ai.anywhere")}
          </button>
        </div>
      ) : null}

      {step === "duration" ? (
        <div className="flex flex-wrap gap-2">
          {[1, 3, 6, 12].map((m) => (
            <Chip key={m} selected={false} onClick={() => chooseDuration(m)}>
              {t("ai.userMonths", { count: m })}
            </Chip>
          ))}
        </div>
      ) : null}

      {step === "moveIn" ? (
        <div className="flex flex-col gap-2">
          <label htmlFor="match-movein" className="sr-only">
            {t("ai.askMoveIn")}
          </label>
          <Input id="match-movein" type="date" value={moveIn} min={new Date().toISOString().slice(0, 10)} onChange={(e) => setMoveIn(e.target.value)} />
          <Button onClick={submitMoveIn} disabled={!moveIn}>
            {t("common.continue")}
          </Button>
        </div>
      ) : null}

      {step === "bedrooms" ? (
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3].map((n) => (
            <Chip key={n} selected={false} onClick={() => chooseBedrooms(n)}>
              {n >= 3 ? t("ai.userBedrooms3") : t("ai.userBedrooms", { count: n })}
            </Chip>
          ))}
        </div>
      ) : null}

      {step === "furnishing" ? (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {(["furnished", "semi-furnished", "unfurnished"] as FurnishingStatus[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => chooseFurnishing(f)}
              className="rounded-lg border border-input bg-background px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {labels.furnishing[f]}
            </button>
          ))}
        </div>
      ) : null}

      {step === "lifestyle" ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {STYLE_TAG_IDS.map((tag) => (
              <Chip key={tag} selected={prefs.lifestyle.includes(tag)} onClick={() => toggleLifestyle(tag)}>
                {t(STYLE_TAG_LABEL[tag])}
              </Chip>
            ))}
          </div>
          <Button className="w-full" onClick={finishLifestyle}>
            {t("common.continue")}
          </Button>
        </div>
      ) : null}

      {step === "amenities" ? (
        <div className="space-y-3">
          <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto">
            {AMENITIES.map((a) => (
              <Chip key={a.id} selected={prefs.amenities.includes(a.id)} onClick={() => toggleAmenity(a.id)}>
                {labels.amenity[a.id]}
              </Chip>
            ))}
          </div>
          <Button className="w-full" onClick={finish}>
            {t("ai.showMatches")} <ArrowRight className="size-4" aria-hidden="true" />
          </Button>
        </div>
      ) : null}

      {step === "done" ? (
        <Button className="w-full" onClick={restart} variant="outline">
          <RotateCcw className="size-4" aria-hidden="true" /> {t("ai.newSearch")}
        </Button>
      ) : null}
    </div>
  );

  const results = (
    <div className={compact ? "p-4" : ""}>
      {step !== "done" ? (
        <div className="grid gap-4">
          <div className="rounded-2xl border border-border bg-card p-6" style={{ boxShadow: "var(--shadow-surface)" }}>
            <h2 className="text-xl font-semibold text-card-foreground">{t("ai.howItWorks")}</h2>
            <ul className="mt-3 space-y-2 text-base text-muted-foreground">
              <li className="flex gap-2"><CheckCircle2 className="mt-1 size-4 shrink-0 text-link" aria-hidden="true" /> {t("ai.howItWorks1")}</li>
              <li className="flex gap-2"><CheckCircle2 className="mt-1 size-4 shrink-0 text-link" aria-hidden="true" /> {t("ai.howItWorks2")}</li>
              <li className="flex gap-2"><CheckCircle2 className="mt-1 size-4 shrink-0 text-link" aria-hidden="true" /> {t("ai.howItWorks3")}</li>
              <li className="flex gap-2"><CheckCircle2 className="mt-1 size-4 shrink-0 text-link" aria-hidden="true" /> {t("ai.howItWorks4")}</li>
            </ul>
            <p className="mt-4 rounded-xl border border-border bg-muted p-3 text-sm text-muted-foreground">{t("ai.prototypeNote")}</p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-6" style={{ boxShadow: "var(--shadow-surface)" }}>
            <h3 className="text-base font-semibold text-card-foreground">{t("ai.yourAnswers")}</h3>
            {prefs.budget === null && !prefs.neighborhood && !prefs.duration && !prefs.bedrooms ? (
              <p className="mt-2 text-sm text-muted-foreground">{t("ai.answersHint")}</p>
            ) : (
              <dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                {prefs.budget !== null ? (<><dt className="text-muted-foreground">{t("home.budget")}</dt><dd className="font-medium text-foreground">${prefs.budget}</dd></>) : null}
                {prefs.neighborhood ? (<><dt className="text-muted-foreground">{t("search.neighborhood")}</dt><dd className="font-medium text-foreground">{prefs.neighborhood === "any" ? t("ai.anywhere") : labels.neighborhood[prefs.neighborhood]}</dd></>) : null}
                {prefs.duration ? (<><dt className="text-muted-foreground">{t("filter.duration")}</dt><dd className="font-medium text-foreground">{t("ai.userMonths", { count: prefs.duration })}</dd></>) : null}
                {prefs.bedrooms ? (<><dt className="text-muted-foreground">{t("search.bedrooms")}</dt><dd className="font-medium text-foreground">{prefs.bedrooms}+</dd></>) : null}
                {prefs.furnishing ? (<><dt className="text-muted-foreground">{t("filter.furnishing")}</dt><dd className="font-medium text-foreground">{labels.furnishing[prefs.furnishing]}</dd></>) : null}
              </dl>
            )}
          </div>
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-heading text-2xl font-medium text-foreground">{t("ai.recommended")}</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {matches.length > 0
                  ? matches.length === 1
                    ? t("ai.matchesCountOne")
                    : t("ai.matchesCount", { count: matches.length })
                  : t("ai.noMatches")}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={restart}>
              {t("common.startOver")}
            </Button>
          </div>

          {matches.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-border bg-card p-8 text-center" style={{ boxShadow: "var(--shadow-surface)" }}>
              <MapPin className="mx-auto size-8 text-muted-foreground" aria-hidden="true" />
              <h3 className="mt-3 text-lg font-semibold text-card-foreground">{t("ai.noMatchesTitle")}</h3>
              <p className="mx-auto mt-2 max-w-md text-base text-muted-foreground">{t("ai.noMatchesHint")}</p>
              <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
                <Button onClick={restart}>{t("ai.adjust")}</Button>
                <Button variant="outline" asChild>
                  <Link to="/search">{t("ai.browseAll")}</Link>
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-6 space-y-5">
              {matches.map((m) => (
                <div key={m.listing.id}>
                  <div className="rounded-xl border border-border bg-card p-4" style={{ boxShadow: "var(--shadow-surface)" }}>
                    <p className="text-sm font-semibold text-link">{t("ai.whyMatches")}</p>
                    <ul className="mt-2 space-y-1.5">
                      {m.reasons.map((r) => (
                        <li key={r} className="flex gap-2 text-sm text-foreground">
                          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-link" aria-hidden="true" /> {r}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="mt-3">
                    <ListingCard listing={m.listing} />
                  </div>
                </div>
              ))}
              <SampleDataNote />
            </div>
          )}
        </div>
      )}
    </div>
  );

  // COMPACT (floating bubble): one single scrollable column holds conversation,
  // controls and results so nothing is clipped by the fixed-height panel.
  if (compact) {
    return (
      <div className="flex h-full min-h-0 flex-col overflow-hidden bg-card">
        {header}
        {progress}
        <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto">
          {conversation}
          {controls}
          {results}
        </div>
      </div>
    );
  }

  // PAGE variant: two-column layout (chat left, results right) on desktop.
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
      <div className="lg:col-span-2">
        <div
          className="flex h-[600px] flex-col overflow-hidden rounded-2xl border border-border bg-card lg:sticky lg:top-24 lg:h-[calc(100vh-8rem)]"
          style={{ boxShadow: "var(--shadow-elevated)" }}
        >
          {header}
          {progress}
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.map((m, i) => (
              <div key={i} className={cn("flex", m.from === "user" ? "justify-end" : "justify-start")}>
                <p
                  className={cn(
                    "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
                    m.from === "user" ? "rounded-br-sm bg-primary text-primary-foreground" : "rounded-tl-sm bg-muted text-foreground",
                  )}
                >
                  {m.text}
                </p>
              </div>
            ))}
          </div>
          {controls}
        </div>
      </div>
      <div className="lg:col-span-3">{results}</div>
    </div>
  );
}
