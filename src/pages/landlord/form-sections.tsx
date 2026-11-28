import { ListingCopyAssistant } from "~/components/detail/listing-copy-assistant";
import { useCatalog } from "~/state/catalog";
import { createContext, useContext, type Dispatch, type ReactNode, type SetStateAction } from "react";
import { Plus, X, ClipboardCheck } from "lucide-react";
import { FURNISHING_LABEL } from "~/data/constants";
import { useI18n } from "~/i18n/language-context";
import { useLabels } from "~/i18n/use-labels";
import { todayISO } from "~/lib/format";
import { Button } from "~/components/ui/button";
import { Field, Input, Select, Textarea } from "~/components/ui/form";
import { LocationPicker } from "~/pages/landlord/location-picker";
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

const ActiveSections = createContext<readonly string[]>([]);
export function SectionCard({ title, id, children }: { title: string; id: string; children: ReactNode }) {
  const active=useContext(ActiveSections);
  return (
    <section hidden={!active.includes(id)}
      className="scroll-mt-24 rounded-2xl border border-border bg-card p-4 sm:p-6"
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
  activeSections, draft,
  errors,
  update,
  setCost,
  toggleAmenity,
  setDraft, files, setFiles, busy, photos, setPhotos,
}: {
  activeSections: readonly string[];
  photos: {id:string;url:string|null}[];
  setPhotos: Dispatch<SetStateAction<{id:string;url:string|null}[]>>;
  files: File[];
  setFiles: Dispatch<SetStateAction<File[]>>;
  busy: boolean;
  draft: ListingDraft;
  errors: FormErrors;
  update: <K extends keyof ListingDraft>(key: K, value: ListingDraft[K]) => void;
  setCost: (index: number, patch: Partial<ListingDraft["extraCosts"][number]>) => void;
  toggleAmenity: (id: AmenityId) => void;
  setDraft: Dispatch<SetStateAction<ListingDraft>>;
}) {
  const { t, pick } = useI18n();
  const labels = useLabels();
  const {required}=useCatalog();
  const summaryLeft = 120 - draft.summary.length;
  return (
    <ActiveSections.Provider value={activeSections}>
      <p className="text-xs text-muted-foreground">{pick("* Required before submission. A draft can omit summary, description, address, move-in date, map pin and photos; core rent, area, neighborhood and furnishing are still required.","* Bắt buộc khi gửi duyệt. Bản nháp có thể thiếu tóm tắt, mô tả, địa chỉ, ngày cho thuê, vị trí và ảnh; vẫn cần giá, diện tích, khu vực và nội thất cơ bản.")}</p>
      <SectionCard title={t("landlord.formSection.basics")} id="basics">
        <Field label={t("landlord.field.listingTitle")+" *"} htmlFor="title" error={errors.title} hint={t("landlord.field.listingTitleHint")}>
          <Input id="title" value={draft.title} onChange={(e) => update("title", e.target.value)} placeholder={t("landlord.field.listingTitlePlaceholder")} />
        </Field>
        <Field
          label={t("landlord.field.summary")+" *"}
          htmlFor="summary"
          error={errors.summary}
          hint={t("landlord.field.summaryLeft", { count: summaryLeft })}
        >
          <Input id="summary" value={draft.summary} onChange={(e) => update("summary", e.target.value)} maxLength={120} placeholder={t("landlord.field.summaryPlaceholder")} />
        </Field>
        <Field label={t("landlord.field.description")+" *"} htmlFor="description" error={errors.description} hint={t("landlord.field.descriptionHint")}>
          <Textarea id="description" value={draft.description} onChange={(e) => update("description", e.target.value)} />
        </Field>
      </SectionCard>

      <SectionCard title={t("landlord.formSection.location")} id="location">
        <Field label={t("landlord.field.neighborhood")+" *"} htmlFor="neighborhood" error={errors.neighborhood}>
          <Select id="neighborhood" value={draft.neighborhood} onChange={(e) => {update("neighborhood", e.target.value as NeighborhoodId);update("location",undefined);}}>
            <option value="">{t("landlord.field.selectNeighborhood")}</option>
            {labels.allNeighborhoods.filter(n=>n.active||n.id===draft.neighborhood).map((n) => (
              <option key={n.id} value={n.id}>{n.name}{!n.active?pick(" (inactive)"," (ngừng sử dụng)"):""}</option>
            ))}
          </Select>
        </Field>
        <Field label={t("landlord.field.address")+" *"} htmlFor="address" error={errors.address}>
          <Input id="address" value={draft.address} onChange={(e) => update("address", e.target.value)} placeholder={t("landlord.field.addressPlaceholder")} />
        </Field>
        {activeSections.includes("location") && draft.neighborhood && <LocationPicker center={labels.allNeighborhoods.find(n=>n.id===draft.neighborhood)?.center??{lat:16.06,lng:108.22}} value={draft.location} onChange={v=>update("location",v)}/>}
        {errors.location && <p role="alert" className="text-sm text-destructive">{errors.location}</p>}
      </SectionCard>

      <SectionCard title={t("landlord.formSection.size")} id="size">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={pick("Apartment type","Loại căn hộ")} htmlFor="listingType"><Select id="listingType" value={draft.type??"apartment"} onChange={e=>update("type",e.target.value as ListingDraft["type"])}>{Object.entries(labels.listingType).map(([id,label])=><option key={id} value={id}>{label}</option>)}</Select></Field>
          <Field label={pick("Floor / level","Tầng")+(required.includes("floorLevel")?" *":"")} htmlFor="floorLevel" error={errors.floorLevel}><Input id="floorLevel" maxLength={80} value={draft.floorLevel??""} onChange={e=>update("floorLevel",e.target.value)}/></Field>
          <Field label={t("landlord.field.bedrooms")+" *"} htmlFor="bedrooms" error={errors.bedrooms}>
            <Input id="bedrooms" type="number" min={0} max={6} value={draft.bedrooms} onChange={(e) => update("bedrooms", e.target.value)} />
          </Field>
          <Field label={t("landlord.field.bathrooms")+" *"} htmlFor="bathrooms" error={errors.bathrooms}>
            <Input id="bathrooms" type="number" min={1} max={4} value={draft.bathrooms} onChange={(e) => update("bathrooms", e.target.value)} />
          </Field>
          <Field label={t("landlord.field.floorArea")+" *"} htmlFor="floorArea" error={errors.floorArea}>
            <Input id="floorArea" type="number" min={11} value={draft.floorArea} onChange={(e) => update("floorArea", e.target.value)} />
          </Field>
          <Field label={t("landlord.field.furnishing")+" *"} htmlFor="furnishing" error={errors.furnishing}>
            <Select id="furnishing" value={draft.furnishing} onChange={(e) => update("furnishing", e.target.value as FurnishingStatus)}>
              <option value="">{t("landlord.field.selectFurnishing")}</option>
              {(Object.keys(FURNISHING_LABEL) as FurnishingStatus[]).map((f) => (
                <option key={f} value={f}>{labels.furnishing[f]}</option>
              ))}
            </Select>
          </Field>
        </div>
      </SectionCard>

      <SectionCard title={t("landlord.formSection.amenities")+(required.includes("amenities")?" *":"")} id="amenities">
        {errors.amenities&&<p role="alert" className="text-destructive text-sm">{errors.amenities}</p>}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {labels.allAmenities.filter(a=>a.active||draft.amenities.includes(a.id)).map((a) => (
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
              {labels.amenity[a.id]}{!a.active?pick(" (inactive)"," (ngừng sử dụng)"):""}
            </label>
          ))}
        </div>
      </SectionCard>

      <SectionCard title={t("landlord.formSection.costs")} id="costs">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label={`${t("landlord.availability.monthlyRent")} (USD) *`} htmlFor="monthlyRent" error={errors.monthlyRent}>
            <Input id="monthlyRent" type="number" min={1} value={draft.monthlyRent} onChange={(e) => update("monthlyRent", e.target.value)} />
          </Field>
          <Field label={t("landlord.field.depositMonths")+" *"} htmlFor="depositMonths" error={errors.depositMonths}>
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
              <div key={index} className="grid grid-cols-1 gap-2 rounded-lg border border-border p-3 sm:grid-cols-2">
                <label className="sr-only" htmlFor={`cost-label-${index}`}>{t("landlord.field.costLabel")}</label>
                <Input id={`cost-label-${index}`} value={cost.label} onChange={(e) => setCost(index, { label: e.target.value })} className="h-10" placeholder={t("landlord.field.costLabel")} />
                <label className="sr-only" htmlFor={`cost-amount-${index}`}>{t("landlord.field.amountPerMonth")}</label>
                <Input id={`cost-amount-${index}`} type="number" min={0} step="any" disabled={cost.state==="unknown"} value={cost.amount} onChange={(e) => setCost(index, { amount: e.target.value })} className="h-10" placeholder={t("landlord.field.amount")} />
                <label className="sr-only" htmlFor={`cost-state-${index}`}>{t("landlord.field.costState")}</label>
                <Select id={`cost-state-${index}`} value={cost.state} onChange={(e) => setCost(index, { state: e.target.value as CostState, ...(e.target.value==="unknown"?{amount:""}:{}) })} className="h-10">
                  {(Object.keys(COST_STATE_LABEL) as CostState[]).map((s) => (
                    <option key={s} value={s}>{t(COST_STATE_LABEL[s])}</option>
                  ))}
                </Select>
                <Select aria-label={pick("Fee basis","Đơn vị phí")} value={cost.unit??"per month"} onChange={e=>setCost(index,{unit:e.target.value,cadence:e.target.value==="per stay"?"one-time":"monthly"})}>
                  {[["per month",pick("USD / month","USD / tháng")],["per stay",pick("USD / stay (once)","USD / kỳ thuê (một lần)")],["per kWh","USD / kWh"],["per m³","USD / m³"],["per person/month",pick("USD / person / month","USD / người / tháng")],["per m²/month",pick("USD / m² / month","USD / m² / tháng")]].map(([v,l])=><option key={v} value={v}>{l}</option>)}
                  {cost.unit&&!['per month','per stay','per kWh','per m³','per person/month','per m²/month'].includes(cost.unit)&&<option value={cost.unit}>{cost.unit}</option>}
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
            onClick={() => setDraft((prev) => ({ ...prev, extraCosts: [...prev.extraCosts, { label: "", amount: "", state: "unknown", unit:"per month", cadence:"monthly" }] }))}
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
          <Field label={t("landlord.field.availableFrom")+" *"} htmlFor="availableFrom" error={errors.availableFrom}>
            <Input id="availableFrom" type="date" min={todayISO()} value={draft.availableFrom} onChange={(e) => update("availableFrom", e.target.value)} />
          </Field>
        </div>
      </SectionCard>

      <SectionCard title={pick("Additional rental terms","Điều kiện thuê bổ sung")} id="terms"><Field label={pick("Availability","Tình trạng căn hộ")} htmlFor="availability"><Select id="availability" value={draft.availability??"available"} onChange={e=>update("availability",e.target.value as ListingDraft["availability"])}><option value="available">{pick("Available","Còn trống")}</option><option value="reserved">{pick("Reserved","Đã giữ chỗ")}</option><option value="unavailable">{pick("Unavailable","Không còn trống")}</option></Select></Field><Field label={pick("Payment day of month","Ngày thanh toán hàng tháng")} htmlFor="paymentDay"><Input id="paymentDay" type="number" min={1} max={31} value={draft.paymentDay??"1"} onChange={e=>update("paymentDay",e.target.value)}/></Field><Field label={pick("Rental conditions (one per line)","Điều kiện thuê (mỗi dòng một điều kiện)")+(required.includes("rentalNotes")?" *":"")} htmlFor="rentalNotes" error={errors.rentalNotes}><Textarea id="rentalNotes" maxLength={2000} value={draft.rentalNotes??""} onChange={e=>update("rentalNotes",e.target.value)}/></Field>{errors.paymentDay&&<p className="text-destructive text-sm">{errors.paymentDay}</p>}</SectionCard>
      <SectionCard title={t("landlord.formSection.photos")} id="photos">
        <PhotoPicker selected={photos} setSelected={setPhotos} files={files} setFiles={setFiles} busy={busy} error={errors.images} />
      </SectionCard>
        <SectionCard title={pick("Review your listing","Xem trước tin đăng")} id="review">
        <div className="flex items-start gap-3 rounded-xl bg-[#E9EFE9] p-4 text-[#365844]"><ClipboardCheck className="size-5 shrink-0" aria-hidden="true"/><p className="text-sm">{pick("Check your facts before submission. Use the step navigation to edit any section. The server still validates and moderates your listing.","Kiểm tra thông tin trước khi gửi. Dùng thanh các bước để chỉnh sửa từng mục. Máy chủ vẫn kiểm tra và kiểm duyệt tin.")}</p></div>
        <ListingCopyAssistant draft={draft} busy={busy} onApply={copy=>setDraft(prev=>({...prev,...copy}))}/>
        <div className="rounded-xl border border-border p-4 space-y-3"><h3 className="font-heading text-2xl break-words">{draft.title||pick("Untitled listing","Tin chưa có tiêu đề")}</h3><p className="text-sm break-words">{draft.summary||"—"}</p><p className="whitespace-pre-wrap break-words text-sm text-muted-foreground">{draft.description||"—"}</p><dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">{[
          [pick("Location","Vị trí"),[labels.neighborhood[draft.neighborhood]??draft.neighborhood,draft.address].filter(Boolean).join(" · ")||"—"],
          [pick("Apartment type","Loại căn hộ"),draft.type?labels.listingType[draft.type]:"—"],
          [pick("Bedrooms / bathrooms","Phòng ngủ / phòng tắm"),`${draft.bedrooms||"—"} / ${draft.bathrooms||"—"}`],
          [pick("Furnishing","Nội thất"),draft.furnishing?labels.furnishing[draft.furnishing]:"—"],
          [pick("Floor","Tầng"),draft.floorLevel||"—"],
          [pick("Monthly rent","Giá thuê tháng"),draft.monthlyRent?`USD ${draft.monthlyRent}`:"—"],
          [pick("Area","Diện tích"),draft.floorArea?`${draft.floorArea} m²`:"—"],
          [pick("Photos","Hình ảnh"),String(photos.length+files.length)],
          [pick("Rental duration","Thời hạn thuê"),`${draft.minMonths}–${draft.maxMonths} ${pick("months","tháng")}`],
          [pick("Move-in","Ngày chuyển vào"),draft.availableFrom||"—"],
          [pick("Amenities","Tiện ích"),draft.amenities.map(a=>labels.amenity[a]??a).join(", ")||"—"],
          [pick("Deposit","Tiền cọc"),`${draft.depositMonths} ${pick("months of rent","tháng tiền thuê")}`],
          [pick("Payment day","Ngày thanh toán"),draft.paymentDay||"—"],
          [pick("Availability","Tình trạng"),draft.availability==="reserved"?pick("Reserved","Đã giữ chỗ"):draft.availability==="unavailable"?pick("Unavailable","Không còn trống"):pick("Available","Còn trống")],
          [pick("Rental conditions","Điều kiện thuê"),draft.rentalNotes||"—"],
          [pick("Additional costs","Phụ phí"),String(draft.extraCosts.length)],
        ].map(([label,value])=><div key={label} className="min-w-0 rounded-lg bg-muted/60 p-3"><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 break-words text-sm font-semibold">{value}</dd></div>)}</dl><h4 className="text-sm font-semibold">{pick("Fee details","Chi tiết phụ phí")}</h4><ul className="divide-y divide-border">{draft.extraCosts.map((cost,i)=><li key={i} className="flex flex-wrap justify-between gap-2 py-2 text-sm"><span className="break-words">{cost.label||"—"}</span><span className="font-medium">{cost.state==="unknown"?pick("Unknown","Chưa xác định"):`${cost.amount||"—"} USD · ${cost.unit??"per month"}`} · {t(COST_STATE_LABEL[cost.state])}</span></li>)}</ul></div>
      </SectionCard>
    </ActiveSections.Provider>
    );
  }

