import { EvidencePanel } from "~/components/verification/evidence-panel";
import { useMemo, useState } from "react";
import { AlertTriangle, Search, Clock, FilePen, EyeOff, CircleCheck, Archive, CircleX } from "lucide-react";
import { formatDate, formatRent, todayISO } from "~/lib/format";
import { availabilityStatus } from "~/lib/availability";
import { MODERATION_LABEL } from "~/lib/moderation";
import { Link } from "~/lib/router";
import { useAppState } from "~/state/app-state";
import { listingUuid, saveSupabaseListing, submitSupabaseListing } from "~/api/supabase-listings";
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
  const Icon=({published:CircleCheck,paused:EyeOff,draft:FilePen,pending:Clock,"needs-attention":AlertTriangle,rejected:CircleX,hidden:EyeOff,archived:Archive})[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium", tone.classes)}>
      <Icon className="size-3.5 shrink-0" aria-hidden="true"/>{t(tone.labelKey)}
    </span>
  );
}

function ReviewSummary({listing}:{listing:Listing}) {
  const {pick,t}=useI18n();const auto=listing.moderation.autoReviewedAt;const manual=listing.moderation.manualReview;
  const decision=manual?({approved:pick("Approved","Đã duyệt"),rejected:pick("Rejected","Đã từ chối"),"corrections-requested":pick("Corrections requested","Yêu cầu bổ sung"),hidden:pick("Hidden","Đã ẩn"),restored:pick("Restored","Đã khôi phục")})[manual.decision]:null;
  return <details className="mt-2 rounded-lg border border-border p-2 text-xs"><summary className="cursor-pointer font-medium">{pick("Review details","Tiến trình kiểm duyệt")}</summary><dl className="mt-2 space-y-2 border-l border-border pl-3"><div><dt className="text-muted-foreground">{pick("Automated check","Kiểm tra tự động")}</dt><dd className="font-medium">{auto?`${t(({passed:"landlord.moderation.passed","needs-attention":"landlord.moderation.needsAttention",rejected:"landlord.moderation.rejected",incomplete:"landlord.moderation.incomplete"})[listing.moderation.result])} · ${formatDate(auto)}`:pick("No recorded check","Chưa có lần kiểm tra")}</dd></div><div><dt className="text-muted-foreground">{pick("Admin review","Admin xét duyệt")}</dt><dd className="font-medium">{decision??pick("No recorded decision","Chưa có quyết định ghi nhận")}</dd>{manual?.reason&&<dd className="break-words">{manual.reason}</dd>}</div><div><dt className="text-muted-foreground">{pick("Current listing status","Trạng thái tin hiện tại")}</dt><dd><StatusBadge status={listing.status}/></dd></div><div><dt className="text-muted-foreground">{pick("Evidence verification (separate)","Xác minh minh chứng (riêng biệt)")}</dt><dd>{listing.verificationBadge?pick("Basic verification","Xác minh cơ bản"):pick("Not verified","Chưa xác minh")}</dd></div></dl></details>;
}
function useListingActions() {
  const { updateListing, refreshListings } = useAppState();
  const { toast } = useToast();
  const { t, pick } = useI18n();

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
    const uuid = await listingUuid(listing.id);
    await saveSupabaseListing({...listing,monthlyRent,costs:{...listing.costs,monthlyRent}},uuid);
    try {
      const result = await submitSupabaseListing(uuid);
      toast({title: result.status === "pending" ? pick("Price saved; awaiting review", "Đã lưu giá; chờ duyệt") : pick("Price saved; check moderation result", "Đã lưu giá; kiểm tra kết quả kiểm duyệt"), description:result.moderation.reasons.join("; ") || listing.title,tone:result.status === "pending" ? "success" : "warning"});
    } finally { await refreshListings(); }
  };

  const togglePause = async (listing: Listing) => {
    if (listing.status === "published") {
      await updateListing(listing.id, { status: "paused" });
      toast({ title: t("landlord.availability.paused"), description: listing.title, tone: "success" });
      return;
    }
    const uuid = await listingUuid(listing.id);
    const result = await submitSupabaseListing(uuid);
    await refreshListings();
    const reasons = result.moderation.reasons.map(reason => {
      if (reason === "Missing: available-from date") return pick(reason, "Thiếu ngày bắt đầu có thể thuê.");
      return reason;
    }).join("; ");
    const title = result.status === "pending"
      ? pick("Submitted for admin review", "Đã gửi Admin xét duyệt")
      : result.status === "needs-attention"
        ? pick("Admin review required", "Cần Admin xem xét")
        : result.status === "draft"
          ? pick("Incomplete listing — edit and resubmit", "Tin thiếu thông tin — hãy chỉnh sửa và gửi lại")
          : result.status === "rejected"
            ? pick("Listing rejected by automated checks", "Tin bị từ chối khi kiểm duyệt tự động")
            : pick("Listing status updated", "Đã cập nhật trạng thái tin");
    toast({ title, description: reasons || listing.title, tone: result.status === "pending" ? "success" : "warning" });
  };

  const moveToDraft = async (listing: Listing) => {
    await updateListing(listing.id, { status: "draft" });
    toast({
      title: t("landlord.availability.movedToDraft"),
      description: t("landlord.availability.movedToDraftDesc", { title: listing.title }),
      tone: "info",
    });
  };

  const archive = async (listing: Listing) => {
    await updateListing(listing.id,{status:"archived"});
    toast({title:pick("Listing archived","Đã lưu trữ tin"),tone:"success"});
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

  const safe = <A extends unknown[]>(fn: (...args:A)=>Promise<void>) => async (...args:A) => { try { await fn(...args); } catch (err) {toast({title:pick("Action failed", "Không thực hiện được"),description:err instanceof Error ? err.message : String(err),tone:"warning"});} };
  return { setAvailability:safe(setAvailability), setRent:safe(setRent), togglePause:safe(togglePause), moveToDraft:safe(moveToDraft), archive:safe(archive), reconfirm:safe(reconfirm) };
}

