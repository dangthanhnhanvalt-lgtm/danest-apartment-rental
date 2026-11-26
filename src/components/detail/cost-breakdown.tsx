import { Calculator, CircleHelp, Info } from "lucide-react";
import { formatCostAmount, formatUSD, summarizeCosts } from "~/lib/format";
import { useI18n } from "~/i18n/language-context";
import type { Listing } from "~/types";

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className={muted ? "text-sm text-muted-foreground" : "text-sm text-foreground"}>{label}</span>
      <span className={muted ? "text-sm text-muted-foreground" : "text-sm font-medium text-foreground"}>{value}</span>
    </div>
  );
}



export function CostBreakdown({ listing }: { listing: Listing }) {
  const { t } = useI18n();
  const estimateTag = (
    <span className="rounded border border-border bg-muted px-1.5 py-0.5 text-xs font-semibold text-warning">
      {t("cost.estimate")}
    </span>
  );
  const summary = summarizeCosts(listing);
  const monthlyItems = listing.costs.items.filter((i) => i.cadence === "monthly");
  const fixedItems = monthlyItems.filter((i) => i.state === "fixed" && i.amount !== null);
  const variableItems = monthlyItems.filter((i) => i.state === "variable" || i.state === "reported");
  const unknownItems = monthlyItems.filter((i) => i.state === "unknown" || i.amount === null);
  const oneTimeItems = listing.costs.items.filter((i) => i.cadence === "one-time");

  return (
    <section aria-labelledby="cost-breakdown-title" className="rounded-2xl border border-border bg-card p-5 md:p-6" style={{ boxShadow: "var(--shadow-surface)" }}>
      <div className="flex items-center gap-2">
        <Calculator className="size-5 text-link" aria-hidden="true" />
        <h2 id="cost-breakdown-title" className="text-xl font-semibold text-foreground">
          {t("cost.title")}
        </h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">{t("cost.subtitle")}</p>

      <div className="mt-4 divide-y divide-border">
        <div className="flex items-baseline justify-between gap-3 pb-2">
          <span className="text-base font-medium text-foreground">{t("cost.monthlyRent")}</span>
          <span className="text-base font-semibold text-foreground">{formatUSD(listing.costs.monthlyRent)}</span>
        </div>

        {fixedItems.length > 0 ? (
          <div className="py-3">
            <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">{t("cost.fixed")}</p>
            {fixedItems.map((item) => (
              <Row key={item.id} label={`${item.label} · ${item.unit}`} value={formatUSD(item.amount ?? 0)} />
            ))}
          </div>
        ) : null}

        {variableItems.length > 0 ? (
          <div className="py-3">
            <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">{t("cost.metered")}</p>
            {variableItems.map((item) => (
              <div key={item.id} className="flex items-baseline justify-between gap-3 py-1.5">
                <span className="flex flex-wrap items-center gap-2 text-sm text-foreground">
                  {item.label} · {item.unit}
                  {estimateTag}
                </span>
                <span className="text-sm font-medium text-foreground">{formatCostAmount(item.amount)}</span>
              </div>
            ))}
          </div>
        ) : null}

        {unknownItems.length > 0 ? (
          <div className="py-3">
            <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">{t("cost.notProvidedTitle")}</p>
            {unknownItems.map((item) => (
              <div key={item.id} className="flex items-baseline justify-between gap-3 py-1.5">
                <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <CircleHelp className="size-3.5" aria-hidden="true" />
                  {item.label} · {item.unit}
                </span>
                <span className="text-sm text-muted-foreground">{t("cost.notProvided")}</span>
              </div>
            ))}
          </div>
        ) : null}

        {oneTimeItems.length > 0 ? (
          <div className="py-3">
            <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">{t("cost.oneTime")}</p>
            {oneTimeItems.map((item) => (
              <Row key={item.id} label={`${item.label} · ${item.unit}`} value={formatCostAmount(item.amount)} />
            ))}
          </div>
        ) : null}
      </div>

      <div className="mt-4 space-y-3 rounded-xl border border-border bg-muted p-4">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-base font-medium text-foreground">{t("cost.estimatedMonthly")}</span>
          <span className="text-lg font-semibold text-foreground">{formatUSD(summary.estimatedMonthly)}</span>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-base font-medium text-foreground">{t("cost.estimatedInitial")}</span>
          <span className="text-lg font-semibold text-foreground">{formatUSD(summary.initialPayment.estimated)}</span>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm text-muted-foreground">
            {t("cost.deposit", { count: listing.costs.depositMonths })}
          </span>
          <span className="text-sm font-medium text-foreground">{formatUSD(listing.costs.depositAmount)}</span>
        </div>
        {summary.oneTimeTotal > 0 ? (
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-sm text-muted-foreground">{t("cost.oneTime")}</span>
            <span className="text-sm font-medium text-foreground">{formatUSD(summary.oneTimeTotal)}</span>
          </div>
        ) : null}
        {summary.unknownItems.length > 0 ? (
          <p className="text-sm text-warning">
            {t("cost.unknownWarn", { count: summary.unknownItems.length })}
          </p>
        ) : null}
      </div>

      <p className="mt-4 flex gap-2 text-sm text-muted-foreground">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        {t("cost.disclaimer")}
      </p>
    </section>
  );
}
