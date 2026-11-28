import { ArrowRight } from "lucide-react";
import { useMemo } from "react";
import { Link } from "~/lib/router";
import { useAppState } from "~/state/app-state";
import { ListingCard, SampleDataNote } from "~/components/ui/listing-card";
import { Skeleton } from "~/components/ui/skeleton";
import { useI18n } from "~/i18n/language-context";

export function FeaturedApartments() {
  const { listings, listingsLoading } = useAppState();
  const { t } = useI18n();
  const featured = useMemo(
    () => listings.filter((l) => l.status === "published").sort((a,b)=>Number(b.featured)-Number(a.featured)).slice(0, 6),
    [listings],
  );

  return (
    <section id="featured" className="bg-background">
      <div className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-16 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-link">{t("featured.eyebrow")}</p>
            <h2 className="mt-3 font-heading text-3xl font-medium text-foreground text-balance md:text-4xl">
              {t("featured.title")}
            </h2>
            <p className="mt-2 text-sm italic text-muted-foreground md:text-base">
              {t("featured.subtitle")}
            </p>
          </div>
          <Link
            to="/search"
            className="inline-flex h-11 shrink-0 items-center gap-2 rounded-lg border border-input px-5 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t("featured.viewAll")} <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>

        <div className="mt-7 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {listingsLoading
            ? Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="aspect-[4/3] w-full rounded-2xl" />
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              ))
            : featured.map((listing) => <ListingCard key={listing.id} listing={listing} />)}
        </div>
        {featured.some(l => l.isSample) && <SampleDataNote className="mt-6" />}
      </div>
    </section>
  );
}
