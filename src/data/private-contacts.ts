// Demo private landlord contact (G4).
//
// PRIVATE — must only be shown to a Renter AFTER they have submitted an inquiry
// for that specific listing (RBAC-SPEC §3.4a / G4). Never render this before an
// inquiry exists. It is demo data held in the frontend; the real platform would
// return it from a server-authorized endpoint. See db/baas/README.md for why the
// Database Hub cannot enforce this today (client writes blocked, no RLS).

import type { Listing } from "~/types";

const CONTACTS: Record<string, { phone: string; email: string }> = {
  "ld-an": { phone: "+84 90 555 0101", email: "an.nguyen@danest.example" },
  "ld-linh": { phone: "+84 90 555 0202", email: "linh.tran@danest.example" },
  "ld-minh": { phone: "+84 90 555 0303", email: "minh.pham@danest.example" },
};

/** Return the private contact for a listing's landlord (demo), or a safe default. */
export function privateContactFor(listing: Listing): { phone: string; email: string } {
  const id = listing.landlordId || listing.landlord.id;
  return CONTACTS[id] ?? { phone: "+84 90 555 0000", email: "landlord@danest.example" };
}
