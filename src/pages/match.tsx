import "./match-theme.css";
import { MatchAssistant } from "~/components/match/assistant";
import { useI18n } from "~/i18n/language-context";

export function MatchPage() {
  const { t } = useI18n();
  return (
    <main className="danest-match-page min-h-screen bg-[#F5FBFF] text-[#12334A]">
      <div className="mx-auto max-w-7xl px-4 py-10 md:px-6 md:py-14 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#087EBD]">{t("match.eyebrow")}</p>
          <h1 className="mt-3 font-heading text-3xl font-medium leading-tight text-[#12334A] text-balance sm:text-4xl md:text-5xl">
            {t("match.heading")}
          </h1>
          <p className="mt-3 text-base text-[#557083] md:text-lg">
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
