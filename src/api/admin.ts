import { readSession, withOverrides } from "~/api";
import { supabase } from "~/lib/supabase";
import { ADMIN_SAMPLE_AUDIT, ADMIN_SAMPLE_LISTINGS, ADMIN_SAMPLE_REPORTS, ADMIN_SAMPLE_USERS } from "~/data/admin";
import { SAMPLE_INQUIRIES } from "~/data/landlord";
import { SAMPLE_LISTINGS_WITH_OPS } from "~/data/listings";
import { DEFAULT_ADMIN_SETTINGS, availabilityStatus } from "~/lib/availability";
import { formatUSD } from "~/lib/format";
import type {
  AdminSettings,
  AdminUser,
  AuditLogEntry,
  Inquiry,
  Listing,
  ListingStatus,
  Report,
} from "~/types";

const KEY = {
  listings: "danest.admin.listings",
  users: "danest.admin.users",
  reports: "danest.admin.reports",
  audit: "danest.admin.audit",
  settings: "danest.admin.settings",
};

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T): T {
  localStorage.setItem(key, JSON.stringify(value));
  return value;
}

const delay = <T,>(value: T): Promise<T> => Promise.resolve(value);

function mergeAllListings(): Listing[] {
  const publicListings = withOverrides(SAMPLE_LISTINGS_WITH_OPS);
  const seeded = [...ADMIN_SAMPLE_LISTINGS.map((l) => withOverrides([l])[0] ?? l)];
  const combined = [...seeded, ...publicListings];
  const overrides = read<Record<string, Listing>>(KEY.listings, {});
  return combined.map((l) => ({ ...l, ...(overrides[l.id] ?? {}) }));
}

function saveListing(listing: Listing) {
  const overrides = read<Record<string, Listing>>(KEY.listings, {});
  write(KEY.listings, { ...overrides, [listing.id]: listing });
}

export function actorName(): string {
  const session = readSession();
  return session?.user.name ? `${session.user.name} (demo)` : "Admin (demo)";
}

export const adminListingRepository = {
  list: async (): Promise<Listing[]> => {
    const { data, error } = await supabase
      .from("properties")
      .select("source_id, listing_data, status")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Admin listings error:", error);
      throw new Error(error.message);
    }

    return (data ?? [])
      .filter((row) => row.source_id && row.listing_data)
      .map((row) => ({
        ...(row.listing_data as Listing),
        id: row.source_id as string,
        status: row.status as Listing["status"],
      }));
  },

  updateStatus: async (
  id: string,
  status: ListingStatus,
  reason: string,
  action: AuditLogEntry["action"]
): Promise<Listing> => {
  // 1. Lấy tin đăng hiện tại từ Supabase
  const { data, error: fetchError } = await supabase
    .from("properties")
    .select("id, source_id, listing_data, status")
    .eq("source_id", id)
    .single();

  if (fetchError) throw new Error(fetchError.message);
  if (!data?.listing_data) {
    throw new Error("Không tìm thấy tin đăng.");
  }

  const listing = data.listing_data as Listing;

  // 2. Tạo dữ liệu kiểm duyệt mới
  const next: Listing = {
    ...listing,
    id,
    status,
    moderation: {
      ...listing.moderation,
      manualReview: {
        reviewedBy: "Admin",
        reviewedAt: new Date().toISOString().slice(0, 10),
        decision:
          action === "listing-approved"
            ? "approved"
            : action === "listing-rejected"
              ? "rejected"
              : action === "listing-corrections-requested"
                ? "corrections-requested"
                : action === "listing-hidden"
                  ? "hidden"
                  : "restored",
        reason,
      },
      reasons: reason
        ? [reason, ...listing.moderation.reasons]
        : listing.moderation.reasons,
    },
  };

  // 3. Cập nhật trạng thái thật trong Database
  const { data: updated, error: updateError } = await supabase
    .from("properties")
    .update({
      status,
      listing_data: next,
      updated_at: new Date().toISOString(),
    })
    .eq("id", data.id)
    .select("id, status")
    .single();

  if (updateError) {
    console.error("Admin update status error:", updateError);
    throw new Error(updateError.message);
  }

  if (!updated) {
    throw new Error("Không thể xác nhận cập nhật tin đăng.");
  }

  // 4. Ghi nhật ký tạm thời
  appendAudit({
    action,
    target: listing.title,
    reason,
  });

  return next;
},
  setVerification: (id: string, badge: boolean, reason: string) => {
    const listing = mergeAllListings().find((l) => l.id === id);
    if (!listing) throw new Error("Listing not found");
    const next: Listing = {
      ...listing,
      verificationBadge: badge,
      verification: {
        ...listing.verification,
        checks: listing.verification.checks.map((c) => ({
          ...c,
          status: badge ? "verified" : c.status,
          lastUpdated: badge ? new Date().toISOString().slice(0, 10) : c.lastUpdated,
        })),
      },
    };
    saveListing(next);
    appendAudit({ action: "listing-status-changed", target: listing.title, reason: `${badge ? "Verification evidence reviewed and badge added" : "Verification badge removed"}: ${reason}` });
    return delay(next);
  },

  reconfirmAvailability: (id: string) => {
    const listing = mergeAllListings().find((l) => l.id === id);
    if (!listing) throw new Error("Listing not found");
    const next: Listing = {
      ...listing,
      lastAvailabilityConfirmedAt: new Date().toISOString().slice(0, 10),
      availabilityReminderSentAt: null,
      verification: {
        ...listing.verification,
        lastAvailabilityConfirmed: new Date().toISOString().slice(0, 10),
      },
    };
    saveListing(next);
    return delay(next);
  },
};

