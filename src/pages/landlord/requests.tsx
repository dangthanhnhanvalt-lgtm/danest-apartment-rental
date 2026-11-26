import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Clock, Mail, MapPin, MessageSquare } from "lucide-react";
import { mockInquiriesRepository } from "~/api";
import { formatDate, initials } from "~/lib/format";
import { useAppState } from "~/state/app-state";
import { useLandlordIdentity } from "~/pages/landlord/use-landlord-identity";
import { useToast } from "~/components/ui/toast";
import { Button } from "~/components/ui/button";
import { Chip, Textarea } from "~/components/ui/form";
import { Skeleton } from "~/components/ui/skeleton";
import { cn } from "~/lib/utils";
import { useI18n } from "~/i18n/language-context";
import { useLabels } from "~/i18n/use-labels";
import type { Inquiry } from "~/types";

const statusTone: Record<Inquiry["status"], { labelKey: string; classes: string }> = {
  new: { labelKey: "landlord.status.new", classes: "border-warning/20 bg-warning/10 text-warning" },
  replied: { labelKey: "landlord.status.replied", classes: "border-transparent bg-accent text-link" },
  viewing_scheduled: { labelKey: "landlord.status.viewingScheduled", classes: "border-transparent bg-accent text-link" },
  rented: { labelKey: "landlord.status.rented", classes: "border-transparent bg-success/15 text-success" },
  not_proceeding: { labelKey: "landlord.status.notProceeding", classes: "border-border bg-muted text-muted-foreground" },
};

type StatusFilter = "all" | Inquiry["status"];
type TypeFilter = "all" | Inquiry["type"];

