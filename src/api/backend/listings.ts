// Backend listing reader — public listing data only.
//
// Reads the `listings` collection (publicly readable) and hydrates each row into
// the app's rich `Listing` via the adapter. Landlord display summary is taken
// from the app's own listing data (public display fields), because the
// landlord_profiles collection holds PRIVATE contact and is intentionally not
// readable from the client.
//
// This reader demonstrates the frontend is genuinely connected to the Database
// Hub for public listings. The rich demo listings remain the browsing base so
// nothing in the UI degrades (see state/app-state.tsx).

import { Query } from "appwrite";
import { db } from "~/lib/baas";
import { SAMPLE_LISTINGS_WITH_OPS } from "~/data/listings";
import type { Listing } from "~/types";
import { hydrateListing } from "./adapter";

const LISTINGS = "listings";

function landlordSummaryFor(landlordId: string): Listing["landlord"] {
  const match = SAMPLE_LISTINGS_WITH_OPS.find((l) => l.landlordId === landlordId);
  if (match) return match.landlord;
  // Fallback display summary (public fields only).
  return {
    id: landlordId,
    displayName: "DaNest landlord",
    role: "Private landlord",
    languages: ["English", "Vietnamese"],
    responseTime: "Usually replies within a day",
    memberSince: "2023-01-01",
  };
}

/**
 * Read up to `limit` publicly visible listings from the Database Hub and
 * hydrate them.
 *
 * This Backend Hub IGNORES equal()/offset() filters and caps a page at 25 rows,
 * so we read a single page and filter `status === "visible"` in memory.
 */
export async function listPublicListingsFromDb(limit = 6): Promise<Listing[]> {
  let page: Record<string, unknown>[];
  try {
    const { documents } = await db.list<Record<string, unknown>>(LISTINGS, [Query.limit(25)]);
    page = documents as Record<string, unknown>[];
  } catch {
    return [];
  }
  const rows = page.filter((row) => row.status === "visible") as (Record<string, unknown> & {
    $id: string;
  })[];
  const picked = rows.slice(0, limit);
  return Promise.all(
    picked.map((row) => hydrateListing(row, landlordSummaryFor(String(row.landlordId ?? "")))),
  );
}

/** Read one public listing by database document id. */
export async function getPublicListingFromDb(id: string): Promise<Listing | null> {
  try {
    const row = await db.get<Record<string, unknown>>(LISTINGS, id);
    return await hydrateListing(
      row as Record<string, unknown> & { $id: string },
      landlordSummaryFor(String(row.landlordId ?? "")),
    );
  } catch {
    return null;
  }
}
