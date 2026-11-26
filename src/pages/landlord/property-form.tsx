import { useRef, useState, type FormEvent } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, Info, ShieldQuestion } from "lucide-react";
import { draftToListing } from "~/api";
import { Link, useNavigate } from "~/lib/router";
import { useAppState } from "~/state/app-state";
import { useLandlordIdentity } from "~/pages/landlord/use-landlord-identity";
import { useToast } from "~/components/ui/toast";
import { Button } from "~/components/ui/button";
import { MODERATION_DESCRIPTION, MODERATION_LABEL, moderationInputFromDraft, runModeration, statusForModeration } from "~/lib/moderation";
import { appendAudit } from "~/api/admin";
import { FormSections, type FormErrors } from "~/pages/landlord/form-sections";
import { useI18n } from "~/i18n/language-context";
import type { AmenityId, FurnishingStatus, Listing, ListingDraft, ListingModeration, NeighborhoodId } from "~/types";

const DEFAULT_COST_KEYS = [
  { key: "landlord.form.costElectricity", state: "variable" },
  { key: "landlord.form.costWater", state: "variable" },
  { key: "landlord.form.costInternet", state: "fixed" },
  { key: "landlord.form.costManagement", state: "fixed" },
] as const;

const MODERATION_LABEL_KEY: Record<keyof typeof MODERATION_LABEL, string> = {
  passed: "landlord.moderation.passed",
  "needs-attention": "landlord.moderation.needsAttention",
  rejected: "landlord.moderation.rejected",
  incomplete: "landlord.moderation.incomplete",
};

const MODERATION_DESCRIPTION_KEY: Record<keyof typeof MODERATION_DESCRIPTION, string> = {
  passed: "landlord.moderation.descPassed",
  "needs-attention": "landlord.moderation.descNeedsAttention",
  rejected: "landlord.moderation.descRejected",
  incomplete: "landlord.moderation.descIncomplete",
};

const DEPOSIT_OPTIONS = [1, 2, 3];

function emptyDraft(t: (key: string) => string): ListingDraft {
  return {
    title: "",
    summary: "",
    description: "",
    neighborhood: "",
    address: "",
    monthlyRent: "",
    depositMonths: "1",
    bedrooms: "1",
    bathrooms: "1",
    floorArea: "",
    furnishing: "",
    amenities: [],
    minMonths: "1",
    maxMonths: "12",
    availableFrom: "",
    images: [],
    extraCosts: DEFAULT_COST_KEYS.map((c) => ({ label: t(c.key), amount: "", state: c.state })),
  };
}

function draftFromListing(listing: Listing): ListingDraft {
  return {
    title: listing.title,
    summary: listing.summary,
    description: listing.description,
    neighborhood: listing.neighborhood,
    address: listing.address,
    monthlyRent: String(listing.monthlyRent),
    depositMonths: String(listing.costs.depositMonths),
    bedrooms: String(listing.bedrooms),
    bathrooms: String(listing.bathrooms),
    floorArea: String(listing.floorArea),
    furnishing: listing.furnishing,
    amenities: listing.amenities,
    minMonths: String(listing.rentalDurationMonths[0]),
    maxMonths: String(listing.rentalDurationMonths[1]),
    availableFrom: listing.availableFrom,
    images: listing.images,
    extraCosts: listing.costs.items.map((i) => ({
      label: i.label,
      amount: i.amount === null ? "" : String(i.amount),
      state: i.state,
    })),
  };
}

type Errors = FormErrors;

const SECTION_FIELDS: Record<string, string> = {
  title: "basics",
  summary: "basics",
  description: "basics",
  neighborhood: "location",
  address: "location",
  monthlyRent: "costs",
  depositMonths: "costs",
  bedrooms: "size",
  bathrooms: "size",
  floorArea: "size",
  furnishing: "size",
  amenities: "amenities",
  minMonths: "rental",
  maxMonths: "rental",
  availableFrom: "rental",
  images: "photos",
  costs: "costs",
};

