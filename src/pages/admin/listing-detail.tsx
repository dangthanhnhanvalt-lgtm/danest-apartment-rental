import { useState } from "react";
import { ShieldCheck, X } from "lucide-react";
import type { Listing } from "~/types";
import { availabilityStatus } from "~/lib/availability";
import { formatCostAmount, formatDate, formatRent, formatUSD, monthsBetweenLabel } from "~/lib/format";
import { useAdmin } from "~/state/admin-state";
import { useToast } from "~/components/ui/toast";
import { Button } from "~/components/ui/button";
import { Field, Textarea } from "~/components/ui/form";
import { cn } from "~/lib/utils";
import {
  MANUAL_REVIEW_DECISION_LABEL_KEY,
  moderationTextClass,
  useEscape,
} from "~/pages/admin/admin-helpers";
import { ListingStatusPill } from "~/pages/admin/pills";
import { useI18n } from "~/i18n/language-context";
import { useLabels } from "~/i18n/use-labels";

type ActionKey = "approve" | "corrections" | "reject" | "hide" | "restore";

const ACTIONS: { key: ActionKey; labelKey: string; descriptionKey: string; destructive?: boolean }[] = [
  { key: "approve", labelKey: "admin.approve", descriptionKey: "admin.detail.approveDesc" },
  { key: "corrections", labelKey: "admin.corrections", descriptionKey: "admin.detail.correctionsDesc" },
  { key: "reject", labelKey: "admin.reject", descriptionKey: "admin.detail.rejectDesc", destructive: true },
  { key: "hide", labelKey: "admin.detail.hideTemporarily", descriptionKey: "admin.detail.hideDesc", destructive: true },
  { key: "restore", labelKey: "admin.restore", descriptionKey: "admin.detail.restoreDesc" },
];

const MODERATION_DESCRIPTION_LABEL_KEY: Record<string, string> = {
  passed: "admin.moderationDescription.passed",
  "needs-attention": "admin.moderationDescription.needsAttention",
  rejected: "admin.moderationDescription.rejected",
  incomplete: "admin.moderationDescription.incomplete",
};

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm text-foreground">{value}</dd>
    </div>
  );
}

