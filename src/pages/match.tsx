import { MatchAssistant } from "~/components/match/assistant";
import { useI18n } from "~/i18n/language-context";

export function MatchPage() {
  const { t } = useI18n();
  return (
    <main className="bg-background">
      <div className="mx-auto max-w-7xl px-4 py-10 md:px-6 md:py-14 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-link">{t("match.eyebrow")}</p>
          <h1 className="mt-3 font-heading text-3xl font-medium leading-tight text-foreground text-balance sm:text-4xl md:text-5xl">
            {t("match.heading")}
          </h1>
          <p className="mt-3 text-base text-muted-foreground md:text-lg">
            {t("match.intro")}
          </p>
        </div>
        <div className="mt-8">
          <MatchAssistant />
        </div>
      </div>
    </main>
  );
}
