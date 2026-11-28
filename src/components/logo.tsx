import { Link } from "~/lib/router";
import { cn } from "~/lib/utils";
import { useI18n } from "~/i18n/language-context";

export function Logo({ className, variant = "default" }: { className?: string; variant?: "default" | "inverse" }) {
  const { t } = useI18n();
  return (
    <Link
      to="/"
      className={cn("group inline-flex items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md", className)}
      aria-label={t("aria.logoHome")}
    >
      <span
        className={cn(
          "danest-brand-mark flex size-10 items-center justify-center rounded-[13px]",
          variant === "inverse" ? "bg-primary-foreground text-primary" : "bg-primary text-primary-foreground",
        )}
      >
        <svg viewBox="0 0 40 40" className="size-6" fill="none" aria-hidden="true">
          <path d="M6 21.5 20 9l14 12.5" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M10 20v11h20V20" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M16 31v-8.5a4 4 0 0 1 8 0V31" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
          <path d="M8 35c6-2 10-2 15 0 4 1.5 7 1.5 10-.2" stroke="#63E1EC" strokeWidth="2.6" strokeLinecap="round" />
        </svg>
      </span>
      <span className="flex flex-col leading-none">
        <span
          className={cn(
            "font-heading text-[1.65rem] font-semibold tracking-[0.025em]",
            variant === "inverse" ? "text-primary-foreground" : "text-foreground",
          )}
        >
          DaNest
        </span>
        <span
          className={cn(
            "mt-0.5 text-[0.625rem] font-medium uppercase tracking-[0.22em]",
            variant === "inverse" ? "text-primary-foreground" : "text-muted-foreground",
          )}
        >
          Da Nang
        </span>
      </span>
    </Link>
  );
}
