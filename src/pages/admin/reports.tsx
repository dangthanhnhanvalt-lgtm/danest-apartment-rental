import { useMemo, useState } from "react";
import { ChevronDown, Flag, ImageOff } from "lucide-react";
import type { Report } from "~/types";
import { formatDate, formatRent } from "~/lib/format";

import { useAdmin } from "~/state/admin-state";
import { useToast } from "~/components/ui/toast";
import { Button } from "~/components/ui/button";
import { Chip, Field, Textarea } from "~/components/ui/form";
import { cn } from "~/lib/utils";
import {
  Card,
  EmptyState,
  LoadingRows,
  PageFooter,
  PageHeader,
} from "~/pages/admin/shared";
import {
  moderationTextClass,
  REPORT_CATEGORY_LABEL_KEY,
  REPORT_STATUS_LABEL_KEY,
  reportStatusTone,
} from "~/pages/admin/admin-helpers";
import { ListingStatusPill, Pill } from "~/pages/admin/pills";
import { useI18n } from "~/i18n/language-context";
import { useLabels } from "~/i18n/use-labels";

type Filter = "all" | Report["status"];

const FILTERS: { key: Filter; labelKey: string }[] = [
  { key: "all", labelKey: "admin.all" },
  { key: "open", labelKey: "admin.reportStatus.open" },
  { key: "resolved", labelKey: "admin.reportStatus.resolved" },
  { key: "unresolved", labelKey: "admin.reportStatus.unresolved" },
];

