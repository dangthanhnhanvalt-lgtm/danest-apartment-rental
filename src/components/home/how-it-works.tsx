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
      <div className="mx-auto max-w-7xl px-4 py-16 md:px-6 md:py-24 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-link">{t("how.eyebrow")}</p>
          <h2 className="mt-3 font-heading text-3xl font-medium text-foreground text-balance md:text-4xl">
            {t("how.title")}
          </h2>
          <p className="mt-3 text-base text-muted-foreground md:text-lg">
            {t("how.subtitle")}
          </p>
        </div>

        <ol className="relative mt-12 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-6">
          {STEPS.map((step, i) => (
            <li key={step.title} className="relative">
              <div className="flex items-center gap-3">
                <span className="flex size-12 items-center justify-center rounded-xl border border-border bg-card text-link">
                  <step.icon className="size-6" aria-hidden="true" />
                </span>
                <span className="font-heading text-4xl font-medium text-border" aria-hidden="true">
                  0{i + 1}
                </span>
              </div>
              <h3 className="mt-4 font-heading text-xl font-semibold text-foreground">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
              {i < STEPS.length - 1 ? (
                <ArrowRight className="mt-4 hidden size-5 text-border lg:absolute lg:-right-4 lg:top-4 lg:block" aria-hidden="true" />
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
