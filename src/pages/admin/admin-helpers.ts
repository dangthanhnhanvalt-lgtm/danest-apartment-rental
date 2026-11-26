import { useCallback, useEffect } from "react";
import type { AuditLogEntry, ListingStatus, ModerationResult, Report } from "~/types";
export type PillTone = "done" | "neutral" | "attention" | "danger";

export const ADMIN_FOOTER_NOTE_KEY = "admin.footerNote";

export const LISTING_STATUS_LABEL_KEY: Record<ListingStatus, string> = {
  published: "admin.status.published",
  draft: "admin.status.draft",
  paused: "admin.status.paused",
  pending: "admin.status.pending",
  "needs-attention": "admin.status.needsAttention",
  rejected: "admin.status.rejected",
  hidden: "admin.status.hidden",
  archived: "admin.status.archived",
};

export const LISTING_STATUSES: ListingStatus[] = [
  "published",
  "pending",
  "needs-attention",
  "rejected",
  "hidden",
  "paused",
  "draft",
  "archived",
];

export function listingStatusTone(status: ListingStatus): PillTone {
  if (status === "published") return "done";
  if (status === "rejected" || status === "hidden") return "danger";
  if (status === "pending" || status === "needs-attention") return "attention";
  return "neutral";
}

export function moderationTone(result: ModerationResult): "success" | "warning" | "danger" | "muted" {
  if (result === "passed") return "success";
  if (result === "rejected") return "danger";
  if (result === "incomplete") return "muted";
  return "warning";
}

export function moderationTextClass(result: ModerationResult): string {
  const tone = moderationTone(result);
  if (tone === "success") return "text-success";
  if (tone === "danger") return "text-destructive";
  if (tone === "warning") return "text-warning";
  return "text-muted-foreground";
}

export const REPORT_STATUS_LABEL_KEY: Record<Report["status"], string> = {
  open: "admin.reportStatus.open",
  resolved: "admin.reportStatus.resolved",
  unresolved: "admin.reportStatus.unresolved",
};

export function reportStatusTone(status: Report["status"]): PillTone {
  if (status === "resolved") return "done";
  if (status === "unresolved") return "danger";
  return "attention";
}

export const REPORT_CATEGORY_LABEL_KEY: Record<Report["category"], string> = {
  inaccurate: "admin.reportCategory.inaccurate",
  "hidden-fees": "admin.reportCategory.hiddenFees",
  duplicate: "admin.reportCategory.duplicate",
  "misleading-photos": "admin.reportCategory.misleadingPhotos",
  other: "admin.reportCategory.other",
};

export const AUDIT_ACTION_LABEL_KEY: Record<AuditLogEntry["action"], string> = {
  "listing-approved": "admin.auditAction.listingApproved",
  "listing-rejected": "admin.auditAction.listingRejected",
  "listing-corrections-requested": "admin.auditAction.listingCorrectionsRequested",
  "listing-hidden": "admin.auditAction.listingHidden",
  "listing-restored": "admin.auditAction.listingRestored",
  "listing-submitted": "admin.auditAction.listingSubmitted",
  "listing-status-changed": "admin.auditAction.listingStatusChanged",
  "account-suspended": "admin.auditAction.accountSuspended",
  "account-activated": "admin.auditAction.accountActivated",
  "report-resolved": "admin.auditAction.reportResolved",
  "report-reopened": "admin.auditAction.reportReopened",
  "settings-updated": "admin.auditAction.settingsUpdated",
  "availability-reconfirmed": "admin.auditAction.availabilityReconfirmed",
};

export const MANUAL_REVIEW_DECISION_LABEL_KEY: Record<string, string> = {
  approved: "admin.reviewDecision.approved",
  rejected: "admin.reviewDecision.rejected",
  "corrections-requested": "admin.reviewDecision.correctionsRequested",
  hidden: "admin.reviewDecision.hidden",
  restored: "admin.reviewDecision.restored",
};

export function humaniseAction(action: string): string {
  return action.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase());
}

export const AUDIT_ACTIONS: AuditLogEntry["action"][] = [
  "listing-approved",
  "listing-rejected",
  "listing-corrections-requested",
  "listing-hidden",
  "listing-restored",
  "listing-submitted",
  "listing-status-changed",
  "account-suspended",
  "account-activated",
  "report-resolved",
  "report-reopened",
  "settings-updated",
  "availability-reconfirmed",
];

export function auditActionTone(action: AuditLogEntry["action"]): "success" | "danger" | "info" | "warning" | "muted" {
  if (action === "listing-approved" || action === "listing-restored" || action === "account-activated" || action === "report-resolved") return "success";
  if (action === "listing-rejected" || action === "listing-hidden" || action === "account-suspended") return "danger";
  if (action === "listing-corrections-requested" || action === "report-reopened") return "warning";
  if (action === "settings-updated" || action === "availability-reconfirmed") return "info";
  return "muted";
}

export function auditToneClass(tone: "success" | "danger" | "info" | "warning" | "muted"): string {
  if (tone === "success") return "text-success";
  if (tone === "danger") return "text-destructive";
  if (tone === "info") return "text-info";
  if (tone === "warning") return "text-warning";
  return "text-muted-foreground";
}

export const thClass = "px-4 py-3 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground";
export const tdClass = "px-4 py-3 text-sm text-foreground align-middle";

export function useEscape(active: boolean, onEscape: () => void) {
  const handler = useCallback(() => onEscape(), [onEscape]);
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") handler();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, handler]);
}
