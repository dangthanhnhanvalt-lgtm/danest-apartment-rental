import { useEffect, useMemo, useState } from "react";
import { CalendarCheck, CalendarDays, CalendarX } from "lucide-react";
import { mockInquiriesRepository } from "~/api";
import { formatDate, initials, todayISO } from "~/lib/format";
import { useAppState } from "~/state/app-state";
import { useLandlordIdentity } from "~/pages/landlord/use-landlord-identity";
import { useToast } from "~/components/ui/toast";
import { Button } from "~/components/ui/button";
import { Skeleton } from "~/components/ui/skeleton";
import { cn } from "~/lib/utils";
import { useI18n } from "~/i18n/language-context";
import type { Inquiry } from "~/types";

type Scheduled = Inquiry & { scheduledAt: string };

const statusBadge: Record<Inquiry["status"], { labelKey: string; classes: string }> = {
  new: { labelKey: "landlord.status.awaitingConfirmation", classes: "border-warning/20 bg-warning/10 text-warning" },
  replied: { labelKey: "landlord.status.replied", classes: "border-transparent bg-accent text-link" },
  viewing_scheduled: { labelKey: "landlord.status.confirmed", classes: "border-transparent bg-accent text-link" },
  rented: { labelKey: "landlord.status.rented", classes: "border-transparent bg-success/15 text-success" },
  not_proceeding: { labelKey: "landlord.status.cancelled", classes: "border-border bg-muted text-muted-foreground" },
};

