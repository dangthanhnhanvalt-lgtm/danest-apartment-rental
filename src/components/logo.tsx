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
          "flex size-9 items-center justify-center rounded-xl",
          variant === "inverse" ? "bg-primary-foreground text-primary" : "bg-primary text-primary-foreground",
        )}
      >
        <svg viewBox="0 0 24 24" className="size-5" fill="none" aria-hidden="true">
          <path d="M4 12.5 12 5.5l8 7V19h-5.5v-4.5h-5V19H4z" fill="currentColor" />
          <path d="M10.2 19v-3.4a1.8 1.8 0 0 1 3.6 0V19" stroke={variant === "inverse" ? "var(--primary)" : "var(--primary-foreground)"} strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      </span>
      <span className="flex flex-col leading-none">
        <span
          className={cn(
            "font-heading text-[1.4rem] font-semibold tracking-[0.06em]",
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
