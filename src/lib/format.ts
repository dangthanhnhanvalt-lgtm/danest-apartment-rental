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
export const usageBasedCost = (i:CostItem):boolean => ['per kWh','per m³','per person/month','per m²/month'].includes(i.unit);
export const knownRate = (i:CostItem):boolean => i.state !== "unknown" && typeof i.amount === "number" && Number.isFinite(i.amount) && i.amount >= 0;
export const knownCost = (i:CostItem):boolean => !usageBasedCost(i) && i.state !== "unknown" && typeof i.amount === "number" && Number.isFinite(i.amount) && i.amount >= 0;
export function rentalMonthOptions(listing:Listing):number[] {
  const [min,max]=listing.rentalDurationMonths;
  return Array.from({length:12},(_,i)=>i+1).filter(m=>m>=min && m<=max);
}

/** Splits the costs a tenant can rely on from the ones that are still estimates, and keeps monthly
 *  recurring costs apart from one-time costs. A missing amount is never treated as zero. */
export function estimateUsage(listing:Listing, quantities:Record<string,string>):Listing {
  return {...listing,costs:{...listing.costs,items:listing.costs.items.map(i=>{
    const q=quantities[i.id];const n=Number(q);
    if(!usageBasedCost(i)||!knownRate(i)||q===undefined||!q.trim()||!Number.isFinite(n)||n<0||n>1000000)return i;
    const amount=i.amount!*n;
    return {...i,amount,unit:"per month",cadence:"monthly",state:"variable"};
  })}};
}
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
  const confirmedItems = recurring.filter((i) => i.state === "fixed" && knownCost(i));
  const estimatedItems = recurring.filter((i) => (i.state === "variable" || i.state === "reported") && knownCost(i));
  const unknownItems = listing.costs.items.filter((i) => !knownCost(i));
  const oneTimeItems = listing.costs.items.filter((i) => i.cadence === "one-time" && knownCost(i));
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

export function summarizeStay(listing:Listing,months:number) {
  if(!rentalMonthOptions(listing).includes(months)) return null;
  const s=summarizeCosts(listing);
  const withoutDeposit=s.estimatedMonthly*months+s.oneTimeTotal;
  return {months,withoutDeposit,withDeposit:withoutDeposit+listing.costs.depositAmount,initialPayment:s.initialPayment.estimated,unknownCount:s.unknownItems.length};
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
