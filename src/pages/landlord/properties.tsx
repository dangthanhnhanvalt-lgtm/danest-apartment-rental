import { useMemo, useState } from "react";
import { AlertTriangle, Search } from "lucide-react";
import { formatDate, formatRent, todayISO } from "~/lib/format";
import { availabilityStatus } from "~/lib/availability";
import { MODERATION_LABEL } from "~/lib/moderation";
import { Link } from "~/lib/router";
import { useAppState } from "~/state/app-state";
import { useLandlordIdentity } from "~/pages/landlord/use-landlord-identity";
import { useToast } from "~/components/ui/toast";
import { Button } from "~/components/ui/button";
import { Input, Select } from "~/components/ui/form";
import { AvailabilityBadge, VerificationBadge } from "~/components/ui/listing-card";
import { cn } from "~/lib/utils";
import { useI18n } from "~/i18n/language-context";
import { useLabels } from "~/i18n/use-labels";
import type { Availability, Listing, ListingStatus } from "~/types";

const statusBadge: Record<ListingStatus, { labelKey: string; classes: string }> = {
  published: { labelKey: "landlord.listingStatus.published", classes: "border-transparent bg-accent text-link" },
  paused: { labelKey: "landlord.listingStatus.paused", classes: "border-warning/20 bg-warning/10 text-warning" },
  draft: { labelKey: "landlord.listingStatus.draft", classes: "border-border bg-muted text-muted-foreground" },
  pending: { labelKey: "landlord.listingStatus.pending", classes: "border-warning/20 bg-warning/10 text-warning" },
  "needs-attention": { labelKey: "landlord.listingStatus.needsAttention", classes: "border-warning/20 bg-warning/10 text-warning" },
  rejected: { labelKey: "landlord.listingStatus.rejected", classes: "border-destructive/20 bg-destructive/10 text-destructive" },
  hidden: { labelKey: "landlord.listingStatus.hidden", classes: "border-border bg-muted text-muted-foreground" },
  archived: { labelKey: "landlord.listingStatus.archived", classes: "border-border bg-muted text-muted-foreground" },
};

const availabilityLabel: Record<Availability, string> = {
  available: "landlord.availability.available",
  reserved: "landlord.availability.reserved",
  unavailable: "landlord.availability.unavailable",
};

function StatusBadge({ status }: { status: ListingStatus }) {
  const { t } = useI18n();
  const tone = statusBadge[status];
  return (
    <span className={cn("inline-flex whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium", tone.classes)}>
      {t(tone.labelKey)}
    </span>
  );
}

function useListingActions() {
  const { updateListing } = useAppState();
  const { toast } = useToast();
  const { t } = useI18n();

  const setAvailability = async (listing: Listing, availability: Availability) => {
    await updateListing(listing.id, { availability });
    const status = t(availabilityLabel[availability]).toLocaleLowerCase();
    toast({
      title: t("landlord.availability.updated"),
      description: t("landlord.availability.updatedDesc", { title: listing.title, status }),
      tone: "success",
    });
  };

  const setRent = async (listing: Listing, monthlyRent: number) => {
    await updateListing(listing.id, { monthlyRent, costs: { ...listing.costs, monthlyRent } });
    toast({
      title: t("landlord.availability.priceUpdated"),
      description: t("landlord.availability.priceUpdatedDesc", { title: listing.title, price: formatRent(monthlyRent) }),
      tone: "success",
    });
  };

  const submitForVerification = async (listing: Listing) => {
    const today = todayISO();
    const checks = listing.verification.checks.map((c) =>
      c.status === "verified" ? c : { ...c, status: "in-review" as const, lastUpdated: today },
    );
    await updateListing(listing.id, {
      verification: { ...listing.verification, checks },
      verificationBadge: false,
    });
    toast({
      title: t("landlord.availability.submitted"),
      description: t("landlord.availability.submittedDesc"),
      tone: "success",
    });
  };

  const togglePause = async (listing: Listing) => {
    const next: ListingStatus = listing.status === "published" ? "paused" : "published";
    await updateListing(listing.id, { status: next });
    toast({
      title: next === "paused" ? t("landlord.availability.paused") : t("landlord.availability.republished"),
      description: listing.title,
      tone: "success",
    });
  };

  const moveToDraft = async (listing: Listing) => {
    await updateListing(listing.id, { status: "draft" });
    toast({
      title: t("landlord.availability.movedToDraft"),
      description: t("landlord.availability.movedToDraftDesc", { title: listing.title }),
      tone: "info",
    });
  };

  const reconfirm = async (listing: Listing) => {
    await updateListing(listing.id, {
      lastAvailabilityConfirmedAt: todayISO(),
      availabilityReminderSentAt: null,
    });
    toast({
      title: t("landlord.availability.reconfirmed"),
      description: t("landlord.availability.reconfirmedDesc", { title: listing.title }),
      tone: "success",
    });
  };

  return { setAvailability, setRent, submitForVerification, togglePause, moveToDraft, reconfirm };
}

