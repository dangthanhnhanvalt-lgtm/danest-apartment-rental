import { ArrowRight } from "lucide-react";
import { Link } from "~/lib/router";
import { useI18n } from "~/i18n/language-context";

export function LandlordCtaSection() {
  const { t } = useI18n();
  const facts = [
    { term: t("cta.1.term"), detail: t("cta.1.detail") },
    { term: t("cta.2.term"), detail: t("cta.2.detail") },
    { term: t("cta.3.term"), detail: t("cta.3.detail") },
    { term: t("cta.4.term"), detail: t("cta.4.detail") },
  ];
  return (
    <section className="bg-section-alt">
      <div className="mx-auto max-w-7xl px-4 py-10 md:px-6 md:py-14 lg:px-8">
        <div className="danest-landlord-cta relative overflow-hidden rounded-3xl bg-[#087EBD] text-white">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-white/10 blur-3xl"
          />
          <div className="grid grid-cols-1 items-center gap-10 p-8 md:p-12 lg:grid-cols-2 lg:p-16">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-white">
                {t("cta.eyebrow")}
              </p>
              <h2 className="mt-4 font-heading text-3xl font-semibold leading-[1.18] tracking-[-0.025em] text-white text-balance md:text-4xl lg:text-[44px]">
                {t("cta.title")}
              </h2>
              <p className="mt-4 max-w-md text-sm leading-[1.75] text-white/90 md:text-[15px]">
                {t("cta.body")}
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/landlord/listings/new"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-white px-6 text-sm font-semibold text-[#087EBD] shadow-sm transition-[color,background-color,box-shadow] hover:bg-[#EAF8FB] hover:text-[#066995] hover:ring-2 hover:ring-white hover:ring-offset-2 hover:ring-offset-[#087EBD] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground"
                >
                  {t("cta.list")} <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
                <Link
                  to="/about"
                  className="inline-flex h-12 items-center justify-center rounded-lg border border-white/80 bg-transparent px-6 text-sm font-semibold text-white transition-colors hover:bg-[#EAF8FB] hover:text-[#066995] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground"
                >
                  {t("cta.learn")}
                </Link>
              </div>
            </div>

            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {facts.map((item) => (
                <div key={item.term} className="rounded-2xl border border-white/65 bg-white/[0.16] p-5 shadow-[0_8px_24px_rgba(0,52,91,0.12)] backdrop-blur-sm transition-colors hover:bg-white/[0.22]">
                  <dt className="text-[15px] font-semibold text-white">{item.term}</dt>
                  <dd className="mt-2 text-[13px] leading-[1.65] text-white/95">{item.detail}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>
    </section>
  );
}
