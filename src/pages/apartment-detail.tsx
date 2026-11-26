import {
  Bath,
  BedDouble,
  Bike,
  Building2,
  CalendarDays,
  ChevronRight,
  CookingPot,
  Dumbbell,
  Fence,
  Heart,
  Laptop,
  MapPin,
  Maximize2,
  PawPrint,
  Sailboat,
  Share2,
  Waves,
  WashingMachine,
  Wifi,
  Wind,
  type LucideIcon,
} from "lucide-react";
import { useState } from "react";
import { useI18n } from "~/i18n/language-context";
import { useLabels } from "~/i18n/use-labels";
import { formatDate, formatRent, formatUSD, monthsBetweenLabel, summarizeCosts } from "~/lib/format";
import { Link } from "~/lib/router";
import { useAppState } from "~/state/app-state";
import { useToast } from "~/components/ui/toast";
import { Button } from "~/components/ui/button";
import { AvailabilityBadge, ListingCard, SampleDataNote, VerificationBadge } from "~/components/ui/listing-card";
import { MapView } from "~/components/map/map-view";
import { Gallery } from "~/components/detail/gallery";
import { CostBreakdown } from "~/components/detail/cost-breakdown";
import { VerificationCard } from "~/components/detail/verification-card";
import { ContactBar, ContactCard } from "~/components/detail/contact-card";
import type { AmenityId, Listing } from "~/types";

const AMENITY_ICON: Record<AmenityId, LucideIcon> = {
  wifi: Wifi,
  "air-conditioning": Wind,
  "washing-machine": WashingMachine,
  kitchen: CookingPot,
  pool: Waves,
  gym: Dumbbell,
  balcony: Fence,
  parking: Bike,
  elevator: Building2,
  workspace: Laptop,
  "pet-friendly": PawPrint,
  "sea-view": Sailboat,
};

function SpecItem({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="mt-0.5 size-4 shrink-0 text-link" aria-hidden="true" />
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="text-sm font-medium text-foreground">{value}</dd>
      </div>
    </div>
  );
}

function NotFound() {
  const { t } = useI18n();
  return (
    <div className="mx-auto max-w-2xl px-4 py-24 text-center">
      <h1 className="font-heading text-3xl font-medium text-foreground">{t("detail.notFound")}</h1>
      <p className="mt-3 text-base text-muted-foreground">
        {t("detail.notFoundDesc")}
      </p>
      <Button asChild className="mt-6">
        <Link to="/search">{t("common.exploreApartments")}</Link>
      </Button>
    </div>
  );
}

function AboutSection({ listing }: { listing: Listing }) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const paragraphs = listing.description.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const long = paragraphs.length > 2 || listing.description.length > 420;
  const shown = expanded ? paragraphs : paragraphs.slice(0, 2);

  return (
    <section aria-labelledby="about-title">
      <h2 id="about-title" className="font-heading text-2xl font-medium text-foreground">
        {t("detail.aboutTitle")}
      </h2>
      <div className="mt-3 space-y-3">
        {shown.map((p, i) => (
          <p key={i} className="text-base leading-relaxed text-muted-foreground">
            {p}
          </p>
        ))}
      </div>
      {long ? (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="mt-3 rounded-md px-2 py-1 text-sm font-medium text-link transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {expanded ? t("detail.showLess") : t("detail.showMore")}
        </button>
      ) : null}
    </section>
  );
}

