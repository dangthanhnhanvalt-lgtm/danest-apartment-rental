import type { AdminSettings, Listing } from "~/types";

export const DEFAULT_ADMIN_SETTINGS: AdminSettings = {
  availabilityGraceDays: 7,
  availabilityReminderDays: 14,
};

export type AvailabilityState = "fresh" | "reminder" | "overdue" | "hidden";

export interface AvailabilityStatus {
  daysSinceConfirmed: number;
  state: AvailabilityState;
  reminderDue: boolean;
  graceDaysLeft: number;
  hideAfterDays: number;
}

function daysBetween(fromISO: string, to: Date): number {
  const from = new Date(`${fromISO.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(from.getTime())) return 0;
  const toDay = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.floor((toDay.getTime() - from.getTime()) / 86_400_000);
}

/**
 * Availability rules (simulated in this prototype):
 * - reminderDays (14 by default): past this, the listing is "overdue" and the landlord must reconfirm.
 * - reminderDays + graceDays: past this, the listing drops out of public search until reconfirmed.
 */
function readSettings(): AdminSettings {
  try {
    const raw = localStorage.getItem("danest.admin.settings");
    if (!raw) return DEFAULT_ADMIN_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<AdminSettings>;
    return {
      availabilityGraceDays: parsed.availabilityGraceDays ?? DEFAULT_ADMIN_SETTINGS.availabilityGraceDays,
      availabilityReminderDays: parsed.availabilityReminderDays ?? DEFAULT_ADMIN_SETTINGS.availabilityReminderDays,
    };
  } catch {
    return DEFAULT_ADMIN_SETTINGS;
  }
}

export function availabilityStatus(
  listing: Listing,
  settings?: AdminSettings,
  now: Date = new Date(),
): AvailabilityStatus {
  settings = settings ?? readSettings();
  const days = daysBetween(listing.lastAvailabilityConfirmedAt, now);
  const reminderDays = settings.availabilityReminderDays;
  const hideAfterDays = reminderDays + settings.availabilityGraceDays;
  let state: AvailabilityState = "fresh";
  if (days > hideAfterDays) state = "hidden";
  else if (days > reminderDays) state = "overdue";
  else if (days >= Math.max(0, reminderDays - 7)) state = "reminder";
  return {
    daysSinceConfirmed: days,
    state,
    reminderDue: days > reminderDays,
    graceDaysLeft: Math.max(0, hideAfterDays - days),
    hideAfterDays,
  };
}

export function isPubliclyVisible(listing: Listing, settings?: AdminSettings): boolean {
  if (listing.status !== "published") return false;
  return availabilityStatus(listing, settings ?? DEFAULT_ADMIN_SETTINGS).state !== "hidden";
}
