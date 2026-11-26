import { useState } from "react";
import { Sparkles, X } from "lucide-react";
import { formatRent } from "~/lib/format";
import { useAppState } from "~/state/app-state";
import { useLandlordIdentity } from "~/pages/landlord/use-landlord-identity";
import { useToast } from "~/components/ui/toast";
import { Button } from "~/components/ui/button";
import { Select } from "~/components/ui/form";
import { cn } from "~/lib/utils";
import { useI18n } from "~/i18n/language-context";
import type { Listing } from "~/types";

interface Promotion {
  id: string;
  nameKey: string;
  durationKey: string;
  price: number;
  includes: string[];
  recommended?: boolean;
}

const PROMOTIONS: Promotion[] = [
  {
    id: "spotlight",
    nameKey: "landlord.featured.spotlight",
    durationKey: "landlord.featured.days7",
    price: 29,
    includes: [
      "landlord.featured.includesSpotlight1",
      "landlord.featured.includesSponsoredCards",
      "landlord.featured.includesOncePerSession",
    ],
  },
  {
    id: "top-search",
    nameKey: "landlord.featured.topSearch",
    durationKey: "landlord.featured.days14",
    price: 49,
    includes: [
      "landlord.featured.includesPinned",
      "landlord.featured.includesRotation",
      "landlord.featured.includesSponsoredCards",
    ],
    recommended: true,
  },
  {
    id: "homepage",
    nameKey: "landlord.featured.homepage",
    durationKey: "landlord.featured.days30",
    price: 89,
    includes: [
      "landlord.featured.includesReserved",
      "landlord.featured.includesTopResults",
      "landlord.featured.includesHigherRotation",
    ],
  },
];

function usePromotionActions() {
  const { updateListing } = useAppState();
  const { toast } = useToast();
  const { t } = useI18n();

  const promote = async (listing: Listing) => {
    await updateListing(listing.id, { sponsored: true, featured: true });
    toast({
      title: t("landlord.featured.activated", { title: listing.title }),
      description: t("landlord.featured.activatedDesc"),
      tone: "success",
    });
  };

  const remove = async (listing: Listing) => {
    await updateListing(listing.id, { sponsored: false, featured: false });
    toast({ title: t("landlord.featured.removed"), description: listing.title, tone: "info" });
  };

  return { promote, remove };
}

function PromotionCard({ promotion, onChoose }: { promotion: Promotion; onChoose: () => void }) {
  const { t } = useI18n();
  return (
    <div
      className={cn(
        "flex flex-col rounded-xl border bg-card p-5",
        promotion.recommended ? "border-primary-strong" : "border-border",
      )}
      style={{ boxShadow: "var(--shadow-surface)" }}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-base font-semibold text-card-foreground">{t(promotion.nameKey)}</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">{t(promotion.durationKey)}</p>
        </div>
        {promotion.recommended ? (
          <span className="inline-flex whitespace-nowrap rounded-full border border-transparent bg-accent px-2.5 py-0.5 text-xs font-medium text-link">
            {t("landlord.featured.recommended")}
          </span>
        ) : null}
      </div>
      <p className="mt-4 text-2xl font-semibold text-foreground">
        ${promotion.price}
        <span className="ml-1 text-sm font-normal text-muted-foreground">{t("landlord.featured.moEquivalent")}</span>
      </p>
      <ul className="mt-4 flex-1 space-y-2 text-sm text-muted-foreground">
        {promotion.includes.map((item) => (
          <li key={item} className="flex gap-2">
            <span className="mt-2 size-1.5 shrink-0 rounded-full bg-link" aria-hidden="true" />
            {t(item)}
          </li>
        ))}
      </ul>
      <Button className="mt-5" variant={promotion.recommended ? "default" : "outline"} onClick={onChoose}>
        {t("landlord.featured.choose")}
      </Button>
    </div>
  );
}