type ActionMode = "price" | "availability" | "confirmVerification" | "confirmPause" | "confirmDraft" | null;

function AvailabilityStamp({ listing }: { listing: Listing }) {
  const { t } = useI18n();
  const status = availabilityStatus(listing);
  if (listing.status !== "published") return null;
  if (status.state === "overdue" || status.state === "hidden") {
    return (
      <span className="inline-flex h-8 items-center gap-1 rounded-md border border-warning/20 bg-warning/10 px-2.5 text-xs font-medium text-warning">
        {status.state === "hidden" ? t("landlord.availability.hiddenFromSearch") : t("landlord.availability.overdue")} ·{" "}
        {t("landlord.availability.days", { count: status.daysSinceConfirmed })}
      </span>
    );
  }
  if (status.state === "reminder") {
    return (
      <span className="inline-flex h-8 items-center gap-1 rounded-md border border-border bg-muted px-2.5 text-xs font-medium text-muted-foreground">
        {t("landlord.availability.reconfirmIn", { count: Math.max(0, 14 - status.daysSinceConfirmed) })}
      </span>
    );
  }
  return (
    <span className="inline-flex h-8 items-center rounded-md border border-border bg-muted px-2.5 text-xs font-medium text-muted-foreground">
      {formatDate(listing.lastAvailabilityConfirmedAt)}
    </span>
  );
}

