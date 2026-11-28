import { SAMPLE_INQUIRIES } from "~/data/landlord";
import { SAMPLE_LISTINGS_WITH_OPS as SAMPLE_LISTINGS } from "~/data/listings";
import { recallRole, rememberRole } from "~/api/backend/role-map";
import { todayISO } from "~/lib/format";
import type { Inquiry, InquiryStatusEvent, Listing, ListingDraft, ListingQuery, Session, User } from "~/types";

/** Repository contract. A real backend provider implements this same interface. */
export interface ListingRepository {
  list(query?: ListingQuery): Promise<Listing[]>;
  get(id: string): Promise<Listing | null>;
  create(draft: Listing, landlordId: string): Promise<Listing>;
  update(id: string, patch: Partial<Listing>): Promise<Listing>;
}

export interface InquiriesRepository {
  listForLandlord(landlordId: string, ownedListingIds?: string[]): Promise<Inquiry[]>;
  listForTenant(email: string): Promise<Inquiry[]>;
  create(input: Omit<Inquiry, "id" | "createdAt" | "status">): Promise<Inquiry>;
  update(id: string, patch: Partial<Inquiry>): Promise<Inquiry>;
  listHistory(inquiryId: string): Promise<InquiryStatusEvent[]>;
  hasInquiryFor(tenantEmail: string, listingId: string): boolean;
}

export interface AuthRepository {
  login(email: string, password: string): Promise<Session>;
  register(name: string, email: string, password: string, role: User["role"]): Promise<Session>;
  logout(): Promise<void>;
}

const OVERRIDES_KEY = "livora.listings.overrides";
const SAVED_KEY = "livora.saved";