export function FeaturedPage() {
  const { t } = useI18n();
  const { listings } = useAppState();
  const landlord = useLandlordIdentity();
  const { promote, remove } = usePromotionActions();
  const [activePromotion, setActivePromotion] = useState<Promotion | null>(null);
  const [selectedListingId, setSelectedListingId] = useState("");
  const [removeTarget, setRemoveTarget] = useState<Listing | null>(null);

  const owned = listings.filter((l) => l.landlordId === landlord.id);
  const sponsored = owned.filter((l) => l.sponsored);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{t("landlord.featured.title")}</h1>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t("landlord.featured.subtitle")}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {PROMOTIONS.map((p) => (
          <PromotionCard
            key={p.id}
            promotion={p}
            onChoose={() => {
              setActivePromotion(p);
              setSelectedListingId(owned[0]?.id ?? "");
            }}
          />
        ))}
      </div>

      {activePromotion ? (
        <div className="rounded-xl border border-border bg-card p-5" style={{ boxShadow: "var(--shadow-surface)" }}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-card-foreground">
                {t("landlord.featured.confirmTitle", { name: t(activePromotion.nameKey) })}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("landlord.featured.confirmPrice", {
                  price: activePromotion.price,
                  duration: t(activePromotion.durationKey),
                })}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActivePromotion(null)}
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={t("landlord.featured.closePanel")}
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>

          {owned.length === 0 ? (
            <p className="mt-4 rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              {t("landlord.featured.needListing")}
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              <label htmlFor="promote-listing" className="block text-sm font-medium text-foreground">
                {t("landlord.featured.chooseListing")}
              </label>
              <Select id="promote-listing" value={selectedListingId} onChange={(e) => setSelectedListingId(e.target.value)}>
                {owned.map((l) => (
                  <option key={l.id} value={l.id}>{l.title}</option>
                ))}
              </Select>
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button variant="ghost" onClick={() => setActivePromotion(null)}>{t("common.cancel")}</Button>
                <Button
                  disabled={!selectedListingId}
                  onClick={async () => {
                    const listing = owned.find((l) => l.id === selectedListingId);
                    if (!listing) return;
                    await promote(listing);
                    setActivePromotion(null);
                  }}
                >
                  {t("landlord.featured.confirmPromotion")}
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : null}

      <section className="rounded-xl border border-border bg-card p-5" style={{ boxShadow: "var(--shadow-surface)" }} aria-labelledby="sponsored-heading">
        <h2 id="sponsored-heading" className="text-base font-semibold text-card-foreground">{t("landlord.featured.sponsoredNow")}</h2>
        {sponsored.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            {t("landlord.featured.emptySponsored")}
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {sponsored.map((listing) => (
              <li key={listing.id} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center">
                <img src={listing.images[0]} alt={listing.title} className="h-16 w-24 shrink-0 rounded-lg object-cover" loading="lazy" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-foreground">{listing.title}</p>
                    <span className="inline-flex items-center gap-1 rounded-full border border-transparent bg-accent px-2.5 py-0.5 text-xs font-medium text-link">
                      <Sparkles className="size-3" aria-hidden="true" /> {t("landlord.featured.sponsored")}
                    </span>
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">{formatRent(listing.monthlyRent)}</p>
                </div>
                <Button size="sm" variant="outline" onClick={() => setRemoveTarget(listing)}>
                  {t("landlord.featured.removePromotion")}
                </Button>
              </li>
            ))}
          </ul>
        )}

        {removeTarget ? (
          <div className="mt-4 flex flex-col gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-foreground">{t("landlord.featured.removeConfirm", { title: removeTarget.title })}</p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="destructive"
                onClick={async () => {
                  await remove(removeTarget);
                  setRemoveTarget(null);
                }}
              >
                {t("common.remove")}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setRemoveTarget(null)}>{t("common.cancel")}</Button>
            </div>
          </div>
        ) : null}
      </section>

      <div className="rounded-xl border border-border bg-muted p-4">
        <p className="text-sm text-muted-foreground">
          {t("landlord.featured.prototypeNote")}
        </p>
      </div>
    </div>
  );
}
