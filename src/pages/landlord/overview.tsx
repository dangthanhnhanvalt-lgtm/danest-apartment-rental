import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Clock, AlertCircle,
  Building2,
  CalendarDays,
  Eye,
  MessageSquare,
} from "lucide-react";
import { readLandlordKpis, type LandlordKpiRow } from "~/api/admin";
import { readInquiries } from "~/api/backend/inquiries";
import { availabilityStatus } from "~/lib/availability";
import { formatDate, formatRent, todayISO } from "~/lib/format";
import { Link } from "~/lib/router";
import { useAppState } from "~/state/app-state";
import { useLandlordIdentity } from "~/pages/landlord/use-landlord-identity";
import { Skeleton } from "~/components/ui/skeleton";
import { AvailabilityBadge, VerificationBadge } from "~/components/ui/listing-card";
import { cn } from "~/lib/utils";
import { useI18n } from "~/i18n/language-context";
import type { Inquiry, Listing } from "~/types";


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
      <p className="mt-4 text-3xl font-semibold tabular-nums text-foreground">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
      <p className="mt-2 text-xs text-muted-foreground">{note}</p>
    </div>
  );
}

function listingTitle(listings: Listing[], id: string, fallback: string): string {
  return listings.find((l) => l.id === id)?.title ?? fallback;
}

