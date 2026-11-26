import { useEffect, useMemo, useState } from "react";
import { Bath, BedDouble, Heart, MapPin, Maximize2, Plus, Scale, Trash2 } from "lucide-react";
import { mockInquiriesRepository } from "~/api";
import { useI18n } from "~/i18n/language-context";
import { useLabels } from "~/i18n/use-labels";
import { formatDate, formatRent } from "~/lib/format";
import { Link } from "~/lib/router";
import { useAppState } from "~/state/app-state";
import { useToast } from "~/components/ui/toast";
import { Button } from "~/components/ui/button";
import { AvailabilityBadge, SampleDataNote, VerificationBadge } from "~/components/ui/listing-card";
import { ComparisonTable } from "~/components/saved/comparison-table";
import type { Inquiry, Listing } from "~/types";

const INQUIRY_STATUS_KEY: Record<Inquiry["status"], string> = {
  new: "inquiry.new",
  replied: "inquiry.replied",
  viewing_scheduled: "inquiry.viewing_scheduled",
  rented: "inquiry.rented",
  not_proceeding: "inquiry.not_proceeding",
};

const INQUIRY_STATUS_CLASSES: Record<Inquiry["status"], string> = {
  new: "border-warning/20 bg-warning/10 text-warning",
  replied: "border-transparent bg-accent text-link",
  viewing_scheduled: "border-transparent bg-accent text-link",
  rented: "border-transparent bg-success/15 text-success",
  not_proceeding: "border-border bg-muted text-muted-foreground",
};

