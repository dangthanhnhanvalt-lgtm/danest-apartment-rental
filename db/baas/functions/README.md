# DaNest backend enforcement contract

**Status:** Sprint 1 does not deploy this — there is no catalog primitive for a custom data-access function, and the platform does not allow writing/deploying a new Function from this agent. This document is the exact contract the Sprint 2 backend must implement. Until it exists, the schema in `db/baas` has **no real access control** beyond Appwrite's document permissions written by whoever creates a record.

Appwrite 1.8 gives us collections, columns, enums, relationships, key/unique-ish indexes and per-document permissions. It does **not** give us RLS, CHECK constraints, triggers, `ON DELETE` modes (only relationship `cascade`/`setNull`/`restrict` at the runtime level), or native `UNIQUE`/partial/FTS. Every rule below is therefore enforced **in backend code**, not in the database.

## Who runs this function

One server-side Appwrite Function (Node runtime) that every browser write/read that needs a rule goes through. It authenticates with `setKey(req.headers['x-appwrite-key'])` (per-execution dynamic key) and must declare scopes:

```
scopes: ["documents.read", "documents.write", "users.read"]
```

Clients never set per-document permissions directly for anything sensitive. The function computes them.

## Identity model

- **Guest** — an anonymous Appwrite user (`email === ""`). Read `status='visible'` listings only.
- **Renter** — a real user whose `users_profile.role = 'renter'`.
- **Landlord** — `users_profile.role = 'landlord'`.
- **Admin** — a member of the Appwrite owner team `app-owner-radiant-valley-421674939` OR `users_profile.role = 'admin'` set through the internal provisioning path only. Public registration can never create Admin (see §G2).
- **SYSTEM** — the function running an automated job. Never an Admin identity (see §G7).

Resolve the caller every request: `users.get(callerId)` (scope `users.read`) → look up `users_profile` by `userId`. Never trust a role/uid in the request body.

## Rules the database cannot express

### G2 — no public Admin
- On registration the function forces `role ∈ {renter, landlord}` and `status = 'pending'` (renter `active`, landlord `pending` for FR-02).
- The only way to write `users_profile.role = 'admin'` is a server job using the admin key. Reject any client write that sets `role='admin'` with 403.

### G3 — guests cannot create inquiries
- `inquiries.tenantId` must equal the authenticated caller's uid **and** the caller must be a `renter`. Anonymous → 401. Body-supplied `tenantId` differing from the session → 403.
- On create force `status='new'`, `firstRequestedAt=now`, and write the initial `inquiry_status_history` row (`fromStatus=null, toStatus='new', actorId=caller`).

### G4 / BRULE-11 — private contact only after an inquiry
- `landlord_profiles.contactEmail` / `contactPhone` are **never** returned by the generic landlord reader.
- A dedicated `getLandlordContact(listingId)` path returns them only when
  `EXISTS(inquiries WHERE tenantId=caller AND listingId=:listingId)` — or the caller owns the listing / is Admin.
- Guests and renters without an inquiry get `null`.

### G8 — multi-landlord isolation
- **listings**: a landlord may read/write a listing only when `listing.landlordId === caller`. Writes set `landlordId` from the session, never the body.
- **child rows** (`listing_image`, `listing_amenity`, `listing_cost`, `rental_terms`, `verification_check`, `moderation_*`, `evidence_*`, `listing_promotion`): accessible only when the parent listing is owned by the caller (or Admin). Resolve parent ownership server-side.
- **inquiries**: a landlord reads/updates an inquiry only when the inquiry's listing is owned by them. A renter sees only `tenantId === caller`.
- This is a **permission check in code**; Appwrite has no row-level policy. A direct client call to the database with a leaked document id must still be blocked because the function is the only writer and the collections carry no collection-level read/write perms.

### G7 — SYSTEM audit actor
- `audit_log` is written only by the function. `actorType` is derived from the caller: interactive actions get `admin|landlord|renter`; automated jobs write `system` with `actorId = null`.
- Reject any client request with `actorType='system'`.
- Enforce `(actorType='system') === (actorId === null)` in code.

### G11 — automated moderation never verifies
- `moderation_auto` writes happen in a system job; they may change `listings.status` only.
- Setting `listings.verificationLevel='basic_verified'` requires `EXISTS(evidence_review WHERE listingId=:id AND decision='approved')` **and** a non-null `verifiedAt`. Check this in the one write path that can touch `verificationLevel`; reject otherwise.
- `evidence_review.reviewerId` and `moderation_review.reviewerId` must be Admin.