export function OverviewPage() {
  const { t, pick } = useI18n();
  const { listings, listingsLoading } = useAppState();
  const landlord = useLandlordIdentity();
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [metrics,setMetrics]=useState<LandlordKpiRow[]|null>(null);
  const [metricsError,setMetricsError]=useState("");
  useEffect(()=>{let active=true;setMetrics(null);setMetricsError("");readLandlordKpis().then(r=>{if(active)setMetrics(r);}).catch(e=>{if(active)setMetricsError(e instanceof Error?e.message:String(e));});return()=>{active=false;};},[landlord.id,listings]);
  const [inquiryError,setInquiryError]=useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);setInquiryError("");
    readInquiries()
      .then((items) => {
        if (active) setInquiries(items);
      })
      .catch((err) => { if (active) {setInquiries([]);setInquiryError(err instanceof Error?err.message:String(err));} })
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
  const topViews=(metrics??[]).filter(m=>m.views!==null).slice().sort((a,b)=>(b.views??0)-(a.views??0)).slice(0,5);
  const viewMax=Math.max(1,...topViews.map(m=>m.views??0));
  const needsAttention=landlordListings.filter(l=>l.status==="needs-attention"||l.status==="rejected").length;
  const needsConfirmation=landlordListings.filter(l=>(l.status==="published"&&availabilityStatus(l).state==="overdue")||Boolean(l.availabilityHiddenAt)).length;

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
          value={listingsLoading?"—":String(activeListings)}
          label={t("landlord.overview.kpiActive")}
          note={t("landlord.overview.kpiActiveNote", { count: landlordListings.length })}
        />
        <KpiTile
          icon={Eye}
          value={metrics===null||metrics.some(m=>m.views===null)?"—":String(metrics.reduce((sum,m)=>sum+(m.views??0),0))}
          label={t("landlord.overview.kpiViews")}
          note={pick("Detail views since tracking began; demo excluded.","Lượt mở chi tiết từ khi bắt đầu đo; không tính demo.")}
        />
        <KpiTile
          icon={MessageSquare}
          value={loading || inquiryError ? "—" : String(inquiries.length)}
          label={t("landlord.overview.kpiInquiries")}
          note={loading ? t("landlord.overview.kpiInquiriesLoading") : t("landlord.overview.kpiInquiriesNote", { count: newInquiries })}
        />
        <KpiTile
          icon={CalendarDays}
          value={loading || inquiryError ? "—" : String(inquiries.filter(i => i.status === "viewing_scheduled" && i.scheduledAt && new Date(i.scheduledAt) > new Date()).length)}
          label={t("landlord.overview.kpiUpcoming")}
          note={nextViewing ? t("landlord.overview.kpiNext", { date: formatDate(nextViewing) }) : t("landlord.overview.kpiNoViewings")}
        />
      </div>

      <section className="rounded-2xl border border-border bg-card p-4 sm:p-6" aria-labelledby="action-center"><h2 id="action-center" className="font-heading text-2xl">{pick("Your action center","Việc cần thực hiện")}</h2><p className="mt-1 text-sm text-muted-foreground">{pick("Priorities from your current listings and requests.","Công việc ưu tiên từ tin đăng và yêu cầu hiện tại.")}</p><div className="mt-4 grid gap-3 md:grid-cols-3">{[
        {Icon:MessageSquare,label:pick("New requests","Yêu cầu mới"),value:loading||inquiryError?"—":String(newInquiries),to:"/landlord/requests"},
        {Icon:Clock,label:pick("Availability follow-up","Cần xác nhận tình trạng"),value:listingsLoading?"—":String(needsConfirmation),to:"/landlord/listings"},
        {Icon:AlertCircle,label:pick("Listings needing attention","Tin cần xử lý"),value:listingsLoading?"—":String(needsAttention),to:"/landlord/listings"},
      ].map(({Icon,label,value,to})=><Link key={label} to={to} className="flex min-w-0 items-center gap-3 rounded-xl bg-muted/60 p-3 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"><span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#E9EFE9] text-[#365844]"><Icon className="size-5" aria-hidden="true"/></span><span className="min-w-0 flex-1 text-sm">{label}</span><span className="text-lg font-semibold tabular-nums">{value}</span><ArrowRight className="size-4 shrink-0" aria-hidden="true"/></Link>)}</div></section>
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

        {inquiryError ? <p role="alert" className="mt-3 text-sm text-destructive">{inquiryError}</p> : loading ? (
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

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="font-semibold">{pick("Performance by listing","Hiệu quả từng tin đăng")}</h2>
        {!metricsError&&topViews.length>0&&<section className="mt-4 space-y-3 rounded-xl bg-muted/40 p-4" aria-label={pick("Most viewed listings","Tin có nhiều lượt xem nhất")}><h3 className="text-sm font-semibold">{pick("Most viewed listings","Tin có nhiều lượt xem nhất")}</h3><p className="text-xs text-muted-foreground">{pick("Up to five listings with known counts since tracking began.","Tối đa 5 tin có số lượt xem đã biết kể từ khi bắt đầu đo.")}</p>{topViews.map(m=><div key={m.listing_id} className="space-y-1.5"><div className="flex items-baseline justify-between gap-3 text-sm"><span className="min-w-0 break-words">{m.title}</span><span className="shrink-0 font-semibold tabular-nums">{m.views}</span></div><div aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-border"><div className="h-full rounded-full bg-[#829987]" style={{width:`${(m.views??0)/viewMax*100}%`}}/></div></div>)}</section>}
        {metricsError?<p role="alert" className="mt-3 text-sm text-destructive">{metricsError}</p>:metrics===null?<p className="mt-3 text-sm">{t("common.loading")}</p>:metrics.length===0?<p className="mt-3 text-sm">{pick("No owned listings","Chưa có tin đăng thuộc sở hữu")}</p>:<div className="mt-3 overflow-x-auto"><table className="w-full min-w-[500px] text-left text-sm"><thead><tr className="border-b border-border"><th className="p-2">{pick("Listing","Tin đăng")}</th><th>{pick("Views","Lượt xem")}</th><th>{pick("Inquiries","Yêu cầu")}</th><th>{pick("Confirmed viewings","Lịch xem đã xác nhận")}</th><th>{pick("Rented","Đã thuê")}</th></tr></thead><tbody>{metrics.map(m=><tr key={m.listing_id} className="border-b border-border"><td className="p-2">{m.title}</td><td>{m.views??"—"}</td><td>{m.inquiries}</td><td>{m.confirmedViewings}</td><td>{m.rented}</td></tr>)}</tbody></table></div>}
        <p className="mt-3 text-xs text-muted-foreground">{pick("Views since tracking began; other metrics are historical. Sample data excluded.","Lượt xem tính từ khi bắt đầu đo; các chỉ số khác tính theo lịch sử. Không tính dữ liệu mẫu.")}</p>
      </section>
    </div>
  );
}
