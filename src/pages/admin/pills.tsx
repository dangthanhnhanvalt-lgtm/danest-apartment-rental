import type { ReactNode } from "react";
import { cn } from "~/lib/utils";
import type { ListingStatus } from "~/types";
import { LISTING_STATUS_LABEL_KEY, listingStatusTone } from "~/pages/admin/admin-helpers";
import { useI18n } from "~/i18n/language-context";
import type { PillTone } from "~/pages/admin/admin-helpers";

export function Pill({ tone, children, className }: { tone: PillTone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium",
        tone === "done" && "border-transparent bg-accent text-link",
        tone === "neutral" && "border-border bg-muted text-muted-foreground",
        tone === "attention" && "border-warning/20 bg-warning/10 text-warning",
        tone === "danger" && "border-destructive/20 bg-destructive/10 text-destructive",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function ListingStatusPill({ status }: { status: ListingStatus }) {
  const { t } = useI18n();
  return <Pill tone={listingStatusTone(status)}>{t(LISTING_STATUS_LABEL_KEY[status])}</Pill>;
}