export function appendAudit(input: { action: AuditLogEntry["action"]; target: string; reason: string; actor?: string }) {
  const entries = read<AuditLogEntry[]>(KEY.audit, ADMIN_SAMPLE_AUDIT);
  const entry: AuditLogEntry = {
    id: `aud-${Date.now()}`,
    action: input.action,
    actor: input.actor ?? actorName(),
    target: input.target,
    reason: input.reason,
    createdAt: new Date().toISOString(),
  };
  return write(KEY.audit, [entry, ...entries]);
}

export const adminAuditRepository = {
  list: () => delay(read<AuditLogEntry[]>(KEY.audit, ADMIN_SAMPLE_AUDIT)),
};

export const adminUserRepository = {
  list: () => delay(read<AdminUser[]>(KEY.users, ADMIN_SAMPLE_USERS)),
  setStatus: (id: string, status: AdminUser["status"]) => {
    const users = read<AdminUser[]>(KEY.users, ADMIN_SAMPLE_USERS);
    const next = users.map((u) => (u.id === id ? { ...u, status } : u));
    write(KEY.users, next);
    const user = next.find((u) => u.id === id);
    appendAudit({
      action: status === "suspended" ? "account-suspended" : "account-activated",
      target: user?.name ?? id,
      reason: status === "suspended" ? "Account suspended from the admin panel." : "Account reactivated.",
    });
    return delay(next);
  },
};

export const adminReportRepository = {
  list: () => delay(read<Report[]>(KEY.reports, ADMIN_SAMPLE_REPORTS)),
  update: (id: string, patch: Partial<Report>) => {
    const reports = read<Report[]>(KEY.reports, ADMIN_SAMPLE_REPORTS);
    const next = reports.map((r) => (r.id === id ? { ...r, ...patch } : r));
    write(KEY.reports, next);
    const report = next.find((r) => r.id === id);
    if (report && (patch.status === "resolved" || patch.status === "unresolved")) {
      appendAudit({
        action: patch.status === "resolved" ? "report-resolved" : "report-reopened",
        target: report.listingId,
        reason: patch.resolutionNote ?? "Report reviewed.",
      });
    }
    return delay(next);
  },
};

export const adminSettingsRepository = {
  get: () => delay(read<AdminSettings>(KEY.settings, DEFAULT_ADMIN_SETTINGS)),
  set: (settings: AdminSettings) => {
    write(KEY.settings, settings);
    appendAudit({
      action: "settings-updated",
      target: "Availability settings",
      reason: `Reminder after ${settings.availabilityReminderDays} days, grace period ${settings.availabilityGraceDays} days.`,
    });
    return delay(settings);
  },
};

export interface AdminKpis {
  activeListings: number;
  completePercent: number;
  verifiedPercent: number;
  inquiries: number;
  averageFirstResponseHours: number | null;
  counts: Record<ListingStatus, number>;
  requiringAttention: number;
  totalUsers: number;
}

export function computeKpis(listings: Listing[], users: AdminUser[], inquiries: Inquiry[], settings: AdminSettings): AdminKpis {
  const counts: Record<ListingStatus, number> = {
    published: 0,
    draft: 0,
    paused: 0,
    pending: 0,
    "needs-attention": 0,
    rejected: 0,
    hidden: 0,
    archived: 0,
  };
  listings.forEach((l) => {
    counts[l.status] += 1;
  });
  const live = listings.filter((l) => l.status === "published" && availabilityStatus(l, settings).state !== "hidden");
  const complete = live.filter((l) => l.moderation.checks.every((c) => c.result !== "incomplete") && l.moderation.reasons.length === 0);
  const verified = live.filter((l) => l.verificationBadge);
  const withReview = inquiries.filter((i) => i.status !== "new");
  const responseTimes = withReview.map((i) => {
    const created = new Date(`${i.createdAt}T09:00:00`).getTime();
    const responded = new Date(`${i.createdAt}T${i.status === "viewing_scheduled" || i.status === "rented" ? "15" : "17"}:00:00`).getTime();
    return Math.max(1, (responded - created) / 3_600_000);
  });
  return {
    activeListings: live.length,
    completePercent: live.length ? Math.round((complete.length / live.length) * 100) : 0,
    verifiedPercent: live.length ? Math.round((verified.length / live.length) * 100) : 0,
    inquiries: inquiries.length,
    averageFirstResponseHours: responseTimes.length ? Math.round((responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length) * 10) / 10 : null,
    counts,
    requiringAttention: counts.pending + counts["needs-attention"] + counts.rejected,
    totalUsers: users.length,
  };
}

export function pendingQueue(listings: Listing[]): Listing[] {
  return listings.filter((l) => l.status === "pending" || l.status === "needs-attention");
}

export function listingPriceLabel(listing: Listing): string {
  return formatUSD(listing.monthlyRent);
}

export function allInquiries(): Inquiry[] {
  const stored = read<Inquiry[]>("livora.inquiries", []);
  const overrides = read<Record<string, Partial<Inquiry>>>("livora.inquiry-overrides", {});
  const createdIds = new Set(stored.map((i) => i.id));
  const merged = [...stored, ...SAMPLE_INQUIRIES.filter((i) => !createdIds.has(i.id))].map((i) => ({
    ...i,
    ...(overrides[i.id] ?? {}),
  }));
  // Normalise legacy statuses to the FR-31 five-state model.
  return merged.map((i) => {
    const legacy = i.status as string;
    const status: Inquiry["status"] =
      legacy === "accepted" ? "viewing_scheduled" : legacy === "declined" ? "not_proceeding" : i.status;
    return { ...i, status };
  });
}