function validate(draft: ListingDraft, t: (key: string, vars?: Record<string, string | number>) => string): Errors {
  const errors: Errors = {};
  if (draft.title.trim().length < 8) errors.title = t("landlord.form.errTitle");
  if (!draft.summary.trim()) errors.summary = t("landlord.form.errSummary");
  else if (draft.summary.length > 120) errors.summary = t("landlord.form.errSummaryLong");
  if (draft.description.trim().length < 40) errors.description = t("landlord.form.errDescription");
  if (!draft.neighborhood) errors.neighborhood = t("landlord.form.errNeighborhood");
  if (!draft.address.trim()) errors.address = t("landlord.form.errAddress");
  const rent = Number(draft.monthlyRent);
  if (!draft.monthlyRent.trim() || !Number.isFinite(rent) || rent <= 0) errors.monthlyRent = t("landlord.form.errRent");
  if (!DEPOSIT_OPTIONS.includes(Number(draft.depositMonths))) errors.depositMonths = t("landlord.form.errDeposit");
  const beds = Number(draft.bedrooms);
  if (!draft.bedrooms.trim() || !Number.isInteger(beds) || beds < 0 || beds > 6) errors.bedrooms = t("landlord.form.errBedrooms");
  const baths = Number(draft.bathrooms);
  if (!draft.bathrooms.trim() || !Number.isInteger(baths) || baths < 1 || baths > 4) errors.bathrooms = t("landlord.form.errBathrooms");
  const area = Number(draft.floorArea);
  if (!draft.floorArea.trim() || !Number.isFinite(area) || area <= 10) errors.floorArea = t("landlord.form.errFloorArea");
  if (!draft.furnishing) errors.furnishing = t("landlord.form.errFurnishing");
  const min = Number(draft.minMonths);
  const max = Number(draft.maxMonths);
  if (!min || min < 1 || min > 12) errors.minMonths = t("landlord.form.errMinDuration");
  if (!max || max < 1 || max > 12) errors.maxMonths = t("landlord.form.errMaxDuration");
  else if (min && min > max) errors.maxMonths = t("landlord.form.errMaxBelowMin");
  if (!draft.availableFrom) errors.availableFrom = t("landlord.form.errAvailableFrom");
  if (draft.images.length === 0) errors.images = t("landlord.form.errImages");
  const badCost = draft.extraCosts.find((c) => c.state !== "unknown" && (c.amount.trim() === "" || !Number.isFinite(Number(c.amount)) || Number(c.amount) < 0));
  if (badCost) errors.costs = t("landlord.form.errCost", { label: badCost.label });
  return errors;
}

