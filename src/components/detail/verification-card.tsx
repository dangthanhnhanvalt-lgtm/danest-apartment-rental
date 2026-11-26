import { BadgeCheck, CircleDashed, Clock, ShieldCheck } from "lucide-react";
import { formatDate } from "~/lib/format";
import { useI18n } from "~/i18n/language-context";
import type { Verification, VerificationStatus } from "~/types";

const statusMeta: Record<VerificationStatus, { key: string; className: string; Icon: typeof BadgeCheck }> = {
  verified: { key: "verify.verified", className: "text-success", Icon: BadgeCheck },
  "in-review": { key: "verify.inReview", className: "text-warning", Icon: Clock },
  "not-started": { key: "verify.notStarted", className: "text-muted-foreground", Icon: CircleDashed },
};

export function VerificationCard({ verification }: { verification: Verification }) {
  const { t } = useI18n();
  const allVerified = verification.checks.every((c) => c.status === "verified");

  return (
    <section aria-labelledby="verification-title" className="rounded-2xl border border-border bg-card p-5 md:p-6" style={{ boxShadow: "var(--shadow-surface)" }}>
      <div className="flex items-center gap-2">
        <ShieldCheck className="size-5 text-link" aria-hidden="true" />
        <h2 id="verification-title" className="text-xl font-semibold text-foreground">
          {t("verify.title")}
        </h2>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        {t("verify.subtitle")}
      </p>
      <dl className="mt-3 grid grid-cols-1 gap-2 rounded-xl border border-border bg-muted p-3 text-xs sm:grid-cols-2">
        <div>
          <dt className="font-semibold text-foreground">{t("verify.landlordProvided")}</dt>
          <dd className="mt-0.5 text-muted-foreground">{t("verify.landlordProvidedDesc")}</dd>
        </div>
        <div>
          <dt className="font-semibold text-foreground">{t("verify.autoChecked")}</dt>
          <dd className="mt-0.5 text-muted-foreground">{t("verify.autoCheckedDesc")}</dd>
        </div>
        <div>
          <dt className="font-semibold text-foreground">{t("verify.reviewed")}</dt>
          <dd className="mt-0.5 text-muted-foreground">{t("verify.reviewedDesc")}</dd>
        </div>
        <div>
          <dt className="font-semibold text-foreground">{t("verify.notVerified")}</dt>
          <dd className="mt-0.5 text-muted-foreground">{t("verify.notVerifiedDesc")}</dd>
        </div>
      </dl>

      <ul className="mt-4 space-y-4">
        {verification.checks.map((check) => {
          const meta = statusMeta[check.status];
          const Icon = meta.Icon;
          return (
            <li key={check.id} className="flex gap-3">
              <Icon className={`mt-0.5 size-5 shrink-0 ${meta.className}`} aria-hidden="true" />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <p className="text-base font-medium text-foreground">{check.label}</p>
                  <span className={`text-xs font-semibold ${meta.className}`}>{t(meta.key)}</span>
                </div>
                <p className="mt-0.5 text-sm text-muted-foreground">{check.description}</p>
                {check.lastUpdated ? (
                  <p className="mt-0.5 text-xs text-muted-foreground">{t("verify.updated", { date: formatDate(check.lastUpdated) })}</p>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      {!allVerified ? (
        <p className="mt-4 rounded-xl border border-border bg-muted p-3 text-sm text-muted-foreground">
          {t("verify.incomplete")}
        </p>
      ) : null}

      <p className="mt-4 border-t border-border pt-3 text-sm text-muted-foreground">
        {t("verify.lastConfirmed", { date: formatDate(verification.lastAvailabilityConfirmed) })}
      </p>
    </section>
  );
}
