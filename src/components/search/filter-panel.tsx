import { Chip, Checkbox, Field, Input, Select } from "~/components/ui/form";
import { useI18n } from "~/i18n/language-context";
import { useLabels } from "~/i18n/use-labels";
import { useState } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";
import { TYPE_KEYS, toggle, type Filters } from "~/components/search/filter-config";

export function FilterPanel({
  filters,
  onChange,
  onReset,
  collapsible = false,
  activeCount = 0,
  hideHeading = false,
}: {
  filters: Filters;
  onChange: (next: Filters) => void;
  onReset: () => void;
  collapsible?: boolean;
  activeCount?: number;
  hideHeading?: boolean;
}) {
  const labels = useLabels();
  const { t,pick } = useI18n();
  const [open, setOpen] = useState(!collapsible);
  const maxRentOptions = [400, 600, 800, 1000, 1500, 2000];
  return (
    <div className="danest-filter-panel space-y-6">
      <div className={`flex flex-wrap items-center justify-between gap-2 ${hideHeading ? "justify-end" : ""}`}>
        {hideHeading ? null : collapsible ? (
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            aria-controls="filter-fields"
            className="flex flex-1 items-center gap-2 rounded-md py-1 text-left text-base font-semibold text-foreground transition-colors hover:text-link focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <SlidersHorizontal className="size-4 text-muted-foreground" aria-hidden="true" />
            {t("filter.title")}
            {activeCount > 0 ? (
              <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">{activeCount}</span>
            ) : null}
            <ChevronDown
              className={`ml-auto size-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
              aria-hidden="true"
            />
          </button>
        ) : (
          <h2 className="text-base font-semibold text-foreground">{t("filter.title")}</h2>
        )}
        <button
          type="button"
          onClick={onReset}
          className="rounded-md px-2 py-1 text-sm font-medium text-link transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t("filter.resetAll")}
        </button>
      </div>

      <div id="filter-fields" hidden={!open} className="danest-filter-fields space-y-5">
      <fieldset className="danest-filter-group space-y-2.5">
        <legend className="mb-1 text-sm font-semibold text-foreground">{t("filter.neighborhood")}</legend>
        {labels.allNeighborhoods.filter(n=>n.active||filters.neighborhoods.includes(n.id)).map((n) => (
          <Checkbox
            key={n.id}
            label={n.name+(n.active?"":pick(" (inactive)"," (ngừng sử dụng)"))}
            checked={filters.neighborhoods.includes(n.id)}
            onChange={() => onChange({ ...filters, neighborhoods: toggle(filters.neighborhoods, n.id) })}
          />
        ))}
      </fieldset>

      <div className="danest-filter-range grid grid-cols-2 gap-3">
        <Field label={t("filter.minRent")} htmlFor="filter-min-rent">
          <Input id="filter-min-rent" type="number" min={0} inputMode="numeric" value={filters.minRent} onChange={(e) => onChange({ ...filters, minRent: e.target.value })} placeholder="0" />
        </Field>
        <Field label={t("filter.maxRent")} htmlFor="filter-max-rent">
          <Input id="filter-max-rent" type="number" min={0} inputMode="numeric" value={filters.maxRent} onChange={(e) => onChange({ ...filters, maxRent: e.target.value })} placeholder={t("filter.any")} />
        </Field>
      </div>
      <div className="danest-filter-quick flex flex-wrap gap-1.5" aria-label={t("filter.quickMax")}>
        {maxRentOptions.map((v) => (
          <Chip key={v} selected={filters.maxRent === String(v)} onClick={() => onChange({ ...filters, maxRent: filters.maxRent === String(v) ? "" : String(v) })}>
            {t("filter.upTo", { amount: v })}
          </Chip>
        ))}
      </div>

      <div className="danest-filter-range grid grid-cols-2 gap-3">
        <Field label={t("filter.minArea")} htmlFor="filter-min-area">
          <Input id="filter-min-area" type="number" min={0} step="any" value={filters.minArea} onChange={e=>onChange({...filters,minArea:e.target.value})} placeholder="0" />
        </Field>
        <Field label={t("filter.maxArea")} htmlFor="filter-max-area">
          <Input id="filter-max-area" type="number" min={0} step="any" value={filters.maxArea} onChange={e=>onChange({...filters,maxArea:e.target.value})} placeholder={t("filter.any")} />
        </Field>
      </div>
      <Field label={t("filter.checkIn")} htmlFor="filter-check-in">
        <Input id="filter-check-in" type="date" value={filters.checkIn} onChange={e=>onChange({...filters,checkIn:e.target.value})} />
      </Field>
      <Field label={t("filter.duration")} htmlFor="filter-duration">
        <Select id="filter-duration" value={filters.duration} onChange={(e) => onChange({ ...filters, duration: e.target.value })}>
          <option value="">{t("filter.anyDuration")}</option>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
            <option key={m} value={m}>
              {m} {m === 1 ? t("common.month") : t("common.months")}
            </option>
          ))}
        </Select>
      </Field>

      <div>
        <p className="mb-2 text-sm font-semibold text-foreground">{t("search.bedrooms")}</p>
        <div className="flex flex-wrap gap-1.5">
          {[1, 2, 3].map((b) => (
            <Chip key={b} selected={filters.bedrooms === b} onClick={() => onChange({ ...filters, bedrooms: filters.bedrooms === b ? null : b })}>
              {b === 3 ? "3+" : b}
            </Chip>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-foreground">{t("search.bathrooms")}</p>
        <div className="flex flex-wrap gap-1.5">
          {[1, 2].map((b) => (
            <Chip key={b} selected={filters.bathrooms === b} onClick={() => onChange({ ...filters, bathrooms: filters.bathrooms === b ? null : b })}>
              {b === 2 ? "2+" : b}
            </Chip>
          ))}
        </div>
      </div>

      <fieldset className="danest-filter-group space-y-2.5">
        <legend className="mb-1 text-sm font-semibold text-foreground">{t("filter.apartmentType")}</legend>
        {TYPE_KEYS.map((t) => (
          <Checkbox
            key={t}
            label={labels.listingType[t]}
            checked={filters.types.includes(t)}
            onChange={() => onChange({ ...filters, types: toggle(filters.types, t) })}
          />
        ))}
      </fieldset>

      <Field label={t("filter.furnishing")} htmlFor="filter-furnishing">
        <Select id="filter-furnishing" value={filters.furnishing} onChange={(e) => onChange({ ...filters, furnishing: e.target.value as Filters["furnishing"] })}>
          <option value="">{t("filter.any")}</option>
          <option value="furnished">{labels.furnishing.furnished}</option>
          <option value="semi-furnished">{labels.furnishing["semi-furnished"]}</option>
          <option value="unfurnished">{labels.furnishing.unfurnished}</option>
        </Select>
      </Field>

      <fieldset className="danest-filter-group">
        <legend className="mb-2 text-sm font-semibold text-foreground">{t("filter.amenities")}</legend>
        <div className="danest-amenities-grid grid grid-cols-1 gap-2 sm:grid-cols-2">
          {labels.allAmenities.filter(a=>a.active||filters.amenities.includes(a.id)).map((a) => (
            <Checkbox
              key={a.id}
              label={labels.amenity[a.id]+(a.active?"":pick(" (inactive)"," (ngừng sử dụng)"))}
              checked={filters.amenities.includes(a.id)}
              onChange={() => onChange({ ...filters, amenities: toggle(filters.amenities, a.id) })}
            />
          ))}
        </div>
      </fieldset>

      <Checkbox label={t("filter.verifiedOnly")} checked={filters.verifiedOnly} onChange={(e) => onChange({ ...filters, verifiedOnly: e.target.checked })} />

      <Field label={t("filter.availability")} htmlFor="filter-availability">
        <Select id="filter-availability" value={filters.availability} onChange={(e) => onChange({ ...filters, availability: e.target.value as Filters["availability"] })}>
          <option value="">{t("filter.any")}</option>
          <option value="available">{t("listing.available")}</option>
          <option value="reserved">{t("listing.reserved")}</option>
        </Select>
      </Field>
      </div>
    </div>
  );
}
