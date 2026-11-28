import { useMemo, useState } from "react";
import { AlertTriangle, Search } from "lucide-react";
import type { Listing, ListingStatus } from "~/types";
import { availabilityStatus } from "~/lib/availability";
import { formatDate, formatRent } from "~/lib/format";
import { useAdmin } from "~/state/admin-state";
import { Button } from "~/components/ui/button";
import { Field, Input, Select } from "~/components/ui/form";
import { cn } from "~/lib/utils";
import {
  Card,
  EmptyState,
  LoadingRows,
  PageFooter,
  PageHeader,
} from "~/pages/admin/shared";
import {
  LISTING_STATUSES,
  LISTING_STATUS_LABEL_KEY,
  moderationTextClass,
  thClass,
  tdClass,
} from "~/pages/admin/admin-helpers";
import { ListingStatusPill, Pill } from "~/pages/admin/pills";
import { ListingDetailPanel } from "~/pages/admin/listing-detail";
import { useI18n } from "~/i18n/language-context";
import { useLabels } from "~/i18n/use-labels";

interface ListingRowProps {
  listing: Listing;
  onReview: (id: string) => void;
}

function AvailabilityCell({ listing }: { listing: Listing }) {
  const { t } = useI18n();
  const { settings } = useAdmin();
  const a = availabilityStatus(listing, settings);
  if (a.state === "unknown") return <span className="text-xs text-muted-foreground">{t("admin.kpis.notEnoughData")}</span>;
  if (a.state === "hidden") {
    return <span className="text-xs font-medium text-destructive">{t("admin.availability.hiddenReconfirm")}</span>;
  }
  if (a.state === "overdue") {
    return <span className="text-xs font-medium text-warning">{t("admin.availability.overdue", { days: Math.max(0,a.daysSinceConfirmed - settings.availabilityReminderDays) })}</span>;
  }
  return <span className="text-xs text-muted-foreground">{t("admin.availability.confirmed", { date: formatDate(listing.lastAvailabilityConfirmedAt) })}</span>;
}

function ListingRow({ listing, onReview }: ListingRowProps) {
  const { t } = useI18n();
  const labels = useLabels();
  return (
    <tr className="transition-colors hover:bg-accent">
      <td className={tdClass}>
        <div className="flex items-center gap-3">
          {listing.images[0] ? (
            <img src={listing.images[0]} alt="" className="size-12 shrink-0 rounded-lg border border-border object-cover" loading="lazy" />
          ) : (
            <div className="size-12 shrink-0 rounded-lg border border-border bg-muted" aria-hidden="true" />
          )}
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{listing.title}</p>
            <p className="truncate text-xs text-muted-foreground">
              {labels.neighborhood[listing.neighborhood]} · {listing.landlord.displayName}
            </p>
          </div>
        </div>
      </td>
      <td className={tdClass}>{formatRent(listing.monthlyRent)}</td>
      <td className={tdClass}><ListingStatusPill status={listing.status} /></td>
      <td className={tdClass}>
        <span className={cn("text-xs font-medium", moderationTextClass(listing.moderation.result))}>{labels.moderation[listing.moderation.result]}</span>
        {listing.moderation.duplicateRisk ? (
          <Pill tone="attention" className="ml-2">
            <AlertTriangle className="size-3" aria-hidden="true" /> {t("admin.listings.duplicate")}
          </Pill>
        ) : null}
      </td>
      <td className={tdClass}><AvailabilityCell listing={listing} /></td>
      <td className={tdClass}>
        <Button variant="outline" size="sm" className="danest-review-button min-w-[92px] whitespace-nowrap px-4" onClick={() => onReview(listing.id)}>
          {t("admin.listings.review")}
        </Button>
      </td>
    </tr>
  );
}

