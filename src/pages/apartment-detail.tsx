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
  CircleCheck,
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
import { useEffect, useState } from "react";
import {recordListingView} from "~/api/backend/analytics";
import { useI18n } from "~/i18n/language-context";
import { useLabels } from "~/i18n/use-labels";
import { formatDate, formatRent, formatUSD, monthsBetweenLabel, summarizeCosts } from "~/lib/format";
import { Link } from "~/lib/router";
import { useAppState } from "~/state/app-state";
import { useToast } from "~/components/ui/toast";
import { Button } from "~/components/ui/button";
import { AvailabilityBadge, ListingCard, SampleDataNote, VerificationBadge } from "~/components/ui/listing-card";
import { NearbyMap } from "~/components/map/nearby-map";
import { Gallery } from "~/components/detail/gallery";
import { CostBreakdown } from "~/components/detail/cost-breakdown";
import { ReportListing } from "~/components/detail/report-listing";
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
    <div className="flex min-w-0 items-start gap-2.5 rounded-xl bg-background p-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[#E9EFE9] text-[#42634B]"><Icon className="size-5" aria-hidden="true" /></span>
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
  const { t, pick } = useI18n();
  const labels = useLabels();
  const listing = listings.find((l) => l.status === "published" && (l.id === id || l.slug === id));

  const trackId=listing&&!listing.isSample?listing.id:null;
  useEffect(()=>{
    if(!trackId)return;
    let sent=false;
    const track=()=>{if(sent||document.visibilityState!=="visible")return;sent=true;void recordListingView(trackId).catch(()=>{ /* analytics must not interrupt viewing */ });};
    track();document.addEventListener("visibilitychange",track);
    return()=>document.removeEventListener("visibilitychange",track);
  },[trackId]);
  if (!listing) return <NotFound />;

  const neighborhood = labels.allNeighborhoods.find((n) => n.id === listing.neighborhood);
  const costs = summarizeCosts(listing);
  const saved = isSaved(listing.id);
  const similar = listings
    .filter((l) => l.neighborhood === listing.neighborhood && l.id !== listing.id && l.status === "published")
    .slice(0, 3);
  const availabilityText =
    listing.availability === "available" ? t("detail.availNow") : listing.availability === "reserved" ? t("detail.availReserved") : t("detail.availNot");

  return (
    <div className="danest-public-surface min-h-screen bg-background">
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

        <Gallery key={listing.id} images={listing.images} title={listing.title} />

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
                    <p className="text-3xl font-bold tabular-nums text-foreground">{formatRent(listing.monthlyRent)}</p>
                    <p className="mt-2 inline-block rounded-md bg-[#E9EFE9] px-2.5 py-1.5 text-sm font-semibold text-[#365844]">{t("detail.allIn", { amount: formatUSD(costs.estimatedMonthly) })}</p>
                    {costs.unknownItems.length>0&&<p className="mt-2 text-xs text-warning">{t("cost.unknownWarn",{count:costs.unknownItems.length})}</p>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant={saved ? "secondary" : "outline"}
                      onClick={async () => {
                        try { const now = await toggleSaved(listing.id);
                        toast({ title: now ? t("detail.savedToast") : t("detail.removedToast"), tone: now ? "success" : "info" }); } catch(e) { toast({title:"Unable to save / Không thể lưu",description:e instanceof Error?e.message:String(e),tone:"warning"}); }
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

                <dl className="mt-4 grid grid-cols-1 gap-2 border-t border-border pt-4 min-[380px]:grid-cols-2 sm:grid-cols-3">
                  <SpecItem icon={BedDouble} label={t("detail.bedrooms")} value={String(listing.bedrooms)} />
                  <SpecItem icon={Bath} label={t("detail.bathrooms")} value={String(listing.bathrooms)} />
                  <SpecItem icon={Maximize2} label={t("detail.floorArea")} value={`${listing.floorArea} m²`} />
                  <SpecItem icon={Building2} label={t("detail.floorLevel")} value={listing.floorLevel} />
                  <SpecItem icon={CookingPot} label={t("detail.furnishing")} value={labels.furnishing[listing.furnishing]} />
                  <SpecItem icon={CalendarDays} label={t("detail.availability")} value={t("detail.availFrom", { status: availabilityText, date: formatDate(listing.availableFrom) })} />
                </dl>
                <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground"><CalendarDays className="size-4 shrink-0" aria-hidden="true"/>{t("verify.lastConfirmed",{date:formatDate(listing.verification.lastAvailabilityConfirmed)})}</p>
              </div>
            </section>

            <AboutSection listing={listing} />

            <section aria-labelledby="amenities-title">
              <h2 id="amenities-title" className="font-heading text-2xl font-medium text-foreground">
                {t("detail.amenitiesTitle")}
              </h2>
              {listing.amenities.length===0&&<p className="mt-3 text-sm text-muted-foreground">{pick("No amenities listed","Chưa khai báo tiện ích")}</p>}
              {[
                {name:pick("Everyday essentials","Sinh hoạt"),ids:["wifi","air-conditioning","washing-machine","kitchen"]},
                {name:pick("Lifestyle","Phong cách sống"),ids:["pool","gym","workspace","balcony","pet-friendly","sea-view"]},
                {name:pick("Building","Tòa nhà"),ids:["parking","elevator"]},
                {name:pick("Other amenities","Tiện ích khác"),ids:listing.amenities.filter(a=>!["wifi","air-conditioning","washing-machine","kitchen","pool","gym","workspace","balcony","pet-friendly","sea-view","parking","elevator"].includes(a))},
              ].map(group=>{const items=listing.amenities.filter(a=>group.ids.includes(a));return items.length>0&&<div key={group.name} className="mt-4"><h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.name}</h3><ul className="grid grid-cols-1 gap-2 min-[380px]:grid-cols-2 sm:grid-cols-3">{items.map(a=>{const Icon=AMENITY_ICON[a]??CircleCheck;return <li key={a} className="flex min-w-0 items-center gap-2.5 rounded-xl border border-border bg-card p-3 text-sm font-medium text-foreground"><span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-[#E9EFE9] text-[#42634B]"><Icon className="size-4" aria-hidden="true"/></span><span className="min-w-0 break-words">{labels.amenity[a]??a}</span></li>;})}</ul></div>;})}
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
                <NearbyMap key={`${listing.id}:${listing.location?.lat}:${listing.location?.lng}`} listing={listing}/>
                <p className="mt-2 text-xs text-muted-foreground">
                  {t("detail.mapCredit")} · {listing.location?.precision === "owner-selected" ? pick("Location selected by landlord; not independently verified", "Vị trí do chủ nhà chọn, chưa xác minh độc lập") : t("map.approximate")}
                </p>
              </section>
            ) : null}

            <section className="space-y-4">
              <VerificationCard verification={listing.verification} />
              <Link className="text-sm text-link underline" to="/stay-guide">{pick("Temporary residence guide for foreign renters", "Hướng dẫn khai báo tạm trú cho khách thuê nước ngoài")}</Link>

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
              <ReportListing key={listing.id} listingId={listing.id} />
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

        {(listing.isSample || similar.some(l => l.isSample)) && <SampleDataNote className="mt-8" />}
      </div>
      <div className="h-20 lg:hidden" aria-hidden="true" />
      <ContactBar listing={listing} />
    </div>
  );
}
