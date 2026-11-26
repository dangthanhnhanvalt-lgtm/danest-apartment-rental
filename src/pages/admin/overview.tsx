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
    <div className="rounded-xl border border-border bg-card p-5" style={{ boxShadow: "var(--shadow-surface)" }}>
      <div className="flex items-start justify-between gap-3">
        <span className="flex size-10 items-center justify-center rounded-full bg-accent text-link">
          <tile.icon className="size-5" aria-hidden="true" />
        </span>
        <span className="text-2xl font-semibold text-foreground">{tile.value}</span>
      </div>
      <p className="mt-3 text-sm font-medium text-card-foreground">{t(tile.labelKey)}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{tile.note}</p>
    </div>
  );
}

export function OverviewPage() {
  const { t } = useI18n();
  const labels = useLabels();
  const { listings, users, reports, audit, settings, kpis, loading } = useAdmin();

  const tiles: Tile[] = [
    { labelKey: "admin.overview.tile.totalListings", value: listings.length, note: t("admin.overview.tile.totalListingsNote"), icon: Building2 },
    { labelKey: "admin.status.published", value: kpis.counts.published, note: t("admin.overview.tile.publishedNote"), icon: CheckCircle2 },
    { labelKey: "admin.status.pending", value: kpis.counts.pending, note: t("admin.overview.tile.pendingNote"), icon: Hourglass },
    { labelKey: "admin.status.rejected", value: kpis.counts.rejected, note: t("admin.overview.tile.rejectedNote"), icon: XCircle },
    { labelKey: "admin.status.needsAttention", value: kpis.counts["needs-attention"], note: t("admin.overview.tile.needsAttentionNote"), icon: AlertTriangle },
    { labelKey: "admin.overview.tile.requiringAttention", value: kpis.requiringAttention, note: t("admin.overview.tile.requiringAttentionNote"), icon: ClipboardList },
    { labelKey: "admin.overview.tile.registeredUsers", value: kpis.totalUsers, note: t("admin.overview.tile.suspendedCount", { count: users.filter((u) => u.status === "suspended").length }), icon: Users },
    { labelKey: "admin.overview.tile.rentalInquiries", value: kpis.inquiries, note: t("admin.overview.tile.rentalInquiriesNote"), icon: MessageSquare },
  ];

  const attention = listings
    .filter((l) => l.status === "pending" || l.status === "needs-attention" || l.status === "rejected")
    .slice(0, 5);

  const availabilityIssues = listings.filter((l) => {
    const state = availabilityStatus(l, settings).state;
    return state === "overdue" || state === "hidden";
  });

  const openReports = reports.filter((r) => r.status === "open").length;
  const recentAudit = audit.slice(0, 5);

  return (
    <div className="space-y-6">
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
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {tiles.map((tile) => (
              <KpiTile key={tile.labelKey} tile={tile} />
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
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
                  {t("admin.overview.availabilityRule", { days: settings.availabilityGraceDays })}
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
                          {t(AUDIT_ACTION_LABEL_KEY[entry.action])}
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

      <PageFooter />
    </div>
  );
}