### G6 — one active promotion per (listing, kind)
- Before activating, query for an existing `active=true` promotion of the same `listingId`+`kind`; reject the second. (Appwrite has no partial unique index.)
- Promotion writes are audited (`featured-requested` / `featured-activated` / `featured-deactivated`).

### G10 — Admin reconfirm is audited separately
- Landlord self-reconfirm writes `audit_log` `actorType='landlord'`.
- Admin reconfirm writes `actorType='admin'` with the Admin's id. Both set `lastAvailabilityConfirmedAt`.

### Unique-ish invariants (app-checked, small TOCTOU risk)
| Table | Invariant | How |
|---|---|---|
| `users_profile` | `email` unique | lookup before insert; rely on the `unique` index (`idx_users_email`) too |
| `landlord_profiles` | one per `userId` | `unique` index `idx_landlord_user` |
| `listing_image` | `(listingId, position)` unique | `unique` index |
| `listing_amenity` | `(listingId, amenityId)` unique | `unique` index |
| `rental_terms` | one per `listingId` | `unique` index |
| `listing_promotion` | one active per `(listingId, kind)` | code query (no partial index) |
| `saved_apartments` | `(userId, listingId)` unique | `unique` index |
| `admin_settings` | `singleton='main'` | `unique` index |
| `inquiries` | `status` lifecycle | code (see BRULE-09) |

### BRULE-09 — inquiry state machine
Allowed transitions (every one appends `inquiry_status_history`):

```
new               -> replied | viewing_scheduled | not_proceeding
replied           -> viewing_scheduled | rented | not_proceeding
viewing_scheduled -> rented | not_proceeding
rented            -> (terminal)
not_proceeding    -> (terminal)
```

A landlord owner or Admin may advance an inquiry. Viewing booking (`viewing_scheduled`, `scheduledAt`) only from `replied`/`viewing_scheduled`. `rented`/`not_proceeding` cannot book.

### Append-only tables
`audit_log`, `inquiry_status_history`, `evidence_access_log` are create-only. The function refuses `update`/`delete` on them; the client never has collection-level write. (Appwrite still lets the admin key mutate them — that is why the function must be the only writer.)

## Storage — evidence

- Bucket `evidence`, `fileSecurity: true`, no collection-level perms.
- Uploads go through the function; the function stamps per-file `read(admin)` only (never public, never landlord).
- Every `storage.getFile` on `evidence` also appends an `evidence_access_log` row with the Admin's id (FR-24).

## What remains honestly unsupported at DB level

- No `ON DELETE RESTRICT` (Appwrite relationship delete is `cascade|setNull|restrict` — `restrict` exists in some versions; treat as best-effort).
- No CHECK constraints: rent ≥ 0, bedrooms ≥ 1, `minMonths ≤ maxMonths`, `paymentDayOfMonth 1..28`, `graceDays 0..30`, `scheduledAt only for viewing`, `amount null ⇒ unknown` — all function-checked.
- No full-text search (D4) — use Appwrite query filters for now.
- No true RLS — isolation is function-enforced plus the fact that collections have no public perms.

## Relationship delete behavior (repaired)

The live schema currently uses these `onDelete` settings (verified by reading
each collection definition):

| Relationship | onDelete | Rationale |
|---|---|---|
| `listings -> listing_image` | cascade | pure child data |
| `listings -> listing_amenity` | cascade | pure child data |
| `listings -> listing_cost` | cascade | pure child data |
| `listings -> listing_promotion` | cascade | promotion tied to listing |
| `listings -> inquiries` | **setNull** | inquiry history must survive listing removal |
| `listings -> reports` | **setNull** | reports are a safety record; preserve |
| `listings -> evidence_review` | **setNull** | evidence trail preserved on listing removal |
| `evidence_review -> evidence_document` | setNull | keep uploaded evidence even if a review row is replaced |
| `inquiries -> inquiry_status_history` | cascade | history tied to its inquiry |
| `inquiries -> notifications` | cascade | notification about a deleted inquiry is meaningless |

The three destructive `cascade`s (inquiries, reports, evidence_review) were
changed to `setNull` during the repair so deleting a listing cannot silently
destroy inquiry/report/evidence history. Child rows keep their `listingId`
string so they remain queryable, and `setNull` clears the relationship attribute
only.

`ON DELETE RESTRICT` is **not available** on this Backend Hub. Where true
"refuse to delete a listing that still has inquiries/reports" is required, the
backend function must pre-check and refuse the delete — document that it cannot
be enforced at the database layer.

Note: `audit_log`, `evidence_access_log` and `inquiry_status_history` are not
reachable by any listing-delete cascade, so audit and evidence-access records
are never removed by deleting application content.