function MyInquiries({ email, listings }: { email: string; listings: Listing[] }) {
  const { t } = useI18n();
  const [inquiries, setInquiries] = useState<Inquiry[] | null>(null);

  useEffect(() => {
    let active = true;
    mockInquiriesRepository
      .listForTenant(email)
      .then((items) => {
        if (active) setInquiries(items);
      })
      .catch(() => {
        if (active) setInquiries([]);
      });
    return () => {
      active = false;
    };
  }, [email]);

  if (inquiries === null) {
    return <p className="mt-4 text-sm text-muted-foreground">{t("saved.inqLoading")}</p>;
  }
  if (inquiries.length === 0) {
    return (
      <p className="mt-4 text-sm text-muted-foreground">{t("saved.noInquiries")}</p>
    );
  }
  return (
    <ul className="mt-4 space-y-2">
      {inquiries.map((inq) => {
        const listing = listings.find((l) => l.id === inq.listingId);
        return (
          <li key={inq.id} className="flex flex-col gap-1 rounded-lg border border-border bg-card p-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{listing?.title ?? t("saved.listingUnavailable")}</p>
              <p className="text-xs text-muted-foreground">
                {t("saved.inqSent", { type: inq.type === "viewing-request" ? t("inquiry.viewingRequest") : t("inquiry.question"), date: formatDate(inq.createdAt) })}
              </p>
            </div>
            <span className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${INQUIRY_STATUS_CLASSES[inq.status]}`}>
              {t(INQUIRY_STATUS_KEY[inq.status])}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function SavedCard({ listing }: { listing: Listing }) {
  const { toggleSaved, toggleCompare, isComparing } = useAppState();
  const { toast } = useToast();
  const { t } = useI18n();
  const labels = useLabels();

  const handleRemove = () => {
    toggleSaved(listing.id);
    toast({ title: t("saved.removedToast"), description: listing.title, tone: "info" });
  };

  const handleCompare = () => {
    const result = toggleCompare(listing.id);
    if (result === "full") {
      toast({
        title: t("saved.comparisonFull"),
        description: t("saved.comparisonFullHint"),
        tone: "warning",
      });
    } else if (result === "added") {
      toast({ title: t("saved.addedToCompare"), description: listing.title, tone: "success" });
    } else {
      toast({ title: t("saved.removedFromCompare"), description: listing.title, tone: "info" });
    }
  };

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-border bg-card" style={{ boxShadow: "var(--shadow-surface)" }}>
      <Link to={`/apartment/${listing.id}`} className="relative block" aria-label={t("listing.viewAria", { title: listing.title })}>
        <img
          src={listing.images[0]}
          alt={t("listing.imageAlt", { title: listing.title, area: labels.neighborhood[listing.neighborhood] })}
          className="aspect-[4/3] w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
          loading="lazy"
        />
        <div className="absolute inset-x-3 top-3 flex flex-wrap gap-2">
          <VerificationBadge verified={listing.verificationBadge} />
        </div>
        <div className="absolute inset-x-3 bottom-3 flex items-center justify-between gap-2">
          <AvailabilityBadge availability={listing.availability} />
          <span className="rounded-full border border-border bg-card px-3 py-1 text-sm font-semibold text-card-foreground">
            {formatRent(listing.monthlyRent)}
          </span>
        </div>
      </Link>

      <div className="flex flex-1 flex-col p-5">
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <MapPin className="size-3.5" aria-hidden="true" />
          {labels.neighborhood[listing.neighborhood]}, Da Nang
        </p>
        <Link to={`/apartment/${listing.id}`} className="mt-1.5">
          <h3 className="font-heading text-xl font-semibold leading-snug text-card-foreground transition-colors group-hover:text-link">
            {listing.title}
          </h3>
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <BedDouble className="size-4" aria-hidden="true" /> {t("listing.beds", { count: listing.bedrooms })}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Bath className="size-4" aria-hidden="true" /> {t("listing.baths", { count: listing.bathrooms })}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Maximize2 className="size-4" aria-hidden="true" /> {listing.floorArea} m²
          </span>
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{labels.furnishing[listing.furnishing]}</p>

        <div className="mt-auto flex flex-wrap items-center gap-2 pt-4">
          <Button asChild size="sm" className="h-9 px-3">
            <Link to={`/apartment/${listing.id}`}>{t("saved.viewDetails")}</Link>
          </Button>
          <Button
            variant={isComparing(listing.id) ? "secondary" : "outline"}
            size="sm"
            className="h-9 px-3"
            onClick={handleCompare}
            aria-pressed={isComparing(listing.id)}
          >
            <Scale className="size-3.5" aria-hidden="true" />
            {isComparing(listing.id) ? t("listing.comparing") : t("listing.compare")}
          </Button>
          <Button variant="ghost" size="sm" className="ml-auto h-9 px-3 text-destructive hover:bg-destructive hover:text-destructive-foreground" onClick={handleRemove}>
            <Trash2 className="size-3.5" aria-hidden="true" />
            {t("common.remove")}
          </Button>
        </div>
      </div>
    </article>
  );
}

export function SavedPage() {
  const { listings, savedIds, compareIds, toggleCompare, clearCompare, session } = useAppState();
  const { toast } = useToast();
  const { t } = useI18n();
  const labels = useLabels();

  const saved = useMemo(
    () => savedIds.map((id) => listings.find((l) => l.id === id)).filter((l): l is Listing => Boolean(l)),
    [savedIds, listings],
  );
  const compared = useMemo(
    () => compareIds.map((id) => listings.find((l) => l.id === id)).filter((l): l is Listing => Boolean(l)),
    [compareIds, listings],
  );
  const notCompared = saved.filter((l) => !compareIds.includes(l.id));

  const handleAddCompare = (listing: Listing) => {
    const result = toggleCompare(listing.id);
    if (result === "full") {
      toast({
        title: t("saved.comparisonFull"),
        description: t("saved.comparisonFullHint"),
        tone: "warning",
      });
    } else if (result === "added") {
      toast({ title: t("saved.addedToCompare"), description: listing.title, tone: "success" });
    }
  };

  const handleRemoveFromCompare = (id: string) => {
    toggleCompare(id);
    toast({ title: t("saved.removedFromCompare"), tone: "info" });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 pb-16 pt-8 md:px-6 lg:px-8">
        <h1 className="font-heading text-3xl font-medium text-foreground md:text-4xl">{t("saved.title")}</h1>
        <p className="mt-2 max-w-2xl text-base text-muted-foreground">
          {t("saved.subtitle")}
        </p>

        {saved.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-border bg-card p-10 text-center" style={{ boxShadow: "var(--shadow-surface)" }}>
            <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-accent">
              <Heart className="size-6 text-link" aria-hidden="true" />
            </div>
            <h2 className="mt-4 font-heading text-xl font-semibold text-foreground">{t("saved.emptyTitle")}</h2>
            <p className="mx-auto mt-2 max-w-md text-base text-muted-foreground">
              {t("saved.emptyHint")}
            </p>
            <Button asChild className="mt-6">
              <Link to="/search">{t("common.exploreApartments")}</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {saved.map((listing) => (
                <SavedCard key={listing.id} listing={listing} />
              ))}
            </div>
            <SampleDataNote className="mt-6" />
          </>
        )}

        {session ? (
          <section className="mt-12" aria-labelledby="my-inquiries-title">
            <h2 id="my-inquiries-title" className="font-heading text-xl font-semibold text-foreground">
              {t("saved.inquiries")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("saved.inquiriesHint")}
            </p>
            <MyInquiries email={session.user.email} listings={listings} />
          </section>
        ) : null}

        <div className="mt-12">
          <ComparisonTable listings={compared} onRemove={handleRemoveFromCompare} onClear={clearCompare} />
          {saved.length > 0 ? <SampleDataNote className="mt-4" /> : null}
        </div>

        {notCompared.length > 0 ? (
          <section aria-labelledby="add-compare-title" className="mt-8">
            <h2 id="add-compare-title" className="text-base font-semibold text-foreground">
              {t("saved.addCompareTitle")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("saved.addCompareHint")}</p>
            <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {notCompared.map((listing) => (
                <li key={listing.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-2.5">
                  <img
                    src={listing.images[0]}
                    alt={t("listing.imageAlt", { title: listing.title, area: labels.neighborhood[listing.neighborhood] })}
                    className="size-14 shrink-0 rounded-lg object-cover"
                    loading="lazy"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{listing.title}</p>
                    <p className="text-xs text-muted-foreground">{formatRent(listing.monthlyRent)}</p>
                  </div>
                  <Button variant="outline" size="sm" className="h-9 shrink-0 px-2.5" onClick={() => handleAddCompare(listing)} aria-label={t("compare.removeAria", { title: listing.title })}>
                    <Plus className="size-3.5" aria-hidden="true" />
                    {t("common.add")}
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}
