import { BadgeCheck, Bath, BedDouble, Heart, MapPin, Maximize2, ImageOff, ShieldQuestion } from "lucide-react";
import { formatUSD } from "~/lib/format";
import { Link } from "~/lib/router";
import { useAppState } from "~/state/app-state";
import { cn } from "~/lib/utils";
import { useToast } from "~/components/ui/toast";
import { useI18n } from "~/i18n/language-context";
import { useLabels } from "~/i18n/use-labels";
import type { Listing } from "~/types";

export function VerificationBadge({ verified, className }: { verified: boolean; className?: string }) {
  const { pick } = useI18n();
  if (verified) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border border-transparent bg-[#E9EFE9] px-2.5 py-1 text-xs font-semibold text-[#365844]",
          className,
        )}
      >
        <BadgeCheck className="size-3.5" aria-hidden="true" />
        {pick("Basic verification","Xác minh cơ bản")}
      </span>
    );
  }
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-[#DAD8D3] bg-[#F0EFEC] px-2.5 py-1 text-xs font-medium text-[#595952]",
        className,
      )}
    >
      <ShieldQuestion className="size-3.5" aria-hidden="true" />
      {pick("Not verified","Chưa xác minh")}
    </span>
  );
}

export function AvailabilityBadge({ availability, className }: { availability: Listing["availability"]; className?: string }) {
  const { t } = useI18n();
  const availabilityTone: Record<Listing["availability"], { label: string; classes: string }> = {
    available: { label: t("listing.available"), classes: "border-transparent bg-[#E9EFE9] text-[#365844]" },
    reserved: { label: t("listing.reserved"), classes: "border-border bg-muted text-muted-foreground" },
    unavailable: { label: t("listing.notAvailable"), classes: "border-border bg-muted text-muted-foreground" },
  };
  const tone = availabilityTone[availability];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium",
        tone.classes,
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
      {tone.label}
    </span>
  );
}

export function SaveButton({ listing, className, compact }: { listing: Listing; className?: string; compact?: boolean }) {
  const { isSaved, toggleSaved } = useAppState();
  const { toast } = useToast();
  const { t } = useI18n();
  const saved = isSaved(listing.id);
  return (
    <button
      type="button"
      onClick={async (e) => {
        e.preventDefault();
        e.stopPropagation();
        try {
        const now = await toggleSaved(listing.id);
        toast({
          title: now ? t("saved.savedToast") : t("saved.removedToast"),
          description: now ? t("listing.savedDesc", { title: listing.title }) : t("listing.removedDesc", { title: listing.title }),
          tone: now ? "success" : "info",
        });
        } catch (e) { toast({title:t("common.error") === "common.error" ? "Unable to save / Không thể lưu" : t("common.error"),description:e instanceof Error?e.message:String(e),tone:"warning"}); }
      }}
      aria-pressed={saved}
      aria-label={saved ? t("listing.removeSavedTitle", { title: listing.title }) : t("listing.saveTitle", { title: listing.title })}
      className={cn(
        "flex items-center justify-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        compact ? "size-9" : "size-10",
        saved
          ? "border-transparent bg-card text-destructive shadow-sm"
          : "border-white/60 bg-black/25 text-white backdrop-blur-sm hover:bg-black/40",
        className,
      )}
    >
      <Heart className={cn(compact ? "size-4" : "size-[18px]", saved && "fill-current")} aria-hidden="true" />
    </button>
  );
}