export function PropertyFormPage({ mode, listingId }: { mode: "create" | "edit"; listingId?: string }) {
  const { t } = useI18n();
  const { listings, addListing, updateListing } = useAppState();
  const landlord = useLandlordIdentity();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);

  const existing = mode === "edit" ? listings.find((l) => l.id === listingId) : undefined;
  const [draft, setDraft] = useState<ListingDraft>(() => (existing ? draftFromListing(existing) : emptyDraft(t)));
  const [errors, setErrors] = useState<Errors>({});
  const [moderationResult, setModerationResult] = useState<ListingModeration | null>(null);
  const formRef = useRef<HTMLDivElement>(null);

  const update = <K extends keyof ListingDraft>(key: K, value: ListingDraft[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }));

  const setCost = (index: number, patch: Partial<ListingDraft["extraCosts"][number]>) =>
    setDraft((prev) => ({
      ...prev,
      extraCosts: prev.extraCosts.map((c, i) => (i === index ? { ...c, ...patch } : c)),
    }));

  const toggleAmenity = (id: AmenityId) =>
    setDraft((prev) => ({
      ...prev,
      amenities: prev.amenities.includes(id) ? prev.amenities.filter((a) => a !== id) : [...prev.amenities, id],
    }));

  const scrollToFirstError = (errs: Errors) => {
    const firstKey = Object.keys(errs)[0];
    if (!firstKey) return;
    const section = SECTION_FIELDS[firstKey] ?? "basics";
    const el = formRef.current?.querySelector<HTMLElement>(`#${section}`);
    el?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const saveAsDraft = () => {
    toast({ title: t("landlord.form.draftSaved"), tone: "info" });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const errs = validate(draft, t);
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      scrollToFirstError(errs);
      return;
    }
    setSubmitting(true);
    try {
      const others = listings.filter((l) => l.id !== existing?.id);
      const result = runModeration(moderationInputFromDraft(draft), others, existing?.id);
      setModerationResult(result);
      const status = "pending" as const;
      if (mode === "create" || !existing) {
        const listing: Listing = { ...draftToListing(draft, landlord.id), moderation: result, status };
        await addListing(listing);
        appendAudit({
          action: "listing-submitted",
          target: listing.title,
          reason: t("landlord.form.auditReason", { result: result.result }),
          actor: t("landlord.form.auditActor", { name: landlord.displayName }),
        });
        toast({
          title: "Đã gửi tin đăng thành công",
          description: "Căn hộ đang chờ Admin kiểm tra và phê duyệt.",
          tone: "success",
        });
        navigate("/landlord/listings");
      } else {
        const rent = Number(draft.monthlyRent);
        const depositMonths = Number(draft.depositMonths);
        await updateListing(existing.id, {
          title: draft.title.trim(),
          summary: draft.summary.trim(),
          description: draft.description.trim(),
          neighborhood: draft.neighborhood as NeighborhoodId,
          address: draft.address.trim(),
          monthlyRent: rent,
          bedrooms: Number(draft.bedrooms),
          bathrooms: Number(draft.bathrooms),
          floorArea: Number(draft.floorArea),
          furnishing: draft.furnishing as FurnishingStatus,
          amenities: draft.amenities,
          rentalDurationMonths: [Number(draft.minMonths), Number(draft.maxMonths)],
          availableFrom: draft.availableFrom,
          images: draft.images,
          status,
          moderation: result,
          availabilityReminderSentAt: null,
          costs: {
            ...existing.costs,
            monthlyRent: rent,
            depositMonths,
            depositAmount: rent * depositMonths,
          },
        });
        toast({ title: t(MODERATION_LABEL_KEY[result.result]), description: t(MODERATION_DESCRIPTION_KEY[result.result]), tone: result.result === "passed" ? "success" : "info" });
        navigate("/landlord/listings");
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (mode === "edit" && !existing) {
    return (
      <div className="max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{t("landlord.form.editTitle")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("landlord.form.notFound")}</p>
        </div>
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
          <p className="text-sm font-medium text-foreground">{t("landlord.form.notFoundTitle")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("landlord.form.notFoundHint")}</p>
          <Button asChild className="mt-4">
            <Link to="/landlord/listings">{t("landlord.form.backToProperties")}</Link>
          </Button>
        </div>
      </div>
    );
  }

  const errorCount = Object.keys(errors).length;

  return (
    <div ref={formRef} className="max-w-3xl space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">
            {mode === "create" ? t("landlord.form.createHeading") : t("landlord.form.editTitle")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === "create" ? t("landlord.form.createSubtitle") : t("landlord.form.editSubtitle")}
          </p>
        </div>
      </div>

      {errorCount > 0 ? (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-destructive/20 bg-destructive/10 p-4">
          <AlertTriangle className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-destructive">
              {t(errorCount === 1 ? "landlord.form.errorOne" : "landlord.form.errorMany", { count: errorCount })}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{t("landlord.form.errorHint")}</p>
          </div>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-6" noValidate>
        <FormSections
          draft={draft}
          errors={errors}
          update={update}
          setCost={setCost}
          toggleAmenity={toggleAmenity}
          setDraft={setDraft}
        />

        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="ghost" asChild>
            <Link to="/landlord/listings">{t("common.cancel")}</Link>
          </Button>
          {mode === "create" ? (
            <Button type="button" variant="outline" onClick={saveAsDraft}>
              {t("landlord.form.saveAsDraft")}
            </Button>
          ) : null}
          <Button type="submit" disabled={submitting}>
            {mode === "create" ? t("landlord.form.submitChecks") : t("landlord.form.saveAndRecheck")}
          </Button>
        </div>
      </form>

      {moderationResult ? (
        <section
          aria-live="polite"
          className={
            moderationResult.result === "passed"
              ? "rounded-xl border border-success/20 bg-card p-5"
              : moderationResult.result === "rejected"
                ? "rounded-xl border border-destructive/20 bg-destructive/10 p-5"
                : "rounded-xl border border-warning/20 bg-warning/10 p-5"
          }
        >
          <div className="flex items-center gap-2">
            {moderationResult.result === "passed" ? (
              <CheckCircle2 className="size-5 text-success" aria-hidden="true" />
            ) : moderationResult.result === "rejected" ? (
              <AlertTriangle className="size-5 text-destructive" aria-hidden="true" />
            ) : (
              <ShieldQuestion className="size-5 text-warning" aria-hidden="true" />
            )}
            <h2 className="text-base font-semibold text-foreground">
              {t("landlord.form.automatedCheck", { result: t(MODERATION_LABEL_KEY[moderationResult.result]) })}
            </h2>
          </div>
          <p className="mt-1 text-sm text-foreground">{t(MODERATION_DESCRIPTION_KEY[moderationResult.result])}</p>
          <ul className="mt-3 space-y-1.5">
            {moderationResult.checks.map((c) => (
              <li key={`${c.id}-${c.label}-${c.detail}`} className="flex items-start gap-2 text-sm text-foreground">
                <span className="mt-0.5 size-1.5 shrink-0 rounded-full bg-current" aria-hidden="true" />
                <span>
                  <span className="font-medium">{c.label}:</span> {c.detail}
                </span>
              </li>
            ))}
          </ul>
          {moderationResult.reasons.length > 0 ? (
            <div className="mt-3 rounded-lg border border-border bg-card p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("landlord.form.whatToDo")}</p>
              <ul className="mt-1.5 space-y-1">
                {moderationResult.reasons.map((r) => (
                  <li key={r} className="flex gap-2 text-sm text-foreground">
                    <ArrowRight className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <p className="mt-3 flex gap-2 text-xs text-muted-foreground">
            <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            {t("landlord.form.simulatedNote")}
          </p>
        </section>
      ) : null}

      <p className="text-xs text-muted-foreground">
        {t("landlord.form.prototypeNote")}
      </p>
    </div>
  );
}