function ListingCard({ listing, onReview }: ListingRowProps) {
  const { t } = useI18n();
  const labels = useLabels();
  return (
    <li className="rounded-xl border border-border bg-card p-4" style={{ boxShadow: "var(--shadow-surface)" }}>
      <div className="flex items-start gap-3">
        {listing.images[0] ? (
          <img src={listing.images[0]} alt="" className="size-12 shrink-0 rounded-lg border border-border object-cover" loading="lazy" />
        ) : (
          <div className="size-12 shrink-0 rounded-lg border border-border bg-muted" aria-hidden="true" />
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground">{listing.title}</p>
          <p className="text-xs text-muted-foreground">
            {labels.neighborhood[listing.neighborhood]} · {listing.landlord.displayName}
          </p>
        </div>
        <ListingStatusPill status={listing.status} />
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
        <div>
          <dt className="text-muted-foreground">{t("admin.col.rent")}</dt>
          <dd className="text-foreground">{formatRent(listing.monthlyRent)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t("admin.col.moderation")}</dt>
          <dd className={cn("font-medium", moderationTextClass(listing.moderation.result))}>{labels.moderation[listing.moderation.result]}</dd>
        </div>
        <div className="col-span-2">
          <dt className="text-muted-foreground">{t("admin.col.availability")}</dt>
          <dd className="mt-0.5"><AvailabilityCell listing={listing} /></dd>
        </div>
      </dl>
      {listing.moderation.duplicateRisk ? (
        <Pill tone="attention" className="mt-2">
          <AlertTriangle className="size-3" aria-hidden="true" /> {t("admin.listings.possibleDuplicate")}
        </Pill>
      ) : null}
      <Button variant="outline" size="sm" className="mt-3 w-full" onClick={() => onReview(listing.id)}>
        {t("admin.listings.review")}
      </Button>
    </li>
  );
}

export function ListingsPage() {
  const { t } = useI18n();
  const { listings, loading } = useAdmin();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | ListingStatus>("all");
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return listings.filter((l) => {
      if (status !== "all" && l.status !== status) return false;
      if (flaggedOnly) {
        const flagged = l.status === "needs-attention" || l.status === "rejected" || l.status === "pending" || l.moderation.duplicateRisk;
        if (!flagged) return false;
      }
      if (!q) return true;
      return l.title.toLowerCase().includes(q) || l.landlord.displayName.toLowerCase().includes(q);
    });
  }, [listings, query, status, flaggedOnly]);

  const selected = selectedId ? listings.find((l) => l.id === selectedId) ?? null : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("admin.listings.title")}
        description={t("admin.listings.description")}
      />

      <Card>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-12 md:items-end">
          <div className="md:col-span-6">
            <Field label={t("admin.listings.search")} htmlFor="listing-search">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                <Input id="listing-search" className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("admin.listings.searchPlaceholder")} />
              </div>
            </Field>
          </div>
          <div className="md:col-span-3">
            <Field label={t("admin.listings.status")} htmlFor="listing-status">
              <Select id="listing-status" value={status} onChange={(e) => setStatus(e.target.value as "all" | ListingStatus)}>
                <option value="all">{t("admin.listings.allStatuses")}</option>
                {LISTING_STATUSES.map((s) => (
                  <option key={s} value={s}>{t(LISTING_STATUS_LABEL_KEY[s])}</option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="md:col-span-3">
            <Button
              type="button"
              variant={flaggedOnly ? "default" : "outline"}
              className="w-full"
              onClick={() => setFlaggedOnly((v) => !v)}
              aria-pressed={flaggedOnly}
            >
              {t("admin.listings.flaggedOnly")}
            </Button>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          {t("admin.listings.showing", { shown: filtered.length, total: listings.length })}
          {flaggedOnly ? t("admin.listings.flaggedSuffix") : ""}
        </p>
      </Card>

      {loading ? (
        <LoadingRows />
      ) : filtered.length === 0 ? (
        <EmptyState title={t("admin.listings.empty")} description={t("admin.listings.emptyDesc")} />
      ) : (
        <>
          <div tabIndex={0} role="region" aria-label={t("admin.nav.listings")} className="hidden overflow-x-auto rounded-2xl border border-border bg-card md:block" style={{ boxShadow: "var(--shadow-surface)" }}>
            <table className="w-full min-w-[960px] border-collapse">
              <thead className="border-b border-border bg-muted/50">
                <tr>
                  <th className={thClass} scope="col">{t("admin.col.property")}</th>
                  <th className={thClass} scope="col">{t("admin.col.rent")}</th>
                  <th className={thClass} scope="col">{t("admin.col.status")}</th>
                  <th className={thClass} scope="col">{t("admin.col.moderation")}</th>
                  <th className={thClass} scope="col">{t("admin.col.availability")}</th>
                  <th className={cn(thClass, "text-right")} scope="col">{t("admin.col.actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((l) => (
                  <ListingRow key={l.id} listing={l} onReview={setSelectedId} />
                ))}
              </tbody>
            </table>
          </div>

          <ul className="space-y-3 md:hidden">
            {filtered.map((l) => (
              <ListingCard key={l.id} listing={l} onReview={setSelectedId} />
            ))}
          </ul>
        </>
      )}

      {selected ? <ListingDetailPanel key={selected.id} listing={selected} onOpen={setSelectedId} onClose={() => setSelectedId(null)} /> : null}

      <PageFooter />
    </div>
  );
}
