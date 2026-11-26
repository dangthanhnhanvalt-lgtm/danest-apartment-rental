import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { LayoutGrid, Map as MapIcon, SlidersHorizontal, X } from "lucide-react";
import { useRouter, buildSearchUrl } from "~/lib/router";
import { useAppState } from "~/state/app-state";
import { useToast } from "~/components/ui/toast";
import { Button } from "~/components/ui/button";
import { Select } from "~/components/ui/form";
import { ListingCard, SampleDataNote } from "~/components/ui/listing-card";
import { Skeleton } from "~/components/ui/skeleton";
import { MapView } from "~/components/map/map-view";
import { QuickViewModal } from "~/components/search/quick-view";
import { FilterPanel } from "~/components/search/filter-panel";
import { EMPTY_FILTERS, SORT_LABEL, parseFilters, toQuery, type Filters } from "~/components/search/filter-config";
import { useI18n } from "~/i18n/language-context";
import type { Listing, SortKey } from "~/types";

export function SearchPage() {
  const router = useRouter();
  const { listings, listingsLoading, toggleCompare } = useAppState();
  const { t } = useI18n();
  const { toast } = useToast();
  const [filters, setFilters] = useState<Filters>(() => parseFilters(router.query));
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [quickView, setQuickView] = useState<Listing | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const lastPushed = useRef("");

  useEffect(() => {
    const target = buildSearchUrl(toQuery(filters));
    if (target === lastPushed.current || target === `${window.location.pathname}${window.location.search}`) return;
    lastPushed.current = target;
    router.navigate(target, { replace: true });
  }, [filters, router]);

  const { neighborhoods: initialNeighborhood } = parseFilters(router.query);
  const neighborhoodKey = initialNeighborhood.join(",");
  useEffect(() => {
    const incoming = `${window.location.pathname}${window.location.search}`;
    if (incoming !== lastPushed.current) setFilters(parseFilters(new URLSearchParams(incoming.split("?")[1] ?? "")));
  }, [neighborhoodKey]);

  const results = useMemo(() => {
    const min = filters.minRent ? Number(filters.minRent) : null;
    const max = filters.maxRent ? Number(filters.maxRent) : null;
    const duration = filters.duration ? Number(filters.duration) : null;
    const filtered = listings.filter((l) => {
      if (l.status !== "published") return false;
      if (filters.neighborhoods.length && !filters.neighborhoods.includes(l.neighborhood)) return false;
      if (min !== null && l.monthlyRent < min) return false;
      if (max !== null && l.monthlyRent > max) return false;
      if (duration !== null && (duration < l.rentalDurationMonths[0] || duration > l.rentalDurationMonths[1])) return false;
      if (filters.bedrooms !== null) {
        if (filters.bedrooms >= 3 ? l.bedrooms < 3 : l.bedrooms < filters.bedrooms) return false;
      }
      if (filters.bathrooms !== null) {
        if (filters.bathrooms >= 2 ? l.bathrooms < 2 : l.bathrooms < filters.bathrooms) return false;
      }
      if (filters.types.length && !filters.types.includes(l.type)) return false;
      if (filters.furnishing && l.furnishing !== filters.furnishing) return false;
      if (filters.amenities.length && !filters.amenities.every((a) => l.amenities.includes(a))) return false;
      if (filters.verifiedOnly && !l.verificationBadge) return false;
      if (filters.availability && l.availability !== filters.availability) return false;
      return true;
    });
    const sorted = [...filtered];
    switch (filters.sort) {
      case "price-asc":
        sorted.sort((a, b) => a.monthlyRent - b.monthlyRent);
        break;
      case "price-desc":
        sorted.sort((a, b) => b.monthlyRent - a.monthlyRent);
        break;
      case "newest":
        sorted.sort((a, b) => new Date(b.listedAt).getTime() - new Date(a.listedAt).getTime());
        break;
      default:
        sorted.sort((a, b) => {
          const score = (l: Listing) => (l.featured ? 2 : 0) + (l.sponsored ? 1 : 0);
          return score(b) - score(a) || b.verification.checks.filter((c) => c.status === "verified").length - a.verification.checks.filter((c) => c.status === "verified").length;
        });
    }
    return sorted;
  }, [listings, filters]);

  const handleCompare = useCallback(
    (listing: Listing) => {
      const result = toggleCompare(listing.id);
      if (result === "full") {
        toast({
          title: t("saved.comparisonFull"),
          description: t("saved.comparisonFullHint"),
          tone: "warning",
        });
      } else if (result === "added") {
        toast({ title: t("search.addedCompare"), description: t("search.addedCompareDesc", { title: listing.title }), tone: "success" });
      } else {
        toast({ title: t("saved.removedFromCompare"), description: listing.title, tone: "info" });
      }
    },
    [toggleCompare, toast, t],
  );

  const reset = () => setFilters({ ...EMPTY_FILTERS, sort: filters.sort, view: filters.view });
  const activeCount =
    filters.neighborhoods.length +
    (filters.minRent ? 1 : 0) +
    (filters.maxRent ? 1 : 0) +
    (filters.duration ? 1 : 0) +
    (filters.bedrooms ? 1 : 0) +
    (filters.bathrooms ? 1 : 0) +
    filters.types.length +
    (filters.furnishing ? 1 : 0) +
    filters.amenities.length +
    (filters.verifiedOnly ? 1 : 0) +
    (filters.availability ? 1 : 0);

  const cardList = listingsLoading
    ? Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-2xl border border-border bg-card" style={{ boxShadow: "var(--shadow-surface)" }}>
          <Skeleton className="aspect-[4/3] w-full" />
          <div className="space-y-3 p-5">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-5 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        </div>
      ))
    : results.map((listing) => (
        <div
          key={listing.id}
          onMouseEnter={() => setActiveId(listing.id)}
          onFocus={() => setActiveId(listing.id)}
          className={`rounded-2xl transition-colors ${
            activeId === listing.id ? "bg-accent p-1 ring-2 ring-primary" : ""
          }`}
        >
          <ListingCard listing={listing} onQuickView={setQuickView} onCompare={handleCompare} />
        </div>
      ));

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 pb-16 pt-8 md:px-6 lg:px-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="font-heading text-3xl font-medium text-foreground md:text-4xl">{t("search.heading")}</h1>
            <p className="mt-2 max-w-2xl text-base text-muted-foreground">
              {t("search.intro")}
            </p>
            <p className="mt-2 text-sm text-muted-foreground" aria-live="polite">
              {listingsLoading ? t("search.loading") : results.length === 1 ? t("search.resultsOne") : t("search.results", { count: results.length })}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" className="lg:hidden" onClick={() => setMobileFiltersOpen(true)}>
              <SlidersHorizontal className="size-4" aria-hidden="true" />
              {t("search.filtersButton")}{activeCount > 0 ? ` (${activeCount})` : ""}
            </Button>
            <div className="inline-flex rounded-lg border border-border bg-muted p-1" role="group" aria-label={t("search.viewGroup")}>
              <button
                type="button"
                onClick={() => setFilters({ ...filters, view: "grid" })}
                aria-pressed={filters.view === "grid"}
                className={`flex h-9 items-center gap-1.5 rounded-md border border-transparent px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  filters.view === "grid" ? "border-border bg-card text-foreground" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                }`}
              >
                <LayoutGrid className="size-4" aria-hidden="true" /> {t("search.grid")}
              </button>
              <button
                type="button"
                onClick={() => setFilters({ ...filters, view: "map" })}
                aria-pressed={filters.view === "map"}
                className={`flex h-9 items-center gap-1.5 rounded-md border border-transparent px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                  filters.view === "map" ? "border-border bg-card text-foreground" : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                }`}
              >
                <MapIcon className="size-4" aria-hidden="true" /> {t("search.map")}
              </button>
            </div>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-12">
          <aside className="hidden lg:col-span-3 lg:block">
            <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto rounded-2xl border border-border bg-card p-5" style={{ boxShadow: "var(--shadow-surface)" }}>
              <FilterPanel filters={filters} onChange={setFilters} onReset={reset} collapsible activeCount={activeCount} />
            </div>
          </aside>

          <div className={filters.view === "map" ? "hidden" : "lg:col-span-9"}>
            <div className="mb-4 flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">{results.length === 1 ? t("search.resultCountOne") : t("search.resultCount", { count: results.length })}</p>
              <label className="flex items-center gap-2 text-sm text-foreground">
                <span className="hidden sm:inline">{t("sort.label")}</span>
                <Select aria-label={t("sort.aria")} value={filters.sort} onChange={(e) => setFilters({ ...filters, sort: e.target.value as SortKey })} className="w-52">
                  {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => (
                    <option key={k} value={k}>
                      {t(`sort.${k}`)}
                    </option>
                  ))}
                </Select>
              </label>
            </div>

            {!listingsLoading && results.length === 0 ? (
              <div className="rounded-2xl border border-border bg-card p-10 text-center" style={{ boxShadow: "var(--shadow-surface)" }}>
                <h2 className="font-heading text-xl font-semibold text-foreground">{t("search.noMatchTitle")}</h2>
                <p className="mx-auto mt-2 max-w-md text-base text-muted-foreground">
                  {t("search.noMatchHint")}
                </p>
                <Button className="mt-5" onClick={reset}>
                  {t("search.resetFilters")}
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">{cardList}</div>
            )}

            {!listingsLoading && results.length > 0 ? <SampleDataNote className="mt-6" /> : null}
          </div>
        </div>

        {filters.view === "map" ? (
          <div className="mt-6">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">
                {results.length === 1 ? t("search.mapHintOne") : t("search.mapHint", { count: results.length })}
              </p>
              <Button variant="outline" size="sm" onClick={() => setFilters({ ...filters, view: "grid" })}>
                <LayoutGrid className="size-4" aria-hidden="true" /> {t("search.showGrid")}
              </Button>
            </div>
            <div className="h-[70vh] min-h-[420px] w-full overflow-hidden rounded-2xl border border-border lg:h-[calc(100vh-11rem)]">
              <MapView listings={results} activeId={activeId} onSelect={setActiveId} className="h-full w-full" />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{t("search.mapAttribution")}</p>
          </div>
        ) : null}
      </div>

      {mobileFiltersOpen ? (
        <div className="fixed inset-0 z-[85] lg:hidden">
          <div className="absolute inset-0" style={{ backgroundColor: "var(--overlay-bg)" }} onClick={() => setMobileFiltersOpen(false)} aria-hidden="true" />
          <div role="dialog" aria-modal="true" aria-label={t("search.filtersButton")} className="absolute inset-x-0 bottom-0 max-h-[90vh] overflow-y-auto rounded-t-2xl bg-card">
            <div className="sticky top-0 flex items-center justify-between border-b border-border bg-card px-5 py-4">
              <h2 className="text-lg font-semibold text-foreground">{t("search.filtersButton")}</h2>
              <button
                type="button"
                onClick={() => setMobileFiltersOpen(false)}
                aria-label={t("search.closeFilters")}
                className="flex size-10 items-center justify-center rounded-full text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>
            <div className="p-5">
              <FilterPanel filters={filters} onChange={setFilters} onReset={reset} activeCount={activeCount} />
            </div>
            <div className="sticky bottom-0 flex gap-2 border-t border-border bg-card px-5 py-4">
              <Button variant="outline" className="flex-1" onClick={reset}>
                {t("search.reset")}
              </Button>
              <Button className="flex-1" onClick={() => setMobileFiltersOpen(false)}>
                {results.length === 1 ? t("search.showResultsOne") : t("search.showResults", { count: results.length })}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {quickView ? (
        <QuickViewModal
          listing={quickView}
          listings={listings}
          onClose={() => setQuickView(null)}
          onSelect={setQuickView}
        />
      ) : null}
    </div>
  );
}