export function readSavedIds(): string[] {
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

export function writeSavedIds(ids: string[]) {
  localStorage.setItem(SAVED_KEY, JSON.stringify(ids));
}

function readOverrides(): Record<string, Partial<Listing>> {
  try {
    const raw = localStorage.getItem(OVERRIDES_KEY);
    return raw ? (JSON.parse(raw) as Record<string, Partial<Listing>>) : {};
  } catch {
    return {};
  }
}

function writeOverrides(map: Record<string, Partial<Listing>>) {
  localStorage.setItem(OVERRIDES_KEY, JSON.stringify(map));
}

function delay<T>(value: T): Promise<T> {
  return Promise.resolve(value);
}

export function applyQuery(listings: Listing[], query: ListingQuery = {}): Listing[] {
  const q = query.q?.trim().toLowerCase() ?? "";
  let result = listings.filter(
    (l) => l.status === "published",
  );

  if (query.ids) {
    const keep = new Set(query.ids);
    result = result.filter((l) => keep.has(l.id));
  }
  if (q) {
    result = result.filter(
      (l) =>
        l.title.toLowerCase().includes(q) ||
        l.summary.toLowerCase().includes(q) ||
        l.neighborhood.includes(q),
    );
  }
  if (query.neighborhoods && query.neighborhoods.length > 0) {
    result = result.filter((l) => query.neighborhoods!.includes(l.neighborhood));
  }
  if (query.minRent !== undefined) result = result.filter((l) => l.monthlyRent >= query.minRent!);
  if (query.maxRent !== undefined && query.maxRent > 0) result = result.filter((l) => l.monthlyRent <= query.maxRent!);
  if (query.duration) result = result.filter((l) => query.duration! >= l.rentalDurationMonths[0] && query.duration! <= l.rentalDurationMonths[1]);
  if (query.bedrooms) result = result.filter((l) => l.bedrooms >= query.bedrooms!);
  if (query.bathrooms) result = result.filter((l) => l.bathrooms >= query.bathrooms!);
  if (query.types && query.types.length > 0) result = result.filter((l) => query.types!.includes(l.type));
  if (query.furnishing) result = result.filter((l) => l.furnishing === query.furnishing);
  if (query.amenities && query.amenities.length > 0) {
    result = result.filter((l) => query.amenities!.every((a) => l.amenities.includes(a)));
  }
  if (query.verifiedOnly) result = result.filter((l) => l.verificationBadge);
  if (query.availability) result = result.filter((l) => l.availability === query.availability);

  switch (query.sort) {
    case "price-asc":
      result = [...result].sort((a, b) => a.monthlyRent - b.monthlyRent);
      break;
    case "price-desc":
      result = [...result].sort((a, b) => b.monthlyRent - a.monthlyRent);
      break;
    case "updated-asc":
    case "updated-desc":
      result = [...result].sort((a,b)=>{
        const at=Date.parse(a.updatedAt??""),bt=Date.parse(b.updatedAt??"");
        if(!Number.isFinite(at)) return Number.isFinite(bt)?1:0;
        if(!Number.isFinite(bt)) return -1;
        return query.sort==="updated-asc"?at-bt:bt-at;
      });
      break;
    case "newest":
      result = [...result].sort((a, b) => b.listedAt.localeCompare(a.listedAt));
      break;
    default:
      result = [...result].sort((a, b) => Number(b.featured) * 100 + b.views / 1000 - (Number(a.featured) * 100 + a.views / 1000));
  }
  return query.limit ? result.slice(0, query.limit) : result;
}

export function withOverrides(listings: Listing[]): Listing[] {
  const overrides = readOverrides();
  return listings.map((l) => ({ ...l, ...(overrides[l.id] ?? {}) }));
}

export const mockListingRepository: ListingRepository = {
  list: (query) => delay(applyQuery(withOverrides(SAMPLE_LISTINGS), query)),

  get: async (id) => {
    const all = withOverrides(SAMPLE_LISTINGS);
    return delay(all.find((l) => l.id === id) ?? all.find((l) => l.slug === id) ?? null);
  },

  create: async (listing, _landlordId) => {
    const overrides = readOverrides();
    writeOverrides({ ...overrides, [listing.id]: listing });
    return delay(listing);
  },

  update: async (id, patch) => {
    const overrides = readOverrides();
    const all = withOverrides(SAMPLE_LISTINGS);
    const base = all.find((l) => l.id === id);
    if (!base) throw new Error("Listing not found");
    const next = { ...base, ...patch };
    writeOverrides({ ...overrides, [id]: next });
    return delay(next);
  },
};

const INQUIRIES_KEY = "livora.inquiries";
const INQUIRY_OVERRIDES_KEY = "livora.inquiry-overrides";
const INQUIRY_HISTORY_KEY = "livora.inquiry-history";

// Legacy demo statuses map to the FR-31 five-state model (see DATABASE-DESIGN §2.15).
function normaliseInquiryStatus(status: string | undefined): Inquiry["status"] {
  switch (status) {
    case "new":
    case "replied":
    case "viewing_scheduled":
    case "rented":
    case "not_proceeding":
      return status;
    case "accepted":
      return "viewing_scheduled";
    case "declined":
      return "not_proceeding";
    default:
      return "new";
  }
}

function readStoredInquiries(): Inquiry[] {
  try {
    const raw = localStorage.getItem(INQUIRIES_KEY);
    return raw ? (JSON.parse(raw) as Inquiry[]) : [];
  } catch {
    return [];
  }
}

function writeStoredInquiries(list: Inquiry[]) {
  localStorage.setItem(INQUIRIES_KEY, JSON.stringify(list));
}

function readStoredInquiryOverrides(): Record<string, Partial<Inquiry>> {
  try {
    const raw = localStorage.getItem(INQUIRY_OVERRIDES_KEY);
    return raw ? (JSON.parse(raw) as Record<string, Partial<Inquiry>>) : {};
  } catch {
    return {};
  }
}

function readHistory(): InquiryStatusEvent[] {
  try {
    const raw = localStorage.getItem(INQUIRY_HISTORY_KEY);
    return raw ? (JSON.parse(raw) as InquiryStatusEvent[]) : [];
  } catch {
    return [];
  }
}

function writeHistory(list: InquiryStatusEvent[]) {
  localStorage.setItem(INQUIRY_HISTORY_KEY, JSON.stringify(list));
}

function appendHistory(event: InquiryStatusEvent) {
  writeHistory([event, ...readHistory()]);
}

function allInquiries(): Inquiry[] {
  const created = readStoredInquiries();
  const createdIds = new Set(created.map((i) => i.id));
  const stored = readStoredInquiryOverrides();
  return [...created, ...SAMPLE_INQUIRIES.filter((i) => !createdIds.has(i.id))].map((i) => {
    const merged = { ...i, ...(stored[i.id] ?? {}) };
    return { ...merged, status: normaliseInquiryStatus(merged.status) };
  });
}

export const mockInquiriesRepository: InquiriesRepository = {
  listForLandlord: (landlordId, ownedListingIds) => {
    const seedOwned = SAMPLE_LISTINGS.filter((l) => l.landlordId === landlordId).map((l) => l.id);
    const owned = new Set([...(ownedListingIds ?? []), ...seedOwned]);
    if (owned.size === 0) return delay([]);
    return delay(allInquiries().filter((i) => owned.has(i.listingId)));
  },
  listForTenant: (email) => delay(allInquiries().filter((i) => i.tenantEmail.toLowerCase() === email.toLowerCase())),
  create: (input) => {
    const now = new Date().toISOString();
    const inquiry: Inquiry = {
      ...input,
      id: `inq-${Date.now()}`,
      status: "new",
      tenantId: input.tenantEmail,
      createdAt: todayISO(),
      updatedAt: now,
      firstRequestedAt: now,
      firstRespondedAt: null,
    };
    writeStoredInquiries([inquiry, ...readStoredInquiries()]);
    appendHistory({
      id: `hist-${Date.now()}`,
      inquiryId: inquiry.id,
      fromStatus: null,
      toStatus: "new",
      actor: input.tenantEmail,
      note: "Inquiry submitted.",
      changedAt: now,
    });
    return delay(inquiry);
  },
  update: (id, patch) => {
    const overrides = readStoredInquiryOverrides();
    const current = allInquiries().find((i) => i.id === id);
    const nextStatus = patch.status ? normaliseInquiryStatus(patch.status) : undefined;
    const appliedPatch: Partial<Inquiry> = {
      ...patch,
      ...(nextStatus ? { status: nextStatus } : {}),
      updatedAt: new Date().toISOString(),
    };
    writeStoredInquiries(readStoredInquiries().map((i) => (i.id === id ? { ...i, ...appliedPatch } : i)));
    localStorage.setItem(INQUIRY_OVERRIDES_KEY, JSON.stringify({ ...overrides, [id]: { ...(overrides[id] ?? {}), ...appliedPatch } }));
    // Record a status-history event when the status actually changes.
    if (current && nextStatus && nextStatus !== normaliseInquiryStatus(current.status)) {
      appendHistory({
        id: `hist-${Date.now()}`,
        inquiryId: id,
        fromStatus: normaliseInquiryStatus(current.status),
        toStatus: nextStatus,
        actor: "landlord",
        note: null,
        changedAt: appliedPatch.updatedAt as string,
      });
    }
    const found = allInquiries().find((i) => i.id === id);
    return delay(found as Inquiry);
  },
  listHistory: (inquiryId) =>
    delay(readHistory().filter((e) => e.inquiryId === inquiryId).sort((a, b) => b.changedAt.localeCompare(a.changedAt))),
  hasInquiryFor: (tenantEmail, listingId) =>
    allInquiries().some((i) => i.tenantEmail.toLowerCase() === tenantEmail.toLowerCase() && i.listingId === listingId),
};

const SESSION_KEY = "livora.session";

export const mockAuthRepository: AuthRepository = {
  login: (email, password) => {
    const name = email.split("@")[0].replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    // Recall the role chosen at registration (demo-only mapping); default renter.
    const session: Session = {
      user: {
        id: `usr-${email}`,
        name: name || "Demo User",
        email,
        role: recallRole(email),
        avatarInitials: (name || "DU").slice(0, 2).toUpperCase(),
      },
      isDemo: true,
    };
    void password;
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return delay(session);
  },
  register: (name, email, _password, role) => {
    rememberRole(email, role);
    const session: Session = {
      user: {
        id: `usr-${email}`,
        name,
        email,
        role,
        avatarInitials: name
          .split(" ")
          .map((p) => p[0])
          .slice(0, 2)
          .join("")
          .toUpperCase(),
      },
      isDemo: true,
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return delay(session);
  },
  logout: () => {
    localStorage.removeItem(SESSION_KEY);
    return Promise.resolve();
  },
};

export function readSession(): Session | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function draftToListing(draft: ListingDraft, landlordId: string): Listing {
  const rent = Number(draft.monthlyRent) || 0;
  const depositMonths = Number(draft.depositMonths) || 1;
  const id = `lst-${Date.now()}`;
  return {
    id,
    slug: id,
    title: draft.title,
    summary: draft.summary,
    description: draft.description,
    neighborhood: (draft.neighborhood || "an-thuong") as Listing["neighborhood"],
    address: draft.address,
    location: draft.location ?? { lat: 16.051, lng: 108.243, precision: "approximate" },
    type: draft.type ?? (Number(draft.bedrooms) === 0 ? "studio" : "apartment"),
    monthlyRent: rent,
    bedrooms: Number(draft.bedrooms),
    bathrooms: Number(draft.bathrooms) || 1,
    floorArea: Number(draft.floorArea) || 40,
    floorLevel: draft.floorLevel?.trim() || "—",
    furnishing: (draft.furnishing || "furnished") as Listing["furnishing"],
    amenities: draft.amenities,
    availability: draft.availability??"available",
    availableFrom: draft.availableFrom || todayISO(),
    rentalDurationMonths: [Number(draft.minMonths) || 1, Number(draft.maxMonths) || 12],
    images: draft.images.length > 0 ? draft.images : ["/images/l1.jpg"],
    verification: {
      checks: [
        { id: "listing-info", label: "Listing information", description: "Rent, size, layout and amenities checked against the landlord's documentation.", status: "not-started", lastUpdated: null },
        { id: "landlord-identity", label: "Landlord identity", description: "Government ID matched to the property documents on file.", status: "not-started", lastUpdated: null },
        { id: "rental-authorization", label: "Rental authorization", description: "Confirmation that the landlord is allowed to rent the apartment on a monthly basis.", status: "not-started", lastUpdated: null },
      ],
      lastAvailabilityConfirmed: todayISO(),
    },
    verificationBadge: false,
    costs: {
      monthlyRent: rent,
      depositMonths,
      depositAmount: rent * depositMonths,
      items: draft.extraCosts.map((c) => ({
        id: c.label.toLowerCase().replace(/\s+/g, "-"),
        label: c.label,
        amount: c.amount ? Number(c.amount) : null,
        unit: c.unit ?? "per month",
        state: c.amount && c.state !== "unknown" ? c.state : "unknown",
        cadence: c.cadence ?? "monthly",
      })),
    },
    rentalTerms: {
      minMonths: Number(draft.minMonths) || 1,
      maxMonths: Number(draft.maxMonths) || 12,
      paymentDayOfMonth: Number(draft.paymentDay) || 1,
      utilitiesIncluded: [],
      notes: (draft.rentalNotes ?? "").split("\n").map(x=>x.trim()).filter(Boolean),
    },
    neighborhoodNotes: [],
    distanceToBeach: "To be confirmed",
    landlordId,
    landlord: {
      id: landlordId,
      displayName: "An Nguyen",
      role: "Private landlord",
      languages: ["English", "Vietnamese"],
      responseTime: "Usually replies within a day",
      memberSince: "2023-03-02",
    },
    status: "pending",
    moderation: {
      result: "incomplete",
      checks: [],
      reasons: ["Awaiting automated moderation."],
      duplicateRisk: false,
      autoReviewedAt: null,
      manualReview: null,
    },
    lastAvailabilityConfirmedAt: todayISO(),
    availabilityReminderSentAt: null,
    featured: false,
    sponsored: false,
    listedAt: todayISO(),
    views: 0,
    inquiries: 0,
    isSample: true,
  };
}