export function ListingDetailPanel({ listing, onClose }: { listing: Listing; onClose: () => void }) {
  const { t } = useI18n();
  const labels = useLabels();
  const { decide, verify, settings } = useAdmin();
  const { toast } = useToast();
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<ActionKey | null>(null);
  const [reverify, setReverify] = useState(false);
  const availability = availabilityStatus(listing, settings);
  const canRestore = listing.status === "hidden" || listing.status === "rejected" || listing.status === "paused" || listing.status === "pending";

  useEscape(true, onClose);

  const run = async (key: ActionKey) => {
    // G-rule: an Admin must not approve/act on a listing they own themselves.
    // No admin-owned listings exist today, but the guard makes the rule explicit
    // and would block a listing tagged with the reserved admin landlord id.
    if (listing.landlordId === "admin") {
      setError(t("admin.detail.errorOwnListing"));
      return;
    }
    if (reason.trim().length < 5) {
      setError(t("admin.detail.errorReasonMin"));
      return;
    }
    const map: Record<ActionKey, { status: Listing["status"]; action: Parameters<typeof decide>[3]; titleKey: string }> = {
      approve: { status: "published", action: "listing-approved", titleKey: "admin.detail.toast.approved" },
      corrections: { status: "needs-attention", action: "listing-corrections-requested", titleKey: "admin.detail.toast.corrections" },
      reject: { status: "rejected", action: "listing-rejected", titleKey: "admin.detail.toast.rejected" },
      hide: { status: "hidden", action: "listing-hidden", titleKey: "admin.detail.toast.hidden" },
      restore: { status: "published", action: "listing-restored", titleKey: "admin.detail.toast.restored" },
    };
    const entry = map[key];
    setError("");
    setBusy(true);
    try {
      await decide(listing.id, entry.status, reason.trim(), entry.action);
      toast({ title: t(entry.titleKey), description: t("admin.detail.toastRecorded", { title: listing.title }), tone: key === "reject" || key === "hide" ? "warning" : "success" });
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const toggleVerification = async () => {
    if (listing.landlordId === "admin") {
      setError(t("admin.detail.errorVerifyOwn"));
      return;
    }
    if (!reverify) {
      setReverify(true);
      return;
    }
    if (reason.trim().length < 5) {
      setError(t("admin.detail.errorVerifyReason"));
      return;
    }
    setBusy(true);
    try {
      await verify(listing.id, !listing.verificationBadge, reason.trim());
      toast({
        title: listing.verificationBadge ? t("admin.detail.toast.badgeRemoved") : t("admin.detail.toast.badgeSet"),
        description: t("admin.detail.toastRecordedAudit"),
        tone: "success",
      });
      setReverify(false);
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const cadenceLabel = (cadence: string) => (cadence === "monthly" ? t("admin.detail.perMonth") : t("admin.detail.oneTime"));

  return (
    <div className="fixed inset-0 z-[70] flex">
      <div className="absolute inset-0" style={{ backgroundColor: "var(--overlay-bg)" }} onClick={onClose} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="listing-detail-title"
        className="relative ml-auto flex h-full w-full max-w-xl flex-col border-l border-border bg-background"
        style={{ boxShadow: "var(--shadow-elevated)" }}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border p-5">
          <div className="min-w-0">
            <h2 id="listing-detail-title" className="text-lg font-semibold text-foreground">{listing.title}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {labels.neighborhood[listing.neighborhood]} · {listing.landlord.displayName}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={t("admin.detail.close")}
          >
            <X className="size-5" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto p-5">
          {listing.images.length > 0 ? (
            <div className="grid grid-cols-2 gap-2">
              {listing.images.slice(0, 3).map((src) => (
                <img key={src} src={src} alt={listing.title} className="h-24 w-full rounded-lg border border-border object-cover" loading="lazy" />
              ))}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-2">
            <ListingStatusPill status={listing.status} />
            <span className={cn("text-sm font-medium", moderationTextClass(listing.moderation.result))}>
              {labels.moderation[listing.moderation.result]}
            </span>
            {listing.moderation.duplicateRisk ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-warning/20 bg-warning/10 px-2.5 py-0.5 text-xs font-medium text-warning">
                {t("admin.listings.possibleDuplicate")}
              </span>
            ) : null}
            {listing.verificationBadge ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-transparent bg-accent px-2.5 py-0.5 text-xs font-medium text-link">
                <ShieldCheck className="size-3" aria-hidden="true" /> {t("admin.detail.verified")}
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                {t("admin.detail.notVerified")}
              </span>
            )}
          </div>

          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <DetailRow label={t("admin.detail.address")} value={listing.address} />
            <DetailRow label={t("admin.detail.type")} value={labels.listingType[listing.type]} />
            <DetailRow label={t("admin.detail.layout")} value={t("admin.detail.layoutValue", { bedrooms: listing.bedrooms, bathrooms: listing.bathrooms, area: listing.floorArea })} />
            <DetailRow label={t("admin.detail.furnishing")} value={labels.furnishing[listing.furnishing]} />
            <DetailRow label={t("admin.detail.availableFrom")} value={formatDate(listing.availableFrom)} />
            <DetailRow label={t("admin.detail.rentalDuration")} value={monthsBetweenLabel(...listing.rentalDurationMonths)} />
            <DetailRow label={t("admin.detail.monthlyRent")} value={formatRent(listing.monthlyRent)} />
            <DetailRow label={t("admin.detail.deposit")} value={t("admin.detail.depositValue", { amount: formatUSD(listing.costs.depositAmount), months: listing.costs.depositMonths })} />
          </dl>

          <div>
            <h3 className="text-sm font-semibold text-foreground">{t("admin.detail.costItems")}</h3>
            <ul className="mt-2 divide-y divide-border rounded-lg border border-border">
              {listing.costs.items.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <div>
                    <p className="text-foreground">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{cadenceLabel(item.cadence)} · {item.state}</p>
                  </div>
                  <span className="shrink-0 font-medium text-foreground">{formatCostAmount(item.amount)}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-foreground">{t("admin.detail.amenities")}</h3>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {listing.amenities.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("admin.detail.noneListed")}</p>
              ) : (
                listing.amenities.map((a) => (
                  <span key={a} className="rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs text-muted-foreground">
                    {labels.amenity[a]}
                  </span>
                ))
              )}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-foreground">{t("admin.detail.automatedChecks")}</h3>
            <p className="mt-1 text-xs text-muted-foreground">{t(MODERATION_DESCRIPTION_LABEL_KEY[listing.moderation.result])}</p>
            <ul className="mt-2 space-y-2">
              {listing.moderation.checks.map((check) => (
                <li key={check.id} className="rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-foreground">{check.label}</p>
                    <span className={cn("text-xs font-medium", moderationTextClass(check.result))}>{labels.moderation[check.result]}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{check.detail}</p>
                </li>
              ))}
            </ul>
          </div>

          {listing.moderation.reasons.length > 0 ? (
            <div>
              <h3 className="text-sm font-semibold text-foreground">{t("admin.detail.reasonsOnRecord")}</h3>
              <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                {listing.moderation.reasons.map((r, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-link" aria-hidden="true" />
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {listing.moderation.manualReview ? (
            <div className="rounded-lg border border-border bg-muted/50 p-3">
              <h3 className="text-sm font-semibold text-foreground">{t("admin.detail.lastManualReview")}</h3>
              <p className="mt-1 text-xs text-muted-foreground">
                {listing.moderation.manualReview.reviewedBy} · {formatDate(listing.moderation.manualReview.reviewedAt)} · {t(MANUAL_REVIEW_DECISION_LABEL_KEY[listing.moderation.manualReview.decision] ?? humaniseReview(listing.moderation.manualReview.decision))}
              </p>
              <p className="mt-1 text-sm text-foreground">{listing.moderation.manualReview.reason}</p>
            </div>
          ) : null}

          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <DetailRow label={t("admin.detail.lastAvailabilityConfirmed")} value={formatDate(listing.lastAvailabilityConfirmedAt)} />
            <DetailRow
              label={t("admin.detail.availabilityState")}
              value={availability.state === "hidden" ? t("admin.detail.availabilityHidden", { days: availability.hideAfterDays }) : availability.state === "overdue" ? t("admin.detail.availabilityOverdue", { days: availability.daysSinceConfirmed, left: availability.graceDaysLeft }) : t("admin.detail.withinReminder")}
            />
          </dl>

          <div className="rounded-lg border border-border p-3">
            <h3 className="text-sm font-semibold text-foreground">{t("admin.detail.verification")}</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("admin.detail.currentBadge", { state: listing.verificationBadge ? t("admin.detail.badgeSet") : t("admin.detail.badgeNotSet") })}
            </p>
            {reverify ? (
              <p className="mt-2 rounded-md border border-warning/20 bg-warning/10 p-2 text-xs text-warning">
                {t("admin.detail.verificationWarning")}
              </p>
            ) : null}
            <Button variant="outline" size="sm" className="mt-3" onClick={toggleVerification} disabled={busy}>
              {reverify ? (listing.verificationBadge ? t("admin.detail.confirmRemoval") : t("admin.detail.confirmBadge")) : listing.verificationBadge ? t("admin.detail.removeBadge") : t("admin.detail.markReviewed")}
            </Button>
          </div>
        </div>

        <div className="space-y-3 border-t border-border p-5">
          <Field
            label={t("admin.detail.reasonLabel")}
            htmlFor={`reason-${listing.id}`}
            error={error || undefined}
            hint={t("admin.detail.reasonHint")}
          >
            <Textarea id={`reason-${listing.id}`} value={reason} onChange={(e) => { setReason(e.target.value); if (error) setError(""); }} placeholder={t("admin.detail.reasonPlaceholder")} />
          </Field>
          <div className="flex flex-wrap gap-2">
            {ACTIONS.filter((a) => (a.key === "restore" ? canRestore : true)).map((a) =>
              a.destructive ? (
                confirm === a.key ? (
                  <div key={a.key} className="flex flex-1 items-center gap-2">
                    <span className="text-xs text-muted-foreground">{t(a.descriptionKey)}</span>
                    <Button variant="destructive" size="sm" onClick={() => run(a.key)} disabled={busy}>{t("common.confirm")}</Button>
                    <Button variant="ghost" size="sm" onClick={() => setConfirm(null)} disabled={busy}>{t("common.cancel")}</Button>
                  </div>
                ) : (
                  <Button key={a.key} variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => setConfirm(a.key)} disabled={busy}>
                    {t(a.labelKey)}
                  </Button>
                )
              ) : (
                <Button key={a.key} variant={a.key === "approve" ? "default" : "outline"} size="sm" onClick={() => run(a.key)} disabled={busy}>
                  {t(a.labelKey)}
                </Button>
              ),
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function humaniseReview(decision: string): string {
  return decision.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase());
}

