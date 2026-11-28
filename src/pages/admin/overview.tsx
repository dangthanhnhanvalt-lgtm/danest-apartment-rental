import {
  AlertTriangle,
  Building2,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  Flag,
  Hourglass,
  MessageSquare,
  ShieldCheck,
  Users,
  XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Link } from "~/lib/router";
import { useAdmin } from "~/state/admin-state";
import { availabilityStatus } from "~/lib/availability";

import { formatDate } from "~/lib/format";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardTitle,
  EmptyState,
  LoadingRows,
  PageFooter,
  PageHeader,
} from "~/pages/admin/shared";
import {
  AUDIT_ACTION_LABEL_KEY,
  auditActionTone,
  auditToneClass,
} from "~/pages/admin/admin-helpers";
import { ListingStatusPill } from "~/pages/admin/pills";
import { useI18n } from "~/i18n/language-context";
import { ListingDistribution } from "~/components/dashboard-visuals";
import { useLabels } from "~/i18n/use-labels";

interface Tile {
  labelKey: string;
  value: number;
  note: string;
  icon: LucideIcon;
}

function KpiTile({ tile }: { tile: Tile }) {
  const { t } = useI18n();
  return (
    <div className="danest-admin-kpi rounded-2xl border border-border bg-card p-4 sm:p-5" style={{ boxShadow: "var(--shadow-surface)" }}>
      <div className="flex items-start justify-between gap-3">
        <span className="flex size-10 items-center justify-center rounded-full bg-accent text-link">
          <tile.icon className="size-5" aria-hidden="true" />
        </span>
        <span className="text-3xl font-semibold tabular-nums text-foreground">{tile.value}</span>
      </div>
      <p className="mt-3 text-sm font-medium text-card-foreground">{t(tile.labelKey)}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{tile.note}</p>
    </div>
  );
}

