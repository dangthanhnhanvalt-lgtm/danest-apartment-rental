import { AMENITIES, LISTING_TYPE_LABEL, NEIGHBORHOODS } from "~/data/constants";
import type { AmenityId, Availability, FurnishingStatus, ListingType, NeighborhoodId, SortKey } from "~/types";

export type ViewMode = "grid" | "map";

export interface Filters {
  neighborhoods: NeighborhoodId[];
  minRent: string;
  maxRent: string;
  minArea: string;
  maxArea: string;
  duration: string;
  bedrooms: number | null;
  bathrooms: number | null;
  types: ListingType[];
  furnishing: FurnishingStatus | "";
  amenities: AmenityId[];
  verifiedOnly: boolean;
  availability: Availability | "";
  checkIn: string;
  sort: SortKey;
  view: ViewMode;
}

export const EMPTY_FILTERS: Filters = {
  neighborhoods: [],
  minRent: "",
  maxRent: "",
  minArea: "",
  maxArea: "",
  duration: "",
  bedrooms: null,
  bathrooms: null,
  types: [],
  furnishing: "",
  amenities: [],
  verifiedOnly: false,
  availability: "",
  checkIn: "",
  sort: "recommended",
  view: "grid",
};

export const SORT_LABEL: Record<SortKey, string> = {
  recommended: "Recommended",
  "price-asc": "Price: Low to High",
  "price-desc": "Price: High to Low",
  newest: "Newest Listings",
  "updated-desc": "Recently updated",
  "updated-asc": "Least recently updated",
};

export const NEIGHBORHOOD_IDS = NEIGHBORHOODS.map((n) => n.id);
export const TYPE_KEYS = Object.keys(LISTING_TYPE_LABEL) as ListingType[];
const AMENITY_IDS = AMENITIES.map((a) => a.id);

export function parseFilters(query: URLSearchParams, areaIds: string[]=NEIGHBORHOOD_IDS, amenityIds: string[]=AMENITY_IDS): Filters {
  const list = (key: string) => (query.get(key) ?? "").split(",").filter(Boolean);
  const neighborhoods = list("neighborhood").filter((n): n is NeighborhoodId => areaIds.includes(n));
  const types = list("type").filter((t): t is ListingType => TYPE_KEYS.includes(t as ListingType));
  const amenities = list("amenities").filter((a): a is AmenityId => amenityIds.includes(a));
  const bedrooms = Number(query.get("bedrooms"));
  const bathrooms = Number(query.get("bathrooms"));
  const furnishingRaw = query.get("furnishing") ?? "";
  const availabilityRaw = query.get("availability") ?? "";
  const sortRaw = query.get("sort") ?? "";
  const viewRaw = query.get("view");
  return {
    neighborhoods,
    minRent: query.get("minRent") ?? "",
    maxRent: query.get("maxRent") ?? "",
    minArea: query.get("minArea") ?? "",
    maxArea: query.get("maxArea") ?? "",
    duration: query.get("duration") ?? "",
    bedrooms: Number.isFinite(bedrooms) && bedrooms > 0 ? bedrooms : null,
    bathrooms: Number.isFinite(bathrooms) && bathrooms > 0 ? bathrooms : null,
    types,
    furnishing: (["furnished", "semi-furnished", "unfurnished"] as const).includes(furnishingRaw as FurnishingStatus)
      ? (furnishingRaw as FurnishingStatus)
      : "",
    amenities,
    verifiedOnly: query.get("verified") === "true",
    availability: (["available", "reserved", "unavailable"] as const).includes(availabilityRaw as Availability)
      ? (availabilityRaw as Availability)
      : "",
    checkIn: query.get("checkIn") ?? "",
    sort: (Object.keys(SORT_LABEL) as SortKey[]).includes(sortRaw as SortKey) ? (sortRaw as SortKey) : "recommended",
    view: viewRaw === "map" ? "map" : "grid",
  };
}

export function toQuery(filters: Filters) {
  return {
    neighborhood: filters.neighborhoods.join(",") || null,
    minRent: filters.minRent || null,
    maxRent: filters.maxRent || null,
    minArea: filters.minArea || null,
    maxArea: filters.maxArea || null,
    duration: filters.duration || null,
    bedrooms: filters.bedrooms || null,
    bathrooms: filters.bathrooms || null,
    type: filters.types.join(",") || null,
    furnishing: filters.furnishing || null,
    amenities: filters.amenities.join(",") || null,
    verified: filters.verifiedOnly || null,
    availability: filters.availability || null,
    checkIn: filters.checkIn || null,
    sort: filters.sort === "recommended" ? null : filters.sort,
    view: filters.view === "grid" ? null : filters.view,
  };
}

export function toggle<T>(arr: T[], value: T): T[] {
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
}

