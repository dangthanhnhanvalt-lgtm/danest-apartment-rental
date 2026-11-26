# DaNest — Database Design Document

**Status:** Design only. No database, backend, migrations, UI, source code, or mock data have been created or modified.
**Target engine:** PostgreSQL 16.
**Primary authorization reference:** `RBAC-SPEC.md` (this document must stay consistent with it; resolved decisions **G2, G3, G4, G6, G7, G8, G9, G10, G11, P1** are honored throughout — see §8.1; **C1** Agent role is a recorded BRD scope deviation).
**Source of truth for current data:** the DaNest React prototype — `src/types/index.ts`, `src/api/index.ts`, `src/api/admin.ts`, `src/lib/availability.ts`, `src/data/{listings,landlord,admin,constants}.ts`, `src/lib/moderation.ts`, `src/components/detail/contact-card.tsx`.

---

## 0. What was inspected, and how to read this document

### 0.1 Files inspected
| Area | File | Used for |
|---|---|---|
| Type model (all entities) | `src/types/index.ts` | Field names, nullability, enums, tuples |
| Public data layer + localStorage | `src/api/index.ts` | Keys `livora.*`, override merge, `draftToListing`, query/sort logic |
| Admin data layer | `src/api/admin.ts` | Keys `danest.admin.*`, status/verification transitions, audit, KPIs |
| Availability rules | `src/lib/availability.ts` | `availabilityStatus()` fresh/reminder/overdue/hidden, settings defaults |
| Moderation | `src/lib/moderation.ts` | Automated check ids/results; `statusForModeration` |
| Mock listings | `src/data/listings.ts` | `Listing` shape, `landlord`, `verification`, `costs`, `rentalTerms`, `gallery`, 30 core + extension listings, 3 landlords |
| Mock inquiries | `src/data/landlord.ts` | `Inquiry`/`ViewingRequest` samples, statuses, `scheduledAt` |
| Admin seed data | `src/data/admin.ts` | `AdminUser`, `Report`, `AuditLogEntry`, 4 admin sample listings |
| Inquiry creation | `src/components/detail/contact-card.tsx` | Exactly which fields the UI writes |
| Authorization | `RBAC-SPEC.md` | Roles, ownership, G3/G4/G11, proposed entities §6 |

### 0.2 Design conventions
- **PostgreSQL 16**, `text`/`citext`/`timestamptz`/`numeric`/`jsonb`, native `CREATE TYPE ... AS ENUM` for stable closed sets.
- **Primary keys:** `uuid` (`gen_random_uuid()`), surrogate. Natural keys (`users.email`, `listings.slug`) are `UNIQUE`.
- **Naming:** `snake_case` tables (plural) and columns (singular).
- **Timestamps:** `timestamptz`; date-only fields (`available_from`, `move_in_date`) use `date`.
- **Money:** `numeric(12,2)` in USD (the app is USD-only). Never floats.
- **Soft vs hard delete:** listings/inquiries/reports are never hard-deleted (lifecycle via `status`); child rows cascade from parent where safe.
- **RLS:** the ownership rules (§4) are expressed as PostgreSQL Row-Level Security policy sketches — *proposals only, not applied*.
- **OPEN:** any rule the code/BRD does not settle is marked **OPEN** rather than invented.

### 0.3 localStorage → target entity (quick map)
| Current key / structure | Target |
|---|---|
| `livora.session` (Session) | `sessions` + `users` |
| `livora.listings.overrides` | `listings` (+ children) |
| `livora.saved` (string[] of listing ids) | `saved_apartments` (user-scoped) |
| `livora.inquiries` / `livora.inquiry-overrides` | `inquiries` |
| `danest.admin.listings` | `listings` overrides |
| `danest.admin.users` (AdminUser[]) | `users` |
| `danest.admin.reports` (Report[]) | `reports` |
| `danest.admin.audit` (AuditLogEntry[]) | `audit_log` |
| `danest.admin.settings` (AdminSettings) | `admin_settings` |
| `danest.admin.session` (client flag) | removes-flag → `sessions` (admin) |

---

## 1. Entity-Relationship Diagram (Mermaid)

```mermaid
erDiagram
    USERS ||--o| LANDLORD_PROFILES : "has profile"
    USERS ||--o{ SESSIONS : "owns"
    USERS ||--o{ LISTINGS : "landlord owns"
    USERS ||--o{ INQUIRIES : "renter submits"
    USERS ||--o{ SAVED_APARTMENTS : "saves"
    USERS ||--o{ REPORT : "files"
    USERS ||--o{ NOTIFICATIONS : "receives"
    USERS ||--o{ AUDIT_LOG : "acts"
    USERS ||--o{ MODERATION_REVIEW : "reviews (admin)"
    USERS ||--o{ EVIDENCE_REVIEW : "reviews (admin)"
    USERS ||--o{ LISTING_PROMOTION : "creates"
    USERS ||--o{ EVIDENCE_DOCUMENT : "submits"

    NEIGHBORHOODS ||--o{ LISTINGS : "located in"
    AMENITIES }o--o{ LISTINGS : "listing_amenity"
    AMENITIES ||--o{ LISTING_AMENITY : "tagged-in"
    LISTINGS ||--o{ LISTING_AMENITY : "has"

    LISTINGS ||--o{ LISTING_IMAGE : "has"
    LISTINGS ||--o{ LISTING_COST : "has"
    LISTINGS ||--o| RENTAL_TERMS : "has"
    LISTINGS ||--o{ VERIFICATION_CHECK : "has"
    LISTINGS ||--o| MODERATION_AUTO : "auto result"
    LISTINGS ||--o{ MODERATION_REVIEW : "manual decisions"
    LISTINGS ||--o{ EVIDENCE_REVIEW : "evidence reviews"
    LISTINGS ||--o{ INQUIRIES : "receives"
    LISTINGS ||--o{ SAVED_APARTMENTS : "saved-as"
    LISTINGS ||--o{ LISTING_PROMOTION : "promoted-by"
    LISTINGS ||--o{ REPORT : "reported-on"
    LISTINGS ||--o{ AUDIT_LOG : "target-of"

    INQUIRIES ||--o{ NOTIFICATIONS : "triggers"
    INQUIRIES ||--o{ INQUIRY_STATUS_HISTORY : "logs"
    USERS ||--o{ INQUIRY_STATUS_HISTORY : "actor"

    EVIDENCE_REVIEW ||--o{ EVIDENCE_DOCUMENT : "references"

    USERS {
        uuid id PK
        citext email UK
        text password_hash
        text name
        user_role role
        account_status status
        text avatar_initials
        timestamptz created_at
    }
    LANDLORD_PROFILES {
        uuid user_id PK_FK
        text display_name
        text business_role
        text[] languages
        text response_time
        date member_since
        citext contact_email
        text contact_phone
    }
    SESSIONS {
        uuid id PK
        uuid user_id FK
        text token_hash
        timestamptz created_at
        timestamptz expires_at
    }
    NEIGHBORHOODS {
        text id PK
        text name
        text tagline
        text description
        text image_path
        text_array lifestyle
        numeric lat
        numeric lng
    }
    AMENITIES {
        text id PK
        text label
    }
    LISTING_AMENITY {
        uuid listing_id PK_FK
        text amenity_id PK_FK
    }
    LISTINGS {
        uuid id PK
        text slug UK
        uuid landlord_id FK
        text neighborhood_id FK
        text title
        text summary
        text description
        listing_type type
        numeric monthly_rent
        int bedrooms
        int bathrooms
        numeric floor_area
        text floor_level
        furnishing_status furnishing
        availability_status availability
        date available_from
        int min_months
        int max_months
        numeric lat
        numeric lng
        text address
        listing_status status
        verification_level verification_level
        date verified_at
        text verified_scope
        date last_availability_confirmed_at
        timestamptz availability_reminder_sent_at
        timestamptz listed_at
        boolean is_sample
        timestamptz created_at
        timestamptz updated_at
    }
    LISTING_IMAGE {
        uuid id PK
        uuid listing_id FK
        text url
        int position
    }
    LISTING_COST {
        uuid id PK
        uuid listing_id FK
        text code
        text label
        numeric amount
        text unit
        cost_state state
        cost_cadence cadence
        boolean refundable
        text note
        int position
    }
    RENTAL_TERMS {
        uuid listing_id PK_FK
        int payment_day_of_month
        text[] utilities_included
        text[] notes
        text[] neighborhood_notes
        text distance_to_beach
    }
    VERIFICATION_CHECK {
        uuid id PK
        uuid listing_id FK
        verification_kind kind
        verification_status status
        timestamptz last_updated
    }
    MODERATION_AUTO {
        uuid listing_id PK_FK
        moderation_result result
        jsonb checks
        text[] reasons
        boolean duplicate_risk
        date auto_reviewed_at
    }
    MODERATION_REVIEW {
        uuid id PK
        uuid listing_id FK
        uuid reviewer_id FK
        moderation_decision decision
        text reason
        timestamptz reviewed_at
    }
    EVIDENCE_REVIEW {
        uuid id PK
        uuid listing_id FK
        uuid reviewer_id FK
        evidence_decision decision
        text reason
        timestamptz reviewed_at
    }
    EVIDENCE_DOCUMENT {
        uuid id PK
        uuid listing_id FK
        uuid evidence_review_id FK
        evidence_kind kind
        text storage_ref
        timestamptz uploaded_at
    }
    INQUIRIES {
        uuid id PK
        uuid listing_id FK
        uuid tenant_id FK
        inquiry_type type
        text message
        date move_in_date
        int duration_months
        text[] tenant_preferences
        inquiry_status status
        timestamptz first_requested_at
        timestamptz first_responded_at
        date scheduled_at
        text preferred_time
        timestamptz created_at
        timestamptz updated_at
    }
    INQUIRY_STATUS_HISTORY {
        uuid id PK
        uuid inquiry_id FK
        inquiry_status from_status
        inquiry_status to_status
        uuid actor_id FK
        timestamptz changed_at
        text note
    }
    SAVED_APARTMENTS {
        uuid id PK
        uuid user_id FK
        uuid listing_id FK
        timestamptz saved_at
    }
    LISTING_PROMOTION {
        uuid id PK
        uuid listing_id FK
        promotion_kind kind
        uuid actor_id FK
        boolean active
        timestamptz created_at
        timestamptz ended_at
    }
    REPORT {
        uuid id PK
        uuid listing_id FK
        uuid reporter_id FK
        text reporter_name
        citext reporter_email
        report_category category
        text message
        report_status status
        uuid resolved_by FK
        text resolution_note
        timestamptz created_at
        timestamptz updated_at
    }
    NOTIFICATIONS {
        uuid id PK
        uuid recipient_id FK
        uuid inquiry_id FK
        notification_type type
        jsonb payload
        timestamptz read_at
        timestamptz created_at
    }
    AUDIT_LOG {
        uuid id PK
        audit_actor_type actor_type
        uuid actor_id FK
        audit_action action
        text target_type
        text target_id
        text target_label
        text reason
        jsonb old_values
        jsonb new_values
        timestamptz created_at
    }
    ADMIN_SETTINGS {
        bool singleton PK
        int availability_grace_days
        int availability_reminder_days
        timestamptz updated_at
    }
```