function SummaryTile({ icon: Icon, label, value }: { icon: typeof CalendarDays; label: string; value: number }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4" style={{ boxShadow: "var(--shadow-surface)" }}>
      <span className="flex size-9 items-center justify-center rounded-full bg-accent text-link">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <div>
        <p className="text-2xl font-semibold text-foreground">{value}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function ViewingItem({
  inquiry,
  listingTitle,
  onConfirm,
  onCancel,
}: {
  inquiry: Scheduled;
  listingTitle: string;
  onConfirm: (id: string) => Promise<void>;
  onCancel: (id: string) => Promise<void>;
}) {
  const { t } = useI18n();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const tone = statusBadge[inquiry.status];
  const isToday = inquiry.scheduledAt === todayISO();

  return (
    <li className="rounded-xl border border-border bg-card p-4" style={{ boxShadow: "var(--shadow-surface)" }}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-foreground" aria-hidden="true">
          {initials(inquiry.tenantName)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-foreground">{inquiry.tenantName}</p>
            {isToday ? (
              <span className="inline-flex rounded-full border border-transparent bg-accent px-2.5 py-0.5 text-xs font-medium text-link">{t("landlord.schedule.today")}</span>
            ) : null}
            <span className={cn("inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium", tone.classes)}>{t(tone.labelKey)}</span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {listingTitle}
            {inquiry.preferredTime ? ` · ${t("landlord.schedule.preferred", { time: inquiry.preferredTime })}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {inquiry.status === "new" || inquiry.status === "replied" ? (
            <Button size="sm" onClick={() => void onConfirm(inquiry.id)}>
              {t("landlord.schedule.markAccepted")}
            </Button>
          ) : null}
          {inquiry.status === "viewing_scheduled" ? (
            <span className="inline-flex h-8 items-center rounded-md bg-accent px-2.5 text-xs font-medium text-link">{t("landlord.schedule.viewingConfirmed")}</span>
          ) : null}
          {inquiry.status !== "not_proceeding" && inquiry.status !== "rented" ? (
            <button
              type="button"
              onClick={() => setConfirmCancel(true)}
              className="inline-flex h-8 items-center rounded-md border border-input px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {t("landlord.schedule.cancelViewing")}
            </button>
          ) : null}
        </div>
      </div>

      {confirmCancel ? (
        <div className="mt-3 flex flex-col gap-2 rounded-lg border border-destructive/20 bg-destructive/10 p-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-foreground">{t("landlord.schedule.confirmCancel", { name: inquiry.tenantName })}</p>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="destructive"
              onClick={async () => {
                await onCancel(inquiry.id);
                setConfirmCancel(false);
              }}
            >
              {t("landlord.schedule.confirmCancellation")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirmCancel(false)}>{t("landlord.schedule.keep")}</Button>
          </div>
        </div>
      ) : null}
    </li>
  );
}

function DayGroup({
  date,
  today,
  items,
  listings,
  onConfirm,
  onCancel,
}: {
  date: string;
  today: string;
  items: Scheduled[];
  listings: { id: string; title: string }[];
  onConfirm: (id: string) => Promise<void>;
  onCancel: (id: string) => Promise<void>;
}) {
  const { t } = useI18n();
  return (
    <div className="space-y-2">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
        {formatDate(date, { weekday: "long", month: "long", day: "numeric" })}
        {date === today ? (
          <span className="inline-flex rounded-full border border-transparent bg-accent px-2.5 py-0.5 text-xs font-medium text-link">{t("landlord.schedule.today")}</span>
        ) : null}
      </h3>
      <ul className="space-y-2">
        {items.map((inq) => (
          <ViewingItem
            key={inq.id}
            inquiry={inq}
            listingTitle={listings.find((l) => l.id === inq.listingId)?.title ?? t("landlord.listing.unavailable")}
            onConfirm={onConfirm}
            onCancel={onCancel}
          />
        ))}
      </ul>
    </div>
  );
}

export function SchedulePage() {
  const { t } = useI18n();
  const { listings } = useAppState();
  const landlord = useLandlordIdentity();
  const { toast } = useToast();
  const [inquiries, setInquiries] = useState<Scheduled[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const ownedListingIds = listings.filter((l) => l.landlordId === landlord.id).map((l) => l.id);
    mockInquiriesRepository
      .listForLandlord(landlord.id, ownedListingIds)
      .then((items) => {
        if (active) setInquiries(items.filter((i): i is Scheduled => Boolean(i.scheduledAt)));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [landlord.id, listings]);

  const today = todayISO();

  const handleConfirm = async (id: string) => {
    const updated = await mockInquiriesRepository.update(id, { status: "viewing_scheduled" });
    setInquiries((prev) => prev.map((i) => (i.id === id ? { ...updated, scheduledAt: updated.scheduledAt ?? i.scheduledAt } : i)));
    toast({ title: t("landlord.schedule.confirmedToast"), tone: "success" });
  };

  const handleCancel = async (id: string) => {
    const updated = await mockInquiriesRepository.update(id, { status: "not_proceeding" });
    setInquiries((prev) => prev.map((i) => (i.id === id ? { ...updated, scheduledAt: updated.scheduledAt ?? i.scheduledAt } : i)));
    toast({ title: t("landlord.schedule.cancelledToast"), tone: "info" });
  };

  const { upcoming, past, counts } = useMemo(() => {
    const sorted = [...inquiries].sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt) || a.createdAt.localeCompare(b.createdAt));
    return {
      upcoming: sorted.filter((i) => i.scheduledAt >= today && i.status !== "not_proceeding"),
      past: sorted.filter((i) => i.scheduledAt < today || i.status === "not_proceeding"),
      counts: {
        upcoming: sorted.filter((i) => i.scheduledAt >= today && i.status !== "not_proceeding").length,
        accepted: sorted.filter((i) => i.status === "viewing_scheduled").length,
        cancelled: sorted.filter((i) => i.status === "not_proceeding").length,
      },
    };
  }, [inquiries, today]);

  const group = (items: Scheduled[]) => {
    const map = new Map<string, Scheduled[]>();
    items.forEach((i) => {
      const list = map.get(i.scheduledAt) ?? [];
      list.push(i);
      map.set(i.scheduledAt, list);
    });
    return Array.from(map.entries());
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{t("landlord.schedule.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("landlord.schedule.subtitle")}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <SummaryTile icon={CalendarDays} label={t("landlord.schedule.upcoming")} value={counts.upcoming} />
        <SummaryTile icon={CalendarCheck} label={t("landlord.schedule.accepted")} value={counts.accepted} />
        <SummaryTile icon={CalendarX} label={t("landlord.schedule.cancelled")} value={counts.cancelled} />
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : inquiries.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-10 text-center">
          <p className="text-sm font-medium text-foreground">{t("landlord.schedule.emptyTitle")}</p>
          <p className="mt-1 text-sm text-muted-foreground">{t("landlord.schedule.emptyHint")}</p>
        </div>
      ) : (
        <div className="space-y-8">
          <section className="space-y-4" aria-labelledby="upcoming-heading">
            <h2 id="upcoming-heading" className="text-base font-semibold text-card-foreground">{t("landlord.schedule.upcoming")}</h2>
            {upcoming.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                {t("landlord.schedule.nothingUpcoming")}
              </p>
            ) : (
              group(upcoming).map(([date, items]) => (
                <DayGroup key={date} date={date} today={today} items={items} listings={listings} onConfirm={handleConfirm} onCancel={handleCancel} />
              ))
            )}
          </section>

          {past.length > 0 ? (
            <section className="space-y-4" aria-labelledby="past-heading">
              <h2 id="past-heading" className="text-base font-semibold text-card-foreground">{t("landlord.schedule.pastCancelled")}</h2>
              {group(past).map(([date, items]) => (
                <DayGroup key={date} date={date} today={today} items={items} listings={listings} onConfirm={handleConfirm} onCancel={handleCancel} />
              ))}
            </section>
          ) : null}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        {t("landlord.schedule.prototypeNote")}
      </p>
    </div>
  );
}
