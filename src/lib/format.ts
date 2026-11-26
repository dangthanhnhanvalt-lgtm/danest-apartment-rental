import type { CostItem, Listing } from "~/types";

const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

const usdPrecise = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
});

export function formatUSD(value: number, precise = false): string {
  return precise ? usdPrecise.format(value) : usd.format(value);
}

export function formatRent(value: number): string {
  return `${formatUSD(value)}/month`;
}

export function formatDate(iso: string | null, opts?: Intl.DateTimeFormatOptions): string {
  if (!iso) return "Not yet confirmed";
  const date = new Date(iso.length === 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(date.getTime())) return "Unknown date";
  return new Intl.DateTimeFormat("en-US", opts ?? { month: "short", day: "numeric", year: "numeric" }).format(date);
}

export function formatMonthYear(iso: string): string {
  return formatDate(iso, { month: "long", year: "numeric" });
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function daysFromNowISODate(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function monthsBetweenLabel(min: number, max: number): string {
  return min === max ? `${min} month${min > 1 ? "s" : ""}` : `${min}–${max} months`;
}

const monthly = (i: CostItem) => i.cadence === "monthly";

/** Splits the costs a tenant can rely on from the ones that are still estimates, and keeps monthly
 *  recurring costs apart from one-time costs. A missing amount is never treated as zero. */
export function summarizeCosts(listing: Listing): {
  confirmedMonthly: number;
  estimatedMonthly: number;
  confirmedItems: CostItem[];
  estimatedItems: CostItem[];
  unknownItems: CostItem[];
  oneTimeItems: CostItem[];
  oneTimeTotal: number;
  initialPayment: { confirmed: number; estimated: number };
} {
  const recurring = listing.costs.items.filter(monthly);
  const confirmedItems = recurring.filter((i) => i.state === "fixed" && i.amount !== null);
  const estimatedItems = recurring.filter((i) => i.state === "variable" || (i.state === "reported" && i.amount !== null));
  const unknownItems = listing.costs.items.filter((i) => i.state === "unknown" || i.amount === null);
  const oneTimeItems = listing.costs.items.filter((i) => !monthly(i) && i.amount !== null);
  const confirmedMonthly = listing.costs.monthlyRent + confirmedItems.reduce((s, i) => s + (i.amount ?? 0), 0);
  const estimatedMonthly = confirmedMonthly + estimatedItems.reduce((s, i) => s + (i.amount ?? 0), 0);
  const oneTimeTotal = oneTimeItems.reduce((s, i) => s + (i.amount ?? 0), 0);
  return {
    confirmedMonthly,
    estimatedMonthly,
    confirmedItems,
    estimatedItems,
    unknownItems,
    oneTimeItems,
    oneTimeTotal,
    initialPayment: {
      confirmed: confirmedMonthly + listing.costs.depositAmount + oneTimeTotal,
      estimated: estimatedMonthly + listing.costs.depositAmount + oneTimeTotal,
    },
  };
}

export function formatCostAmount(amount: number | null): string {
  return amount === null ? "Not provided" : formatUSD(amount);
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
