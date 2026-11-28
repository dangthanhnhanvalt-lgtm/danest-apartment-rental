import { CheckCircle2, X } from "lucide-react";
import type { ReactNode } from "react";
import { useI18n } from "~/i18n/language-context";
import { useLabels } from "~/i18n/use-labels";
import { formatUSD, monthsBetweenLabel, summarizeCosts } from "~/lib/format";
import { Link } from "~/lib/router";
import { VerificationBadge } from "~/components/ui/listing-card";
import { cn } from "~/lib/utils";
import type { Listing } from "~/types";

type BestRule = "low" | "high" | null;

interface RowDef {
  key: string;
  label: string;
  best: BestRule;
  value: (l: Listing) => number | null;
  render: (l: Listing) => ReactNode;
}

type Labels = ReturnType<typeof useLabels>;
type Translate = (key: string, vars?: Record<string, string | number>) => string;

function buildRows(labels: Labels, t: Translate): RowDef[] {
  return [
    {
      key: "rent",
      label: t("compare.rent"),
      best: "low",
      value: (l) => l.monthlyRent,
      render: (l) => <span className="font-semibold text-foreground">{formatUSD(l.monthlyRent)}</span>,
    },
    {
      key: "total",
      label: t("compare.total"),
      best: "low",
      value: (l) => summarizeCosts(l).unknownItems.length ? null : summarizeCosts(l).estimatedMonthly,
      render: (l) => <>{formatUSD(summarizeCosts(l).estimatedMonthly,true)}{summarizeCosts(l).unknownItems.length>0 && <span className="block text-xs text-muted-foreground">{t("cost.unknownWarn",{count:summarizeCosts(l).unknownItems.length})}</span>}</>,
    },
    {
      key: "initial",
      label: t("cost.estimatedInitial"),
      best: "low",
      value: (l) => summarizeCosts(l).unknownItems.length ? null : summarizeCosts(l).initialPayment.estimated,
      render: (l) => formatUSD(summarizeCosts(l).initialPayment.estimated,true),
    },
    {
      key: "deposit",
      label: t("compare.deposit"),
      best: "low",
      value: (l) => l.costs.depositAmount,
      render: (l) => `${formatUSD(l.costs.depositAmount)} · ${l.costs.depositMonths} ${t("common.months")}`,
    },
    {
      key: "location",
      label: t("compare.location"),
      best: null,
      value: () => null,
      render: (l) => (
        <span>
          <span className="block font-medium text-foreground">{labels.neighborhood[l.neighborhood]}</span>
          <span className="block text-muted-foreground">{l.address}</span>
        </span>
      ),
    },
    {
      key: "area",
      label: t("compare.area"),
      best: "high",
      value: (l) => l.floorArea,
      render: (l) => `${l.floorArea} m²`,
    },
    { key: "bedrooms", label: t("search.bedrooms"), best: null, value: () => null, render: (l) => l.bedrooms },
    { key: "bathrooms", label: t("search.bathrooms"), best: null, value: () => null, render: (l) => l.bathrooms },
    {
      key: "furnishing",
      label: t("search.furnishing"),
      best: null,
      value: () => null,
      render: (l) => labels.furnishing[l.furnishing],
    },
    {
      key: "amenities",
      label: t("search.amenities"),
      best: null,
      value: () => null,
      render: (l) => (
        <span>
          <span className="block font-medium text-foreground">{t("compare.included", { count: l.amenities.length })}</span>
          <span className="block text-muted-foreground">{l.amenities.map((a) => labels.amenity[a]).join(", ")}</span>
        </span>
      ),
    },
    {
      key: "terms",
      label: t("compare.conditions"),
      best: null,
      value: () => null,
      render: (l) => (
        <span>
          <span className="block">{monthsBetweenLabel(l.rentalTerms.minMonths, l.rentalTerms.maxMonths)}</span>
          <span className="block text-muted-foreground">{t("compare.paymentDay", { day: l.rentalTerms.paymentDayOfMonth })}</span>
        </span>
      ),
    },
    {
      key: "verification",
      label: t("compare.verificationStatus"),
      best: null,
      value: () => null,
      render: (l) => <VerificationBadge verified={l.verificationBadge} />,
    },
  ];
}