export function ReportsPage() {
  const { t } = useI18n();
  const labels = useLabels();
  const { reports, listings, decide, updateReport, loading } = useAdmin();
  const { toast } = useToast();
  const [filter, setFilter] = useState<Filter>("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [noteFor, setNoteFor] = useState<{ id: string; status: "resolved" | "unresolved" } | null>(null);
  const [note, setNote] = useState(() => t("admin.reports.defaultNote"));
  const [busy, setBusy] = useState<string | null>(null);

  const counts = useMemo(
    () => ({
      open: reports.filter((r) => r.status === "open").length,
      resolved: reports.filter((r) => r.status === "resolved").length,
      unresolved: reports.filter((r) => r.status === "unresolved").length,
    }),
    [reports],
  );

  const filtered = filter === "all" ? reports : reports.filter((r) => r.status === filter);
  const listingById = (id: string) => listings.find((l) => l.id === id) ?? null;

  const startNote = (report: Report, status: "resolved" | "unresolved") => {
    setNoteFor({ id: report.id, status });
    setNote(t("admin.reports.defaultNote"));
  };

  const saveNote = async (report: Report, status: "resolved" | "unresolved") => {
    setBusy(report.id);
    try {
      await updateReport(report.id, { status, resolvedBy: "Admin (demo)", resolutionNote: note.trim() || t("admin.reports.defaultNote") });
      toast({
        title: status === "resolved" ? t("admin.reports.toastResolved") : t("admin.reports.toastUnresolved"),
        description: t("admin.reports.toastRecorded", { id: report.id }),
        tone: status === "resolved" ? "success" : "warning",
      });
      setNoteFor(null);
    } finally {
      setBusy(null);
    }
  };

  const hideListing = async (report: Report) => {
    setBusy(report.id);
    try {
      await decide(report.listingId, "hidden", `Hidden after report ${report.id}: ${report.message.slice(0, 80)}`, "listing-hidden");
      toast({ title: t("admin.reports.toastHidden"), description: t("admin.reports.toastHiddenDesc", { id: report.id }), tone: "warning" });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("admin.reports.title")}
        description={t("admin.reports.description")}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { labelKey: "admin.reportStatus.open", value: counts.open },
          { labelKey: "admin.reportStatus.resolved", value: counts.resolved },
          { labelKey: "admin.reportStatus.unresolved", value: counts.unresolved },
        ].map((s) => (
          <div key={s.labelKey} className="rounded-xl border border-border bg-card p-5" style={{ boxShadow: "var(--shadow-surface)" }}>
            <p className="text-xs text-muted-foreground">{t(s.labelKey)}</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Chip key={f.key} selected={filter === f.key} onClick={() => setFilter(f.key)}>
            {t(f.labelKey)} ({f.key === "all" ? reports.length : counts[f.key]})
          </Chip>
        ))}
      </div>

      {loading ? (
        <LoadingRows />
      ) : filtered.length === 0 ? (
        <EmptyState title={t("admin.reports.empty")} description={t("admin.reports.emptyDesc")} />
      ) : (
        <ul className="space-y-4">
          {filtered.map((report) => {
            const listing = listingById(report.listingId);
            const isOpen = expanded === report.id;
            const noting = noteFor?.id === report.id ? noteFor.status : null;
            return (
              <li key={report.id}>
                <Card>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Pill tone="neutral">{t(REPORT_CATEGORY_LABEL_KEY[report.category])}</Pill>
                        <Pill tone={reportStatusTone(report.status)}>{t(REPORT_STATUS_LABEL_KEY[report.status])}</Pill>
                        <span className="text-xs text-muted-foreground">{formatDate(report.createdAt)}</span>
                      </div>
                      <p className="mt-2 text-sm text-foreground">{report.message}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {report.reporterName} · {report.reporterEmail}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={() => setExpanded(isOpen ? null : report.id)} aria-expanded={isOpen}>
                        {t("admin.reports.viewListingDetails")}
                        <ChevronDown className={cn("size-4 transition-transform", isOpen && "rotate-180")} aria-hidden="true" />
                      </Button>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-col gap-3 rounded-lg border border-border bg-muted/40 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-center gap-3">
                      {listing ? (
                        <>
                          {listing.images[0] ? (
                            <img src={listing.images[0]} alt="" className="size-12 shrink-0 rounded-lg border border-border object-cover" loading="lazy" />
                          ) : (
                            <span className="flex size-12 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground" aria-hidden="true">
                              <ImageOff className="size-4" />
                            </span>
                          )}
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">{listing.title}</p>
                            <p className="truncate text-xs text-muted-foreground">{formatRent(listing.monthlyRent)}</p>
                          </div>
                          <ListingStatusPill status={listing.status} />
                        </>
                      ) : (
                        <p className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Flag className="size-4" aria-hidden="true" /> {t("admin.reports.notFound")}
                        </p>
                      )}
                    </div>
                    {listing && listing.status !== "hidden" ? (
                      <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => hideListing(report)} disabled={busy === report.id}>
                        {t("admin.reports.hideListing")}
                      </Button>
                    ) : null}
                  </div>

                  {isOpen && listing ? (
                    <div className="mt-3 rounded-lg border border-border p-3">
                      <h3 className="text-sm font-semibold text-foreground">{t("admin.reports.reportedListing")}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{listing.summary}</p>
                      <dl className="mt-2 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                        <div>
                          <dt className="text-xs text-muted-foreground">{t("admin.col.rent")}</dt>
                          <dd className="text-foreground">{formatRent(listing.monthlyRent)}</dd>
                        </div>
                        <div>
                          <dt className="text-xs text-muted-foreground">{t("admin.reports.moderationResult")}</dt>
                          <dd className={cn("font-medium", moderationTextClass(listing.moderation.result))}>{labels.moderation[listing.moderation.result]}</dd>
                        </div>
                      </dl>
                    </div>
                  ) : null}

                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => startNote(report, "resolved")}>{t("admin.reports.markResolved")}</Button>
                    <Button variant="outline" size="sm" onClick={() => startNote(report, "unresolved")}>{t("admin.reports.markUnresolved")}</Button>
                  </div>

                  {noting ? (
                    <div className="mt-3 rounded-lg border border-border p-3">
                      <Field
                        label={noting === "resolved" ? t("admin.reports.resolutionNote") : t("admin.reports.unresolvedNote")}
                        htmlFor={`note-${report.id}`}
                        hint={t("admin.reports.noteHint")}
                      >
                        <Textarea id={`note-${report.id}`} value={note} onChange={(e) => setNote(e.target.value)} />
                      </Field>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button size="sm" onClick={() => saveNote(report, noting)} disabled={busy === report.id}>{t("admin.reports.saveOutcome")}</Button>
                        <Button variant="ghost" size="sm" onClick={() => setNoteFor(null)} disabled={busy === report.id}>{t("common.cancel")}</Button>
                      </div>
                    </div>
                  ) : null}

                  {report.status !== "open" && report.resolutionNote ? (
                    <p className="mt-3 text-xs text-muted-foreground">
                      {report.resolvedBy ?? t("admin.reports.admin")} · {t(REPORT_STATUS_LABEL_KEY[report.status])}: {report.resolutionNote}
                    </p>
                  ) : null}
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <PageFooter />
    </div>
  );
}
