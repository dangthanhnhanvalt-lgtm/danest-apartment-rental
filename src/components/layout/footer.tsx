import { Facebook, Instagram, Mail, MapPin } from "lucide-react";
import { Link } from "~/lib/router";
import { Logo } from "~/components/logo";
import { useI18n } from "~/i18n/language-context";
import type { NeighborhoodId } from "~/types";

interface FooterLink {
  to: string;
  key: string;
  vars?: Record<string, string>;
  area?: NeighborhoodId;
}

const exploreLinks: FooterLink[] = [
  { to: "/search", key: "nav.explore" },
  { to: "/search?neighborhood=an-thuong", key: "area", area: "an-thuong" },
  { to: "/search?neighborhood=my-an", key: "area", area: "my-an" },
  { to: "/search?neighborhood=son-tra", key: "area", area: "son-tra" },
  { to: "/search?neighborhood=han-river", key: "area", area: "han-river" },
];

const landlordLinks: FooterLink[] = [
  { to: "/landlord/listings/new", key: "nav.listProperty" },
  { to: "/landlord", key: "nav.landlordDashboard" },
  { to: "/#how-it-works", key: "nav.howItWorks" },
  { to: "/about", key: "footer.about" },
];

const legalLinks: FooterLink[] = [
  { to: "/about#terms", key: "footer.termsFull" },
  { to: "/about#privacy", key: "footer.privacyFull" },
  { to: "/about#contact", key: "footer.contact" },
];

export function Footer() {
  const { t, lang } = useI18n();
  const areaLabel = (id?: NeighborhoodId): string => {
    if (!id) return "";
    const map: Record<NeighborhoodId, string> = {
      "an-thuong": lang === "vi" ? "An Thượng" : "An Thuong",
      "my-an": lang === "vi" ? "Mỹ An" : "My An",
      "son-tra": lang === "vi" ? "Sơn Trà" : "Son Tra",
      "han-river": lang === "vi" ? "Sông Hàn" : "Han River",
    };
    return map[id];
  };
  const label = (l: FooterLink) => (l.key === "area" ? areaLabel(l.area) : t(l.key));

  return (
    <footer className="border-t border-border bg-section-alt text-foreground">
      <div className="mx-auto max-w-7xl px-4 py-14 md:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <Logo />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">{t("footer.blurb")}</p>
            <div className="mt-5 flex items-center gap-2">
              <a
                href="https://www.facebook.com"
                target="_blank"
                rel="noreferrer noopener"
                aria-label={t("aria.social", { network: "Facebook" })}
                className="flex size-10 items-center justify-center rounded-lg border border-input text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Facebook className="size-4" aria-hidden="true" />
              </a>
              <a
                href="https://www.instagram.com"
                target="_blank"
                rel="noreferrer noopener"
                aria-label={t("aria.social", { network: "Instagram" })}
                className="flex size-10 items-center justify-center rounded-lg border border-input text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Instagram className="size-4" aria-hidden="true" />
              </a>
            </div>
          </div>

          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground">{t("footer.exploreHeading")}</h2>
            <ul className="mt-4 space-y-2.5">
              {exploreLinks.map((l) => (
                <li key={l.to + l.key + (l.area ?? "")}>
                  <Link to={l.to} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                    {label(l)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground">{t("footer.landlordsHeading")}</h2>
            <ul className="mt-4 space-y-2.5">
              {landlordLinks.map((l) => (
                <li key={l.to + l.key}>
                  <Link to={l.to} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                    {label(l)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground">{t("footer.contactHeading")}</h2>
            <ul className="mt-4 space-y-2.5 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span>{t("footer.address")}</span>
              </li>
              <li>
                <a href="mailto:hello@danest.example" className="flex items-center gap-2 transition-colors hover:text-foreground">
                  <Mail className="size-4 shrink-0" aria-hidden="true" />
                  hello@danest.example
                </a>
              </li>
              <li className="pt-1 text-xs">{t("footer.hours")}</li>
            </ul>
            <ul className="mt-5 space-y-2">
              {legalLinks.map((l) => (
                <li key={l.to + l.key}>
                  <Link to={l.to} className="text-sm text-muted-foreground transition-colors hover:text-foreground">
                    {label(l)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-border pt-6">
          <p className="text-xs leading-relaxed text-muted-foreground">{t("footer.prototype")} {t("listing.demoDataNote")}</p>
          <div className="mt-4 flex flex-col items-start justify-between gap-2 text-xs text-muted-foreground sm:flex-row sm:items-center">
            <p>{t("footer.copyright", { year: new Date().getFullYear() })}</p>
            <p>{t("footer.madeFor")}</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
