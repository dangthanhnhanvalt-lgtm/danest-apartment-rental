import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Building2,
  CalendarDays,
  Eye,
  MessageSquare,
} from "lucide-react";
import { mockInquiriesRepository } from "~/api";
import { LANDLORD_STATS } from "~/data/landlord";
import { formatDate, formatRent, todayISO } from "~/lib/format";
import { Link } from "~/lib/router";
import { useAppState } from "~/state/app-state";
import { useLandlordIdentity } from "~/pages/landlord/use-landlord-identity";
import { Skeleton } from "~/components/ui/skeleton";
import { AvailabilityBadge, VerificationBadge } from "~/components/ui/listing-card";
import { cn } from "~/lib/utils";
import { useI18n } from "~/i18n/language-context";
import type { Inquiry, Listing } from "~/types";

const numberFormat = new Intl.NumberFormat("en-US");

const inquiryStatusBadge: Record<Inquiry["status"], { labelKey: string; classes: string }> = {
  new: { labelKey: "landlord.status.new", classes: "border-warning/20 bg-warning/10 text-warning" },
  replied: { labelKey: "landlord.status.replied", classes: "border-transparent bg-accent text-link" },
  viewing_scheduled: { labelKey: "landlord.status.viewingScheduled", classes: "border-transparent bg-accent text-link" },
  rented: { labelKey: "landlord.status.rented", classes: "border-transparent bg-primary text-primary-foreground" },
  not_proceeding: { labelKey: "landlord.status.notProceeding", classes: "border-border bg-muted text-muted-foreground" },
};

const inquiryTypeLabel: Record<Inquiry["type"], string> = {
  "viewing-request": "landlord.type.viewingRequest",
  question: "landlord.type.question",
};

function StatusPill({ status }: { status: Inquiry["status"] }) {
  const { t } = useI18n();
  const tone = inquiryStatusBadge[status];
  return (
    <span className={cn("inline-flex whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium", tone.classes)}>
      {t(tone.labelKey)}
    </span>
  );
}

function TypePill({ type }: { type: Inquiry["type"] }) {
  const { t } = useI18n();
  return (
    <span className="inline-flex whitespace-nowrap rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
      {t(inquiryTypeLabel[type])}
    </span>
  );
}

function KpiTile({
  icon: Icon,
  value,
  label,
  note,
}: {
  icon: typeof Eye;
  value: string;
  label: string;
  note: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5" style={{ boxShadow: "var(--shadow-surface)" }}>
      <span className="flex size-10 items-center justify-center rounded-full bg-accent text-link">
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <p className="mt-4 text-2xl font-semibold text-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
      <p className="mt-2 text-xs text-muted-foreground">{note}</p>
    </div>
  );
}

function listingTitle(listings: Listing[], id: string, fallback: string): string {
  return listings.find((l) => l.id === id)?.title ?? fallback;
}

