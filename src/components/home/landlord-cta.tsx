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
      <div className="mx-auto max-w-7xl px-4 py-16 md:px-6 md:py-20 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl bg-primary text-primary-foreground">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-24 -top-24 size-96 rounded-full bg-primary-foreground/10 blur-3xl"
          />
          <div className="grid grid-cols-1 items-center gap-10 p-8 md:p-12 lg:grid-cols-2 lg:p-16">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.2em] text-primary-foreground">
                {t("cta.eyebrow")}
              </p>
              <h2 className="mt-4 font-heading text-3xl font-medium leading-tight text-primary-foreground text-balance md:text-4xl lg:text-5xl">
                {t("cta.title")}
              </h2>
              <p className="mt-4 max-w-md text-base leading-relaxed text-primary-foreground md:text-lg">
                {t("cta.body")}
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  to="/landlord/listings/new"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-primary-foreground px-6 text-sm font-semibold text-primary shadow-sm transition-[color,background-color,box-shadow] hover:bg-primary-foreground hover:text-primary hover:ring-2 hover:ring-primary-foreground hover:ring-offset-2 hover:ring-offset-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground"
                >
                  {t("cta.list")} <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
                <Link
                  to="/about"
                  className="inline-flex h-12 items-center justify-center rounded-lg border border-primary-foreground bg-transparent px-6 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-foreground hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground"
                >
                  {t("cta.learn")}
                </Link>
              </div>
            </div>

            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {facts.map((item) => (
                <div key={item.term} className="rounded-2xl border border-primary-foreground p-4">
                  <dt className="text-sm font-semibold text-primary-foreground">{item.term}</dt>
                  <dd className="mt-1.5 text-sm leading-relaxed text-primary-foreground">{item.detail}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </div>
    </section>
  );
}
