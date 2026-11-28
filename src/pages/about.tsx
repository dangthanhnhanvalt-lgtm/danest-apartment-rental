import { BadgeCheck, Languages, Mail, MapPin, MessagesSquare, ReceiptText, ShieldCheck } from "lucide-react";
import { Link } from "~/lib/router";
import { Button } from "~/components/ui/button";
import { SampleDataNote } from "~/components/ui/listing-card";
import { useI18n } from "~/i18n/language-context";

const principles = [
  { icon: ShieldCheck, titleKey: "about.p1Title", bodyKey: "about.p1Body" },
  { icon: ReceiptText, titleKey: "about.p2Title", bodyKey: "about.p2Body" },
  { icon: MessagesSquare, titleKey: "about.p3Title", bodyKey: "about.p3Body" },
  { icon: Languages, titleKey: "about.p4Title", bodyKey: "about.p4Body" },
];

export function AboutPage() {
  const { t } = useI18n();
  return (
    <main className="danest-public-surface danest-about-page bg-white">
      <section className="danest-about-hero border-b border-border bg-white">
        <div className="mx-auto max-w-7xl px-4 py-16 md:px-6 md:py-20 lg:px-8">
          <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-link">{t("about.eyebrow")}</p>
              <h1 className="mt-4 font-heading text-4xl font-semibold leading-[1.14] tracking-tight text-foreground text-balance md:text-5xl lg:text-[3.5rem]">
                {t("about.heroTitle")}
                <br />
                <span className="danest-about-accent">{t("about.heroAccent")}</span>
              </h1>
              <p className="mt-5 max-w-xl text-sm leading-[1.85] text-muted-foreground md:text-[15px]">
                {t("about.heroDesc")}
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button size="lg" asChild>
                  <Link to="/search">{t("common.exploreApartments")}</Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link to="/landlord/listings/new">{t("common.listProperty")}</Link>
                </Button>
              </div>
            </div>
            <div className="danest-about-photo overflow-hidden rounded-[24px]">
              <img
                src="/images/about.jpg"
                alt={t("about.heroImgAlt")}
                className="aspect-[4/3] w-full object-cover"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="danest-about-principles bg-white">
        <div className="mx-auto max-w-7xl px-4 py-16 md:px-6 md:py-20 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-link">{t("about.approachEyebrow")}</p>
            <h2 className="mt-3 font-heading text-3xl font-medium text-foreground text-balance md:text-4xl">
              {t("about.approachTitle")}
            </h2>
            <p className="danest-about-supporting mt-3 max-w-[62ch] text-sm italic leading-[1.85] text-muted-foreground md:text-[15px]">
              {t("about.approachDesc")}
            </p>
          </div>
          <div className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2">
            {principles.map((p) => (
              <div key={p.titleKey} className="danest-about-principle rounded-2xl border border-border bg-card p-6" style={{ boxShadow: "var(--shadow-surface)" }}>
                <span className="flex size-11 items-center justify-center rounded-xl bg-accent text-link">
                  <p.icon className="size-5" aria-hidden="true" />
                </span>
                <h3 className="mt-4 font-heading text-xl font-semibold text-card-foreground">{t(p.titleKey)}</h3>
                <p className="mt-2 text-sm leading-[1.8] text-muted-foreground">{t(p.bodyKey)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="danest-about-contact bg-white">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-4 py-16 md:px-6 md:py-20 lg:grid-cols-2 lg:px-8">
          <div id="contact" className="scroll-mt-24">
            <h2 className="font-heading text-3xl font-medium text-foreground">{t("about.contactTitle")}</h2>
            <p className="mt-3 text-base text-muted-foreground">
              {t("about.contactDesc")}
            </p>
            <ul className="mt-6 space-y-4">
              <li className="flex items-start gap-3">
                <span className="flex size-10 items-center justify-center rounded-lg border border-border bg-card text-link">
                  <Mail className="size-4" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground">{t("about.email")}</p>
                  <a href="mailto:hello@danest.example" className="text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
                    hello@danest.example
                  </a>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex size-10 items-center justify-center rounded-lg border border-border bg-card text-link">
                  <MapPin className="size-4" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground">{t("about.office")}</p>
                  <p className="text-sm text-muted-foreground">{t("about.officeAddr")}</p>
                </div>
              </li>
              <li className="flex items-start gap-3">
                <span className="flex size-10 items-center justify-center rounded-lg border border-border bg-card text-link">
                  <Languages className="size-4" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-foreground">{t("about.languages")}</p>
                  <p className="text-sm text-muted-foreground">{t("about.languagesValue")}</p>
                </div>
              </li>
            </ul>
          </div>

          <div className="space-y-6">
            <div id="terms" className="scroll-mt-24 rounded-2xl border border-border bg-card p-6">
              <div className="flex items-center gap-2">
                <BadgeCheck className="size-5 text-link" aria-hidden="true" />
                <h2 className="font-heading text-2xl font-medium text-card-foreground">{t("about.termsTitle")}</h2>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {t("about.termsBody")}
              </p>
            </div>
            <div id="privacy" className="scroll-mt-24 rounded-2xl border border-border bg-card p-6">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-5 text-link" aria-hidden="true" />
                <h2 className="font-heading text-2xl font-medium text-card-foreground">{t("about.privacyTitle")}</h2>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {t("about.privacyBody")}
              </p>
            </div>
            <SampleDataNote />
          </div>
        </div>
      </section>
    </main>
  );
}
