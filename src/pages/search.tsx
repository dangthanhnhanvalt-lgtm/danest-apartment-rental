import { useCatalog } from "~/state/catalog";
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
import { useLabels } from "~/i18n/use-labels";
import { useI18n } from "~/i18n/language-context";
import { searchResults } from "~/lib/search-results";
import type { Listing, SortKey } from "~/types";

export function SearchPage() {
  const router = useRouter();
  const { listings, listingsLoading, toggleCompare } = useAppState();
  const { t, pick } = useI18n();
  const labels=useLabels();
  const { toast } = useToast();
  const {areas,amenities}=useCatalog();
  const filters = useMemo(()=>parseFilters(router.query,areas.map(a=>a.id),amenities.map(a=>a.id)),[router.query,areas,amenities]);
  const setFilters = (next:Filters) => {
    const target=buildSearchUrl(toQuery(next));
    if(target!==`${window.location.pathname}${window.location.search}`) router.navigate(target,{replace:true,scroll:false});
  };
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const filterDialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const d=filterDialog.current;if(!d||!mobileFiltersOpen)return;const previous=document.body.style.overflow;const trigger=document.activeElement as HTMLElement|null;d.showModal();document.body.style.overflow="hidden";return()=>{if(d.open)d.close();document.body.style.overflow=previous;trigger?.focus();};},[mobileFiltersOpen]);
  const [quickView, setQuickView] = useState<Listing | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const results = useMemo(() => {
    return searchResults(listings, filters);
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
    (filters.minArea ? 1 : 0) +
    (filters.maxArea ? 1 : 0) +
    (filters.checkIn ? 1 : 0) +
    (filters.duration ? 1 : 0) +
    (filters.bedrooms ? 1 : 0) +
    (filters.bathrooms ? 1 : 0) +
    filters.types.length +
    (filters.furnishing ? 1 : 0) +
    filters.amenities.length +
    (filters.verifiedOnly ? 1 : 0) +
    (filters.availability ? 1 : 0);

  const chips:{key:string;label:string;next:Filters}[]=[];
  for(const id of filters.neighborhoods)chips.push({key:`area:${id}`,label:labels.neighborhood[id]??id,next:{...filters,neighborhoods:filters.neighborhoods.filter(x=>x!==id)}});
  for(const id of filters.types)chips.push({key:`type:${id}`,label:labels.listingType[id]??id,next:{...filters,types:filters.types.filter(x=>x!==id)}});
  for(const id of filters.amenities)chips.push({key:`amenity:${id}`,label:labels.amenity[id]??id,next:{...filters,amenities:filters.amenities.filter(x=>x!==id)}});
  const scalar = <K extends keyof Filters>(key:K,label:string,empty:Filters[K])=>{if(filters[key])chips.push({key,label,next:{...filters,[key]:empty}});};
  scalar("minRent",`${t("filter.minRent")}: $${filters.minRent}`,"");scalar("maxRent",`${t("filter.maxRent")}: $${filters.maxRent}`,"");
  scalar("minArea",`${t("filter.minArea")}: ${filters.minArea} m²`,"");scalar("maxArea",`${t("filter.maxArea")}: ${filters.maxArea} m²`,"");
  scalar("checkIn",`${t("home.checkIn")}: ${filters.checkIn}`,"");scalar("duration",`${t("home.duration")}: ${filters.duration} ${t("common.months")}`,"");
  scalar("bedrooms",`${t("search.bedrooms")}: ${filters.bedrooms}+`,null);scalar("bathrooms",`${t("search.bathrooms")}: ${filters.bathrooms}+`,null);
  scalar("furnishing",filters.furnishing?labels.furnishing[filters.furnishing]:"","");
  scalar("verifiedOnly",pick("Verified only","Chỉ tin đã xác minh"),false);
  scalar("availability",filters.availability?({available:t("listing.available"),reserved:t("listing.reserved"),unavailable:t("listing.notAvailable")}[filters.availability]):"","");

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
          className="h-full min-w-0"
        >
          <ListingCard listing={listing} onQuickView={setQuickView} onCompare={handleCompare} />
        </div>
      ));

  return (
    <div className="danest-public-surface danest-explore-page min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 pb-16 pt-8 md:px-6 lg:px-8">
        <div className="danest-explore-intro flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 md:flex-row md:items-end md:justify-between md:p-7">
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
            <Button variant="outline" className="border-primary text-primary" aria-haspopup="dialog" aria-expanded={mobileFiltersOpen} aria-controls="explore-filter-dialog" onClick={() => setMobileFiltersOpen(true)}>
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

        {activeCount>0&&<div className="mt-4 flex flex-wrap items-center gap-2" aria-label={pick("Active filters","Bộ lọc đang áp dụng")}>
          {chips.map(c=><button key={c.key} type="button" className="inline-flex items-center gap-2 rounded-full border border-[#C8D6CA] bg-[#E9EFE9] px-3 py-2 text-xs font-semibold text-[#365844] focus-visible:ring-2 focus-visible:ring-ring" onClick={()=>setFilters(c.next)} aria-label={`${pick("Remove filter","Bỏ bộ lọc")}: ${c.label}`}>{c.label}<X className="size-3.5" aria-hidden="true"/></button>)}
          <Button variant="ghost" size="sm" onClick={reset}>{t("search.reset")}</Button>
        </div>}
        <div className="mt-6">
          <div className={filters.view === "map" ? "hidden" : "min-w-0"}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm font-semibold text-foreground">{listingsLoading ? t("search.loading") : results.length === 1 ? t("search.resultCountOne") : t("search.resultCount", { count: results.length })}</p>
              <label className="flex items-center gap-2 text-sm text-foreground">
                <span className="hidden sm:inline">{t("sort.label")}</span>
                <Select aria-label={t("sort.aria")} value={filters.sort} onChange={(e) => setFilters({ ...filters, sort: e.target.value as SortKey })} className="w-full max-w-52">
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
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">{cardList}</div>
            )}

            {!listingsLoading && results.some(l => l.isSample) ? <SampleDataNote className="mt-6" /> : null}
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
            <div className="danest-explore-map h-[70dvh] min-h-[260px] w-full overflow-hidden rounded-2xl border border-border lg:h-[calc(100dvh-11rem)]">
              <MapView listings={results} activeId={activeId} onSelect={setActiveId} className="h-full w-full" />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">{t("search.mapAttribution")} · {t("map.approximate")}</p>
          </div>
        ) : null}
      </div>

      <dialog id="explore-filter-dialog" ref={filterDialog} onCancel={e=>{e.preventDefault();setMobileFiltersOpen(false);}} aria-label={t("search.filtersButton")} className="danest-filter-dialog danest-explore-filters fixed inset-y-0 right-0 left-auto m-0 h-dvh max-h-none w-full max-w-[440px] overflow-y-auto overscroll-contain border-l border-border bg-card text-foreground sm:rounded-l-2xl">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-5 py-4">
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
              <FilterPanel filters={filters} onChange={setFilters} onReset={reset} activeCount={activeCount} hideHeading />
            </div>
            <div className="sticky bottom-0 z-10 flex flex-wrap gap-2 border-t border-border bg-card px-5 py-4">
              <Button variant="outline" className="flex-1" onClick={reset}>
                {t("search.reset")}
              </Button>
              <Button className="flex-1 whitespace-normal" onClick={() => setMobileFiltersOpen(false)}>
                {results.length === 1 ? t("search.showResultsOne") : t("search.showResults", { count: results.length })}
              </Button>
            </div>
        </dialog>

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
