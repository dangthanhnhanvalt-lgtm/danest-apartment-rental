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
        "inline-flex items-center gap-1 max-w-full whitespace-normal rounded-full border px-2.5 py-0.5 text-xs font-medium",
        tone === "done" && "border-transparent bg-[#E9EFE9] text-[#365844]",
        tone === "neutral" && "border-transparent bg-[#F0EFEC] text-[#595952]",
        tone === "attention" && "border-transparent bg-[#F7EFE0] text-[#80581C]",
        tone === "danger" && "border-transparent bg-[#F5E7E5] text-[#994D48]",
        className,
      )}
    >
      <span className="size-1.5 shrink-0 rounded-full bg-current" aria-hidden="true"/>{children}
    </span>
  );
}

export function ListingStatusPill({ status }: { status: ListingStatus }) {
  const { t } = useI18n();
  return <Pill tone={listingStatusTone(status)}>{t(LISTING_STATUS_LABEL_KEY[status])}</Pill>;
}
