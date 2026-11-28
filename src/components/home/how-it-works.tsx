import { ArrowRight, Handshake, House, MessagesSquare, Search } from "lucide-react";
import { Link } from "~/lib/router";
import { useI18n } from "~/i18n/language-context";

const STEP_DEFS = [
  { icon: Search, titleKey: "how.1.title", bodyKey: "how.1.body" },
  { icon: MessagesSquare, titleKey: "how.2.title", bodyKey: "how.2.body" },
  { icon: Handshake, titleKey: "how.3.title", bodyKey: "how.3.body" },
  { icon: House, titleKey: "how.4.title", bodyKey: "how.4.body" },
];

export function HowItWorksSection() {
  const { t } = useI18n();
  const STEPS = STEP_DEFS.map((d) => ({ icon: d.icon, title: t(d.titleKey), body: t(d.bodyKey) }));
  return (
    <section id="how-it-works" className="scroll-mt-24 bg-background">
      <div className="mx-auto max-w-7xl px-4 py-12 md:px-6 md:py-16 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-link">{t("how.eyebrow")}</p>
          <h2 className="mt-3 font-heading text-3xl font-medium text-foreground text-balance md:text-4xl">
            {t("how.title")}
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground md:text-[15px]">
            {t("how.subtitle")}
          </p>
        </div>

        <ol className="relative mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          {STEPS.map((step, i) => (
            <li key={step.title} className="danest-step-card relative rounded-2xl border border-[#C8E4F0] bg-white p-5 shadow-[0_8px_22px_rgba(8,126,189,0.07)] transition-all duration-200 hover:-translate-y-1 hover:border-[#087EBD]/50 hover:shadow-[0_14px_30px_rgba(8,126,189,0.12)]">
              <div className="flex items-center gap-3">
                <span className="flex size-12 items-center justify-center rounded-full bg-[#DFF5FC] text-[#087EBD]">
                  <step.icon className="size-6" aria-hidden="true" />
                </span>
                <span className="font-heading text-3xl font-semibold text-[#087EBD]" aria-hidden="true">
                  0{i + 1}
                </span>
              </div>
              <h3 className="mt-4 font-heading text-xl font-semibold text-foreground">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
              {i < STEPS.length - 1 ? (
                <ArrowRight className="pointer-events-none absolute left-[calc(100%+0.75rem)] top-1/2 z-20 hidden size-5 -translate-x-1/2 -translate-y-1/2 text-[#087EBD] lg:block" aria-hidden="true" />
              ) : null}
            </li>
          ))}
        </ol>

        <div className="mt-12 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            to="/search"
            className="inline-flex h-11 items-center rounded-lg bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t("how.startExploring")}
          </Link>
          <Link
            to="/match"
            className="inline-flex h-11 items-center rounded-lg border border-input bg-background px-6 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t("how.askAi")}
          </Link>
        </div>
      </div>
    </section>
  );
}