function RowActions({ listing }: { listing: Listing }) {
  const { t } = useI18n();
  const [mode, setMode] = useState<ActionMode>(null);
  const [rentValue, setRentValue] = useState(String(listing.monthlyRent));
  const [confirmAvailability, setConfirmAvailability] = useState<Availability>(listing.availability);
  const { setAvailability, setRent, submitForVerification, togglePause, moveToDraft, reconfirm } = useListingActions();

  const smallBtn =
    "inline-flex h-8 items-center justify-center rounded-md border border-input px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <AvailabilityStamp listing={listing} />
        <Link to={`/landlord/listings/edit/${listing.id}`} className={smallBtn}>
          {t("landlord.availability.edit")}
        </Link>
        {listing.status === "published" ? (
          <button type="button" className={smallBtn} onClick={() => void reconfirm(listing)}>
            {t("landlord.availability.reconfirm")}
          </button>
        ) : null}
        {listing.moderation.reasons.length > 0 && (listing.status === "needs-attention" || listing.status === "rejected") ? (
          <span className="inline-flex h-8 items-center rounded-md border border-warning/20 bg-warning/10 px-2.5 text-xs font-medium text-warning">
            {t("landlord.availability.adminReview", { result: MODERATION_LABEL[listing.moderation.result] })}
          </span>
        ) : null}
        <button
          type="button"
          className={smallBtn}
          aria-expanded={mode === "availability"}
          onClick={() => setMode(mode === "availability" ? null : "availability")}
        >
          {t("landlord.availability.availability")}
        </button>
        <button
          type="button"
          className={smallBtn}
          aria-expanded={mode === "price"}
          onClick={() => {
            setRentValue(String(listing.monthlyRent));
            setMode(mode === "price" ? null : "price");
          }}
        >
          {t("landlord.availability.price")}
        </button>
        {listing.verificationBadge ? null : (
          <button type="button" className={smallBtn} onClick={() => setMode("confirmVerification")}>
            {t("landlord.availability.submitForVerification")}
          </button>
        )}
        <button
          type="button"
          className={smallBtn}
          onClick={() => (listing.status === "published" ? setMode("confirmPause") : void togglePause(listing))}
        >
          {listing.status === "published" ? t("landlord.availability.pause") : t("landlord.availability.republish")}
        </button>
        {listing.status !== "draft" ? (
          <button
            type="button"
            className="inline-flex h-8 items-center justify-center rounded-md border border-destructive/30 px-2.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => setMode("confirmDraft")}
          >
            {t("landlord.availability.delete")}
          </button>
        ) : null}
      </div>

      {mode === "availability" ? (
        <div className="rounded-lg border border-border bg-muted p-3">
          <label htmlFor={`avail-${listing.id}`} className="block text-xs font-medium text-muted-foreground">
            {t("landlord.availability.setAvailability")}
          </label>
          <div className="mt-2 flex items-center gap-2">
            <Select
              id={`avail-${listing.id}`}
              value={confirmAvailability ?? listing.availability}
              onChange={(e) => setConfirmAvailability(e.target.value as Availability)}
              className="h-9 max-w-[180px]"
            >
              {(["available", "reserved", "unavailable"] as Availability[]).map((a) => (
                <option key={a} value={a}>{t(availabilityLabel[a])}</option>
              ))}
            </Select>
            <Button
              size="sm"
              onClick={async () => {
                await setAvailability(listing, confirmAvailability);
                setMode(null);
              }}
            >
              {t("common.save")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setMode(null)}>{t("common.cancel")}</Button>
          </div>
        </div>
      ) : null}

      {mode === "price" ? (
        <form
          className="rounded-lg border border-border bg-muted p-3"
          onSubmit={async (e) => {
            e.preventDefault();
            const value = Number(rentValue);
            if (!Number.isFinite(value) || value <= 0) return;
            await setRent(listing, value);
            setMode(null);
          }}
        >
          <label htmlFor={`rent-${listing.id}`} className="block text-xs font-medium text-muted-foreground">
            {t("landlord.availability.monthlyRent")}
          </label>
          <div className="mt-2 flex items-center gap-2">
            <Input
              id={`rent-${listing.id}`}
              type="number"
              min={1}
              value={rentValue}
              onChange={(e) => setRentValue(e.target.value)}
              className="h-9 max-w-[140px]"
              required
            />
            <Button size="sm" type="submit">{t("common.save")}</Button>
            <Button size="sm" variant="ghost" type="button" onClick={() => setMode(null)}>{t("common.cancel")}</Button>
          </div>
        </form>
      ) : null}

      {mode === "confirmVerification" ? (
        <div className="rounded-lg border border-warning/20 bg-warning/10 p-3">
          <p className="text-sm text-foreground">{t("landlord.availability.submitPrompt")}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t("landlord.availability.submitHint")}</p>
          <div className="mt-2 flex gap-2">
            <Button
              size="sm"
              onClick={async () => {
                await submitForVerification(listing);
                setMode(null);
              }}
            >
              {t("landlord.availability.confirm")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setMode(null)}>{t("common.cancel")}</Button>
          </div>
        </div>
      ) : null}

      {mode === "confirmPause" ? (
        <div className="rounded-lg border border-warning/20 bg-warning/10 p-3">
          <p className="text-sm text-foreground">{t("landlord.availability.pausePrompt")}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t("landlord.availability.pauseHint")}</p>
          <div className="mt-2 flex gap-2">
            <Button
              size="sm"
              onClick={async () => {
                await togglePause(listing);
                setMode(null);
              }}
            >
              {t("landlord.availability.pauseListing")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setMode(null)}>{t("common.cancel")}</Button>
          </div>
        </div>
      ) : null}

      {mode === "confirmDraft" ? (
        <div className="rounded-lg border border-destructive/20 bg-destructive/10 p-3">
          <p className="text-sm text-foreground">{t("landlord.availability.draftPrompt")}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t("landlord.availability.draftHint")}</p>
          <div className="mt-2 flex gap-2">
            <Button
              size="sm"
              variant="destructive"
              onClick={async () => {
                await moveToDraft(listing);
                setMode(null);
              }}
            >
              {t("landlord.availability.moveToDraft")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setMode(null)}>{t("common.cancel")}</Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function PropertiesPage() {
  const { t } = useI18n();
  const labels = useLabels();
  const { listings } = useAppState();
  const landlord = useLandlordIdentity();
  const [status, setStatus] = useState<"all" | ListingStatus>("all");
  const [query, setQuery] = useState("");

  const owned = listings.filter((l) => l.landlordId === landlord.id);
  const overdue = owned.filter(
    (l) => l.status === "published" && ["overdue", "hidden"].includes(availabilityStatus(l).state),
  );
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return owned.filter((l) => {
      if (status !== "all" && l.status !== status) return false;
      if (q && !l.title.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [owned, status, query]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{t("landlord.properties.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("landlord.properties.subtitle")}</p>
        </div>
        <Button asChild className="self-start sm:self-auto">
          <Link to="/landlord/listings/new">{t("landlord.properties.addNew")}</Link>
        </Button>
      </div>

      {overdue.length > 0 ? (
        <div role="status" className="flex items-start gap-3 rounded-xl border border-warning/20 bg-warning/10 p-4">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-foreground">
              {t(overdue.length === 1 ? "landlord.properties.overdueOne" : "landlord.properties.overdueMany", {
                count: overdue.length,
              })}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{t("landlord.properties.overdueBody")}</p>
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="sm:w-48">
          <label htmlFor="status-filter" className="sr-only">{t("landlord.properties.filterLabel")}</label>
          <Select id="status-filter" value={status} onChange={(e) => setStatus(e.target.value as "all" | ListingStatus)}>
            <option value="all">{t("landlord.properties.allStatuses")}</option>
            <option value="published">{t("landlord.listingStatus.published")}</option>
            <option value="pending">{t("landlord.listingStatus.pending")}</option>
            <option value="needs-attention">{t("landlord.listingStatus.needsAttention")}</option>
            <option value="rejected">{t("landlord.listingStatus.rejected")}</option>
            <option value="paused">{t("landlord.listingStatus.paused")}</option>
            <option value="draft">{t("landlord.properties.draftIncomplete")}</option>
            <option value="hidden">{t("landlord.listingStatus.hidden")}</option>
          </Select>
        </div>
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <label htmlFor="listing-search" className="sr-only">{t("landlord.properties.searchLabel")}</label>
          <Input
            id="listing-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("landlord.properties.searchPlaceholder")}
            className="pl-9"
          />
        </div>
        <p className="text-xs text-muted-foreground">{t("landlord.properties.shown", { count: filtered.length })}</p>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
          <p className="text-sm font-medium text-foreground">{t("landlord.properties.noMatch")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("landlord.properties.noMatchHint")}</p>
        </div>
      ) : (
        <>
          <div className="space-y-3 md:hidden">
            {filtered.map((listing) => (
              <div key={listing.id} className="rounded-xl border border-border bg-card p-4" style={{ boxShadow: "var(--shadow-surface)" }}>
                <div className="flex gap-3">
                  <img src={listing.images[0]} alt={listing.title} className="h-16 w-20 shrink-0 rounded-lg object-cover" loading="lazy" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{listing.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{labels.neighborhood[listing.neighborhood]}</p>
                    <p className="mt-1 text-sm font-semibold text-link">{formatRent(listing.monthlyRent)}</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <StatusBadge status={listing.status} />
                  <AvailabilityBadge availability={listing.availability} />
                  {listing.verificationBadge ? <VerificationBadge verified /> : (
                    <span className="text-xs text-muted-foreground">{t("landlord.properties.notSubmitted")}</span>
                  )}
                  <span className="text-xs text-muted-foreground">{t("landlord.properties.views", { count: listing.views })}</span>
                </div>
                <div className="mt-3">
                  <RowActions listing={listing} />
                </div>
              </div>
            ))}
          </div>

          <div className="hidden overflow-x-auto rounded-xl border border-border bg-card md:block" style={{ boxShadow: "var(--shadow-surface)" }}>
            <table className="w-full min-w-[900px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th scope="col" className="px-5 py-3 font-medium">{t("landlord.properties.thProperty")}</th>
                  <th scope="col" className="px-5 py-3 font-medium">{t("landlord.properties.thRent")}</th>
                  <th scope="col" className="px-5 py-3 font-medium">{t("landlord.properties.thStatus")}</th>
                  <th scope="col" className="px-5 py-3 font-medium">{t("landlord.properties.thVerification")}</th>
                  <th scope="col" className="px-5 py-3 font-medium">{t("landlord.properties.thViews")}</th>
                  <th scope="col" className="px-5 py-3 font-medium">{t("landlord.properties.thActions")}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((listing) => (
                  <tr key={listing.id} className="border-b border-border align-top last:border-0">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <img src={listing.images[0]} alt={listing.title} className="h-12 w-16 shrink-0 rounded-lg object-cover" loading="lazy" />
                        <div className="min-w-0">
                          <p className="font-medium text-foreground">{listing.title}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">{labels.neighborhood[listing.neighborhood]}</p>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 font-semibold text-link">{formatRent(listing.monthlyRent)}</td>
                    <td className="px-5 py-4"><StatusBadge status={listing.status} /></td>
                    <td className="px-5 py-4">
                      {listing.verificationBadge ? <VerificationBadge verified /> : (
                        <span className="text-xs text-muted-foreground">{t("landlord.properties.notSubmitted")}</span>
                      )}
                    </td>
                    <td className="px-5 py-4 text-muted-foreground">{listing.views}</td>
                    <td className="px-5 py-4">
                      <RowActions listing={listing} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <p className="text-xs text-muted-foreground">
        {t("landlord.properties.prototypeNote")}
      </p>
    </div>
  );
}