function RequestCard({
  inquiry,
  listingTitle,
  neighborhood,
  reply,
  onReply,
  onSchedule,
  onMarkRented,
  onNotProceeding,
}: {
  inquiry: Inquiry;
  listingTitle: string;
  neighborhood: string;
  reply: string | undefined;
  onReply: (id: string, text: string) => Promise<void>;
  onSchedule: (id: string) => Promise<void>;
  onMarkRented: (id: string) => Promise<void>;
  onNotProceeding: (id: string) => Promise<void>;
}) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const [replyOpen, setReplyOpen] = useState(false);
  const [replyText, setReplyText] = useState("");
  const [confirmStop, setConfirmStop] = useState(false);
  const [sending, setSending] = useState(false);

  const tone = statusTone[inquiry.status];
  const canReply = inquiry.status === "new" || inquiry.status === "replied";
  const canSchedule =
    inquiry.type === "viewing-request" && (inquiry.status === "replied" || inquiry.status === "viewing_scheduled");
  const canMarkRented = inquiry.status === "replied" || inquiry.status === "viewing_scheduled";
  const canStop = inquiry.status !== "not_proceeding" && inquiry.status !== "rented";

  const smallBtn =
    "inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-input px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  return (
    <article className="rounded-xl border border-border bg-card p-5" style={{ boxShadow: "var(--shadow-surface)" }}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <span
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-semibold text-link"
          aria-hidden="true"
        >
          {initials(inquiry.tenantName)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-foreground">{inquiry.tenantName}</p>
            <span className={cn("inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium", tone.classes)}>{t(tone.labelKey)}</span>
            <span className="inline-flex rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              {t(inquiry.type === "viewing-request" ? "landlord.type.viewingRequest" : "landlord.type.question")}
            </span>
          </div>
          <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <Mail className="size-3.5" aria-hidden="true" /> {inquiry.tenantEmail}
          </p>
          <p className="mt-1 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <MapPin className="size-3.5" aria-hidden="true" /> {listingTitle} · {neighborhood}
          </p>
        </div>
        <p className="shrink-0 text-xs text-muted-foreground">{t("landlord.requests.received", { date: formatDate(inquiry.createdAt) })}</p>
      </div>

      <p className={cn("mt-4 text-sm text-muted-foreground", !expanded && "line-clamp-3")}>{inquiry.message}</p>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="mt-1 rounded-md text-sm font-medium text-link transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {expanded ? t("landlord.requests.showLess") : t("landlord.requests.showMore")}
      </button>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {inquiry.tenantPreferences.map((pref) => (
          <span key={pref} className="rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
            {pref}
          </span>
        ))}
      </div>

      <dl className="mt-4 grid grid-cols-1 gap-3 text-xs text-muted-foreground sm:grid-cols-3">
        <div>
          <dt className="font-medium text-foreground">{t("landlord.requests.moveIn")}</dt>
          <dd className="mt-0.5">{formatDate(inquiry.moveInDate)}</dd>
        </div>
        <div>
          <dt className="font-medium text-foreground">{t("landlord.requests.duration")}</dt>
          <dd className="mt-0.5">
            {inquiry.durationMonths ? t("landlord.requests.monthsCount", { count: inquiry.durationMonths }) : t("landlord.requests.notSpecified")}
          </dd>
        </div>
        {inquiry.scheduledAt ? (
          <div>
            <dt className="inline-flex items-center gap-1 font-medium text-foreground">
              <CalendarDays className="size-3.5" aria-hidden="true" /> {t("landlord.requests.viewing")}
            </dt>
            <dd className="mt-0.5">
              {formatDate(inquiry.scheduledAt)}
              {inquiry.preferredTime ? ` · ${inquiry.preferredTime}` : ""}
            </dd>
          </div>
        ) : null}
      </dl>

      {reply ? (
        <div className="mt-4 rounded-lg border border-border bg-muted p-3">
          <p className="text-xs font-semibold text-foreground">{t("landlord.requests.yourReply")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{reply}</p>
          <p className="mt-2 text-xs text-muted-foreground">{t("landlord.requests.replyNote")}</p>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {canReply ? (
          <button type="button" className={smallBtn} onClick={() => setReplyOpen((v) => !v)} aria-expanded={replyOpen}>
            <MessageSquare className="size-4" aria-hidden="true" /> {t("landlord.requests.reply")}
          </button>
        ) : null}
        {canSchedule ? (
          <Button size="sm" onClick={() => void onSchedule(inquiry.id)}>
            {inquiry.status === "viewing_scheduled" ? t("landlord.requests.reconfirmViewing") : t("landlord.requests.scheduleViewing")}
          </Button>
        ) : null}
        {canMarkRented ? (
          <button
            type="button"
            className="inline-flex h-9 items-center justify-center rounded-lg border border-success/30 px-3 text-sm font-medium text-success transition-colors hover:bg-success/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => void onMarkRented(inquiry.id)}
          >
            {t("landlord.requests.markRented")}
          </button>
        ) : null}
        {canStop ? (
          <button
            type="button"
            className="inline-flex h-9 items-center justify-center rounded-lg border border-destructive/30 px-3 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => setConfirmStop(true)}
          >
            {t("landlord.requests.notProceeding")}
          </button>
        ) : null}
      </div>

      {confirmStop ? (
        <div className="mt-3 flex flex-col gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-foreground">{t("landlord.requests.confirmStop", { name: inquiry.tenantName })}</p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="destructive"
              onClick={async () => {
                await onNotProceeding(inquiry.id);
                setConfirmStop(false);
              }}
            >
              {t("landlord.requests.confirm")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmStop(false)}>{t("common.cancel")}</Button>
          </div>
        </div>
      ) : null}

      {replyOpen && canReply ? (
        <form
          className="mt-3 space-y-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!replyText.trim()) return;
            setSending(true);
            try {
              await onReply(inquiry.id, replyText.trim());
              setReplyText("");
              setReplyOpen(false);
            } finally {
              setSending(false);
            }
          }}
        >
          <label htmlFor={`reply-${inquiry.id}`} className="sr-only">
            {t("landlord.requests.replyTo", { name: inquiry.tenantName })}
          </label>
          <Textarea
            id={`reply-${inquiry.id}`}
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder={t("landlord.requests.replyPlaceholder")}
            className="min-h-24"
          />
          <div className="flex items-center justify-end gap-2">
            <Button type="button" size="sm" variant="ghost" onClick={() => setReplyOpen(false)}>{t("common.cancel")}</Button>
            <Button type="submit" size="sm" disabled={sending || !replyText.trim()}>{t("landlord.requests.sendReply")}</Button>
          </div>
        </form>
      ) : null}
    </article>
  );
}