export function ListingCard({
  listing,
  onQuickView,
  onCompare,
  horizontal,
}: {
  listing: Listing;
  onQuickView?: (listing: Listing) => void;
  onCompare?: (listing: Listing) => void;
  horizontal?: boolean;
}) {
  const keyAmenities = listing.amenities.slice(0, 3);
  const { isComparing } = useAppState();
  const { t, pick } = useI18n();
  const labels = useLabels();

  return (
    <article
      className={cn(
        "group relative flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-card transition-[border-color,box-shadow] hover:border-[#829987] hover:shadow-[var(--shadow-elevated)]",
        horizontal && "sm:flex-row",
      )}
      style={{ boxShadow: "var(--shadow-surface)" }}
    >
      <div className={cn("relative overflow-hidden", horizontal ? "sm:w-2/5 sm:shrink-0" : "")}>
        <Link to={`/apartment/${listing.id}`} className="block" aria-label={t("listing.viewAria", { title: listing.title })}>
          {listing.images[0] ? <img
            src={listing.images[0]}
            alt={t("listing.imageAlt", { title: listing.title, area: labels.neighborhood[listing.neighborhood] })}
            className={cn("w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]", horizontal ? "h-56 sm:h-full sm:min-h-[220px]" : "aspect-[4/3]")}
            loading="lazy"
          /> : <div className="flex aspect-[4/3] items-center justify-center bg-muted text-muted-foreground"><ImageOff className="size-9" aria-hidden="true"/><span className="sr-only">{pick("No photo provided","Chưa có ảnh căn hộ")}</span></div>}
        </Link>
        <div className="pointer-events-none absolute inset-x-3 top-3 flex items-start justify-between gap-2">
          <div className="pointer-events-auto flex flex-wrap gap-2">
            <VerificationBadge verified={listing.verificationBadge} />
            {listing.isSample && <span className="rounded-full border border-border bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground">{t("listing.demoData")}</span>}
            {listing.sponsored ? (
              <span className="rounded-full border border-[#E4D6BF] bg-[#F2EBDF] px-2.5 py-1 text-xs font-semibold text-[#735826]">
                {t("listing.sponsored")}
              </span>
            ) : null}
          </div>
          <div className="pointer-events-auto">
            <SaveButton listing={listing} compact />
          </div>
        </div>
        <div className="absolute bottom-3 left-3"><AvailabilityBadge availability={listing.availability} /></div>
      </div>

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin className="size-3.5" aria-hidden="true" />
          <span>{t("listing.areaCity", { area: labels.neighborhood[listing.neighborhood] })}</span>
        </div>
        <Link to={`/apartment/${listing.id}`} className="mt-1.5">
          <h3 className="font-heading text-xl font-semibold leading-snug text-card-foreground transition-colors group-hover:text-link">
            {listing.title}
          </h3>
        </Link>
        <p className="mt-2 text-2xl font-bold tabular-nums text-foreground">{formatUSD(listing.monthlyRent)}<span className="ml-1 text-xs font-medium text-muted-foreground">{t("common.perMonth")}</span></p>
        <p className="mt-1.5 line-clamp-2 text-sm text-muted-foreground">{listing.summary}</p>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-y border-border py-2.5 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <BedDouble className="size-4" aria-hidden="true" /> {t("listing.beds", { count: listing.bedrooms })}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Bath className="size-4" aria-hidden="true" /> {t("listing.baths", { count: listing.bathrooms })}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Maximize2 className="size-4" aria-hidden="true" /> {listing.floorArea} m²
          </span>
        </div>

        <ul className="mt-3 flex flex-wrap gap-1.5">
          {keyAmenities.map((a) => (
            <li key={a} className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {labels.amenity[a]??a}
            </li>
          ))}
        </ul>

        <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
          <Link
            to={`/apartment/${listing.id}`}
            className="inline-flex h-9 items-center justify-center rounded-lg bg-primary px-3.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t("listing.viewDetails")}
          </Link>
          {onQuickView ? (
            <button
              type="button"
              onClick={() => onQuickView(listing)}
              className="inline-flex h-9 items-center justify-center rounded-lg border border-input px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {t("listing.quickView")}
            </button>
          ) : null}
          {onCompare ? (
            <button
              type="button"
              onClick={() => onCompare(listing)}
              aria-pressed={isComparing(listing.id)}
              className={cn(
                "inline-flex h-9 items-center justify-center rounded-lg border px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                isComparing(listing.id)
                  ? "border-primary bg-accent text-link"
                  : "border-input text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )}
            >
              {isComparing(listing.id) ? t("listing.comparing") : t("listing.compare")}
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export function SampleDataNote({ className }: { className?: string }) {
  // Retain individual sample badges on listing cards; omit the repetitive site-wide note.
  return null;
}
