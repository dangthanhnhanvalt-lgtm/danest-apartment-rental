import type { Filters } from "~/components/search/filter-config";
import type { Listing } from "~/types";
function numericBound(raw:string):number|null { const n=Number(raw);return raw.trim() && Number.isFinite(n) && n>=0 ? n : null; }
export function searchResults(listings:Listing[],filters:Filters):Listing[] {
    const min = numericBound(filters.minRent);
    const max = numericBound(filters.maxRent);
    const minArea = numericBound(filters.minArea);
    const maxArea = numericBound(filters.maxArea);
    const duration = numericBound(filters.duration);
    const filtered = listings.filter((l) => {
      if (l.status !== "published") return false;
      if (filters.neighborhoods.length && !filters.neighborhoods.includes(l.neighborhood)) return false;
      if (min !== null && l.monthlyRent < min) return false;
      if (max !== null && l.monthlyRent > max) return false;
      if (minArea !== null && (!Number.isFinite(l.floorArea) || l.floorArea < minArea)) return false;
      if (maxArea !== null && (!Number.isFinite(l.floorArea) || l.floorArea > maxArea)) return false;
      if (filters.checkIn && (l.availability !== "available" || !l.availableFrom || l.availableFrom.slice(0,10) > filters.checkIn)) return false;
      if (duration !== null && (duration < l.rentalDurationMonths[0] || duration > l.rentalDurationMonths[1])) return false;
      if (filters.bedrooms !== null) {
        if (filters.bedrooms >= 3 ? l.bedrooms < 3 : l.bedrooms < filters.bedrooms) return false;
      }
      if (filters.bathrooms !== null) {
        if (filters.bathrooms >= 2 ? l.bathrooms < 2 : l.bathrooms < filters.bathrooms) return false;
      }
      if (filters.types.length && !filters.types.includes(l.type)) return false;
      if (filters.furnishing && l.furnishing !== filters.furnishing) return false;
      if (filters.amenities.length && !filters.amenities.every((a) => l.amenities.includes(a))) return false;
      if (filters.verifiedOnly && !l.verificationBadge) return false;
      if (filters.availability && l.availability !== filters.availability) return false;
      return true;
    });
    const sorted = [...filtered];
    switch (filters.sort) {
      case "price-asc":
        sorted.sort((a, b) => a.monthlyRent - b.monthlyRent);
        break;
      case "price-desc":
        sorted.sort((a, b) => b.monthlyRent - a.monthlyRent);
        break;
      case "updated-asc":
      case "updated-desc":
        sorted.sort((a,b)=>{
          const at = Date.parse(a.updatedAt ?? ""), bt = Date.parse(b.updatedAt ?? "");
          if (!Number.isFinite(at)) return Number.isFinite(bt) ? 1 : 0;
          if (!Number.isFinite(bt)) return -1;
          return filters.sort === "updated-asc" ? at-bt : bt-at;
        });
        break;
      case "newest":
        sorted.sort((a, b) => new Date(b.listedAt).getTime() - new Date(a.listedAt).getTime());
        break;
      default:
        sorted.sort((a, b) => {
          const score = (l: Listing) => (l.featured ? 2 : 0) + (l.sponsored ? 1 : 0);
          return score(b) - score(a) || b.verification.checks.filter((c) => c.status === "verified").length - a.verification.checks.filter((c) => c.status === "verified").length;
        });
    }
    return sorted;
}
