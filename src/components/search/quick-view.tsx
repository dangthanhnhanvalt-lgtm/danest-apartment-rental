import { useEffect, useState } from "react";
import { Bath, BedDouble, ChevronLeft, ChevronRight, Expand, MapPin, Maximize2, X } from "lucide-react";
import { AMENITIES } from "~/data/constants";
import { useI18n } from "~/i18n/language-context";
import { useLabels } from "~/i18n/use-labels";
import { formatRent, formatUSD, summarizeCosts } from "~/lib/format";
import { Link } from "~/lib/router";
import { SaveButton, VerificationBadge, AvailabilityBadge } from "~/components/ui/listing-card";
import { Button } from "~/components/ui/button";
import { PhotoViewer } from "~/components/photos/photo-viewer";
import { SimilarPanel } from "~/components/quick-view/similar-panel";
import { cn } from "~/lib/utils";
import type { Listing } from "~/types";

function ListingGallery({ listing }: { listing: Listing }) {
  const { t } = useI18n();
  const [index, setIndex] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);
  const images = listing.images.length > 0 ? listing.images : ["/images/l1.jpg"];
  const multiple = images.length > 1;

  useEffect(() => {
    setIndex(0);
  }, [listing.id]);

  const open = (i: number) => {
    setIndex(i);
    setViewerOpen(true);
  };

  return (
    <div className="flex min-h-0 flex-col bg-muted">
      <div className="relative flex min-h-0 flex-1 items-center justify-center">
        <div className="flex aspect-[4/3] w-full items-center justify-center p-3 sm:p-4 lg:aspect-auto lg:h-full lg:min-h-0">
          <img
            key={images[index]}
            src={images[index]}
            alt={`${listing.title} — photo ${index + 1}`}
            className="h-auto max-h-full w-auto max-w-full rounded-xl object-contain animate-in fade-in duration-300"
          />
        </div>

        <div className="pointer-events-none absolute inset-x-4 top-4 flex items-start justify-between gap-2">
          <div className="pointer-events-auto">
            <AvailabilityBadge availability={listing.availability} />
          </div>
          <div className="pointer-events-auto">
            <SaveButton listing={listing} compact />
          </div>
        </div>

        {multiple ? (
          <>
            <button
              type="button"
              onClick={() => setIndex((i) => (i - 1 + images.length) % images.length)}
              aria-label={t("aria.prevPhoto")}
              className="absolute left-3 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full border border-input bg-card text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ChevronLeft className="size-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={() => setIndex((i) => (i + 1) % images.length)}
              aria-label={t("aria.nextPhoto")}
              className="absolute right-3 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full border border-input bg-card text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ChevronRight className="size-5" aria-hidden="true" />
            </button>
          </>
        ) : null}

        <div className="absolute inset-x-4 bottom-4 flex items-center justify-between gap-2">
          <span className="rounded-full bg-card px-2.5 py-1 text-xs font-semibold text-card-foreground shadow-sm">
            {index + 1} / {images.length}
          </span>
          <button
            type="button"
            onClick={() => open(index)}
            className="inline-flex items-center gap-1.5 rounded-full border border-input bg-card px-3 py-1.5 text-xs font-semibold text-card-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Expand className="size-3.5" aria-hidden="true" />
            View photo
          </button>
        </div>
      </div>

      {multiple ? (
        <div className="flex shrink-0 gap-2 overflow-x-auto px-3 pb-3">
          {images.map((src, i) => (
            <button
              key={`${src}-${i}`}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={t("aria.showPhoto", { n: i + 1 })}
              aria-current={i === index}
              className={cn(
                "aspect-[4/3] w-16 shrink-0 overflow-hidden rounded-md bg-background ring-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-20",
                i === index ? "ring-primary-strong" : "ring-transparent hover:ring-border",
              )}
            >
              <img src={src} alt="" className="size-full object-contain" />
            </button>
          ))}
        </div>
      ) : null}

      {viewerOpen ? (
        <PhotoViewer images={images} title={listing.title} index={index} onIndex={setIndex} onClose={() => setViewerOpen(false)} />
      ) : null}
    </div>
  );
}

