import { listingFormSteps, stepForSection, clampListingStep } from "~/lib/listing-form-steps";
import { useCatalog } from "~/state/catalog";
import { useRef, useState, type FormEvent } from "react";
import { AlertTriangle, ArrowRight, ArrowLeft, Building2, MapPin, Images, Sofa, Wallet, CalendarDays, ClipboardCheck, CheckCircle2, Info, ShieldQuestion } from "lucide-react";
import { draftToListing } from "~/api";
import { Link, useNavigate } from "~/lib/router";
import { useAppState } from "~/state/app-state";
import { useLandlordIdentity } from "~/pages/landlord/use-landlord-identity";
import { useToast } from "~/components/ui/toast";
import { Button } from "~/components/ui/button";
import { MODERATION_DESCRIPTION, MODERATION_LABEL } from "~/lib/moderation";
import { listingUuid, saveSupabaseListing, uploadListingPhoto, submitSupabaseListing } from "~/api/supabase-listings";
import { FormSections, type FormErrors } from "~/pages/landlord/form-sections";
import { useI18n } from "~/i18n/language-context";
import type { AmenityId, Listing, ListingDraft, ListingModeration } from "~/types";

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
    type:"apartment", floorLevel:"", availability:"available", paymentDay:"1", rentalNotes:"",
    extraCosts: DEFAULT_COST_KEYS.map((c) => ({ label: t(c.key), amount: "", state: "unknown", unit:"per month", cadence:"monthly" })),
  };
}

function draftFromListing(listing: Listing): ListingDraft {
  return {
    type: listing.type, availability:listing.availability, location: listing.location, floorLevel: listing.floorLevel === "—" ? "" : listing.floorLevel, paymentDay: String(listing.rentalTerms.paymentDayOfMonth), rentalNotes: listing.rentalTerms.notes.join("\n"),
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
      unit: i.cadence === "one-time" ? "per stay" : i.unit, cadence:i.cadence,
    })),
  };
}

type Errors = FormErrors;

const SECTION_FIELDS: Record<string, string> = {
  floorLevel:"size", rentalNotes:"terms",
  title: "basics",
  summary: "basics",
  description: "basics",
  neighborhood: "location",
  address: "location",
  location:"location", paymentDay:"terms",
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
  const badCost = draft.extraCosts.find((c) => !c.label.trim() || (c.state !== "unknown" && (c.amount.trim() === "" || !Number.isFinite(Number(c.amount)) || Number(c.amount) < 0)));
  if (badCost) errors.costs = t("landlord.form.errCost", { label: badCost.label });
  return errors;
}

export function PropertyFormPage(props: { mode: "create" | "edit"; listingId?: string }) {
  const { listings, listingsLoading, session } = useAppState();
  const { pick } = useI18n();
  if(props.mode==="edit") {
    const owned=listings.find(l=>l.id===props.listingId && l.landlordId===session?.user.id && l.imageRecords!==undefined);
    if(!owned) return <p>{listingsLoading?pick("Loading your listing…","Đang tải tin của bạn…"):pick("Listing unavailable or not owned by you. Return to My Properties.","Tin không khả dụng hoặc không thuộc bạn. Quay lại danh sách tin.")}</p>;
    if(owned.status==="hidden"||owned.status==="archived") return <div className="space-y-3"><p>{pick("This listing is locked. Contact an administrator before editing.","Tin đang bị khóa chỉnh sửa. Liên hệ Admin trước khi sửa.")}</p><Button asChild><Link to="/landlord/listings">{pick("My Properties","Tin của tôi")}</Link></Button></div>;
  }
  return <PropertyFormInner key={`${props.mode}:${props.listingId}:${props.mode === "edit" && listings.some(l => l.id === props.listingId)}`} {...props} />;
}

