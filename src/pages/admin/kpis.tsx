import { useMemo } from "react";
import { ClipboardCheck, Gauge, MessageSquare, ShieldCheck, Timer, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAdmin } from "~/state/admin-state";
import {
  Card,
  CardTitle,
  LoadingRows,
  PageFooter,
  PageHeader,
} from "~/pages/admin/shared";
import {
  LISTING_STATUSES,
  LISTING_STATUS_LABEL_KEY,
} from "~/pages/admin/admin-helpers";
import { useI18n } from "~/i18n/language-context";

interface Headline {
  labelKey: string;
  value: string;
  caption: string;
  icon: LucideIcon;
}

export function KpisPage() {
  const { t } = useI18n();
  const { kpis, listings, users, loading } = useAdmin();

  const total = listings.length || 1;


  const headlines: Headline[] = useMemo(
    () => [
      { labelKey: "admin.kpis.activeListings", value: String(kpis.activeListings), caption: t("admin.kpis.activeListingsCaption"), icon: ClipboardCheck },
      { labelKey: "admin.kpis.completeInfo", value: `${kpis.completePercent}%`, caption: t("admin.kpis.completeInfoCaption", { count: kpis.activeListings }), icon: Gauge },
      { labelKey: "admin.kpis.verifiedListings", value: `${kpis.verifiedPercent}%`, caption: t("admin.kpis.verifiedCaption"), icon: ShieldCheck },
      { labelKey: "admin.kpis.inquiries", value: String(kpis.inquiries), caption: t("admin.kpis.inquiriesCaption"), icon: MessageSquare },
      {
        labelKey: "admin.kpis.avgResponse",
        value: kpis.averageFirstResponseHours === null ? t("admin.kpis.notEnoughData") : `${kpis.averageFirstResponseHours} h`,
        caption: kpis.averageFirstResponseHours === null ? t("admin.kpis.noAnswered") : t("admin.kpis.replyCaption"),
        icon: Timer,
      },
    ],
    [kpis, t],
  );


  return (
    <div className="space-y-6">
      <PageHeader
        title={t("admin.kpis.title")}
        description={t("admin.kpis.description")}
      />

      {loading ? (
        <LoadingRows rows={3} />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {headlines.map((h) => (
              <div key={h.labelKey} className="rounded-xl border border-border bg-card p-5" style={{ boxShadow: "var(--shadow-surface)" }}>
                <div className="flex items-start justify-between gap-3">
                  <span className="flex size-10 items-center justify-center rounded-full bg-accent text-link">
                    <h.icon className="size-5" aria-hidden="true" />
                  </span>
                </div>
                <p className="mt-3 text-2xl font-semibold text-foreground">{h.value}</p>
                <p className="mt-0.5 text-sm font-medium text-card-foreground">{t(h.labelKey)}</p>
                <p className="mt-1 text-xs text-muted-foreground">{h.caption}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <Card>
                <CardTitle>{t("admin.kpis.byStatus")}</CardTitle>
                <ul className="mt-4 space-y-3">
                  {LISTING_STATUSES.map((status) => {
                    const count = kpis.counts[status];
                    const pct = Math.round((count / total) * 100);
                    return (
                      <li key={status}>
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span className="text-foreground">{t(LISTING_STATUS_LABEL_KEY[status])}</span>
                          <span className="text-muted-foreground">{count} · {pct}%</span>
                        </div>
                        <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
                          <div className="h-2 rounded-full bg-primary" style={{ width: `${pct}%` }} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
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
                  {t("admin.kpis.landlordsTenants", {
                    landlords: users.filter((u) => u.role === "landlord").length,
                    tenants: users.filter((u) => u.role === "tenant").length,
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

      <PageFooter />
    </div>
  );
}
