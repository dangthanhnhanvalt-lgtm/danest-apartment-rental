// Hydration adapter: normalized Backend Hub records -> the app's rich `Listing`
// type, and the reverse for owner writes.
//
// The UI was built against a nested Listing shape (images, costs, verification,
// rentalTerms embedded). The database is normalized across collections, so a
// listing is assembled from: listings + listing_image + listing_amenity +
// listing_cost + rental_terms + verification_check + listing_promotion.
//
// Child document ids are deterministic (see db/baas/README.md):
//   image        <listingDocId>-img-<position>
//   amenity      <listingDocId>-am-<amenityId>
//   cost         <listingDocId>-cost-<position>   (deposit = -cost-999)
//   rental terms listingid-<listingDocId>
//   verification <listingDocId>-vc-<kind>
//   promotion    <listingDocId>-promo-<kind>
//
// IMPORTANT: everything fetched here is PUBLIC listing data only. Private
// landlord contact and evidence are never read by this adapter.

import type {
  AmenityId,
  Availability,
  CostItem,
  CostState,
  FurnishingStatus,
  Listing,
  ListingStatus,
  ListingType,
  NeighborhoodId,
} from "~/types";
import { db } from "~/lib/baas";

export const LISTING_IMAGES = "listing_image";
export const LISTING_AMENITIES = "listing_amenity";
export const LISTING_COSTS = "listing_cost";
export const RENTAL_TERMS = "rental_terms";
export const VERIFICATION_CHECKS = "verification_check";
export const LISTING_PROMOTIONS = "listing_promotion";

interface Row {
  [key: string]: unknown;
}

