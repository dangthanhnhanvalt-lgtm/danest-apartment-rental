# DaNest — Backend Hub database layer (`db/baas`)

The DaNest database runs on the connected **Paletto Backend Hub** (Appwrite 1.8),
database `main`. This folder holds the schema reconciler, the demo seed, the
backup tool, the hardened data client and the verification suite.

> The PostgreSQL schema in `DATABASE-DESIGN.md` is the design reference. The
> Backend Hub cannot express RLS, CHECK constraints, triggers, native UNIQUE or
> `ON DELETE` modes, so those rules are enforced by a **backend function** (see
> `functions/README.md`). This folder implements the structure + seed only.

## Files

| File | Purpose |
|---|---|
| `schema.data.mjs` | Canonical schema definition (data only): 23 collections, attributes, enums, indexes, relationships, buckets, and `rules` metadata for function enforcement. |
| `schema.mjs` | Idempotent reconciler. Creates missing collections/attributes/indexes/relationships/buckets; repairs a relationship whose `onDelete` drifted. `--verify` = read-only, `--drop` = remove collections. |
| `extract-demo.mjs` | Extracts the existing demo data from `src/data/*.ts` into `demo-data.json` (source of truth for the seed). |
| `seed.mjs` | Deterministic, idempotent demo seed. `--reset` drains all demo docs; `--verify` checks expected ids (read-only). |
| `backup.mjs` | Read-only full backup (all docs + schema snapshot + users + buckets + manifest) into `backups/<timestamp>/`. |
| `lib/database.mjs` | Hardened data client (see "API caveats"). |
| `tests/run.mjs` | Verification suite: data integrity, seed reliability, security, isolation. Prints PASS / FAIL / NOT TESTABLE. |
| `functions/README.md` | The enforcement contract the backend function must implement. |

## Commands

```bash
node db/baas/extract-demo.mjs        # refresh demo-data.json from src/data
node db/baas/schema.mjs --verify     # read-only: is the schema complete?
node db/baas/schema.mjs              # reconcile schema (create/repair missing)
node db/baas/backup.mjs              # full read-only backup -> backups/<ts>/
node db/baas/seed.mjs --reset        # delete every demo document (drains pages)
node db/baas/seed.mjs                # seed / re-seed (idempotent)
node db/baas/seed.mjs --verify       # read-only: expected ids present?
node db/baas/tests/run.mjs           # full verification suite
node db/baas/tests/run-auth.mjs      # REAL-session auth + permission tests
```

## API caveats discovered (IMPORTANT)

This Backend Hub REST fork behaves differently from stock Appwrite:

- **`equal()` document filters are ignored.** A filtered list returns the first
  page regardless. Never use filters to decide create-vs-update.
- **`offset` and `cursorAfter` are ignored**, and a page is **capped at 25**
  documents regardless of `?limit`.
- **`total` IS accurate.** Use it for counts.
- **GET by exact document id works reliably.** 404 = truly absent.

Therefore `lib/database.mjs` is built entirely on **direct id access**:

- `getDocument(coll, id)` → `{found, doc}`; only a genuine 404 means absent;
  any other error throws.
- `createWithId(coll, id, data, perms)` → idempotent; 409 → returns existing.
- `updateById(coll, id, data, perms?)` → PUT (with perms) or PATCH.
- `upsertById` / `deleteById`.
- `countDocuments(coll)` → authoritative `total`.
- `pageAllDocuments(coll)` → `{docs, total, truncated}` (≤25 enumerable; `total`
  is the real count).

Because more than 25 documents cannot be enumerated, the seed and tests verify
content by **fetching known deterministic ids**, and counts by **`total`** — never
by trusting a page length or a counter.

### Client writes are NOT possible on this hub (verified)

`db/baas/tests/run-auth.mjs` creates real users, signs them in with real
sessions, and attempts genuine operations. Findings:

- **Every collection has zero collection-level permissions**, so a signed-in
  client is denied `create` (`No permissions provided for action 'create'`).
- The hub **rejects user-scoped document permissions**: only `(any, guests)` are
  accepted for the roles a client holds (`Permissions must be one of: (any,
  guests)`). The stock Appwrite `read("user:<uid>")` owner pattern cannot be used.
- Consequently **no browser write reaches the database** — saved apartments,
  listing create/update/delete, inquiries, reports, etc. all remain impossible
  client-side. Writes happen only via the admin key (seed / a future function).
- What the client *can* do is verified working: **authentication** (sign-up,
  sign-in, session restore, cross-device sessions) and **public reads**
  (`listings` and its child collections are per-document `read("any")`).

## Frontend integration status

The React app (`src/api/backend/*`, `src/state/app-state.tsx`) is wired to this
hub for exactly the subset the platform can support:

| Capability | Status | Notes |
| --- | --- | --- |
| Real auth (sign-up/sign-in/sign-out/restore) | **Connected** | Appwrite Auth; sessions persist across devices. Role is a local demo mapping (see below), never server-trusted, cannot escalate to Admin. |
| Public listing reads (`listPublicListingsFromDb`, `getPublicListingFromDb`) | **Connected (capability)** | Reads `listings` + children, filters `visible` in memory (equal() ignored). Demo browse uses the rich local data so the UX is complete; the hub reader is a demonstrated, tested capability. |
| Saved apartments persistence | **Local only** | Client writes impossible (see above). Stays in `localStorage` per browser. |
| Inquiries, viewing requests, inquiry status + history | **Local demo only** | Stored in `localStorage`; five-state model `new → replied → viewing_scheduled → rented` / `not_proceeding`; append-only history. |
| Landlord listing management (create/edit/pause/reconfirm/promote) | **Local demo only** | `localStorage` overrides; scoped to the signed-in landlord id (demo isolation). |
| Admin back-office (moderation, verification, reports, users, audit, settings) | **Local demo only** | `localStorage` (`danest.admin.*`); separate `sessionStorage` demo gate. |
| Role assignment (renter / landlord) | **Local demo only** | `src/api/backend/role-map.ts` (`danest.role-map`), keyed by real account email. **Not server RBAC.** |

### Persistence mechanism per feature (exact keys)

| Feature | Where it is stored |
| --- | --- |
| Auth session | Appwrite Auth (real); browser session cookie managed by the SDK |
| Role (renter/landlord) | `localStorage["danest.role-map"]` (demo mapping, UI-only) |
| Saved apartments | `localStorage["livora.saved"]` |
| Comparison | in-memory React state (`MAX_COMPARE = 3`) |
| Landlord listing edits/creates | `localStorage["livora.listings.overrides"]` |
| Inquiries | `localStorage["livora.inquiries"]` + `localStorage["livora.inquiry-overrides"]` |
| Inquiry status history | `localStorage["livora.inquiry-history"]` |
| Admin listings/users/reports/audit/settings | `localStorage["danest.admin.{listings,users,reports,audit,settings}"]` |
| Admin demo session gate | `sessionStorage["danest.admin.session"]` = `"1"` |

> Automated browser E2E is **NOT TESTABLE here** (no headless browser on the
> host). Real auth + public-read + private-data-denial are covered by
> `tests/run-auth.mjs` and `tests/run.mjs`; demo behaviours are verified by
> build + code-path review. Manual demo steps are in the final project report.




## Deterministic ids

Every seeded document gets an id derived from its source id, so re-runs are
idempotent and never collide:

| Record | Id |
|---|---|
| Listing `lst-001` | `lstlst-001` |
| Listing image (pos 0) | `lstlst-001-img-0` |
| Amenity link | `lstlst-001-am-wifi` |
| Cost (pos N) / deposit | `lstlst-001-cost-N` / `-cost-999` |
| Verification check | `lstlst-001-vc-listing-info` |
| Evidence review / document | `lstlst-001-evrev` / `-evdoc` |
| Promotion | `lstlst-001-promo-featured` |
| Inquiry `inq-001` | `inqinq-001` |
| Inquiry history row 0/1 | `inqinq-001-hist-0` / `-hist-1` |
| User (uid `user-ld-an`) | `useruser-ld-an` |
| Landlord profile `ld-an` | `llpld-an` |
| Neighborhood / amenity | `neighborhoodid-an-thuong` / `amenityid-wifi` |
| Report `rpt-001` | `rptrpt-001` |
| Audit `aud-001` | `auditaud-001` |
| Settings singleton | `singleton-main` |

(`docId()` lower-cases and strips characters that are not `a-z0-9.-_`, max 36.)

## Idempotency & reset

- Running `seed.mjs` twice: first run `created 769`, second run `created 0 /
  updated 769` — no duplicates.
- `--reset` drains each seeded collection page by page (delete the visible ≤25,
  the next page shifts into view) until `total` is 0, asserting each collection
  reaches zero.

## Security posture (verified vs required)

**Native (verified by `tests/run.mjs`):**
- `documentSecurity=true` on all 23 collections; **no collection-level
  permissions** (no public read/write).
- Evidence bucket `evidence`: `fileSecurity=true`, **no permissions** (no
  anonymous access).
- Seeded listings are public-read (`read("any")`) — public content.
- Seeded `landlord_profiles` (which hold private contact) carry **no
  permissions** — anonymous users see zero private contact.
- Anonymous users **cannot** create inquiries (HTTP 401 at collection level).

**Requires the backend function (NOT TESTABLE without it):**
- Landlord isolation (Landlord A cannot touch Landlord B's listings/inquiries).
- Guest-cannot-create-inquiry business rule (beyond collection-level denial).
- G4 contact projection (contact only after the renter's own inquiry).
- Only Admins grant Basic Verified.
- Audit append-only / immutability.

Do not claim full RBAC is operational until the function exists and its
end-to-end tests pass.

## Backups

`backup.mjs` writes to `db/baas/backups/<timestamp>/`:
`backup.json`, `schema-snapshot.json`, `users.json`, `buckets.json`, `MANIFEST.md`.
It re-reads the backup and fails if it cannot parse or if counts differ.

## Rollback

To return to a previous backup, `--reset` the seed, then re-create documents
from `backups/<ts>/backup.json` (ids are preserved in the file). The schema and
evidence bucket are never dropped by the seed.