export function OverviewPage() {
  const { t } = useI18n();
  const { listings } = useAppState();
  const landlord = useLandlordIdentity();
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const ownedListingIds = listings.filter((l) => l.landlordId === landlord.id).map((l) => l.id);
    mockInquiriesRepository
      .listForLandlord(landlord.id, ownedListingIds)
      .then((items) => {
        if (active) setInquiries(items);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [landlord.id, listings]);

  const landlordListings = useMemo(
    () => listings.filter((l) => l.landlordId === landlord.id),
    [listings, landlord.id],
  );

  const activeListings = landlordListings.filter((l) => l.status === "published").length;
  const newInquiries = inquiries.filter((i) => i.status === "new").length;

  const today = todayISO();
  const nextViewing = useMemo(() => {
    const upcoming = inquiries
      .filter((i) => i.scheduledAt && i.scheduledAt >= today && (i.status === "viewing_scheduled" || i.status === "new"))
      .map((i) => i.scheduledAt as string)
      .sort();
    return upcoming[0] ?? null;
  }, [inquiries, today]);

  const recentInquiries = useMemo(
    () => [...inquiries].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 3),
    [inquiries],
  );

  const recentListings = landlordListings.slice(0, 3);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{t("landlord.overview.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {landlord.displayName} · {t("landlord.overview.privateLandlord")}
          </p>
        </div>
        <Link
          to="/landlord/listings/new"
          className="inline-flex h-11 items-center justify-center gap-2 self-start rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:self-auto"
        >
          {t("landlord.overview.addListing")}
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile
          icon={Building2}
          value={String(activeListings)}
          label={t("landlord.overview.kpiActive")}
          note={t("landlord.overview.kpiActiveNote", { count: landlordListings.length })}
        />
        <KpiTile
          icon={Eye}
          value={numberFormat.format(LANDLORD_STATS.propertyViews)}
          label={t("landlord.overview.kpiViews")}
          note={t("landlord.overview.kpiViewsNote")}
        />
        <KpiTile
          icon={MessageSquare}
          value={loading ? "—" : String(inquiries.length)}
          label={t("landlord.overview.kpiInquiries")}
          note={loading ? t("landlord.overview.kpiInquiriesLoading") : t("landlord.overview.kpiInquiriesNote", { count: newInquiries })}
        />
        <KpiTile
          icon={CalendarDays}
          value={String(LANDLORD_STATS.upcomingViewings)}
          label={t("landlord.overview.kpiUpcoming")}
          note={nextViewing ? t("landlord.overview.kpiNext", { date: formatDate(nextViewing) }) : t("landlord.overview.kpiNoViewings")}
        />
      </div>

      <section
        className="rounded-xl border border-border bg-card p-5"
        style={{ boxShadow: "var(--shadow-surface)" }}
        aria-labelledby="recent-inquiries-heading"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 id="recent-inquiries-heading" className="text-base font-semibold text-card-foreground">
            {t("landlord.overview.recentInquiries")}
          </h2>
          <Link
            to="/landlord/requests"
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-sm font-medium text-link transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t("landlord.overview.viewAllRequests")} <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </div>

        {loading ? (
          <div className="mt-4 space-y-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : recentInquiries.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            {t("landlord.overview.noInquiries")}
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th scope="col" className="pb-2 pr-4 font-medium">{t("landlord.overview.thTenant")}</th>
                  <th scope="col" className="pb-2 pr-4 font-medium">{t("landlord.overview.thListing")}</th>
                  <th scope="col" className="pb-2 pr-4 font-medium">{t("landlord.overview.thType")}</th>
                  <th scope="col" className="pb-2 pr-4 font-medium">{t("landlord.overview.thStatus")}</th>
                  <th scope="col" className="pb-2 font-medium">{t("landlord.overview.thReceived")}</th>
                </tr>
              </thead>
              <tbody>
                {recentInquiries.map((inq) => (
                  <tr key={inq.id} className="border-b border-border/60 last:border-0">
                    <td className="py-3 pr-4 font-medium text-foreground">{inq.tenantName}</td>
                    <td className="py-3 pr-4 text-muted-foreground">{listingTitle(listings, inq.listingId, t("landlord.listing.unavailable"))}</td>
                    <td className="py-3 pr-4"><TypePill type={inq.type} /></td>
                    <td className="py-3 pr-4"><StatusPill status={inq.status} /></td>
                    <td className="py-3 text-muted-foreground">{formatDate(inq.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section
        className="rounded-xl border border-border bg-card p-5"
        style={{ boxShadow: "var(--shadow-surface)" }}
        aria-labelledby="your-listings-heading"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 id="your-listings-heading" className="text-base font-semibold text-card-foreground">
            {t("landlord.overview.yourListings")}
          </h2>
          <Link
            to="/landlord/listings"
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-sm font-medium text-link transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t("landlord.overview.manage")} <ArrowRight className="size-3.5" aria-hidden="true" />
          </Link>
        </div>

        {recentListings.length === 0 ? (
          <p className="mt-4 rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            {t("landlord.overview.noListings")}
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-border">
            {recentListings.map((listing) => (
              <li key={listing.id} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0 sm:flex-row sm:items-center">
                <img
                  src={listing.images[0]}
                  alt={listing.title}
                  className="h-16 w-24 shrink-0 rounded-lg object-cover"
                  loading="lazy"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{listing.title}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{formatRent(listing.monthlyRent)}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <AvailabilityBadge availability={listing.availability} />
                    <VerificationBadge verified={listing.verificationBadge} />
                  </div>
                </div>
                <Link
                  to="/landlord/listings"
                  className="inline-flex h-9 shrink-0 items-center justify-center rounded-lg border border-input px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={t("landlord.overview.manageAria", { title: listing.title })}
                >
                  {t("landlord.overview.manage")}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div
        className="rounded-xl border border-border bg-muted p-4"
        style={{ boxShadow: "var(--shadow-surface)" }}
      >
        <p className="text-sm text-muted-foreground">
          {t("landlord.overview.prototypeNote")}
        </p>
      </div>
    </div>
  );
}
