import { ArrowUpRight, MapPin } from "lucide-react";
import { useI18n } from "~/i18n/language-context";
import { useLabels } from "~/i18n/use-labels";
import { Link } from "~/lib/router";

export function NeighborhoodsSection() {
  const { t } = useI18n();
  const labels = useLabels();
  return (
    <section className="bg-section-alt">
      <div className="mx-auto max-w-7xl px-4 py-16 md:px-6 md:py-24 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-link">{t("hood.eyebrow")}</p>
          <h2 className="mt-3 font-heading text-3xl font-medium text-foreground text-balance md:text-4xl">
            {t("hood.title")}
          </h2>
          <p className="mt-3 text-base text-muted-foreground md:text-lg">
            {t("hood.subtitle")}
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {labels.neighborhoods.map((n) => (
            <Link
              key={n.id}
              to={`/search?neighborhood=${n.id}`}
              className="group relative flex min-h-[26rem] flex-col justify-end overflow-hidden rounded-2xl bg-black text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <img
                src={n.image}
                alt={t("hood.imageAlt", { name: n.name })}
                className="absolute inset-0 size-full object-cover transition-transform duration-700 group-hover:scale-105"
                loading="lazy"
              />
              <div
                className="absolute inset-0"
                style={{ background: "linear-gradient(to top, rgba(0,0,0,0.78) 10%, rgba(0,0,0,0.15) 60%, transparent)" }}
                aria-hidden="true"
              />
              <div className="relative p-5">
                <p className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-[0.16em] text-white">
                  <MapPin className="size-3.5" aria-hidden="true" /> {n.tagline}
                </p>
                <h3 className="mt-2 font-heading text-2xl font-medium text-white">{n.name}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white">{n.description}</p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-white">
                  {t("hood.explore")}
                  <ArrowUpRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" aria-hidden="true" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