---

## 2. Data dictionary & schema

### 2.1 Enumerated types
```sql
CREATE TYPE user_role          AS ENUM ('renter', 'landlord', 'admin');       -- tenant = renter; Agent/Property-Manager excluded (BRD scope deviation, RBAC §9a C1)
CREATE TYPE account_status     AS ENUM ('pending', 'active', 'rejected', 'suspended'); -- FR-02 approval/lock
CREATE TYPE listing_type       AS ENUM ('apartment', 'studio', 'serviced-apartment', 'penthouse');
CREATE TYPE furnishing_status  AS ENUM ('furnished', 'semi-furnished', 'unfurnished');
CREATE TYPE availability_status AS ENUM ('available', 'reserved', 'unavailable');
CREATE TYPE listing_status     AS ENUM ('draft','pending_review','visible','needs_correction','rejected','temp_hidden','rented'); -- FR-09/14
CREATE TYPE cost_state         AS ENUM ('fixed', 'variable', 'reported', 'unknown');
CREATE TYPE cost_cadence       AS ENUM ('monthly', 'one-time');
CREATE TYPE verification_level AS ENUM ('unverified', 'basic_verified');       -- FR-21 (replaces boolean badge)
CREATE TYPE verification_kind  AS ENUM ('listing-info', 'landlord-identity', 'rental-authorization');
CREATE TYPE verification_status AS ENUM ('verified', 'in-review', 'not-started');
CREATE TYPE moderation_result  AS ENUM ('passed', 'needs-attention', 'rejected', 'incomplete');
CREATE TYPE moderation_decision AS ENUM ('approved','rejected','corrections-requested','hidden','restored');
CREATE TYPE evidence_decision  AS ENUM ('approved', 'rejected', 'corrections-requested');
CREATE TYPE evidence_kind      AS ENUM ('identity', 'rental-authorization', 'listing-proof');
CREATE TYPE inquiry_type       AS ENUM ('question', 'viewing-request');
CREATE TYPE inquiry_status     AS ENUM ('new', 'replied', 'viewing_scheduled', 'rented', 'not_proceeding'); -- FR-31 five states
CREATE TYPE promotion_kind     AS ENUM ('featured', 'sponsored');
CREATE TYPE report_category    AS ENUM ('inaccurate', 'hidden-fees', 'duplicate', 'misleading-photos', 'other');
CREATE TYPE report_status      AS ENUM ('open', 'resolved', 'unresolved');
CREATE TYPE notification_type  AS ENUM ('inquiry-created','inquiry-replied','inquiry-viewing-scheduled','inquiry-rented',
                                        'inquiry-not-proceeding','availability-reminder','listing-moderated','verification-changed',
                                        'report-resolved','account-status-changed');
CREATE TYPE audit_action       AS ENUM ('listing-approved','listing-rejected','listing-corrections-requested',
                                        'listing-hidden','listing-restored','listing-submitted','listing-status-changed',
                                        'verification-level-changed','evidence-reviewed','evidence-accessed',
                                        'account-approved','account-rejected','account-suspended','account-activated',
                                        'report-resolved','report-reopened','settings-updated','availability-reconfirmed',
                                        'featured-requested','featured-activated','featured-deactivated');
CREATE TYPE audit_actor_type   AS ENUM ('admin', 'landlord', 'renter', 'system');  -- G7: 'system' = automated action (actor_id NULL)
```

> `user_role` **adds `admin`** (RBAC G2 — RESOLVED: Admin rows are provisioned **only** through a secure internal process; public registration never self-assigns Admin). `tenant = renter` (RBAC G9 — RESOLVED). `agent` is **not** added — the Agent/Property-Manager role is **excluded from the current project scope** as an explicit BRD scope deviation (**C1**, RBAC §9a); **no `delegation_scope` table** is created.

### 2.2 `users`
| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| id | uuid | no | gen_random_uuid() | PK |
| email | citext | no | | UNIQUE |
| password_hash | text | no | | Argon2/bcrypt hash (today passwords ignored — backend must hash) |
| name | text | no | | |
| role | user_role | no | 'renter' | renter / landlord / admin (no agent — excluded, C1). Public registration = renter/landlord only; admin via secure internal provisioning (G2) |
| status | account_status | no | 'pending' | FR-02: pending→active on Admin approval; suspended/locked denied auth |
| approved_by | uuid | yes | | FK→users(id) — Admin who approved (FR-02) |
| approved_at | timestamptz | yes | | FR-02 |
| terms_accepted_at | timestamptz | yes | | FR-43 consent timestamp (required at register) |
| avatar_initials | text | no | | 1–2 chars |
| created_at | timestamptz | no | now() | |

Constraints/indexes: `UNIQUE(email)`; `CHECK (char_length(avatar_initials) BETWEEN 1 AND 2)`; `INDEX (role, status)`.

> The current `AdminUser` includes derived counts `listings`/`inquiries` — these become **aggregates**, not columns (OPEN whether to denormalize; see §8).

### 2.3 `landlord_profiles` (1:1 with a landlord user)
| Column | Type | Null | Notes |
|---|---|---|---|
| user_id | uuid | no | PK, FK→users(id) ON DELETE CASCADE |
| display_name | text | no | replaces embedded `landlord.displayName` |
| business_role | text | no | e.g. "Private landlord"/"Property manager" (R9 note: labels, not roles) |
| languages | text[] | no | default '{}' |
| response_time | text | no | display string |
| member_since | date | no | |
| contact_email | citext | yes | **private contact** (G4-gated) |
| contact_phone | text | yes | **private contact** (G4-gated) |

> **R9 clarification:** `business_role` is a free-text *self-description* ("Property manager", "Building operator") shown on listings. It is **not** an authorization role and must never be mapped to an RBAC role. No Agent/Broker/Property-Manager role is introduced.

### 2.4 `sessions`
| Column | Type | Null | Notes |
|---|---|---|---|
| id | uuid | no | PK |
| user_id | uuid | no | FK→users(id) ON DELETE CASCADE |
| token_hash | text | no | store hash of opaque token, never raw |
| created_at | timestamptz | no | |
| expires_at | timestamptz | no | |

Index: `INDEX (user_id)`, `INDEX (expires_at)`.

### 2.5 `neighborhoods` (reference)
| Column | Type | Null | Notes |
|---|---|---|---|
| id | text | no | PK — `an-thuong`/`my-an`/`son-tra`/`han-river` |
| name | text | no | |
| tagline | text | no | |
| description | text | no | |
| image_path | text | no | |
| lat | numeric(9,6) | no | |
| lng | numeric(9,6) | no | |

> The current `Neighborhood` type also has `lifestyle: string[]` — modeled as `text[]` column `lifestyle` (add: `lifestyle text[] NOT NULL DEFAULT '{}'`).

