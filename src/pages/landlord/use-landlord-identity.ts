// Demo landlord identity for the signed-in landlord.
//
// Landlord dashboard pages must scope ALL data (listings, inquiries, viewings)
// to the current landlord so one landlord never sees another's data in the demo
// experience. On this Backend Hub there is no server-side ownership check — this
// is a frontend/demo isolation only (documented in RBAC-SPEC §7). The id is the
// real account's user id, so different landlord accounts get distinct scopes.

import { LANDLORD_PROFILE } from "~/data/listings";
import { useAppState } from "~/state/app-state";

export interface LandlordIdentity {
  id: string;
  displayName: string;
}

export function useLandlordIdentity(): LandlordIdentity {
  const { session, demoLandlordId } = useAppState();
  if (demoLandlordId && session) {
    return {
      id: demoLandlordId,
      // A brand-new landlord has no profile yet; use their account name.
      displayName: session.user.name || LANDLORD_PROFILE.displayName,
    };
  }
  // Fallback (should not happen behind the landlord gate) — the demo landlord.
  return { id: LANDLORD_PROFILE.id, displayName: LANDLORD_PROFILE.displayName };
}