function bestIdFor(row: RowDef, listings: Listing[]): string | null {
  if (!row.best || listings.length < 2) return null;
  const withValues = listings.map((l) => ({ id: l.id, v: row.value(l) })).filter((x): x is { id: string; v: number } => x.v !== null);
  if (withValues.length !== listings.length) return null;
  const target = row.best === "low" ? Math.min(...withValues.map((x) => x.v)) : Math.max(...withValues.map((x) => x.v));
  const winners = withValues.filter((x) => x.v === target);
  return winners.length === 1 ? winners[0].id : null;
}

export function ComparisonTable({
  listings,
  onRemove,
  onClear,
}: {
  listings: Listing[];
  onRemove: (id: string) => void;
  onClear: () => void;
}) {
  const { t } = useI18n();
  const labels = useLabels();
  const rows = buildRows(labels, t);
  return (
    <section aria-labelledby="compare-title" className="rounded-2xl border border-border bg-card" style={{ boxShadow: "var(--shadow-surface)" }}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5">
        <div>
          <h2 id="compare-title" className="text-xl font-semibold text-foreground">
            {t("compare.title")}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("compare.selected", { count: listings.length })}</p>
        </div>
        {listings.length > 0 ? (
          <button
            type="button"
            onClick={onClear}
            className="rounded-md px-2 py-1 text-sm font-medium text-link transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t("compare.clear")}
          </button>
        ) : null}
      </div>

      {listings.length < 2 ? (
        <div className="p-6">
          <p className="text-base text-muted-foreground">{t("compare.pickTwo")}</p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 border-b border-border bg-muted px-5 py-3 text-sm text-muted-foreground">
            <CheckCircle2 className="size-4 text-success" aria-hidden="true" />
            {t("compare.diffHint")}
          </div>
          <div className="overflow-x-auto max-h-[75vh]" tabIndex={0} role="region" aria-labelledby="compare-title">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr>
                  <th scope="col" className="sticky left-0 top-0 z-20 w-36 min-w-32 bg-card p-3 text-left align-top text-xs font-semibold uppercase text-muted-foreground sm:w-48">
                    {t("compare.property")}
                  </th>
                  {listings.map((l) => (
                    <th key={l.id} scope="col" className="sticky top-0 z-10 min-w-[180px] bg-card p-3 text-left align-top">
                      <div className="relative">
                        <img src={l.images[0]} alt={t("listing.imageAlt", { title: l.title, area: labels.neighborhood[l.neighborhood] })} className="h-28 w-full rounded-xl object-cover" />
                        <button
                          type="button"
                          onClick={() => onRemove(l.id)}
                          aria-label={t("compare.removeAria", { title: l.title })}
                          className="absolute right-2 top-2 flex size-11 items-center justify-center rounded-full border border-input bg-card text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <X className="size-4" aria-hidden="true" />
                        </button>
                      </div>
                      <Link to={`/apartment/${l.id}`} className="mt-2 block font-heading text-base font-semibold text-foreground hover:text-link">
                        {l.title}
                      </Link>
                      <span className="text-xs text-muted-foreground">{l.floorArea} m² · {t("listing.beds", { count: l.bedrooms })}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const bestId = bestIdFor(row, listings);
                  return (
                    <tr key={row.key} className="border-t border-border">
                      <th scope="row" className="sticky left-0 z-[1] bg-card p-3 text-left align-top text-sm font-semibold text-muted-foreground">
                        {row.label}
                      </th>
                      {listings.map((l) => {
                        const isBest = l.id === bestId;
                        return (
                          <td key={l.id} className={cn("p-4 align-top text-sm text-foreground", isBest && "bg-[#E9EFE9] text-[#365844] dark:bg-accent dark:text-accent-foreground")}>
                            {row.render(l)}
                            {isBest ? <span className="mt-1 block text-xs font-semibold text-success">{t("compare.best")}</span> : null}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
