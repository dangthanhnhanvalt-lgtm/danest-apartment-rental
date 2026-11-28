import { Inbox } from "lucide-react";
import type { ReactNode } from "react";
import { Skeleton } from "~/components/ui/skeleton";
import { ADMIN_FOOTER_NOTE_KEY } from "~/pages/admin/admin-helpers";
import { useI18n } from "~/i18n/language-context";
import { cn } from "~/lib/utils";

export function PageHeader({ title, description, actions }: { title: string; description: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-sans text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section className={cn("min-w-0 rounded-2xl border border-border bg-card p-4 sm:p-5", className)} style={{ boxShadow: "var(--shadow-surface)" }}>
      {children}
    </section>
  );
}

export function CardTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 className="font-sans text-base font-semibold text-card-foreground">{children}</h2>
      {action}
    </div>
  );
}

export function PageFooter() {
  const { t } = useI18n();
  return <p className="border-t border-border pt-4 text-xs text-muted-foreground">{t(ADMIN_FOOTER_NOTE_KEY)}</p>;
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-muted/40 px-4 py-10 text-center">
      <span className="mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-accent text-accent-foreground"><Inbox aria-hidden="true" className="size-5"/></span>
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description ? <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">{description}</p> : null}
    </div>
  );
}

export function LoadingRows({ rows = 4 }: { rows?: number }) {
  const { t } = useI18n();
  return (
    <div className="space-y-2" role="status" aria-busy="true" aria-label={t("common.loading")}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-14 w-full" />
      ))}
    </div>
  );
}
