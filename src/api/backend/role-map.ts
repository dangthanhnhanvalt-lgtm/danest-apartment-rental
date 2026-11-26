// Demo role mapping — UI-only, browser-local.
//
// WHY THIS EXISTS: real Appwrite authentication tells us WHO a user is, but on
// this Backend Hub we cannot securely read or write a role profile (clients may
// not create documents and user-scoped permissions are rejected). So the role a
// person picked at sign-up ("Looking for an apartment" => renter, "A landlord"
// => landlord) is remembered here in localStorage, keyed by their real account
// email. This is a DEMO convenience only:
//
//   - It is NOT server-side authorization. A determined user can edit
//     localStorage. Do not describe this as secure RBAC.
//   - It can only ever be "tenant" (Renter) or "landlord". Admin is NOT part of
//     this mapping — admin is a separate internal back-office gate
//     (sessionStorage `danest.admin.session`) and can never be granted here.
//   - The role only selects which demo dashboard the UI shows; it never grants
//     access to private server data (which the hub would deny anyway).

import type { User } from "~/types";

const KEY = "danest.role-map";

type RoleMap = Record<string, User["role"]>;

function readMap(): RoleMap {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as RoleMap) : {};
  } catch {
    return {};
  }
}

function writeMap(map: RoleMap) {
  try {
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    /* storage unavailable — role falls back to renter */
  }
}

const normalise = (email: string) => email.trim().toLowerCase();

/** Remember the role chosen for a real account (renter or landlord only). */
export function rememberRole(email: string, role: User["role"]) {
  if (!email) return;
  // Admin can never be stored here — clamp to landlord/renter.
  const safe: User["role"] = role === "landlord" ? "landlord" : "tenant";
  writeMap({ ...readMap(), [normalise(email)]: safe });
}

/** Look up the remembered role for an account; defaults to renter. */
export function recallRole(email: string): User["role"] {
  if (!email) return "tenant";
  const role = readMap()[normalise(email)];
  return role === "landlord" ? "landlord" : "tenant";
}

/** Forget a role mapping (used when switching accounts is not desired on logout). */
export function forgetRole(email: string) {
  const map = readMap();
  delete map[normalise(email)];
  writeMap(map);
}
