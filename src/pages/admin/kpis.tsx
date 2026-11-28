import { ClipboardCheck, Gauge, MessageSquare, ShieldCheck, Timer, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ListingDistribution } from "~/components/dashboard-visuals";
import { ListingPeriodReportPanel } from "~/components/listing-period-report";
import { Button } from "~/components/ui/button";
import { snapshotCsv } from "~/lib/advanced-reporting";
import { downloadCsv } from "~/lib/reporting";
import { AdminPeriodReport } from "~/components/admin-period-report";
import { useAdmin } from "~/state/admin-state";
import {
  Card,
  CardTitle,
  LoadingRows,
  PageFooter,
  PageHeader,
} from "~/pages/admin/shared";
import { useI18n } from "~/i18n/language-context";

interface Headline {
  labelKey: string;
  value: string;
  caption: string;
  icon: LucideIcon;
}

export function KpisPage() {
  const { t, pick } = useI18n();
  const { kpis, users, loading, usersError, refresh, loadError } = useAdmin();

  if (!kpis) return loadError ? <div role="alert" className="space-y-3"><p className="text-destructive">{loadError}</p><Button onClick={()=>void refresh().catch(()=>{})}>{pick("Retry","Thử lại")}</Button></div> : <LoadingRows rows={3} />;
  const pct=(n:number|null)=>n===null?"—":`${n}%`;


  const accountCounts=usersError?null:{landlords:users.filter(u=>!u.isSample&&u.role==="landlord").length,renters:users.filter(u=>!u.isSample&&u.role==="tenant").length};
  const headlines: Headline[] = [
      { labelKey: "admin.kpis.activeListings", value: String(kpis.activeListings), caption: t("admin.kpis.activeListingsCaption"), icon: ClipboardCheck },
      { labelKey: "admin.kpis.completeInfo", value: pct(kpis.completePercent), caption: t("admin.kpis.completeInfoCaption", { count: kpis.activeListings }), icon: Gauge },
      { labelKey: "admin.kpis.verifiedListings", value: pct(kpis.verifiedPercent), caption: t("admin.kpis.verifiedCaption"), icon: ShieldCheck },
      { labelKey: "admin.kpis.inquiries", value: String(kpis.inquiries), caption: t("admin.kpis.inquiriesCaption"), icon: MessageSquare },
      {
        labelKey: "admin.kpis.avgResponse",
        value: kpis.averageFirstResponseHours === null ? t("admin.kpis.notEnoughData") : `${kpis.averageFirstResponseHours} h`,
        caption: kpis.averageFirstResponseHours === null ? t("admin.kpis.noAnswered") : t("admin.kpis.replyCaption"),
        icon: Timer,
      },
      {labelKey:pick("Median first response","Trung vị thời gian phản hồi"),value:kpis.medianFirstResponseHours===null?"—":`${kpis.medianFirstResponseHours} h`,caption:pick("Actual first response timestamps","Thời điểm phản hồi thực"),icon:Timer},
      {labelKey:pick("Response within 24 hours","Phản hồi trong 24 giờ"),value:pct(kpis.responseWithin24HoursPercent),caption:pick(`${kpis.responseWithin24HoursDenominator} eligible inquiries`,`${kpis.responseWithin24HoursDenominator} yêu cầu đủ điều kiện tính`),icon:Timer},
      {labelKey:pick("Viewing conversion","Tỷ lệ hẹn xem"),value:pct(kpis.viewingConversionPercent),caption:pick("Inquiries with a confirmed viewing in history","Yêu cầu từng xác nhận lịch xem"),icon:Gauge},
      {labelKey:pick("Overdue availability","Tin quá hạn xác nhận"),value:pct(kpis.overduePercent),caption:pick(`${kpis.overdueListings} overdue; ${kpis.unknownConfirmationListings} without confirmation date`,`${kpis.overdueListings} quá hạn; ${kpis.unknownConfirmationListings} chưa có ngày xác nhận`),icon:Gauge},
      {labelKey:pick("Sponsored listings","Tin nổi bật"),value:String(kpis.sponsoredListings),caption:pick("Currently eligible campaigns","Chiến dịch đang đủ điều kiện"),icon:ClipboardCheck},
      {labelKey:pick("Unanswered after 24h","Chưa phản hồi sau 24 giờ"),value:String(kpis.awaitingResponse24Hours),caption:pick("New inquiries still awaiting reply","Yêu cầu mới chưa được phản hồi"),icon:MessageSquare},
    ];


  return (
    <div className="space-y-6">
      <PageHeader
        title={t("admin.kpis.title")}
        description={t("admin.kpis.description")}
      />

      <div className="flex flex-wrap items-center gap-3"><Button variant="outline" onClick={()=>void refresh().catch(()=>{})}>{pick("Refresh snapshot","Làm mới KPI hiện trạng")}</Button><Button variant="outline" disabled={loading} onClick={()=>downloadCsv(`danest-kpi-snapshot-${kpis.asOf.slice(0,10)}.csv`,snapshotCsv(kpis,accountCounts))}>{pick("Export KPI snapshot CSV","Xuất CSV toàn bộ KPI hiện trạng")}</Button><span className="text-xs text-muted-foreground">{pick("Exports the displayed snapshot, not a fresh query. Period reports have separate exports.","Xuất đúng ảnh chụp số liệu đang hiển thị, không truy vấn lại. Báo cáo theo kỳ có nút xuất riêng.")}</span></div>
      {loading ? (
        <LoadingRows rows={3} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {headlines.map((h) => (
              <div key={h.labelKey} className="rounded-2xl border border-border bg-card p-4 sm:p-5" style={{ boxShadow: "var(--shadow-surface)" }}>
                <div className="flex items-start justify-between gap-3">
                  <span className="flex size-10 items-center justify-center rounded-full bg-accent text-link">
                    <h.icon className="size-5" aria-hidden="true" />
                  </span>
                </div>
                <p className="mt-3 text-3xl font-semibold tabular-nums text-foreground">{h.value}</p>
                <p className="mt-0.5 text-sm font-medium text-card-foreground">{t(h.labelKey)}</p>
                <p className="mt-1 text-xs text-muted-foreground">{h.caption}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <Card>
                <CardTitle>{t("admin.kpis.byStatus")}</CardTitle>
                <ListingDistribution counts={kpis.counts}/>

              </Card>
            </div>

            <div className="space-y-4">
              <Card>
                <CardTitle>{t("admin.kpis.registeredUsers")}</CardTitle>
                <p className="mt-3 flex items-center gap-2 text-2xl font-semibold text-foreground">
                  <Users className="size-5 text-link" aria-hidden="true" />
                  {kpis.totalUsers}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {usersError ? pick("Account breakdown unavailable","Chưa tải được phân loại tài khoản") : t("admin.kpis.landlordsTenants", {
                    landlords: users.filter((u) => !u.isSample && u.role === "landlord").length,
                    tenants: users.filter((u) => !u.isSample && u.role === "tenant").length,
                  })}
                </p>
              </Card>

              <Card>
                <CardTitle>{t("admin.kpis.howComputed")}</CardTitle>
                <p className="mt-2 text-sm text-muted-foreground">{t("admin.kpis.howComputedText")}</p>
              </Card>
            </div>
          </div>
        </>
      )}

      <p className="text-xs text-muted-foreground">{pick("Demo listings excluded", "Không tính tin demo")}: {kpis.demoListings} · {new Date(kpis.asOf).toLocaleString()}</p>
      <AdminPeriodReport />
      <ListingPeriodReportPanel />
      <PageFooter />
    </div>
  );
}
