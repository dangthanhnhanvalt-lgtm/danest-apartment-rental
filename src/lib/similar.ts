import { formatRent } from "~/lib/format";
import type { AmenityId, FurnishingStatus, Listing, ListingType, NeighborhoodId } from "~/types";

export interface SimilarLabels {
  amenity: Record<AmenityId, string>;
  furnishing: Record<FurnishingStatus, string>;
  listingType: Record<ListingType, string>;
  neighborhood: Record<NeighborhoodId, string>;
}

type Translate = (key: string, vars?: Record<string, string | number>) => string;

export interface SimilarMatch {
  listing: Listing;
  score: number;
  reasons: string[];
  isAlternative: boolean;
}

const CLOSE_THRESHOLD = 4;

function scoreCandidate(base: Listing, candidate: Listing, t: Translate, labels: SimilarLabels): { score: number; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  if (candidate.neighborhood === base.neighborhood) {
    score += 5;
    reasons.push(t("similar.sameArea", { area: labels.neighborhood[candidate.neighborhood] }));
  }

  const rentGap = Math.abs(candidate.monthlyRent - base.monthlyRent) / Math.max(base.monthlyRent, 1);
  if (rentGap <= 0.15) {
    score += 4;
    reasons.push(t("similar.similarRent", { rent: formatRent(candidate.monthlyRent) }));
  } else if (rentGap <= 0.25) {
    score += 2;
    reasons.push(t("similar.closeRent"));
  }

  if (candidate.bedrooms === base.bedrooms) {
    score += 3;
    reasons.push(t("similar.bedrooms", { count: candidate.bedrooms }));
  }

  if (candidate.type === base.type) {
    score += 2;
    reasons.push(labels.listingType[candidate.type]);
  }

  if (candidate.furnishing === base.furnishing) {
    score += 1;
    reasons.push(labels.furnishing[candidate.furnishing]);
  }

  const shared = candidate.amenities.filter((a) => base.amenities.includes(a));
  if (shared.length >= 3) {
    score += 2;
    reasons.push(t("similar.shares", { items: shared.slice(0, 2).map((a) => labels.amenity[a].toLowerCase()).join(", ") }));
  }

  return { score, reasons: reasons.slice(0, 3) };
}

/**
 * Recommends apartments from the existing dataset using neighbourhood, rent proximity, bedrooms,
 * type, furnishing and shared amenities. Falls back to closest alternatives when nothing is a
 * strong match, so the caller can label them honestly.
 */
export function findSimilarApartments(
  base: Listing,
  listings: Listing[],
  options: { limit?: number; excludeIds?: string[]; t: Translate; labels: SimilarLabels },
): SimilarMatch[] {
  const limit = options.limit ?? 4;
  const exclude = new Set([base.id, ...(options.excludeIds ?? [])]);

  const scored = listings
    .filter((l) => l.status === "published" && !exclude.has(l.id))
    .map((listing) => ({ listing, ...scoreCandidate(base, listing, options.t, options.labels) }))
    .sort((a, b) => b.score - a.score || Math.abs(a.listing.monthlyRent - base.monthlyRent) - Math.abs(b.listing.monthlyRent - base.monthlyRent));

  const close = scored.filter((m) => m.score >= CLOSE_THRESHOLD);
  const pick = close.length > 0 ? close : scored;

  return pick.slice(0, limit).map((m) => ({
    ...m,
    isAlternative: close.length === 0,
  }));
}