### 2.6 `amenities` (reference) + `listing_amenity` (M:N)
```sql
CREATE TABLE amenities (
  id    text PRIMARY KEY,       -- wifi, air-conditioning, ...
  label text NOT NULL
);
CREATE TABLE listing_amenity (
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  amenity_id text NOT NULL REFERENCES amenities(id) ON DELETE RESTRICT,
  PRIMARY KEY (listing_id, amenity_id)
);
CREATE INDEX ON listing_amenity (amenity_id);
```
> Replaces `Listing.amenities: AmenityId[]` (normalized, per approved decision).

### 2.7 `listings`
| Column | Type | Null | Default | Notes |
|---|---|---|---|---|
| id | uuid | no | gen_random_uuid() | PK |
| slug | text | no | | UNIQUE |
| landlord_id | uuid | no | | FK→users(id) ON DELETE RESTRICT — **ownership anchor** |
| neighborhood_id | text | no | | FK→neighborhoods(id) |
| title | text | no | | |
| summary | text | no | | |
| description | text | no | | |
| type | listing_type | no | 'apartment' | |
| monthly_rent | numeric(12,2) | no | | CHECK ≥ 0 |
| bedrooms | int | no | | CHECK ≥ 1 |
| bathrooms | int | no | | CHECK ≥ 1 |
| floor_area | numeric(8,2) | no | | CHECK ≥ 0 |
| floor_level | text | no | | display string |
| furnishing | furnishing_status | no | | |
| availability | availability_status | no | 'available' | |
| available_from | date | no | | |
| min_months | int | no | | CHECK ≥ 1 (from `rentalDurationMonths[0]`) |
| max_months | int | no | | CHECK ≥ min_months (`rentalDurationMonths[1]`) |
| lat | numeric(9,6) | no | | from `location.lat` |
| lng | numeric(9,6) | no | | from `location.lng` |
| address | text | no | | |
| status | listing_status | no | 'draft' | drives public visibility (FR-14) |
| verification_level | verification_level | no | 'unverified' | FR-21 (replaces boolean badge) |
| verified_at | date | yes | | FR-21 verification date |
| verified_scope | text | yes | | FR-22 published verified scope |
| last_availability_confirmed_at | date | no | | drives availability_status() |
| availability_reminder_sent_at | timestamptz | yes | | drives overdue/hide (FR-23/47) |
| listed_at | timestamptz | no | now() | |
| is_sample | boolean | no | false | demo/seed flag |
| created_at | timestamptz | no | now() | |
| updated_at | timestamptz | no | now() | |

> `views` and `inquiries` counters exist on today's `Listing`. They are **derived** (from analytics/existing inquiries) — whether to keep denormalized counters is **OPEN** (§8). `featured`/`sponsored` booleans move to `listing_promotion` (auditable, §2.13), but the public query still needs them — see §5 note on a partial index / view. `verification_level` replaces `verification_badge`; `basic_verified` is only settable after an approved `evidence_review` (Stage 2→3, §6).

### 2.8 `listing_image`
| Column | Type | Null | Notes |
|---|---|---|---|
| id | uuid | no | PK |
| listing_id | uuid | no | FK→listings(id) ON DELETE CASCADE |
| url | text | no | |
| position | int | no | 0 = cover (`images[0]`) |

Constraints/index: `UNIQUE (listing_id, position)`; `INDEX (listing_id)`.

### 2.9 `listing_cost` (recurring, one-time, refundable deposit, missing)
| Column | Type | Null | Notes |
|---|---|---|---|
| id | uuid | no | PK |
| listing_id | uuid | no | FK→listings(id) ON DELETE CASCADE |
| code | text | yes | stable key e.g. `electricity`,`water` |
| label | text | no | |
| amount | numeric(12,2) | **yes** | **NULL = amount not provided (missing)** |
| unit | text | no | e.g. "per month, estimated" |
| state | cost_state | no | `fixed`/`variable`/`reported`/`unknown` |
| cadence | cost_cadence | no | `monthly`/`one-time` |
| refundable | boolean | no | true for refundable deposit |
| note | text | yes | |
| position | int | no | |

> Mapping: `RentalCosts.items[]` → rows. `RentalCosts.depositAmount`/`depositMonths` → one row `code='deposit'`, `cadence='one-time'`, `refundable=true`, `state='fixed'`. **Missing cost info** is preserved as `amount IS NULL AND state='unknown'` — never coerced to 0 (matches `formatCostAmount`/`summarizeCosts` semantics that treat missing ≠ zero).
> **Refundable deposit** is distinct from rent: `refundable = true`, excluded from monthly totals by `cadence/code`, consistent with `cost-breakdown` (deposit refundable and kept separate).

### 2.10 `rental_terms` (1:1)
| Column | Type | Null | Notes |
|---|---|---|---|
| listing_id | uuid | no | PK, FK→listings(id) ON DELETE CASCADE |
| payment_day_of_month | int | no | CHECK 1..28 |
| utilities_included | text[] | no | default '{}' |
| notes | text[] | no | default '{}' |
| neighborhood_notes | text[] | no | default '{}' |
| distance_to_beach | text | no | display string |

> `min_months`/`max_months` live on `listings` (also used in search filtering); duplicated here is avoided — `rental_terms` keeps only term-specific fields.

### 2.11 `verification_check` (Stage 3 building blocks)
| Column | Type | Null | Notes |
|---|---|---|---|
| id | uuid | no | PK |
| listing_id | uuid | no | FK→listings(id) ON DELETE CASCADE |
| kind | verification_kind | no | listing-info / landlord-identity / rental-authorization |
| status | verification_status | no | not-started / in-review / verified |
| last_updated | timestamptz | yes | |

`UNIQUE (listing_id, kind)`.

### 2.12 `moderation_auto` (Stage 1) & `moderation_review` (admin listing decision)
**`moderation_auto`** (1:1 with listing) — automated content moderation; sets status only, never Verified.
| Column | Type | Null | Notes |
|---|---|---|---|
| listing_id | uuid | no | PK, FK→listings(id) ON DELETE CASCADE |
| result | moderation_result | no | |
| checks | jsonb | no | array of `{id,label,result,detail}` |
| reasons | text[] | no | |
| duplicate_risk | boolean | no | |
| auto_reviewed_at | date | yes | |

**`moderation_review`** (0..N; replaces `ListingModeration.manualReview`) — Admin approve/reject/corrections/hide/restore.
| Column | Type | Null | Notes |
|---|---|---|---|
| id | uuid | no | PK |
| listing_id | uuid | no | FK→listings(id) ON DELETE CASCADE |
| reviewer_id | uuid | no | FK→users(id); must be role=admin (app-enforced) |
| decision | moderation_decision | no | |
| reason | text | no | |
| reviewed_at | timestamptz | no | |

`INDEX (listing_id, reviewed_at DESC)`.

### 2.13 `listing_promotion` (featured / sponsored)
| Column | Type | Null | Notes |
|---|---|---|---|
| id | uuid | no | PK |
| listing_id | uuid | no | FK→listings(id) ON DELETE CASCADE |
| kind | promotion_kind | no | featured / sponsored |
| actor_id | uuid | no | FK→users(id) — landlord self-promote or admin override |
| active | boolean | no | |
| created_at | timestamptz | no | |
| ended_at | timestamptz | yes | |

```sql
CREATE UNIQUE INDEX one_active_promotion_per_kind
  ON listing_promotion (listing_id, kind) WHERE active;
```
> Replaces `Listing.featured`/`Listing.sponsored` booleans; implements RBAC **G6 (resolved)**: landlords self-promote their own listings, Admins may override any, both audited. **P1 (resolved):** there is **no online payment or billing** in the current scope (BRD **OOS-03**); the featured **permission model is kept separate from payment**, and the pilot fee is stored only as config (`admin_settings.featured_fee_config`). **No payment table is modeled.**

### 2.14 `evidence_review` (Stage 2) + `evidence_document`
**`evidence_review`** — Admin review of identity & rental-right evidence (G11).
| Column | Type | Null | Notes |
|---|---|---|---|
| id | uuid | no | PK |
| listing_id | uuid | no | FK→listings(id) ON DELETE CASCADE |
| reviewer_id | uuid | no | FK→users(id); role=admin |
| decision | evidence_decision | no | approved / rejected / corrections-requested |
| reason | text | no | |
| reviewed_at | timestamptz | no | |

`INDEX (listing_id, reviewed_at DESC)`.

**`evidence_document`** — the files referenced by a review.
| Column | Type | Null | Notes |
|---|---|---|---|
| id | uuid | no | PK |
| listing_id | uuid | no | FK→listings(id) |
| evidence_review_id | uuid | yes | FK→evidence_review(id) ON DELETE SET NULL |
| kind | evidence_kind | no | identity / rental-authorization / listing-proof |
| storage_ref | text | no | object-store key (never public URL) |
| uploaded_at | timestamptz | no | |

> **Privacy:** `storage_ref` is an internal reference; retrieval is Admin-only (RBAC §3.6). Storing actual documents is **OPEN** (object storage choice). Evidence itself is never exposed by the public reader.