function Fact({ icon: Icon, value, label }: { icon: typeof BedDouble; value: string; label: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5 rounded-xl bg-muted/60 px-3 py-2.5">
      <Icon className="size-4 shrink-0 text-link" aria-hidden="true" />
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

export function QuickViewModal({
  listing,
  listings,
  onClose,
  onSelect,
}: {
  listing: Listing;
  listings?: Listing[];
  onClose: () => void;
  onSelect?: (listing: Listing) => void;
}) {
  const { t } = useI18n();
  const labels = useLabels();
  const [mode, setMode] = useState<"details" | "similar">("details");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  useEffect(() => {
    setMode("details");
  }, [listing.id]);

  const costs = summarizeCosts(listing);
  const titleId = `quick-view-${listing.id}`;
  const available = AMENITIES.filter((a) => listing.amenities.includes(a.id)).slice(0, 6);

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center p-0 sm:items-center sm:p-4 lg:p-6">
      <div className="absolute inset-0" style={{ backgroundColor: "var(--overlay-bg)" }} onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 flex max-h-[94vh] w-full flex-col overflow-hidden rounded-t-2xl bg-card sm:max-h-[90vh] sm:rounded-2xl lg:h-[86vh] lg:max-h-[900px] lg:w-[92vw] lg:max-w-[1500px]"
        style={{ boxShadow: "var(--shadow-overlay)" }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label={t("qv.closeAria")}
          className="absolute right-3 top-3 z-30 flex size-10 items-center justify-center rounded-full border border-input bg-card text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X className="size-4" aria-hidden="true" />
        </button>

        <div className="grid min-h-0 flex-1 grid-cols-1 overflow-y-auto lg:grid-cols-[55fr_45fr] lg:overflow-hidden">
          <ListingGallery listing={listing} />

          <div className="flex min-h-0 flex-col border-t border-border lg:border-l lg:border-t-0">
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-7 sm:py-6">
              {mode === "details" ? (
                <>
                  <div className="flex flex-wrap items-center gap-2 pr-10">
                    {listing.verificationBadge ? <VerificationBadge verified /> : null}
                    <AvailabilityBadge availability={listing.availability} />
                    <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                      {labels.listingType[listing.type]}
                    </span>
                  </div>

                  <h2 id={titleId} className="mt-4 max-w-[36ch] font-heading text-2xl font-semibold leading-snug text-card-foreground sm:text-3xl">
                    {listing.title}
                  </h2>
                  <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
                    <MapPin className="size-4 shrink-0" aria-hidden="true" />
                    {labels.neighborhood[listing.neighborhood]}, Da Nang
                  </p>

                  <div className="mt-5">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <span className="font-heading text-3xl font-semibold text-foreground">{formatRent(listing.monthlyRent)}</span>
                      <span className="text-sm text-muted-foreground">{t("qv.monthlyRent")}</span>
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {t("qv.estimatedAllIn", { amount: formatUSD(costs.estimatedMonthly) })}
                    </p>
                  </div>

                  <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
                    <Fact icon={BedDouble} value={String(listing.bedrooms)} label={t("search.bedrooms")} />
                    <Fact icon={Bath} value={String(listing.bathrooms)} label={t("search.bathrooms")} />
                    <Fact icon={Maximize2} value={`${listing.floorArea} m²`} label={t("qv.floorArea")} />
                  </div>

                  <p className="mt-5 line-clamp-3 text-base leading-relaxed text-muted-foreground">{listing.summary}</p>

                  {available.length > 0 ? (
                    <div className="mt-5">
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{t("qv.amenities")}</p>
                      <ul className="mt-2 flex flex-wrap gap-2">
                        {available.map((a) => (
                          <li key={a.id} className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-link">
                            {labels.amenity[a.id]}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </>
              ) : (
                <>
                  <h2 className="font-heading text-2xl font-semibold text-card-foreground">{t("qv.similarTitle")}</h2>
                  {listings ? (
                    <SimilarPanel
                      base={listing}
                      listings={listings}
                      onBack={() => setMode("details")}
                      onView={(next) => {
                        if (onSelect) onSelect(next);
                        else setMode("details");
                      }}
                      onClose={onClose}
                    />
                  ) : null}
                </>
              )}
            </div>

            {mode === "details" ? (
              <div className="shrink-0 border-t border-border bg-card px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:px-7">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Button asChild size="lg" className="w-full">
                    <Link to={`/apartment/${listing.id}`} onClick={onClose}>
                      {t("qv.viewFull")}
                    </Link>
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    className="w-full"
                    onClick={() => setMode("similar")}
                    disabled={!listings || listings.length === 0}
                  >
                    {t("qv.similar")}
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