export function RequestsPage() {
  const { t } = useI18n();
  const labels = useLabels();
  const { listings, session } = useAppState();
  const landlord = useLandlordIdentity();
  const { toast } = useToast();
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [loading, setLoading] = useState(true);
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");

  useEffect(() => {
    let active = true;
    const ownedListingIds = listings.filter((l) => l.landlordId === landlord.id).map((l) => l.id);
    mockInquiriesRepository
      .listForLandlord(landlord.id, ownedListingIds)
      .then((items) => {
        if (active) setInquiries(items);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [session, landlord.id, listings]);

  const patch = async (id: string, update: Partial<Inquiry>) => {
    const updated = await mockInquiriesRepository.update(id, update);
    setInquiries((prev) => prev.map((i) => (i.id === id ? updated : i)));
  };

  const handleReply = async (id: string, text: string) => {
    await patch(id, { status: "replied", firstRespondedAt: new Date().toISOString() });
    setReplies((prev) => ({ ...prev, [id]: text }));
    toast({ title: t("landlord.requests.replyToast"), description: t("landlord.requests.replyToastDesc"), tone: "success" });
  };

  const handleSchedule = async (id: string) => {
    await patch(id, { status: "viewing_scheduled" });
    toast({ title: t("landlord.requests.viewingScheduledToast"), tone: "success" });
  };

  const handleMarkRented = async (id: string) => {
    await patch(id, { status: "rented" });
    toast({ title: t("landlord.requests.markedRentedToast"), tone: "success" });
  };

  const handleNotProceeding = async (id: string) => {
    await patch(id, { status: "not_proceeding" });
    toast({ title: t("landlord.requests.markedNotProceedingToast"), tone: "info" });
  };

  const filtered = useMemo(
    () =>
      inquiries.filter((i) => {
        if (statusFilter !== "all" && i.status !== statusFilter) return false;
        if (typeFilter !== "all" && i.type !== typeFilter) return false;
        return true;
      }),
    [inquiries, statusFilter, typeFilter],
  );

  const sorted = useMemo(() => [...filtered].sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [filtered]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{t("landlord.requests.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("landlord.requests.subtitle")}</p>
        </div>
        <span className="inline-flex items-center gap-1.5 self-start rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground sm:self-auto">
          <Clock className="size-3.5" aria-hidden="true" /> {t("landlord.requests.awaiting", { count: inquiries.filter((i) => i.status === "new").length })}
        </span>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4" style={{ boxShadow: "var(--shadow-surface)" }}>
        <div className="flex flex-wrap gap-2">
          {(["all", "new", "replied", "viewing_scheduled", "rented", "not_proceeding"] as StatusFilter[]).map((s) => (
            <Chip key={s} selected={statusFilter === s} onClick={() => setStatusFilter(s)}>
              {s === "all" ? t("landlord.requests.filterAll") : t(statusTone[s].labelKey)}
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {([
            { id: "all", label: t("landlord.requests.filterAllRequests") },
            { id: "viewing-request", label: t("landlord.requests.filterViewingRequests") },
            { id: "question", label: t("landlord.requests.filterQuestions") },
          ] as { id: TypeFilter; label: string }[]).map((t) => (
            <Chip key={t.id} selected={typeFilter === t.id} onClick={() => setTypeFilter(t.id)}>
              {t.label}
            </Chip>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-44 w-full" />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
          <p className="text-sm font-medium text-foreground">{t("landlord.requests.emptyTitle")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("landlord.requests.emptyHint")}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sorted.map((inq) => {
            const listing = listings.find((l) => l.id === inq.listingId);
            return (
              <RequestCard
                key={inq.id}
                inquiry={inq}
                listingTitle={listing?.title ?? t("landlord.listing.unavailable")}
                neighborhood={listing ? labels.neighborhood[listing.neighborhood] : "Da Nang"}
                reply={replies[inq.id]}
                onReply={handleReply}
                onSchedule={handleSchedule}
                onMarkRented={handleMarkRented}
                onNotProceeding={handleNotProceeding}
              />
            );
          })}
        </div>
      )}

      <p className="text-xs text-muted-foreground">{labels.sampleNotice}</p>
    </div>
  );
}