**Stage-3 grant rule (DB-level intent):** `listings.verification_level = 'basic_verified'` may only be set (with `verified_at`/`verified_scope`) when an `evidence_review` row with `decision='approved'` exists for that listing (FR-21/BRULE-05). Enforced by application logic + optionally a trigger (a trigger is recommended because a CHECK cannot reference other tables). See §6.

### 2.15 `inquiries` (inquiries and viewing requests)
| Column | Type | Null | Notes |
|---|---|---|---|
| id | uuid | no | PK |
| listing_id | uuid | no | FK→listings(id) ON DELETE CASCADE |
| **tenant_id** | uuid | **no** | FK→users(id) — **required (G3)**; renter only |
| type | inquiry_type | no | question / viewing-request |
| message | text | no | |
| move_in_date | date | yes | |
| duration_months | int | yes | |
| tenant_preferences | text[] | no | default '{}' |
| status | inquiry_status | no | 'new' — enum `new|replied|viewing_scheduled|rented|not_proceeding` (§5.4) |
| first_requested_at | timestamptz | yes | FR-32 response-time KPI (set at create) |
| first_responded_at | timestamptz | yes | FR-32 (set on first landlord reply) |
| scheduled_at | date | yes | viewing date |
| preferred_time | text | yes | viewing time |
| created_at | timestamptz | no | |
| updated_at | timestamptz | no | |

Constraints/indexes: `INDEX (listing_id)`, `INDEX (tenant_id)`, `INDEX (status)`; **contact-visibility helper** index `INDEX (tenant_id, listing_id)` (supports the G4 predicate). `CHECK (scheduled_at IS NULL OR type='viewing-request')`.

> **G3:** `tenant_id` is NOT NULL — guests cannot create inquiries; the API sets it from the session (RBAC §3.4/§7). `ViewingRequest` is not a separate table; it is `inquiries` where `type='viewing-request'`.
> **Status model (BRD FR-31, five states):** `new` (Mới tiếp nhận) → `replied` (Đã phản hồi) → `viewing_scheduled` (Đã hẹn xem) → `rented` (Đã thuê); `not_proceeding` (Không tiếp tục) is reachable from `new`/`replied`/`viewing_scheduled`. **BRULE-09:** bookings/changes only from `replied`/`viewing_scheduled`. Every transition writes `inquiry_status_history`. Legacy code mapping: `accepted → viewing_scheduled`, `declined → not_proceeding`.

### 2.15a `inquiry_status_history` (FR-31 change history)
| Column | Type | Null | Notes |
|---|---|---|---|
| id | uuid | no | PK |
| inquiry_id | uuid | no | FK→inquiries(id) ON DELETE CASCADE |
| from_status | inquiry_status | yes | NULL on creation |
| to_status | inquiry_status | no | |
| actor_id | uuid | no | FK→users(id) — who changed it (Landlord owner) |
| changed_at | timestamptz | no | now() |
| note | text | yes | optional reason |

`INDEX (inquiry_id, changed_at)`. Append-only; never updated or deleted (FR-31).

### 2.16 `saved_apartments`
| Column | Type | Null | Notes |
|---|---|---|---|
| id | uuid | no | PK |
| user_id | uuid | no | FK→users(id) ON DELETE CASCADE |
| listing_id | uuid | no | FK→listings(id) ON DELETE CASCADE |
| saved_at | timestamptz | no | |

`UNIQUE (user_id, listing_id)`; `INDEX (user_id)`.
> Fixes the current browser-global `livora.saved`; per-user isolation. Comparison (max 3) is client/derived from these rows — no comparison table needed.

### 2.17 `reports`
| Column | Type | Null | Notes |
|---|---|---|---|
| id | uuid | no | PK |
| listing_id | uuid | no | FK→listings(id) ON DELETE CASCADE |
| reporter_id | uuid | **no** | FK→users(id) — **required (FR-42)**: authenticated reporters only |
| reporter_name | text | no | |
| reporter_email | citext | no | |
| category | report_category | no | |
| message | text | no | |
| status | report_status | no | 'open' |
| resolved_by | uuid | yes | FK→users(id); admin |
| resolution_note | text | yes | |
| created_at | timestamptz | no | |
| updated_at | timestamptz | no | |

`INDEX (status)`, `INDEX (listing_id)`.
> Reporting requires an **authenticated** user (Renter/Landlord) — BRD FR-42. `reporter_id` is NOT NULL; guests are redirected to log in. Admin records the outcome and the reporter is notified.

### 2.18 `notifications`
| Column | Type | Null | Notes |
|---|---|---|---|
| id | uuid | no | PK |
| recipient_id | uuid | no | FK→users(id) ON DELETE CASCADE |
| inquiry_id | uuid | yes | FK→inquiries(id) ON DELETE CASCADE (nullable) |
| type | notification_type | no | |
| payload | jsonb | no | channel-agnostic body |
| read_at | timestamptz | yes | |
| created_at | timestamptz | no | |

`INDEX (recipient_id, read_at)`, `INDEX (inquiry_id)`.
> **OPEN:** delivery channels (email/SMS/push) and triggers are not implemented anywhere in code. This table stores the in‑app record only; transport is out of scope and flagged (§8).

