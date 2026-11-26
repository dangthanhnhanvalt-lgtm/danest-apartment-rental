import { ArrowLeft, BedDouble, Info } from "lucide-react";
import { useMemo } from "react";
import { useI18n } from "~/i18n/language-context";
import { useLabels } from "~/i18n/use-labels";
import { formatRent } from "~/lib/format";
import { Link } from "~/lib/router";
import { findSimilarApartments, type SimilarMatch } from "~/lib/similar";
import { Button } from "~/components/ui/button";
import type { Listing } from "~/types";

export function SimilarPanel({
  base,
  listings,
  onBack,
  onView,
  onClose,
}: {
  base: Listing;
  listings: Listing[];
  onBack: () => void;
  onView: (listing: Listing) => void;
  onClose: () => void;
}) {
  const labels = useLabels();
  const { t } = useI18n();
  const matches = useMemo<SimilarMatch[]>(() => findSimilarApartments(base, listings, { limit: 4, t, labels }), [base, listings, t, labels]);
  const isAlternative = matches.length > 0 && matches.every((m) => m.isAlternative);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex w-fit items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium text-link transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ArrowLeft className="size-4" aria-hidden="true" /> {t("similar.backTo", { title: base.title })}
      </button>

      {matches.length === 0 ? (
        <div className="mt-4 rounded-xl bg-muted p-4">
          <p className="text-sm font-medium text-foreground">{t("similar.none")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("similar.noneHint")}</p>
          <Button asChild variant="outline" size="sm" className="mt-3">
            <Link to="/search" onClick={onClose}>
              {t("common.browseApartments")}
            </Link>
          </Button>
        </div>
      ) : (
        <>
          {isAlternative ? (
            <p className="mt-3 flex gap-2 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
              <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              {t("similar.alternatives")}
            </p>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">{t("similar.matchedBy")}</p>
          )}

          <ul className="mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
            {matches.map((m) => (
              <li key={m.listing.id} className="rounded-xl bg-muted/60 p-3">
                <div className="flex gap-3">
                  <div className="aspect-[4/3] w-24 shrink-0 overflow-hidden rounded-md bg-background">
                    <img src={m.listing.images[0]} alt="" className="size-full object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <Link to={`/apartment/${m.listing.id}`} onClick={onClose} className="block">
                      <p className="line-clamp-2 text-sm font-semibold text-card-foreground hover:text-link">{m.listing.title}</p>
                    </Link>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {labels.neighborhood[m.listing.neighborhood]} ·{" "}
                      <span className="inline-flex items-center gap-1">
                        <BedDouble className="size-3" aria-hidden="true" />
                        {m.listing.bedrooms}
                      </span>
                    </p>
                    <p className="mt-1 text-sm font-semibold text-foreground">{formatRent(m.listing.monthlyRent)}</p>
                  </div>
                </div>
                {m.reasons.length > 0 ? <p className="mt-2 line-clamp-1 text-xs text-muted-foreground">{m.reasons.join(" · ")}</p> : null}
                <div className="mt-2 flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => onView(m.listing)}>
                    {t("listing.quickView")}
                  </Button>
                  <Button size="sm" asChild>
                    <Link to={`/apartment/${m.listing.id}`} onClick={onClose}>
                      {t("detail.overview")}
                    </Link>
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