export function OverviewPage() {
  const { t, pick } = useI18n();
  const labels = useLabels();
  const { listings, users, reports, audit, settings, kpis, loading, usersError } = useAdmin();

  if(!kpis) return <LoadingRows rows={2}/>;
  const realListings=listings.filter(l=>!l.isSample);
  const tiles: Tile[] = [
    { labelKey: "admin.overview.tile.totalListings", value: Object.values(kpis.counts).reduce((a,b)=>a+b,0), note: t("admin.overview.tile.totalListingsNote"), icon: Building2 },
    { labelKey: "admin.status.published", value: kpis.counts.published, note: t("admin.overview.tile.publishedNote"), icon: CheckCircle2 },
    { labelKey: "admin.status.pending", value: kpis.counts.pending, note: t("admin.overview.tile.pendingNote"), icon: Hourglass },
    { labelKey: "admin.status.rejected", value: kpis.counts.rejected, note: t("admin.overview.tile.rejectedNote"), icon: XCircle },
    { labelKey: "admin.status.needsAttention", value: kpis.counts["needs-attention"], note: t("admin.overview.tile.needsAttentionNote"), icon: AlertTriangle },
    { labelKey: "admin.overview.tile.requiringAttention", value: kpis.requiringAttention, note: t("admin.overview.tile.requiringAttentionNote"), icon: ClipboardList },
    { labelKey: "admin.overview.tile.registeredUsers", value: kpis.totalUsers, note: usersError ? pick("Account breakdown unavailable","Chưa tải được phân loại tài khoản") : t("admin.overview.tile.suspendedCount", { count: users.filter((u) => !u.isSample && u.status === "suspended").length }), icon: Users },
    { labelKey: "admin.overview.tile.rentalInquiries", value: kpis.inquiries, note: t("admin.overview.tile.rentalInquiriesNote"), icon: MessageSquare },
  ];

  const attention = realListings
    .filter((l) => l.status === "pending" || l.status === "needs-attention" || l.status === "rejected")
    .slice(0, 5);

  const availabilityIssues = realListings.filter((l) => {
    const state = availabilityStatus(l, settings).state;
    return (l.status === "published" && state === "overdue") || state === "hidden";
  });

  const openReports = reports.filter((r) => r.status === "open").length;
  const recentAudit = audit.slice(0, 5);

  return (
    <div className="danest-admin-overview space-y-6">
      <PageHeader
        title={t("admin.overview.title")}
        description={t("admin.overview.description")}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link to="/admin/reports">{t("admin.overview.openReports")}</Link>
            </Button>
            <Button asChild>
              <Link to="/admin/listings">{t("admin.overview.reviewListings")}</Link>
            </Button>
          </>
        }
      />

      {loading ? (
        <LoadingRows rows={2} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {tiles.map((tile) => (
              <KpiTile key={tile.labelKey} tile={tile} />
            ))}
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(340px,1fr)]">
            <Card>
              <CardTitle>{pick("Listing status distribution", "Phân bố trạng thái tin đăng")}</CardTitle>
              <ListingDistribution counts={kpis.counts}/>
              <p className="mt-4 text-xs text-muted-foreground">{pick("Current snapshot; legacy demo data excluded.","Số liệu hiện trạng; không tính dữ liệu demo cũ.")}</p>
            </Card>
            <Card>
              <CardTitle>{pick("Listings by status", "Số lượng tin theo trạng thái")}</CardTitle>
              <div className="mt-6 space-y-4" role="img" aria-label={pick("Bar chart of listing counts by status", "Biểu đồ thanh số tin theo trạng thái")}>
                {([
                  {label:pick("Published","Đã đăng"),value:kpis.counts.published,color:"#087EBD"},
                  {label:pick("Pending review","Chờ duyệt"),value:kpis.counts.pending,color:"#20B7C8"},
                  {label:pick("Needs attention","Cần chỉnh sửa"),value:kpis.counts["needs-attention"],color:"#FFAD47"},
                  {label:pick("Draft","Bản nháp"),value:kpis.counts.draft,color:"#8CB5D2"},
                  {label:pick("Other statuses","Trạng thái khác"),value:kpis.counts.rejected+kpis.counts.hidden+kpis.counts.paused+kpis.counts.archived,color:"#627DA5"},
                ]).map(item=><div key={item.label} className="space-y-1.5"><div className="flex justify-between gap-3 text-sm"><span>{item.label}</span><strong className="tabular-nums">{item.value}</strong></div><div className="h-3 overflow-hidden rounded-full bg-[#E8F4FA]"><div className="h-full rounded-full transition-all" style={{width:`${item.value===0?0:Math.max(3,item.value/Math.max(1,...Object.values(kpis.counts))*100)}%`,background:item.color}}/></div></div>)}
              </div>
            </Card>
          </div>
          <Card>
            <CardTitle>{pick("Operational snapshot", "Tổng quan hoạt động")}</CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">{pick("Current totals, not a time-series trend.", "Số liệu tổng hiện tại, không phải xu hướng theo thời gian.")}</p>
            <div className="mt-5 grid gap-5 md:grid-cols-3">
              {[
                {label:pick("Rental inquiries","Yêu cầu thuê"),value:kpis.inquiries,color:"#087EBD"},
                {label:pick("Registered users","Người dùng"),value:kpis.totalUsers,color:"#20B7C8"},
                {label:pick("Open reports","Phản ánh đang mở"),value:openReports,color:"#627DA5"},
              ].map(item=><div key={item.label} className="rounded-xl border border-[#D9EAF2] bg-[#F7FCFF] p-4"><div className="text-xs font-medium text-[#587080]">{item.label}</div><div className="mt-2 text-3xl font-bold tabular-nums text-[#12334A]">{item.value}</div><div className="mt-4 h-2.5 overflow-hidden rounded-full bg-[#E2F1F8]"><div className="h-full rounded-full" style={{background:item.color,width:`${item.value===0?0:Math.max(4,item.value/Math.max(1,kpis.inquiries,kpis.totalUsers,openReports)*100)}%`}}/></div></div>)}
            </div>
          </Card>
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <div className="min-w-0 xl:col-span-2">
              <Card>
                <CardTitle
                  action={
                    <Link to="/admin/listings" className="text-sm font-medium text-link underline-offset-2 hover:underline">
                      {t("admin.overview.viewQueue")}
                    </Link>
                  }
                >
                  {t("admin.overview.needsAttention")}
                </CardTitle>
                {attention.length === 0 ? (
                  <div className="mt-4">
                    <EmptyState title={t("admin.overview.nothingWaiting")} description={t("admin.overview.nothingWaitingDesc")} />
                  </div>
                ) : (
                  <ul className="mt-4 divide-y divide-border">
                    {attention.map((l) => (
                      <li key={l.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{l.title}</p>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {l.landlord.displayName} · {labels.moderation[l.moderation.result]} · {t("admin.overview.listedOn", { date: formatDate(l.listedAt) })}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <ListingStatusPill status={l.status} />
                          <Button variant="outline" size="sm" asChild>
                            <Link to="/admin/listings">{t("admin.overview.review")}</Link>
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>

            <div className="space-y-4">
              <Card>
                <CardTitle>{t("admin.overview.availabilityHealth")}</CardTitle>
                <p className="mt-3 text-2xl font-semibold text-foreground">{availabilityIssues.length}</p>
                <p className="text-xs text-muted-foreground">{t("admin.overview.availabilityIssuesNote")}</p>
                <p className="mt-3 flex items-start gap-2 text-sm text-muted-foreground">
                  <CalendarClock className="mt-0.5 size-4 shrink-0 text-link" aria-hidden="true" />
                  {t("admin.overview.availabilityRule", { days: settings.availabilityGraceDays, reminder:settings.availabilityReminderDays })}
                </p>
                <Button variant="outline" size="sm" className="mt-4" asChild>
                  <Link to="/admin/settings">{t("admin.overview.adjustRules")}</Link>
                </Button>
              </Card>

              <Card>
                <CardTitle>{t("admin.overview.openReports")}</CardTitle>
                <p className="mt-3 text-2xl font-semibold text-foreground">{openReports}</p>
                <p className="text-xs text-muted-foreground">{t("admin.overview.openReportsNote")}</p>
                <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                  <Flag className="size-4 shrink-0 text-link" aria-hidden="true" />
                  {t("admin.overview.totalReports", { count: reports.length })}
                </p>
                <Button variant="outline" size="sm" className="mt-4" asChild>
                  <Link to="/admin/reports">{t("admin.overview.reviewReports")}</Link>
                </Button>
              </Card>
            </div>
          </div>

          <Card>
            <CardTitle
              action={
                <Link to="/admin/audit" className="text-sm font-medium text-link underline-offset-2 hover:underline">
                  {t("admin.overview.fullLog")}
                </Link>
              }
            >
              {t("admin.overview.recentAudit")}
            </CardTitle>
            {recentAudit.length === 0 ? (
              <div className="mt-4">
                <EmptyState title={t("admin.overview.noActivity")} description={t("admin.overview.noActivityDesc")} />
              </div>
            ) : (
              <ul className="mt-4 divide-y divide-border">
                {recentAudit.map((entry) => (
                  <li key={entry.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm text-foreground">
                        <span className={`font-medium ${auditToneClass(auditActionTone(entry.action))}`}>
                          {AUDIT_ACTION_LABEL_KEY[entry.action] ? t(AUDIT_ACTION_LABEL_KEY[entry.action]) : entry.action}
                        </span>{" "}
                        <span className="text-muted-foreground">{t("admin.overview.on")}</span> <span className="font-medium">{entry.target}</span>
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {entry.actor} · {entry.reason}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">{formatDate(entry.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}

      <p className="flex items-center gap-2 rounded-xl border border-border bg-muted px-4 py-3 text-xs text-muted-foreground">
        <ShieldCheck className="size-4 shrink-0 text-link" aria-hidden="true" />
        {t("admin.overview.automatedNote")}
      </p>

      <p className="text-xs text-muted-foreground">{pick("Listing and account KPIs exclude demo data; recent audit and reports show database records.","KPI tin đăng và tài khoản không tính dữ liệu demo; nhật ký và phản ánh hiển thị bản ghi database.")}</p><PageFooter />
    </div>
  );
}