export function ApartmentDetailPage({ id }: { id: string }) {
  const { listings, isSaved, toggleSaved } = useAppState();
  const { toast } = useToast();
  const { t } = useI18n();
  const labels = useLabels();
  const listing = listings.find((l) => l.id === id || l.slug === id);

  if (!listing) return <NotFound />;

  const neighborhood = labels.neighborhoods.find((n) => n.id === listing.neighborhood);
  const costs = summarizeCosts(listing);
  const saved = isSaved(listing.id);
  const similar = listings
    .filter((l) => l.neighborhood === listing.neighborhood && l.id !== listing.id && l.status === "published")
    .slice(0, 3);
  const availabilityText =
    listing.availability === "available" ? t("detail.availNow") : listing.availability === "reserved" ? t("detail.availReserved") : t("detail.availNot");

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 pb-16 pt-6 md:px-6 lg:px-8">
        <nav aria-label={t("detail.breadcrumb")} className="mb-4 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
          <Link to="/search" className="transition-colors hover:text-link hover:underline">
            {t("detail.exploreBreadcrumb")}
          </Link>
          <ChevronRight className="size-3.5" aria-hidden="true" />
          <Link to={`/search?neighborhood=${listing.neighborhood}`} className="transition-colors hover:text-link hover:underline">
            {labels.neighborhood[listing.neighborhood]}
          </Link>
        </nav>

        <Gallery images={listing.images} title={listing.title} />

        <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="space-y-8 lg:col-span-2">
            <section aria-labelledby="overview-title">
              <div className="flex flex-wrap items-center gap-2">
                <VerificationBadge verified={listing.verificationBadge} />
                <AvailabilityBadge availability={listing.availability} />
                <span className="rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                  {labels.listingType[listing.type]}
                </span>
              </div>
              <h1 id="overview-title" className="mt-3 max-w-[30ch] font-heading text-3xl font-medium leading-tight text-foreground text-balance md:text-4xl">
                {listing.title}
              </h1>
              <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="size-4" aria-hidden="true" />
                  {labels.neighborhood[listing.neighborhood]}, Da Nang
                </span>
                <span>· {listing.distanceToBeach}</span>
              </p>

              <div className="mt-5 rounded-2xl border border-border bg-card p-5" style={{ boxShadow: "var(--shadow-surface)" }}>
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-muted-foreground">{t("detail.monthlyRent")}</p>
                    <p className="font-heading text-3xl font-semibold text-foreground">{formatRent(listing.monthlyRent)}</p>
                    <p className="text-sm text-muted-foreground">
                      {t("detail.allIn", { amount: formatUSD(costs.estimatedMonthly) })}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant={saved ? "secondary" : "outline"}
                      onClick={() => {
                        const now = toggleSaved(listing.id);
                        toast({ title: now ? t("detail.savedToast") : t("detail.removedToast"), tone: now ? "success" : "info" });
                      }}
                      aria-pressed={saved}
                    >
                      <Heart className={saved ? "fill-current" : ""} aria-hidden="true" />
                      {saved ? t("detail.saved") : t("detail.save")}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => {
                        void navigator.clipboard
                          ?.writeText(window.location.href)
                          .then(() => toast({ title: t("detail.linkCopied"), description: t("detail.linkCopiedDesc"), tone: "success" }))
                          .catch(() => toast({ title: t("detail.linkCopyFailed"), tone: "warning" }));
                      }}
                    >
                      <Share2 aria-hidden="true" />
                      {t("detail.share")}
                    </Button>
                  </div>
                </div>

                <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-border pt-4 sm:grid-cols-3">
                  <SpecItem icon={BedDouble} label={t("detail.bedrooms")} value={String(listing.bedrooms)} />
                  <SpecItem icon={Bath} label={t("detail.bathrooms")} value={String(listing.bathrooms)} />
                  <SpecItem icon={Maximize2} label={t("detail.floorArea")} value={`${listing.floorArea} m²`} />
                  <SpecItem icon={Building2} label={t("detail.floorLevel")} value={listing.floorLevel} />
                  <SpecItem icon={CookingPot} label={t("detail.furnishing")} value={labels.furnishing[listing.furnishing]} />
                  <SpecItem icon={CalendarDays} label={t("detail.availability")} value={t("detail.availFrom", { status: availabilityText, date: formatDate(listing.availableFrom) })} />
                </dl>
              </div>
            </section>

            <AboutSection listing={listing} />

            <section aria-labelledby="amenities-title">
              <h2 id="amenities-title" className="font-heading text-2xl font-medium text-foreground">
                {t("detail.amenitiesTitle")}
              </h2>
              <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {listing.amenities.map((a) => {
                  const Icon = AMENITY_ICON[a];
                  return (
                    <li key={a} className="flex items-center gap-2.5 rounded-xl border border-border bg-card p-3 text-sm text-foreground">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent text-link">
                        <Icon className="size-4" aria-hidden="true" />
                      </span>
                      {labels.amenity[a]}
                    </li>
                  );
                })}
              </ul>
            </section>

            <CostBreakdown listing={listing} />

            {neighborhood ? (
              <section aria-labelledby="location-title" className="rounded-2xl border border-border bg-card p-5 md:p-6" style={{ boxShadow: "var(--shadow-surface)" }}>
                <h2 id="location-title" className="font-heading text-2xl font-medium text-foreground">
                  {t("detail.locationTitle", { name: neighborhood.name })}
                </h2>
                <p className="mt-2 text-base text-muted-foreground">{neighborhood.description}</p>
                <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
                  <MapPin className="size-4" aria-hidden="true" />
                  {labels.neighborhood[listing.neighborhood]}, Da Nang · {listing.distanceToBeach}
                </p>
                {listing.neighborhoodNotes.length > 0 ? (
                  <ul className="mt-4 space-y-2">
                    {listing.neighborhoodNotes.map((note) => (
                      <li key={note} className="flex gap-2 text-sm text-muted-foreground">
                        <span className="mt-2 size-1.5 shrink-0 rounded-full bg-link" aria-hidden="true" />
                        {note}
                      </li>
                    ))}
                  </ul>
                ) : null}
                <div className="mt-4 h-72 overflow-hidden rounded-2xl border border-border">
                  <MapView listings={[listing]} focus={listing} compact className="h-full w-full" />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {t("detail.mapCredit")}
                </p>
              </section>
            ) : null}

            <section aria-labelledby="verification-title" className="space-y-4">
              <VerificationCard verification={listing.verification} />

              <div className="rounded-2xl border border-border bg-card p-5 md:p-6" style={{ boxShadow: "var(--shadow-surface)" }}>
                <h2 className="font-heading text-2xl font-medium text-foreground">{t("detail.rentalTerms")}</h2>
                <ul className="mt-3 space-y-2 text-sm">
                  <li className="flex justify-between gap-4">
                    <span className="text-muted-foreground">{t("detail.duration")}</span>
                    <span className="font-medium text-foreground">{monthsBetweenLabel(listing.rentalTerms.minMonths, listing.rentalTerms.maxMonths)}</span>
                  </li>
                  <li className="flex justify-between gap-4">
                    <span className="text-muted-foreground">{t("detail.paymentDue")}</span>
                    <span className="font-medium text-foreground">{t("detail.paymentDueValue", { day: listing.rentalTerms.paymentDayOfMonth })}</span>
                  </li>
                  <li className="flex justify-between gap-4">
                    <span className="text-muted-foreground">{t("detail.utilitiesIncluded")}</span>
                    <span className="text-right font-medium text-foreground">
                      {listing.rentalTerms.utilitiesIncluded.length > 0 ? listing.rentalTerms.utilitiesIncluded.join(", ") : t("detail.none")}
                    </span>
                  </li>
                </ul>
                {listing.rentalTerms.notes.length > 0 ? (
                  <ul className="mt-4 space-y-2 border-t border-border pt-4">
                    {listing.rentalTerms.notes.map((note) => (
                      <li key={note} className="flex gap-2 text-sm text-muted-foreground">
                        <span className="mt-2 size-1.5 shrink-0 rounded-full bg-link" aria-hidden="true" />
                        {note}
                      </li>
                    ))}
                  </ul>
                ) : null}
                <p className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">
                  {t("detail.listingDisclaimer")}
                </p>
              </div>
            </section>
          </div>

          <div className="lg:col-span-1">
            <div className="lg:sticky lg:top-[6.5rem]">
              <ContactCard listing={listing} />
            </div>
          </div>
        </div>

        {similar.length > 0 ? (
          <section aria-labelledby="similar-title" className="mt-14">
            <h2 id="similar-title" className="font-heading text-3xl font-medium text-foreground md:text-4xl">
              {t("detail.similarTitle")}
            </h2>
            <p className="mt-2 text-base text-muted-foreground">{t("detail.similarHint", { area: labels.neighborhood[listing.neighborhood] })}</p>
            <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {similar.map((l) => (
                <ListingCard key={l.id} listing={l} />
              ))}
            </div>
          </section>
        ) : null}

        <SampleDataNote className="mt-8" />
      </div>
      <div className="h-20 lg:hidden" aria-hidden="true" />
      <ContactBar listing={listing} />
    </div>
  );
}