type ActionMode = "price" | "availability" | "evidence" | "confirmPause" | "confirmDraft" | "confirmArchive" | null;

function AvailabilityStamp({ listing }: { listing: Listing }) {
  const { t, pick } = useI18n();
  const status = availabilityStatus(listing);
  if (listing.status !== "published" && !listing.availabilityHiddenAt) return null;
  if(status.state==="unknown") return <span className="text-xs text-muted-foreground">{pick("Not yet confirmed","Chưa xác nhận")}</span>;
  if (status.state === "overdue" || status.state === "hidden") {
    return (
      <span className="inline-flex h-8 items-center gap-1 rounded-md border border-warning/20 bg-warning/10 px-2.5 text-xs font-medium text-warning">
        {status.state === "hidden" ? t("landlord.availability.hiddenFromSearch") : t("landlord.availability.overdue")} ·{" "}
        {t("landlord.availability.days", { count: status.daysSinceConfirmed })}
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
  const { t, pick } = useI18n();
  const [mode, setMode] = useState<ActionMode>(null);
  const [rentValue, setRentValue] = useState(String(listing.monthlyRent));
  const [confirmAvailability, setConfirmAvailability] = useState<Availability>(listing.availability);
  const { setAvailability, setRent, togglePause, moveToDraft, archive, reconfirm } = useListingActions();

  const locked = listing.status === "hidden" || listing.status === "archived";
  const smallBtn =
    "inline-flex h-8 items-center justify-center rounded-md border border-input px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <AvailabilityStamp listing={listing} />
        <button type="button" className={smallBtn} aria-expanded={mode === "evidence"} onClick={() => setMode(mode === "evidence" ? null : "evidence")}>{pick("Verification evidence", "Minh chứng xác minh")}</button>
        {!locked && <Link to={`/landlord/listings/edit/${listing.id}`} className={smallBtn}>
          {t("landlord.availability.edit")}
        </Link>}
        {(listing.status === "published" || !!listing.availabilityHiddenAt) && listing.availability==="available" ? (
          <button type="button" className={smallBtn} onClick={() => void reconfirm(listing)}>
            {t("landlord.availability.reconfirm")}
          </button>
        ) : null}
        {listing.moderation.reasons.length > 0 && (listing.status === "needs-attention" || listing.status === "rejected" || listing.status === "draft") ? (
          <span className="inline-flex h-8 items-center rounded-md border border-warning/20 bg-warning/10 px-2.5 text-xs font-medium text-warning">
            {t("landlord.availability.adminReview", { result: MODERATION_LABEL[listing.moderation.result] })}
          </span>
        ) : null}
        {!locked && <><button
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
        {(["published","draft","paused","rejected"].includes(listing.status)) && <button
          type="button"
          className={smallBtn}
          onClick={() => (listing.status === "published" ? setMode("confirmPause") : void togglePause(listing))}
        >
          {listing.status === "published" ? t("landlord.availability.pause") : t("landlord.availability.republish")}
        </button>}
        {listing.status !== "draft" ? (
          <button
            type="button"
            className="inline-flex h-8 items-center justify-center rounded-md border border-destructive/30 px-2.5 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => setMode("confirmDraft")}
          >
            {pick("Move to draft","Chuyển về bản nháp")}
          </button>
        ) : null}
        <button type="button" className={smallBtn} onClick={()=>setMode("confirmArchive")}>{pick("Archive","Lưu trữ")}</button>
        </>}
      </div>
      {mode === "confirmArchive" && !locked && <div className="rounded-lg border p-3 text-sm"><p>{pick("Archive this listing? It will no longer be editable or visible publicly. Inquiry history is preserved.","Lưu trữ tin? Tin sẽ không hiển thị công khai hoặc chỉnh sửa được. Lịch sử yêu cầu thuê vẫn được giữ.")}</p><div className="mt-2 flex gap-2"><Button size="sm" variant="destructive" onClick={async()=>{await archive(listing);setMode(null);}}>{pick("Archive","Lưu trữ")}</Button><Button size="sm" variant="ghost" onClick={()=>setMode(null)}>{t("common.cancel")}</Button></div></div>}
      {listing.moderation.manualReview?.reason && <p className="text-xs break-words">{pick("Admin decision reason:","Lý do quyết định của Admin:")} {listing.moderation.manualReview.reason}</p>}

      {["draft", "needs-attention", "rejected"].includes(listing.status) && listing.moderation.reasons.length > 0 ? (
        <div role="status" className="rounded-md border border-warning/20 bg-warning/10 p-2 text-xs text-foreground">
          {listing.moderation.reasons.map((reason, index) => (
            <p key={index}>{reason}</p>
          ))}
        </div>
      ) : null}

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
            if(listing.verificationBadge && !window.confirm(pick("Changing price removes verification and requires fresh evidence. Continue?","Đổi giá sẽ thu hồi xác minh và yêu cầu minh chứng mới. Tiếp tục?"))) return;
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

      {mode === "evidence" ? <EvidencePanel key={listing.id} listing={listing} /> : null}

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
  const { t, pick } = useI18n();
  const labels = useLabels();
  const { listings, listingsLoading } = useAppState();
  const landlord = useLandlordIdentity();
  const [status, setStatus] = useState<"all" | ListingStatus>("all");
  const [query, setQuery] = useState("");

  const owned = listings.filter((l) => l.landlordId === landlord.id);
  const overdue = owned.filter(
    (l) => (l.status === "published" && availabilityStatus(l).state === "overdue") || !!l.availabilityHiddenAt,
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

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{(["published","pending","needs-attention","draft"] as const).map(s=><button type="button" key={s} onClick={()=>setStatus(status===s?"all":s)} aria-pressed={status===s} className={`rounded-xl border p-3 text-left focus-visible:ring-2 focus-visible:ring-ring ${status===s?"border-primary bg-[#E9EFE9] text-[#365844]":"border-border bg-card"}`}><span className="block text-2xl font-semibold tabular-nums">{listingsLoading?"—":owned.filter(l=>l.status===s).length}</span><span className="text-xs">{t(statusBadge[s].labelKey)}</span></button>)}</div>
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
            <option value="archived">{pick("Archived","Đã lưu trữ")}</option>
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

      {listingsLoading && owned.length === 0 ? <p role="status" className="rounded-xl border border-border bg-card p-6 text-sm">{pick("Loading your properties…","Đang tải căn hộ của bạn…")}</p> : filtered.length === 0 ? (
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
                <ReviewSummary listing={listing}/>
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
                    <td className="px-5 py-4"><StatusBadge status={listing.status} /><ReviewSummary listing={listing}/></td>
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
        {pick("Listing changes are saved on the server. Verification evidence is private. Promotion will be integrated later.","Thay đổi tin đăng được lưu trên máy chủ. Minh chứng xác minh được lưu riêng tư. Tin nổi bật sẽ được kết nối ở bước sau.")}
      </p>
    </div>
  );
}