function PropertyFormInner({ mode, listingId }: { mode: "create" | "edit"; listingId?: string }) {
  const { t, pick } = useI18n();
  const { listings, refreshListings } = useAppState();
  const landlord = useLandlordIdentity();
  const catalog=useCatalog();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [step,setStep]=useState(0);
  const stepHeading=useRef<HTMLHeadingElement>(null);
  const stepLabels=[pick("Basics","Cơ bản"),pick("Location","Vị trí"),pick("Photos","Hình ảnh"),pick("Amenities","Tiện ích"),pick("Costs","Chi phí"),pick("Rental terms","Điều kiện thuê"),pick("Review","Xem trước")];
  const stepIcons=[Building2,MapPin,Images,Sofa,Wallet,CalendarDays,ClipboardCheck];
  const goStep=(n:number)=>{setStep(clampListingStep(n));window.requestAnimationFrame(()=>{stepHeading.current?.focus({preventScroll:true});stepHeading.current?.scrollIntoView({block:"start",behavior:"instant"});});};

  const existing = mode === "edit" ? listings.find((l) => l.id === listingId && l.imageRecords!==undefined) : undefined;
  const [draft, setDraft] = useState<ListingDraft>(() => (existing ? draftFromListing(existing) : emptyDraft(t)));
  const [errors, setErrors] = useState<Errors>({});
  const [moderationResult, setModerationResult] = useState<ListingModeration | null>(null);
  const formRef = useRef<HTMLDivElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [photos,setPhotos]=useState(()=>existing?.imageRecords??[]);
  const snapshot=useRef((existing?.imageRecords??[]).map(x=>x.id));
  const [mustReopen,setMustReopen]=useState(false);
  const [savedUuid, setSavedUuid] = useState<string | null>(null);
  const [failure, setFailure] = useState("");

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
    setStep(stepForSection(section));
    window.requestAnimationFrame(()=>{const el=formRef.current?.querySelector<HTMLElement>(`#${section}`);el?.scrollIntoView({behavior:"instant",block:"start"});const field=formRef.current?.querySelector<HTMLElement>(`#${firstKey}`);if(field&&field.matches("input,select,textarea,button"))field.focus({preventScroll:true});else stepHeading.current?.focus({preventScroll:true});});
  };

  const persist = async (submit: boolean) => {
    if (submitting || mustReopen) return;
    if(!catalog.ready){setFailure(pick("Catalog not ready. Retry or reload before saving.","Chưa tải được danh mục. Thử lại hoặc tải lại trang trước khi lưu."));void catalog.refresh();return;}
    const errs = validate(draft, t);
    if(submit){
      if(catalog.required.includes("floorLevel")&&(!draft.floorLevel?.trim()||draft.floorLevel.trim()==="—"))errs.floorLevel=pick("Enter floor / level.","Nhập tầng.");
      if(catalog.required.includes("amenities")&&!draft.amenities.length)errs.amenities=pick("Choose at least one amenity.","Chọn ít nhất một tiện ích.");
      if(catalog.required.includes("rentalNotes")&&!draft.rentalNotes?.trim())errs.rentalNotes=pick("Enter rental conditions.","Nhập điều kiện thuê.");
    }
    if(!submit){if(draft.title.trim()) delete errs.title;delete errs.summary;delete errs.description;delete errs.address;delete errs.availableFrom;}
    if (!submit || files.length > 0 || photos.length>0) delete errs.images; else errs.images=t("landlord.form.errImages");
    if(submit && draft.location?.precision!=="owner-selected" && (!existing || (existing as Listing & {locationRequired?:boolean}).locationRequired)) errs.location=pick("Choose an apartment location on the map.","Hãy chọn vị trí căn hộ trên bản đồ.");
    if(!Number.isInteger(Number(draft.paymentDay)) || Number(draft.paymentDay)<1 || Number(draft.paymentDay)>31) errs.paymentDay=pick("Payment day must be 1–31.","Ngày thanh toán phải từ 1–31.");
    setErrors(errs);
    if (Object.keys(errs).length) { scrollToFirstError(errs); return; }
    setSubmitting(true); setFailure("");
    let uuid = savedUuid;
    try {
      if (!uuid && existing) uuid = await listingUuid(existing.id);
      const listing = {...draftToListing(draft, landlord.id),availableFrom:draft.availableFrom};
      const order=photos.map(x=>x.id);
      const changed=JSON.stringify(order)!==JSON.stringify(snapshot.current);
      uuid = await saveSupabaseListing(listing, uuid ?? undefined, changed?{snapshot:snapshot.current,order}:undefined,!submit);
      snapshot.current=order;
      setSavedUuid(uuid);
      for (const file of files) {
        await uploadListingPhoto(uuid, file);
        setFiles(prev => prev.filter(f => f !== file));
      }
      if (submit) {
        const result = await submitSupabaseListing(uuid);
        setModerationResult(result.moderation);
        toast({title:t(MODERATION_LABEL_KEY[result.moderation.result]),description:pick(`Server status: ${result.status}`,`Trạng thái từ máy chủ: ${result.status}`),tone:result.moderation.result === "passed" ? "success" : "info"});
      } else toast({title:pick("Draft saved to database", "Đã lưu bản nháp vào database"),tone:"success"});
      await refreshListings();
      navigate("/landlord/listings");
    } catch (err) {
      if(uuid) setMustReopen(true);
      setFailure((err instanceof Error ? err.message : String(err)) + (uuid ? pick(" — Draft may already be saved. Open the listing list and reopen the draft before retrying."," — Bản nháp có thể đã được lưu. Mở danh sách tin và mở lại bản nháp trước khi thử lại.") : ""));
    } finally { setSubmitting(false); }
  };
  const handleSubmit = (e: FormEvent) => { e.preventDefault(); if(step===listingFormSteps.length-1)void persist(true); };
  const saveAsDraft = () => { void persist(false); };

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
    <div ref={formRef} className="mx-auto max-w-4xl space-y-6">
      {existing?.verificationBadge && <p className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm">{pick("Saving this listing removes its verification badge and requires a fresh evidence review. The listing must be moderated again.","Lưu chỉnh sửa sẽ thu hồi huy hiệu xác minh, yêu cầu nộp minh chứng mới và kiểm duyệt lại tin.")}</p>}
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

      {failure && <p role="alert" className="rounded border border-destructive p-3 text-destructive">{failure}</p>}
      <nav aria-label={pick("Listing form steps","Các bước đăng tin")} className="rounded-2xl border border-border bg-card p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2"><span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{pick("Listing setup","Thiết lập tin đăng")}</span><span className="text-sm font-semibold tabular-nums">{step+1}/7</span></div>
        <div role="progressbar" aria-label={pick("Current step","Bước hiện tại")} aria-valuemin={1} aria-valuemax={7} aria-valuenow={step+1} className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-[#829987]" style={{width:`${(step+1)/7*100}%`}}/></div>
        <ol className="mt-4 grid grid-cols-4 gap-2 sm:grid-cols-7">{stepLabels.map((label,i)=>{const Icon=stepIcons[i];const hasError=Object.keys(errors).some(k=>stepForSection(SECTION_FIELDS[k]??"basics")===i);return <li key={i}><button type="button" disabled={submitting||mustReopen} aria-current={step===i?"step":undefined} onClick={()=>goStep(i)} className={`flex w-full min-w-0 flex-col items-center gap-1 rounded-lg p-2 text-center text-xs focus-visible:ring-2 focus-visible:ring-ring ${step===i?"bg-primary text-primary-foreground":"bg-muted/50 text-foreground hover:bg-muted"}`}><Icon className="size-5" aria-hidden="true"/><span className="break-words">{i+1}. {label}</span>{hasError&&<span className="text-[10px] underline">{pick("Check fields","Cần sửa")}</span>}</button></li>;})}</ol>
      </nav>
      <h2 ref={stepHeading} tabIndex={-1} className="scroll-mt-24 font-heading text-3xl font-medium outline-none">{stepLabels[step]}</h2>
      <form onSubmit={handleSubmit} className="space-y-6" noValidate>
        <fieldset disabled={submitting||mustReopen} className="min-w-0 space-y-5">
        <FormSections
          activeSections={listingFormSteps[step]}
          draft={draft}
          errors={errors}
          update={update}
          setCost={setCost}
          toggleAmenity={toggleAmenity}
          setDraft={setDraft}
          files={files}
          setFiles={setFiles}
          busy={submitting||mustReopen}
          photos={photos}
          setPhotos={setPhotos}
        />
        </fieldset>
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-card p-3 sm:justify-end">
          <Button type="button" variant="outline" disabled={step===0||submitting||mustReopen} onClick={()=>goStep(step-1)}><ArrowLeft className="size-4"/>{pick("Back","Quay lại")}</Button>
          <Button type="button" variant="ghost" asChild>
            <Link to="/landlord/listings">{t("common.cancel")}</Link>
          </Button>
          {(mode === "create" || mode === "edit") ? (
            <Button type="button" variant="outline" disabled={submitting||mustReopen} onClick={saveAsDraft}>
              {t("landlord.form.saveAsDraft")}
            </Button>
          ) : null}
          {step<listingFormSteps.length-1?<Button type="button" disabled={submitting||mustReopen} onClick={()=>goStep(step+1)}>{pick("Continue","Tiếp tục")}<ArrowRight className="size-4"/></Button>:<Button type="submit" disabled={submitting||mustReopen}>{mode === "create" ? t("landlord.form.submitChecks") : t("landlord.form.saveAndRecheck")}</Button>}
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
            {pick("Checks were run by the server.", "Kiểm duyệt được thực hiện tại máy chủ.")}
          </p>
        </section>
      ) : null}

      <p className="text-xs text-muted-foreground">
        {t("landlord.form.prototypeNote")}
      </p>
    </div>
  );
}