function parseJson<T>(value: unknown, fallback: T): T {
  if (typeof value !== "string" || value.length === 0) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

// DB status enum -> the app's ListingStatus enum.
const DB_TO_APP_STATUS: Record<string, ListingStatus> = {
  draft: "draft",
  pending_review: "pending",
  visible: "published",
  needs_correction: "needs-attention",
  rejected: "rejected",
  temp_hidden: "hidden",
  rented: "archived",
};
const APP_TO_DB_STATUS: Record<ListingStatus, string> = {
  published: "visible",
  draft: "draft",
  paused: "draft",
  pending: "pending_review",
  "needs-attention": "needs_correction",
  rejected: "rejected",
  hidden: "temp_hidden",
  archived: "rented",
};

export function dbStatusToApp(status: string): ListingStatus {
  return DB_TO_APP_STATUS[status] ?? "draft";
}
export function appStatusToDb(status: ListingStatus): string {
  return APP_TO_DB_STATUS[status] ?? "draft";
}

export interface HydrationChildren {
  images: Row[];
  amenities: Row[];
  costs: Row[];
  terms: Row | null;
  checks: Row[];
  promotions: Row[];
}

// Fetch the child collections for one listing document by deterministic id.
async function loadChildren(listingDocId: string): Promise<HydrationChildren> {
  const out: HydrationChildren = { images: [], amenities: [], costs: [], terms: null, checks: [], promotions: [] };
  // Images / costs / checks: we don't know how many, so probe up to a cap.
  for (let i = 0; i < 12; i++) {
    try {
      const doc = await db.get<Row>(LISTING_IMAGES, `${listingDocId}-img-${i}`);
      out.images.push(doc);
    } catch {
      /* absent */
    }
  }
  for (let i = 0; i < 12; i++) {
    try {
      const doc = await db.get<Row>(LISTING_COSTS, `${listingDocId}-cost-${i}`);
      out.costs.push(doc);
    } catch {
      break;
    }
  }
  try {
    out.costs.push(await db.get<Row>(LISTING_COSTS, `${listingDocId}-cost-999`));
  } catch {
    /* no deposit */
  }
  try {
    out.terms = await db.get<Row>(RENTAL_TERMS, `listingid-${listingDocId}`);
  } catch {
    /* no terms */
  }
  for (const kind of ["listing-info", "landlord-identity", "rental-authorization"]) {
    try {
      out.checks.push(await db.get<Row>(VERIFICATION_CHECKS, `${listingDocId}-vc-${kind}`));
    } catch {
      /* absent */
    }
  }
  for (const kind of ["featured", "sponsored"]) {
    try {
      out.promotions.push(await db.get<Row>(LISTING_PROMOTIONS, `${listingDocId}-promo-${kind}`));
    } catch {
      /* absent */
    }
  }
  return out;
}

// Amenities need the full set; probe the 12 known amenity ids.
const KNOWN_AMENITIES: AmenityId[] = [
  "wifi",
  "air-conditioning",
  "washing-machine",
  "kitchen",
  "pool",
  "gym",
  "balcony",
  "parking",
  "elevator",
  "workspace",
  "pet-friendly",
  "sea-view",
];

async function loadAmenities(listingDocId: string): Promise<AmenityId[]> {
  const found: AmenityId[] = [];
  await Promise.all(
    KNOWN_AMENITIES.map(async (a) => {
      try {
        await db.get<Row>(LISTING_AMENITIES, `${listingDocId}-am-${a}`);
        found.push(a);
      } catch {
        /* not linked */
      }
    }),
  );
  return found;
}

/**
 * Build a UI `Listing` from a `listings` row plus its child collections.
 * `landlordSummary` is passed in (display-only fields) because landlord
 * profiles are private and must not be read from the public path here.
 */
export async function hydrateListing(
  row: Row & { $id: string },
  landlordSummary: Listing["landlord"],
): Promise<Listing> {
  const listingDocId = row.$id;
  const [children, amenities] = await Promise.all([loadChildren(listingDocId), loadAmenities(listingDocId)]);

  const images = children.images
    .slice()
    .sort((a, b) => Number(a.position) - Number(b.position))
    .map((r) => String(r.url));

  const costs: CostItem[] = children.costs
    .filter((c) => c.code !== "deposit")
    .map((c) => ({
      id: String(c.code ?? c.$id ?? "cost"),
      label: String(c.label ?? ""),
      amount: c.amount == null ? null : Number(c.amount),
      unit: String(c.unit ?? ""),
      state: String(c.state ?? "unknown") as CostState,
      cadence: String(c.cadence ?? "monthly") as CostItem["cadence"],
      note: c.note ? String(c.note) : undefined,
    }));
  const deposit = children.costs.find((c) => c.code === "deposit");

  const checks = children.checks.map((c) => ({
    id: String(c.kind) as "listing-info" | "landlord-identity" | "rental-authorization",
    label: String(c.kind),
    description: "",
    status: String(c.status) as "verified" | "in-review" | "not-started",
    lastUpdated: c.lastUpdated ? String(c.lastUpdated) : null,
  }));

  const featured = children.promotions.some((p) => p.kind === "featured" && p.active === true);
  const sponsored = children.promotions.some((p) => p.kind === "sponsored" && p.active === true);

  const minMonths = Number(row.minMonths ?? 1);
  const maxMonths = Number(row.maxMonths ?? 12);

  const listing: Listing = {
    id: listingDocId,
    slug: String(row.slug ?? listingDocId),
    title: String(row.title ?? ""),
    summary: String(row.summary ?? ""),
    description: String(row.description ?? ""),
    neighborhood: String(row.neighborhoodId ?? "an-thuong") as NeighborhoodId,
    address: String(row.address ?? ""),
    location: { lat: Number(row.lat ?? 0), lng: Number(row.lng ?? 0) },
    type: String(row.type ?? "apartment") as ListingType,
    monthlyRent: Number(row.monthlyRent ?? 0),
    bedrooms: Number(row.bedrooms ?? 1),
    bathrooms: Number(row.bathrooms ?? 1),
    floorArea: Number(row.floorArea ?? 0),
    floorLevel: String(row.floorLevel ?? "—"),
    furnishing: String(row.furnishing ?? "furnished") as FurnishingStatus,
    amenities,
    availability: String(row.availability ?? "available") as Availability,
    availableFrom: String(row.availableFrom ?? ""),
    rentalDurationMonths: [minMonths, maxMonths],
    images: images.length ? images : ["/images/l1.jpg"],
    verification: {
      checks,
      lastAvailabilityConfirmed: row.lastAvailabilityConfirmedAt ? String(row.lastAvailabilityConfirmedAt) : null,
    },
    verificationBadge: String(row.verificationLevel ?? "unverified") === "basic_verified",
    costs: {
      monthlyRent: Number(row.monthlyRent ?? 0),
      depositMonths: deposit && row.monthlyRent ? Math.max(1, Math.round(Number(deposit.amount) / Number(row.monthlyRent))) : 1,
      depositAmount: deposit ? Number(deposit.amount) : Number(row.monthlyRent ?? 0),
      items: costs,
    },
    rentalTerms: {
      minMonths,
      maxMonths,
      paymentDayOfMonth: Number(children.terms?.paymentDayOfMonth ?? 1),
      utilitiesIncluded: parseJson<string[]>(children.terms?.utilitiesIncluded, []),
      notes: parseJson<string[]>(children.terms?.notes, []),
    },
    neighborhoodNotes: parseJson<string[]>(children.terms?.neighborhoodNotes, []),
    distanceToBeach: String(children.terms?.distanceToBeach ?? ""),
    landlordId: String(row.landlordId ?? ""),
    landlord: landlordSummary,
    status: dbStatusToApp(String(row.status ?? "draft")),
    moderation: {
      result: "passed",
      checks: [],
      reasons: [],
      duplicateRisk: false,
      autoReviewedAt: null,
      manualReview: null,
    },
    lastAvailabilityConfirmedAt: String(row.lastAvailabilityConfirmedAt ?? ""),
    availabilityReminderSentAt: row.availabilityReminderSentAt ? String(row.availabilityReminderSentAt) : null,
    featured,
    sponsored,
    listedAt: row.listedAt ? String(row.listedAt) : new Date().toISOString(),
    views: 0,
    inquiries: 0,
    isSample: Boolean(row.isSample),
  };
  return listing;
}

/** Flatten a Listing into the scalar `listings` row (children written separately). */
export function toListingRow(listing: Listing): Record<string, unknown> {
  return {
    landlordId: listing.landlordId,
    slug: listing.slug,
    neighborhoodId: listing.neighborhood,
    title: listing.title,
    summary: listing.summary,
    description: listing.description,
    type: listing.type,
    monthlyRent: listing.monthlyRent,
    bedrooms: listing.bedrooms,
    bathrooms: listing.bathrooms,
    floorArea: listing.floorArea,
    floorLevel: listing.floorLevel,
    furnishing: listing.furnishing,
    availability: listing.availability,
    availableFrom: listing.availableFrom,
    minMonths: listing.rentalDurationMonths[0],
    maxMonths: listing.rentalDurationMonths[1],
    lat: listing.location.lat,
    lng: listing.location.lng,
    address: listing.address,
    status: appStatusToDb(listing.status),
    listedAt: listing.listedAt,
    lastAvailabilityConfirmedAt: listing.lastAvailabilityConfirmedAt,
    isSample: listing.isSample,
  };
}
