import type { Dispatch, ReactNode, SetStateAction } from "react";
import { Plus, X } from "lucide-react";
import { AMENITIES, FURNISHING_LABEL, NEIGHBORHOODS } from "~/data/constants";
import { useI18n } from "~/i18n/language-context";
import { useLabels } from "~/i18n/use-labels";
import { todayISO } from "~/lib/format";
import { Button } from "~/components/ui/button";
import { Field, Input, Select, Textarea } from "~/components/ui/form";
import { PhotoPicker } from "~/pages/landlord/photo-picker";
import type { AmenityId, CostState, FurnishingStatus, ListingDraft, NeighborhoodId } from "~/types";

const COST_STATE_LABEL: Record<CostState, string> = {
  fixed: "landlord.costState.fixed",
  variable: "landlord.costState.variable",
  reported: "landlord.costState.reported",
  unknown: "landlord.costState.unknown",
};

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => i + 1);
const DEPOSIT_OPTIONS = [1, 2, 3];

export interface FormErrors {
  [key: string]: string;
}

export function SectionCard({ title, id, children }: { title: string; id: string; children: ReactNode }) {
  return (
    <section
      className="scroll-mt-24 rounded-xl border border-border bg-card p-5"
      style={{ boxShadow: "var(--shadow-surface)" }}
      aria-labelledby={id}
    >
      <h2 id={id} className="text-base font-semibold text-card-foreground">
        {title}
      </h2>
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

export function FormSections({
  draft,
  errors,
  update,
  setCost,
  toggleAmenity,
  setDraft,
}: {
  draft: ListingDraft;
  errors: FormErrors;
  update: <K extends keyof ListingDraft>(key: K, value: ListingDraft[K]) => void;
  setCost: (index: number, patch: Partial<ListingDraft["extraCosts"][number]>) => void;
  toggleAmenity: (id: AmenityId) => void;
  setDraft: Dispatch<SetStateAction<ListingDraft>>;
}) {
  const { t } = useI18n();
  const labels = useLabels();
  const summaryLeft = 120 - draft.summary.length;
  return (
    <>
      <SectionCard title={t("landlord.formSection.basics")} id="basics">
        <Field label={t("landlord.field.listingTitle")} htmlFor="title" error={errors.title} hint={t("landlord.field.listingTitleHint")}>
          <Input id="title" value={draft.title} onChange={(e) => update("title", e.target.value)} placeholder={t("landlord.field.listingTitlePlaceholder")} />
        </Field>
        <Field
          label={t("landlord.field.summary")}
          htmlFor="summary"
          error={errors.summary}
          hint={t("landlord.field.summaryLeft", { count: summaryLeft })}
        >
          <Input id="summary" value={draft.summary} onChange={(e) => update("summary", e.target.value)} maxLength={120} placeholder={t("landlord.field.summaryPlaceholder")} />
        </Field>
        <Field label={t("landlord.field.description")} htmlFor="description" error={errors.description} hint={t("landlord.field.descriptionHint")}>
          <Textarea id="description" value={draft.description} onChange={(e) => update("description", e.target.value)} />
        </Field>
      </SectionCard>

      <SectionCard title={t("landlord.formSection.location")} id="location">
        <Field label={t("landlord.field.neighborhood")} htmlFor="neighborhood" error={errors.neighborhood}>
          <Select id="neighborhood" value={draft.neighborhood} onChange={(e) => update("neighborhood", e.target.value as NeighborhoodId)}>
            <option value="">{t("landlord.field.selectNeighborhood")}</option>
            {NEIGHBORHOODS.map((n) => (
              <option key={n.id} value={n.id}>{labels.neighborhood[n.id]}</option>
            ))}
          </Select>
        </Field>
        <Field label={t("landlord.field.address")} htmlFor="address" error={errors.address}>
          <Input id="address" value={draft.address} onChange={(e) => update("address", e.target.value)} placeholder={t("landlord.field.addressPlaceholder")} />
        </Field>
      </SectionCard>

      <SectionCard title={t("landlord.formSection.size")} id="size">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t("landlord.field.bedrooms")} htmlFor="bedrooms" error={errors.bedrooms}>
            <Input id="bedrooms" type="number" min={0} max={6} value={draft.bedrooms} onChange={(e) => update("bedrooms", e.target.value)} />
          </Field>
          <Field label={t("landlord.field.bathrooms")} htmlFor="bathrooms" error={errors.bathrooms}>
            <Input id="bathrooms" type="number" min={1} max={4} value={draft.bathrooms} onChange={(e) => update("bathrooms", e.target.value)} />
          </Field>
          <Field label={t("landlord.field.floorArea")} htmlFor="floorArea" error={errors.floorArea}>
            <Input id="floorArea" type="number" min={11} value={draft.floorArea} onChange={(e) => update("floorArea", e.target.value)} />
          </Field>
          <Field label={t("landlord.field.furnishing")} htmlFor="furnishing" error={errors.furnishing}>
            <Select id="furnishing" value={draft.furnishing} onChange={(e) => update("furnishing", e.target.value as FurnishingStatus)}>
              <option value="">{t("landlord.field.selectFurnishing")}</option>
              {(Object.keys(FURNISHING_LABEL) as FurnishingStatus[]).map((f) => (
                <option key={f} value={f}>{labels.furnishing[f]}</option>
              ))}
            </Select>
          </Field>
        </div>
      </SectionCard>

      <SectionCard title={t("landlord.formSection.amenities")} id="amenities">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {AMENITIES.map((a) => (
            <label
              key={a.id}
              className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-input px-3 py-2 text-sm text-foreground transition-colors hover:bg-accent"
            >
              <input
                type="checkbox"
                checked={draft.amenities.includes(a.id)}
                onChange={() => toggleAmenity(a.id)}
                className="size-4 rounded border-input accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              {labels.amenity[a.id]}
            </label>
          ))}
        </div>
      </SectionCard>

      <SectionCard title={t("landlord.formSection.costs")} id="costs">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={t("landlord.availability.monthlyRent")} htmlFor="monthlyRent" error={errors.monthlyRent}>
            <Input id="monthlyRent" type="number" min={1} value={draft.monthlyRent} onChange={(e) => update("monthlyRent", e.target.value)} />
          </Field>
          <Field label={t("landlord.field.depositMonths")} htmlFor="depositMonths" error={errors.depositMonths}>
            <Select id="depositMonths" value={draft.depositMonths} onChange={(e) => update("depositMonths", e.target.value)}>
              {DEPOSIT_OPTIONS.map((m) => (
                <option key={m} value={m}>{t(m > 1 ? "landlord.field.monthsPlural" : "landlord.field.months", { count: m })}</option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium text-foreground">{t("landlord.field.extraCosts")}</p>
          {errors.costs ? <p className="text-sm text-destructive" role="alert">{errors.costs}</p> : null}
          <div className="space-y-2">
            {draft.extraCosts.map((cost, index) => (
              <div key={index} className="grid grid-cols-1 gap-2 rounded-lg border border-border p-3 sm:grid-cols-[1fr_120px_140px_auto]">
                <label className="sr-only" htmlFor={`cost-label-${index}`}>{t("landlord.field.costLabel")}</label>
                <Input id={`cost-label-${index}`} value={cost.label} onChange={(e) => setCost(index, { label: e.target.value })} className="h-10" placeholder={t("landlord.field.costLabel")} />
                <label className="sr-only" htmlFor={`cost-amount-${index}`}>{t("landlord.field.amountPerMonth")}</label>
                <Input id={`cost-amount-${index}`} type="number" min={0} value={cost.amount} onChange={(e) => setCost(index, { amount: e.target.value })} className="h-10" placeholder={t("landlord.field.amount")} />
                <label className="sr-only" htmlFor={`cost-state-${index}`}>{t("landlord.field.costState")}</label>
                <Select id={`cost-state-${index}`} value={cost.state} onChange={(e) => setCost(index, { state: e.target.value as CostState })} className="h-10">
                  {(Object.keys(COST_STATE_LABEL) as CostState[]).map((s) => (
                    <option key={s} value={s}>{t(COST_STATE_LABEL[s])}</option>
                  ))}
                </Select>
                <button
                  type="button"
                  onClick={() => setDraft((prev) => ({ ...prev, extraCosts: prev.extraCosts.filter((_, i) => i !== index) }))}
                  aria-label={t("landlord.field.removeCost", { label: cost.label || t("landlord.field.cost") })}
                  className="flex size-10 items-center justify-center rounded-lg border border-input text-muted-foreground transition-colors hover:bg-accent hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setDraft((prev) => ({ ...prev, extraCosts: [...prev.extraCosts, { label: "", amount: "", state: "variable" }] }))}
          >
            <Plus aria-hidden="true" /> {t("landlord.field.addCost")}
          </Button>
        </div>
      </SectionCard>

      <SectionCard title={t("landlord.formSection.rental")} id="rental">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Field label={t("landlord.field.minStay")} htmlFor="minMonths" error={errors.minMonths}>
            <Select id="minMonths" value={draft.minMonths} onChange={(e) => update("minMonths", e.target.value)}>
              {MONTH_OPTIONS.map((m) => (
                <option key={m} value={m}>{t(m > 1 ? "landlord.field.monthsPlural" : "landlord.field.months", { count: m })}</option>
              ))}
            </Select>
          </Field>
          <Field label={t("landlord.field.maxStay")} htmlFor="maxMonths" error={errors.maxMonths}>
            <Select id="maxMonths" value={draft.maxMonths} onChange={(e) => update("maxMonths", e.target.value)}>
              {MONTH_OPTIONS.map((m) => (
                <option key={m} value={m}>{t(m > 1 ? "landlord.field.monthsPlural" : "landlord.field.months", { count: m })}</option>
              ))}
            </Select>
          </Field>
          <Field label={t("landlord.field.availableFrom")} htmlFor="availableFrom" error={errors.availableFrom}>
            <Input id="availableFrom" type="date" min={todayISO()} value={draft.availableFrom} onChange={(e) => update("availableFrom", e.target.value)} />
          </Field>
        </div>
      </SectionCard>

      <SectionCard title={t("landlord.formSection.photos")} id="photos">
        <PhotoPicker selected={draft.images} onChange={(images) => update("images", images)} error={errors.images} />
      </SectionCard>
      </>
    );
  }