### 2.19 `audit_log`
| Column | Type | Null | Notes |
|---|---|---|---|
| id | uuid | no | PK |
| actor_type | audit_actor_type | no | `admin`/`landlord`/`renter`/`system` (G7) |
| actor_id | uuid | yes | FK→users(id); real identity for interactive actions; **NULL iff `actor_type='system'`** |
| action | audit_action | no | |
| target_type | text | no | e.g. `listing`,`user`,`report`,`settings` |
| target_id | text | yes | id of target |
| target_label | text | no | human label (today's `target`) |
| reason | text | no | |
| old_values | jsonb | yes | FR-41 before-state (nullable on create) |
| new_values | jsonb | yes | FR-41 after-state |
| created_at | timestamptz | no | |

`INDEX (created_at DESC)`, `INDEX (action)`, `INDEX (target_type, target_id)`, `INDEX (actor_type, actor_id)`. **Append-only & immutable** (FR-41): no UPDATE/DELETE grant; enforced by RLS + trigger. Constraint: `CHECK ((actor_type = 'system') = (actor_id IS NULL))` — automated actions use a distinct **SYSTEM** actor and are **never** attributed to an Admin (G7).

### 2.20 `admin_settings` (singleton)
| Column | Type | Null | Notes |
|---|---|---|---|
| singleton | boolean | no | PK, `CHECK (singleton)` |
| availability_grace_days | int | no | CHECK 0..30; **configurable proposed default** (3 for BRULE-06, **pending Project-Owner confirmation**) |
| availability_reminder_days | int | no | CHECK 7..30; default 14 (FR-23) |
| featured_fee_config | jsonb | yes | P1 (RESOLVED): pilot fee hypothesis stored as config only; **no billing, no payment table** (OOS-03) |
| updated_at | timestamptz | no | |

### 2.21 `evidence_access_log` (FR-24 — every evidence open is audited)
| Column | Type | Null | Notes |
|---|---|---|---|
| id | uuid | no | PK |
| evidence_id | uuid | no | FK→evidence_document(id) ON DELETE CASCADE |
| actor_id | uuid | no | FK→users(id) RESTRICT — must be Admin |
| accessed_at | timestamptz | no | now() |

`INDEX (evidence_id, accessed_at)`, `INDEX (actor_id)`. Append-only.

> **No `delegation_scope` table:** the Agent/Property-Manager role is excluded from the current project scope (BRD scope deviation, RBAC §9a C1). This is the last entity; §2 ends here.

---

## 3. Relationship & cardinality summary

| From | To | Cardinality | FK / rule |
|---|---|---|---|
| users | landlord_profiles | 1 : 0..1 | `landlord_profiles.user_id` PK |
| users | listings | 1 : 0..N | `listings.landlord_id` (RESTRICT) |
| users | inquiries | 1 : 0..N | `inquiries.tenant_id` (required, renter) |
| users | saved_apartments | 1 : 0..N | `saved_apartments.user_id` |
| users | reports | 1 : 0..N | `reports.reporter_id` (required — FR-42) |
| users | notifications | 1 : 0..N | `notifications.recipient_id` |
| users | audit_log | 1 : 0..N | `audit_log.actor_id` (NULL iff `actor_type='system'`; G7) |
| inquiries | inquiry_status_history | 1 : 0..N | `inquiry_status_history.inquiry_id` (cascade) |
| neighborhoods | listings | 1 : 0..N | `listings.neighborhood_id` |
| listings | listing_image | 1 : 0..N | cascade |
| listings | listing_cost | 1 : 0..N | cascade |
| listings | rental_terms | 1 : 0..1 | PK listing_id |
| listings | verification_check | 1 : 0..3 | unique (listing, kind) |
| listings | moderation_auto | 1 : 0..1 | PK listing_id |
| listings | moderation_review | 1 : 0..N | history |
| listings | evidence_review | 1 : 0..N | history |
| evidence_review | evidence_document | 1 : 0..N | set null on delete |
| evidence_document | evidence_access_log | 1 : 0..N | cascade; every open audited (FR-24) |
| listings | inquiries | 1 : 0..N | cascade |
| listings | listing_promotion | 1 : 0..N | partial-unique active |
| listings | reports | 1 : 0..N | cascade |
| amenities | listings (via listing_amenity) | M : N | `listing_amenity(listing_id, amenity_id)` PK; both FKs RESTRICT on amenities, CASCADE on listings |

---

## 4. Ownership & access-control rules (RLS-ready)

These mirror `RBAC-SPEC.md` §4. Policies below are **proposals** (not applied). §4.6 covers **every** sensitive table, not just `listings`.

### 4.1 Multi-landlord isolation
- A landlord may read/write only listings where `listings.landlord_id = current_setting('app.user_id')::uuid`.
- Inquiry access is scoped through the listing: a landlord may touch an inquiry only if it belongs to a listing they own:
  ```sql
  -- landlord read/reply/accept/decline
  EXISTS (SELECT 1 FROM listings l
          WHERE l.id = inquiries.listing_id
            AND l.landlord_id = current_setting('app.user_id')::uuid)
  ```
- **This is the core isolation guarantee** (RBAC G8). The demo portal may still act as one landlord, but the schema enforces per-landlord scoping for all of them.

### 4.2 Renters
- Own profile, own `saved_apartments` (`user_id = uid`), own `inquiries` (`tenant_id = uid`).
- Must not read other renters' saved lists, inquiries, or private contact.

### 4.3 Admin
- Platform-wide on listings (status/verify), users (status), reports, promotions, audit, settings. Admin identity is the authenticated `users.role='admin'` session.

### 4.4 Contact-visibility rule (G4) — SQL predicate
Private landlord contact (`landlord_profiles.contact_email`, `contact_phone`) is returned to a Renter **only if** that Renter has a submitted inquiry on that specific listing:
```sql
-- Allows selecting contact_* for listing :lid to renter :uid
EXISTS (SELECT 1 FROM inquiries i
        WHERE i.tenant_id = :uid AND i.listing_id = :lid)
```
Implemented as a view/`SECURITY DEFINER` function that returns contact fields only under this predicate, or as an RLS policy on a `landlord_private_contact` projection. Guests and Renters without an inquiry get NULL/403. Backed by `INDEX (tenant_id, listing_id)` on `inquiries`.

### 4.5 Guests
- Public reads only: `visible` listings visible per §5; never private contact, saved lists, inquiries, or admin data. **Cannot create inquiries** — `inquiries` has no anonymous path (`tenant_id` NOT NULL, G3).

### 4.6 RLS coverage — all sensitive tables (proposal, not applied)

Every table that holds private data or ownership scope gets RLS. Session context (illustrative): `app.role` ∈ `guest|renter|landlord|admin`, `app.user_id` = `uuid` of the authenticated user. `current_user` is the DB role, not the app role.

| Table | Enabled | Read policy | Write policy |
|---|---|---|---|
| `users` | yes | self, or admin | self (profile), or admin (status/role) |
| `landlord_profiles` | yes | self, admin, and renters only via the G4 contact projection | self, admin |
| `sessions` | yes | self, admin | self (create/delete own), system |
| `listings` | yes | owner, admin, or `status='visible'` for guest/renter | owner (own rows), admin; **never** cross-landlord |
| `listing_image` / `listing_cost` / `rental_terms` / `listing_amenity` | yes | inherited via parent listing visibility | owner (own listing), admin |
| `verification_check` / `moderation_auto` / `moderation_review` / `evidence_review` / `evidence_document` | yes | owner sees own listing's status **only**; evidence docs admin-only | admin only (Stage 2/3); landlord may view own, not mutate |
| `inquiries` | yes | `tenant_id = uid` (renter), or landlord where `EXISTS listing owned by uid`, or admin | renter: create own, no edit of others; landlord: reply/accept/decline own-listing inquiries; admin: all |
| `saved_apartments` | yes | `user_id = uid`, admin | `user_id = uid` only |
| `reports` | yes | reporter sees own; admin all | reporter: create/own; admin: resolve/reopen; **reporter PII never public** |
| `listing_promotion` | yes | public can see `active = true` (for ranking/featured); actors + admin see all | landlord (own listing), admin (any); audited |
| `notifications` | yes | `recipient_id = uid` | system/recipient (mark read) |
| `audit_log` | yes | admin only | append-only; written by system (`actor_type='system'`, G7) or admin (no update/delete) |
| `admin_settings` | yes | all (read-only thresholds) | admin only |

Illustrative policy sketches (placeholders; real backend sets session GUCs):

```sql
-- Example: users
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
CREATE POLICY users_self_or_admin ON users
  USING (
    current_setting('app.role') = 'admin'
    OR id = current_setting('app.user_id')::uuid
  );

-- Example: landlords may only touch their own listings (Landlord A ≠ Landlord B)
ALTER TABLE listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY listings_owner_admin_or_public ON listings
  USING (
    current_setting('app.role') = 'admin'
    OR (current_setting('app.role') = 'landlord'
        AND landlord_id = current_setting('app.user_id')::uuid)
    OR (current_setting('app.role') IN ('guest','renter') AND status = 'visible')
  )
  WITH CHECK (
    current_setting('app.role') = 'admin'
    OR (current_setting('app.role') = 'landlord'
        AND landlord_id = current_setting('app.user_id')::uuid)
  );   -- writes: owner/admin only (no public insert)

-- Example: inquiries scoped through the owning listing
ALTER TABLE inquiries ENABLE ROW LEVEL SECURITY;
CREATE POLICY inquiries_scope ON inquiries
  USING (
    current_setting('app.role') = 'admin'
    OR (current_setting('app.role') = 'renter'
        AND tenant_id = current_setting('app.user_id')::uuid)
    OR (current_setting('app.role') = 'landlord'
        AND EXISTS (SELECT 1 FROM listings l
                    WHERE l.id = inquiries.listing_id
                      AND l.landlord_id = current_setting('app.user_id')::uuid))
  )
  WITH CHECK (
    current_setting('app.role') = 'admin'
    OR (current_setting('app.role') = 'renter'
        AND tenant_id = current_setting('app.user_id')::uuid)   -- create own only
    OR (current_setting('app.role') = 'landlord'
        AND EXISTS (SELECT 1 FROM listings l
                    WHERE l.id = inquiries.listing_id
                      AND l.landlord_id = current_setting('app.user_id')::uuid))
  );

-- Example: saved & reports are strictly per-user / per-reporter
ALTER TABLE saved_apartments ENABLE ROW LEVEL SECURITY;
CREATE POLICY saved_own ON saved_apartments
  USING (user_id = current_setting('app.user_id')::uuid
         OR current_setting('app.role') = 'admin')
  WITH CHECK (user_id = current_setting('app.user_id')::uuid);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY reports_own_or_admin ON reports
  USING (reporter_id = current_setting('app.user_id')::uuid
         OR current_setting('app.role') = 'admin');

-- Example: promotions — landlord own, admin any (G6), public sees active only
ALTER TABLE listing_promotion ENABLE ROW LEVEL SECURITY;
CREATE POLICY promotions_visibility ON listing_promotion
  USING (
    active
    OR current_setting('app.role') = 'admin'
    OR (current_setting('app.role') = 'landlord'
        AND EXISTS (SELECT 1 FROM listings l
                    WHERE l.id = listing_promotion.listing_id
                      AND l.landlord_id = current_setting('app.user_id')::uuid))
  )
  WITH CHECK (
    current_setting('app.role') = 'admin'
    OR (current_setting('app.role') = 'landlord'
        AND EXISTS (SELECT 1 FROM listings l
                    WHERE l.id = listing_promotion.listing_id
                      AND l.landlord_id = current_setting('app.user_id')::uuid))
  );

-- Example: audit log — admin read; append-only
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY audit_admin_read ON audit_log
  FOR SELECT USING (current_setting('app.role') = 'admin');

-- Example: evidence documents — admin only, never public/renter/landlord
ALTER TABLE evidence_document ENABLE ROW LEVEL SECURITY;
CREATE POLICY evidence_admin_only ON evidence_document
  USING (current_setting('app.role') = 'admin');
```

> **Landlord A vs Landlord B (focus item 5):** every policy that mentions a landlord resolves ownership via `EXISTS (SELECT 1 FROM listings … landlord_id = app.user_id)` or a direct `landlord_id` match, **never** by trusting a client-supplied id. A landlord can therefore neither read nor write another landlord's `listings`, child rows, `inquiries`, or `listing_promotion` even through direct SQL/API, because the row filter fails. Enforced for **all** tables above, not only `listings`.

> **Bypass note:** RLS applies to the connection's non-owner role. Backend jobs/system tasks that must cross tenants use a dedicated privileged role with `BYPASSRLS`; application request handlers must **not**.

---

## 5. Constraints, indexes & lifecycle

### 5.1 Notable constraints
- `users.email` UNIQUE (citext, case-insensitive login).
- `users.role` enum has `renter|landlord|admin` — the Agent/Broker/Property Manager role is **excluded from the current project scope** as an explicit BRD scope deviation (**C1**, RBAC §9a); no `delegation_scope` table. `landlord_profiles.business_role` is a free-text *label*, never an auth role.
- Admin rows are provisioned **only** via a secure internal process (G2); public registration allows `renter`/`landlord` only.
- `users.status='pending'` until an Admin approves landlords (FR-02); `pending`/`suspended` cannot authenticate.
- `listings.slug` UNIQUE.
- `listings.min_months >= 1`, `max_months >= min_months`.
- `listing_cost`: `amount IS NULL` implies `state='unknown'` (missing info) — application-checked (`CHECK (amount IS NOT NULL OR state = 'unknown')`).
- `inquiries.tenant_id NOT NULL` (G3).
- `saved_apartments UNIQUE(user_id, listing_id)`.
- `listing_promotion` partial unique index (one active per kind).
- `moderation_review.reviewer_id` and `evidence_review.reviewer_id` must reference a `users.role='admin'` (app-enforced; optional trigger).
- `audit_log`: `CHECK ((actor_type = 'system') = (actor_id IS NULL))` — automated actions use the distinct SYSTEM actor and are never attributed to an Admin (G7); append-only/immutable (FR-41).
- `availability-reconfirmed` audit rows: Admin-assisted reconfirmation records `actor_type='admin'`; Landlord self-reconfirmation records `actor_type='landlord'` (G10, kept separate).

### 5.1a Foreign keys, delete behavior & enum consistency
| FK / field | ON DELETE | Rationale / consistency |
|---|---|---|
| `listings.landlord_id → users` | **RESTRICT** | Never orphan or silently drop a landlord's listings; deactivate (`status=suspended`) instead. Mirrors RBAC (no soft-delete of rental history). |
| `inquiries.listing_id → listings` | CASCADE | Inquiries vanish with the listing they belong to (demo parity: `allInquiries` merges by listing). |
| `inquiries.tenant_id → users` | RESTRICT | The renter must remain identifiable; suspend, don't delete. |
| `saved_apartments.* ` | CASCADE | Pure preference rows. |
| `listing_image/listing_cost/rental_terms/listing_amenity.… → listings` | CASCADE | Child data. |
| `verification_check/moderation_auto/moderation_review/evidence_review → listings` | CASCADE | Stage data tied to a listing. |
| `evidence_document.evidence_review_id → evidence_review` | SET NULL | Keep the uploaded-evidence audit trail even if a review row is superseded; `listing_id` retained. |
| `reports.listing_id → listings` | CASCADE | Reports point at a listing; parity with current mock (reports reference existing listings). |
| `reports.resolved_by → users` | SET NULL | Preserve the report if an admin account is removed. |
| `audit_log.actor_id → users` | SET NULL | Audit must survive actor deletion; `actor_type` retains `system` vs interactive origin; keep `target_label`/`reason`. |
| `listing_promotion.requested_by/activated_by → users` | RESTRICT | A promotion always has accountable actors (requester + Admin activator; FR-35). |
| `notifications.recipient_id → users` | CASCADE | User-scoped feed. |
| `notifications.inquiry_id → inquiries` | CASCADE | Notification about a deleted inquiry is meaningless. |
| `verification_level` vs `evidence_review.decision` | — | Enum consistency: `basic_verified` requires an `approved` evidence review (§6 trigger). Enum `moderation_result` and `moderation_decision` are **distinct** types (auto result ≠ manual decision) — do not merge. |
| `inquiry_status_history.inquiry_id → inquiries` | CASCADE | History dies with its inquiry. `actor_id → users` RESTRICT (keep actor). Append-only. |
| `inquiry_type`/`inquiry_status` | — | `viewing-request` is a `type` value; five-state `inquiry_status` per FR-31. `scheduled_at`/`preferred_time` only meaningful when `type='viewing-request'` (`CHECK`). |

> **Cross-check with current code:** `Listing` is never hard-deleted (lifecycle via `status`); `mockInquiriesRepository.update` patches rather than deletes; saved ids are ephemeral. The FK choices above preserve those behaviours while adding referential safety.

### 5.2 Index catalog (beyond PK/unique/FK)
| Purpose | Index |
|---|---|
| Public search visibility | `listings (status, availability, listed_at DESC)` |
| Neighborhood filter | `listings (neighborhood_id)` |
| Rent range sort | `listings (monthly_rent)` |
| Landlord scope | `listings (landlord_id)` |
| Featured ranking | `listing_promotion (kind) WHERE active` + join |
| Verified filter | partial `listings (id) WHERE verification_level = 'basic_verified'` |
| Full-text search | GIN on `to_tsvector('simple', title||' '||summary)` (OPEN: which config/language) |
| Availability overdue scan | `listings (last_availability_confirmed_at)` |
| Inquiries per landlord | `inquiries (listing_id)`, `inquiries (tenant_id, listing_id)`, `inquiries (status)` |
| Saved per renter | `saved_apartments (user_id)` |
| Notifications feed | `notifications (recipient_id, read_at)` |
| Audit browsing | `audit_log (created_at DESC)`, `audit_log (action)` |

### 5.3 Availability rules → columns
`availabilityStatus()` (`src/lib/availability.ts`) computes from `last_availability_confirmed_at` + settings:
- `fresh` → ≤ reminderDays−7
- `reminder` → reminderDays−7 .. reminderDays
- `overdue` → > reminderDays
- `hidden` → > reminderDays + graceDays (drops out of public search)
Public visibility = `status='visible' AND (today − last_availability_confirmed_at) ≤ reminder+grace`. This is a computed predicate; represented by the public-visibility policy/`availabilityStatus` function selecting narrow columns. `availability_reminder_sent_at` records the last reminder sent (transport = OPEN).

### 5.4 Inquiry / viewing lifecycle (state machine — BRD FR-31 / BRULE-09)
Five states: `new` (Mới tiếp nhận), `replied` (Đã phản hồi), `viewing_scheduled` (Đã hẹn xem), `rented` (Đã thuê), `not_proceeding` (Không tiếp tục). Server sets `status='new'` on create (matches `mockInquiriesRepository.create` forcing `new`). No role may skip states (RBAC §5.4). **BRULE-09:** a viewing can be booked/changed only from `replied`/`viewing_scheduled`; `rented`/`not_proceeding` cannot book.

```text
                 ┌── reply ─────────► replied ─────────────► rented
   create ──► new ┤                      │  │                  ▲
                 ├── schedule ──────► viewing_scheduled ───────┘
                 └── not_proceeding ◄─── (from new/replied/viewing_scheduled)
```

> Every transition appends to `inquiry_status_history` (from, to, actor, time, note — FR-31). First-request/response timestamps (`first_requested_at`, `first_responded_at`) support FR-32 KPIs. Legacy code mapping: `accepted → viewing_scheduled`, `declined → not_proceeding`. `rented` is a new post-viewing outcome (not the listing's `availability`/`status`, which is separate).

### 5.5 Cost semantics (recurring vs one-time vs deposit vs missing)
- Recurring = `cadence='monthly'` rows; split into "confirmed" (`state IN (fixed)` with amount) and "estimated" (`state IN (reported,variable)`) — matches `summarizeCosts`.
- One-time = `cadence='one-time'` rows.
- Refundable deposit = dedicated row `refundable=true` (separate from monthly totals).
- Missing = `amount IS NULL, state='unknown'`; excluded from totals, never treated as zero (`formatCostAmount`/`cost-breakdown`).

---

## 6. Separation of moderation, evidence review, and Verified status (G11)

Three **distinct** stages, each a separate table/path so the ceiling "automated moderation never grants Verified" is structural:

| Stage | Entity | Who | What it does | Can it set the verification level? |
|---|---|---|---|---|
| **1. Automated content moderation** | `moderation_auto` | system | Sets `listings.status` ∈ {draft, pending_review, visible, needs_correction, rejected, temp_hidden, rented} via `statusForModeration`; records checks/reasons/duplicate risk | **Never** |
| **2a. Admin listing decision** | `moderation_review` | admin | approve/reject/corrections/hide/restore; records reason + reviewer | No (status only) |
| **2b. Admin evidence review** | `evidence_review` + `evidence_document` (+ `evidence_access_log`) | admin | Reviews identity + rental-right evidence; `decision ∈ {approved, rejected, corrections-requested}`; each access audited (FR-24) | No (it is a prerequisite) |
| **3. Verification level** | `listings.verification_level` + `verified_at`/`verified_scope` + `verification_check` | admin | Sets `basic_verified` (+ date + published scope) only after an **approved** `evidence_review` exists | **Yes, only after 2b approved** |

**DB enforcement intent:** a trigger on `listings` (or the `verification_level` write path) rejects setting `verification_level = 'basic_verified'` unless `EXISTS (SELECT 1 FROM evidence_review er WHERE er.listing_id = listings.id AND er.decision = 'approved')` (and requires `verified_at`). This replaces the current `setVerification()` behaviour (`src/api/admin.ts:94-112`) that force-marks all checks verified — under the new model, verification checks reflect reviewed evidence and the level is inseparable from an approved `evidence_review`. Automated rows can never satisfy this because Stage 1 has no `evidence_review`.

> This directly implements resolved decision **G11** (BRD FR-21/22/24, BRULE-05): automated content moderation ≠ evidence review ≠ verification level.

---

## 7. Mapping from current structures to the database

### 7.1 TypeScript types → tables
| TS type (`src/types/index.ts`) | Target | Notes |
|---|---|---|
| `User` | `users` | add `password_hash`; role enum gains `admin` |
| `Session` | `sessions` (+`users`) | `isDemo` dropped in production |
| `AdminUser` | `users` | `listings`/`inquiries` counts → aggregates (OPEN) |
| `LandlordSummary` | `landlord_profiles` | `role`→`business_role` (label, not auth role); add private `contact_email/phone` |
| `Listing` | `listings` + children | see below |
| `Listing.amenities[]` | `listing_amenity` (M:N) | normalized |
| `Listing.images[]` | `listing_image` (position) | `[0]` = cover |
| `Listing.location{}` | `listings.lat/lng` | |
| `Listing.costs{RentalCosts}` | `listing_cost` rows + deposit row | `depositAmount`/`depositMonths`→refundable deposit row |
| `Listing.rentalTerms` | `rental_terms` (+`listings.min/max_months`) | |
| `Listing.verification` | `verification_check` (+`listings.last_availability_confirmed_at`) | |
| `Listing.verificationBadge` | `listings.verification_level` + `verified_at`/`verified_scope` | Stage 3 (boolean → level) |
| `Listing.moderation{ListingModeration}` | `moderation_auto` + `moderation_review` | auto result vs manual review split |
| `Listing.featured/sponsored` | `listing_promotion` | auditable, active flag + start/end dates (FR-35) |
| `Listing.neighborhoodNotes/distanceToBeach` | `rental_terms` | |
| `Listing.rentalDurationMonths[min,max]` | `listings.min_months/max_months` | |
| `Listing.views/inquiries` | — | derived; columns OPEN (§8) |
| `Inquiry` / `ViewingRequest` | `inquiries` | `tenantName/Email` → `users` via `tenant_id`; keep contact snapshot? see OPEN |
| `SavedApartment` | `saved_apartments` | add `user_id` (was browser-global) |
| `Report` | `reports` | `reporter_id` **required** (FR-42) |
| `AuditLogEntry` | `audit_log` | `actor` → `actor_id`; add `old_values`/`new_values` (FR-41); keep `target_label` |
| `AdminSettings` | `admin_settings` | singleton |
| `ListingDraft` | (form only) | not persisted as a table; converted to `listings` |
| `ListingModerationOverride` | — | collapses to `moderation_review` |

### 7.2 localStorage keys → tables
(see §0.3 table.) Key notes:
- `livora.saved` is a global string array → becomes per-user `saved_apartments`; migration must assign rows to the migrating user.
- `livora.session.user.role` is `tenant|landlord` → maps `tenant→renter`; **admin sessions do not exist yet** (the admin gate is a client flag, not a user).

### 7.3 Seed data volume (for migration/testing)
- **Listings:** 30 public core+extension (`src/data/listings.ts`) + 4 admin samples (`src/data/admin.ts`) = 34 rows.
- **Landlords:** 3 (`ld-an`, `ld-linh`, `ld-minh` → `users` + `landlord_profiles`).
- **Inquiries:** 6 samples (`src/data/landlord.ts`).
- **Users (admin sample):** 8 (`ADMIN_SAMPLE_USERS`).
- **Reports:** 3; **Audit:** 4; **Settings:** 1 singleton; **Neighborhoods:** 4; **Amenities:** 12.
- Inquiries in samples lack a `tenant_id`; migration must match by `tenant_email` to a `users` row (or create renter users) — see §9 G3-migration note.

---

## 8. Decision reconciliation & remaining open items

### 8.1 Decisions already confirmed (do not reopen)

These were explicitly confirmed earlier in the project. They are **resolved** and the schema implements them; they are no longer listed as open.

| ID | Confirmed decision | How the schema implements it |
|---|---|---|
| **G3** | Guests cannot submit inquiries/viewing requests; must be a Renter. Guests may browse/search public listings. | `inquiries.tenant_id` **NOT NULL**; no anonymous inquiry path (§2.15, §4.5). |
| **G4** | Landlord private contact revealed to a Renter **only after** their inquiry on that listing is submitted (BRD BRULE-11). | `EXISTS(inquiry WHERE tenant_id=:uid AND listing_id=:lid)` predicate + RLS projection (§4.4). |
| **G6** | **Featured (BRD FR-35):** landlord **requests**; **Admin activates** with manual start/end dates; sponsored label + metrics (FR-36/37). | `listing_promotion` with `requested_by`/`activated_by` + `start_date`/`end_date` + RLS + audit (§2.13, §4.6). |
| **G8** | **True multi-landlord isolation** — Landlord A must never access Landlord B's listings or inquiries. | Ownership-anchored RLS on `listings` and scoped-subquery RLS on `inquiries` (§4.1). |
| **G9** | **Role naming:** Guest / Renter / Landlord / Admin; existing "tenant" = Renter. | `user_role` enum `('renter','landlord','admin')`; `tenant_id` column maps to Renter (§2.1, §2.15). |
| **G11** | Three separate stages; automated moderation never verifies; two levels `unverified`/`basic_verified` + date + scope (FR-21/22/24, BRULE-05); evidence Admin-only + audited. | `moderation_auto` / `moderation_review` / `evidence_review` / `evidence_document` / `verification_level` separated; evidence-access audit; DB trigger §6. |
| **New (BRD)** | **Inquiry lifecycle 5 states** (FR-31/BRULE-09) with `inquiry_status_history`; **account approval/consent** (FR-02/43); **reports authenticated-only** (FR-42); **audit immutable with old/new** (FR-41); **overdue → temp_hidden** (FR-23/47). | See §2.1, §2.2, §2.15, §2.15a, §5.4. |
| **G2** | **`admin` role provisioning** — RESOLVED: Admin rows are created **only** through a secure internal process; public registration never self-assigns Admin. | `user_role` includes `admin`; registration path restricted to `renter`/`landlord`; `users.approved_by/approved_at` record approval (§2.1, §2.2). |
| **G7** | **Audit actor (SYSTEM)** — RESOLVED: automated actions use a distinct **SYSTEM** actor, never an Admin. | `audit_log.actor_type` (`admin/landlord/renter/system`) + `actor_id` NULL iff `system` (CHECK) + `old_values`/`new_values` (§2.19). |
| **G10** | **Admin reconfirm-availability** — RESOLVED: Admin may reconfirm any listing only with an explicit audit event identifying the Admin actor; kept separate from Landlord self-reconfirm. | `audit_log` row with `action='availability-reconfirmed'` and `actor_type='admin'`; landlord path uses `actor_type='landlord'`. |
| **P1** | **Featured payment** — RESOLVED: **no online payment/billing** (BRD OOS-03); featured permission model kept **separate** from payment. | `listing_promotion` records the action only; fee stored in `admin_settings.featured_fee_config`; **no payment table**. |

> **G6 vs payment (resolved):** the featured **permission model** is Admin-activated (BRD FR-35). **P1** is now resolved: there is **no payment/billing** in the current scope (BRD OOS-03), and the permission model stays separate from any payment concern (see G6/P1 rows and §2.13).

### 8.2 Still unresolved (require approval)

| ID | Item | Why open | Impact on schema |
|---|---|---|---|
| **D1** | **Notification delivery** | No engine; BRD FR-34 wants in-app **+ email** | In-app `notifications` modeled; email/SMS/push transport **OPEN** |
| **D2** | **`views`/`inquiries` counters** | Denormalized numbers exist in mock | Keep as aggregates (recommended) or add `listing_stats` — **OPEN** (FR-37 wants metrics) |
| **D4** | **Full-text search config** | Not specified | Choose language/config (simple vs english) — **OPEN** |
| **D5** | **Evidence storage backend** | `evidence_document.storage_ref` abstract | Object-store choice + PII retention — **OPEN** |
| **D6** | **Inquiry contact snapshot** | Inquiry stores `tenant_name/tenant_email` denormalized | Snapshot vs join — **OPEN** (recommend snapshot + `tenant_id`) |
| **D7** | **Renter profile fields** | `User` has only name/email | Add renter profile (phone, prefs)? — **OPEN** |

**Pre-production review items (not blockers; confirm before production):**

| ID | Item | Status |
|---|---|---|
| **BRULE-06** | 3-day grace (hide after reminder) — `admin_settings.availability_grace_days` | **Configurable proposed default**, pending Project-Owner confirmation |
| **BRULE-13** | Legal guidance / compliance | **Pre-production legal/content review** |

> **Removed from OPEN this revision:** **C1** (Agent role — recorded as a BRD scope deviation, not open), **G2** (internal provisioning — resolved), **G7** (SYSTEM actor — resolved), **G10** (admin reconfirm audited + separated — resolved), **P1** (no billing, OOS-03 — resolved), plus the earlier **A1** (five states now implemented, FR-31) and the nullable-reporter item (closed by FR-42). **BRULE-06** and **BRULE-13** are now pre-production review items (above), not schema opens.

---

## 9. Suggested migration & implementation sequence

Dependency-ordered; each phase is independently deployable and reversible. **No scripts are written here — this is the plan only.**

1. **Reference & enums** — create types (§2.1), `neighborhoods`, `amenities`. Seed 4 neighborhoods + 12 amenities from `src/data/constants.ts`. *Safe to roll back (no dependents).*
2. **Identity** — `users`, `landlord_profiles`, `sessions`. Seed 3 landlords + 8 sample users (map `tenant→renter`). Introduce real password hashing. *Rollback: drop sessions/profiles/users.*
3. **Listings core** — `listings` (+ `listing_image`, `listing_amenity`, `listing_cost`, `rental_terms`). Migrate 30 public + 4 admin-sample listings; split arrays/embedded objects per §7. *Rollback: drop listings tree.*
4. **Availability & moderation (Stage 1)** — `moderation_auto`, availability columns + `admin_settings`. Run `runModeration` results into `moderation_auto`; seed settings. *Rollback: drop moderation_auto.*
5. **Verification & evidence (Stages 2–3)** — `verification_check`, `moderation_review`, `evidence_review`, `evidence_document`, `evidence_access_log`, verification-level rule (§6). Backfill checks to `not-started`; `verification_level='basic_verified'` only where an approved evidence record is created. *Rollback: drop evidence tables (levels reset to `unverified`).*
6. **Inquiries** — `inquiries` with required `tenant_id` + `inquiry_status_history`. Migrate 6 samples by matching `tenant_email`→`users` (create renters where absent). Enforce `new` default; seed an initial history row per inquiry. *Rollback: drop inquiries + history.*
7. **Saved, promotions, reports** — `saved_apartments`, `listing_promotion`, `reports`. Assign saved rows to migrating users; convert `featured/sponsored` booleans to active promotions (actor = landlord). No billing/payment tables (P1/OOS-03). *Rollback per table.*
8. **Notifications & audit** — `notifications`, `audit_log` (with `actor_type`). Backfill audit from `ADMIN_SAMPLE_AUDIT`: map `actor` strings→`actor_id` with `actor_type='admin'` where resolvable; automated/system-originated seed rows use `actor_type='system'` + `actor_id NULL` (never attributed to Admin, G7). *Rollback per table.*
9. **Indexes & constraints** — apply §5 indexes; add triggers for the verification-level rule, reviewer-role checks, and the audit `actor_type='system' ⇔ actor_id IS NULL` CHECK. *Additive; rollback drops indexes/triggers.*
10. **RLS enablement** — apply §4 policies once the backend sets session role/user identity. *Rollback: disable RLS.*
11. **Switch repositories** — point `listing/inquiry/session/admin` repositories at the DB (replacing `livora.*`/`danest.admin.*` localStorage), preserving current product behaviour and demo data. **Out of scope for this document.**

---

## 10. Summary

- **Inspected (and reconciled against):** TypeScript types, public + admin repositories, availability + moderation logic, mock listings/inquiries/admin data, inquiry-creation UI, `RBAC-SPEC.md`, and the authoritative **BRD** (`public/BRD-NHÓM-27.docx.pdf`) — roles, FR-01/02/05/09/21/22/23/24/31/32/35/36/37/41/42/43/47, BRULE-05/06/07/09/11/13, OOS-03.
- **Created:** this `DATABASE-DESIGN.md` — PostgreSQL 16 ERD, data dictionary, ownership/RLS coverage for all sensitive tables, constraints/indexes, moderation/evidence/verification separation, data-mapping, migration sequence, and decision reconciliation.
- **Resolved & preserved (do not reopen):** G3 (required `tenant_id`, guests blocked), G4 (contact-visibility predicate, BRULE-11), G6 (featured: landlord request + Admin activation with dates, FR-35), G8 (true multi-landlord isolation), G9 (Guest/Renter/Landlord/Admin; tenant=Renter), G11 (three-stage moderation/evidence/verification; two levels + date + scope; evidence audited), **G2** (internal Admin provisioning), **G7** (distinct SYSTEM audit actor), **G10** (Admin reconfirm audited + separated), **P1** (no billing, OOS-03). **C1** recorded as a **BRD scope deviation** (Agent role excluded).
- **Reconciled to BRD (this revision):** inquiry lifecycle is now the **5-state** model `new/replied/viewing_scheduled/rented/not_proceeding` with `inquiry_status_history` (FR-31/BRULE-09); `verification_level` replaces the boolean badge (FR-21/22); account `pending/active/rejected/suspended` + consent timestamp (FR-02/43); listing status set aligned to BRD lifecycle (FR-09/14); reports authenticated-only (FR-42); audit immutable with old/new + SYSTEM actor (FR-41/G7); featured Admin-activated with start/end dates, no billing (FR-35/P1/OOS-03).
- **Not done:** no source, UI, mock data, or migration files were changed.
- **Remaining unresolved (DB-side):** D1 (notification delivery/email transport), D2 (view/inquiry counters), D4 (FTS config), D5 (evidence storage backend), D6 (inquiry contact snapshot), D7 (renter profile fields).
- **Pre-production review (not blockers):** BRULE-06 3-day grace = configurable proposed default pending owner confirmation; BRULE-13 legal = pre-production legal review.

---

## 11. Implementation on the Paletto Backend Hub (Appwrite 1.8)

The schema in §2 is implemented on the connected Backend Hub database `main`
(database id `6b00758d0034deb844ef`), as code in `db/baas/`. This section records
how the PostgreSQL design maps onto Appwrite and what is enforced where.

### 11.1 Structure

- 23 collections, 174+ scalar attributes, 47 indexes, 10 logical relationships
  (20 two-way attributes), one private `evidence` storage bucket.
- Created and kept in sync by `db/baas/schema.mjs` from `db/baas/schema.data.mjs`.
- Type mapping: `uuid`→`string(64)`, `citext`→`email`, `numeric`→`double`,
  `timestamptz`→`datetime`, `date`→`string(10)`, `text[]`/`jsonb`→`string(65535)`
  (JSON text), `CREATE TYPE`→`string enum`.
- Primary keys are Appwrite document ids (string). The seed uses **deterministic
  ids** derived from source ids (documented in `db/baas/README.md`).

### 11.2 What the Backend Hub cannot express (moved to the backend function)

`db/baas/functions/README.md` is the enforcement contract. Not available at the
database layer: Row-Level Security, `CHECK` constraints, triggers, native
`UNIQUE`/partial/GIN indexes, `ON DELETE RESTRICT`, and reliable filtered
queries. Consequences:

- **Landlord isolation, guest-cannot-inquire, G4 contact projection,
  verify-only-after-approved-evidence, Admin provisioning and audit
  immutability are NOT enforced by the database.** They require the backend
  function. Do not treat them as done until that function exists and its tests
  pass.
- Unique-ish invariants are enforced by Appwrite `unique` indexes where they
  exist and by the function otherwise.

### 11.3 Relationship delete behavior (repaired)

Destructive cascades were removed: `listings → inquiries`, `listings → reports`
and `listings → evidence_review` now use `setNull`, so deleting a listing cannot
silently destroy inquiry, report or evidence history. Pure child data
(images/amenities/costs) stays `cascade`; `evidence_review → evidence_document`
stays `setNull`. `ON DELETE RESTRICT` is unavailable — the function must refuse
deletion where retention is mandatory.

### 11.4 Seed data

`db/baas/seed.mjs` reproduces the original demo (34 listings, 6 inquiries, 10
user profiles, 3 landlords, 4 neighbourhoods, 12 amenities, 3 reports, 4 audit
rows, plus images/amenity links/costs/terms/moderation/verification/evidence/
promotions/history). It is idempotent and verified by `db/baas/tests/run.mjs`.
No payment/billing is modelled (P1/OOS-03); no Agent role exists (C1).

### 11.5 Security verified natively

- `documentSecurity=true` on all 23 collections; no collection-level
  permissions.
- Evidence bucket: `fileSecurity=true`, no permissions.
- Public-read only where intended (listings); landlord private contact is not
  publicly readable.

### 11.6 Frontend integration status (this build)

The React app now connects to the hub for the subset that is genuinely possible,
and uses demo/localStorage for everything else. Verified facts and the exact
persistence are documented in `db/baas/README.md` (§ Client writes / § Frontend
integration status) and `RBAC-SPEC.md` §11. Summary:

- **Real (hub):** authentication + session restore; public listing reads. Client
  database **writes are impossible** here (collections deny client create; user-
  scoped permissions rejected), so the app performs **no** client writes.
- **Demo (localStorage):** saved apartments, landlord listing management,
  inquiries + five-state status history, admin moderation/verification/audit, and
  the renter/landlord role mapping. These are separate from the 769 seeded hub
  documents, which remain intact and are never modified by the app.
- **Not possible here (needs a deployed backend function):** RLS, cross-user
  reads, server-side G3/G4/verification gates, and audit immutability. The
  `db/baas/functions/README.md` contract still describes what such a function
  must do. The app does **not** claim these are server-enforced.

The seeded database (769 documents, 10 auth users) is preserved unchanged; the
app never writes to it.

