# DaNest — Role-Based Access Control (RBAC) Specification

**Status:** Proposed — analysis and specification only. No backend, database, or UI code has been changed.
**Authoritative business source:** `public/BRD-NHÓM-27.docx.pdf` (DaNest BRD, Sprint 0, 49 pp.). Where this spec and the BRD differ, the **BRD wins** — conflicts are listed in §9 and the new §9a BRD reconciliation, not silently resolved.
**Secondary source:** the current DaNest repository (React + Vite prototype).

---

## 0. How to read this document

- **Roles:** Guest, Renter, Landlord, Admin. The BRD-mandated Agent/Property-Manager role is **excluded from the current project scope** — a recorded BRD scope deviation (§1, §9a C1).
- **Scope notation:** `own` = only records the caller owns; `platform` = any record; `public` = unauthenticated-visible data only.
- Every permission lists the **current implementation** it maps to (with `file:line`) so it is clear what exists and what will need to be built.
- **BRULE-xx / FR-xx / UR-xx / OOS-xx** codes cite the BRD. A **Conflicts & BRD Gaps** section (§9) plus a **BRD reconciliation** section (§9a) capture every place this spec follows the BRD, resolves a prior assumption, or flags a genuine conflict for approval.

---

## 1. Roles

| Role | Definition | Current code mapping |
|---|---|---|
| **Guest** | Unauthenticated visitor. Can browse, search and view public listing details **only**. **Cannot** submit rental inquiries or viewing requests, and **cannot** access any private account data or authenticated actions — must register or log in as a Renter first (**resolved: G3, §9**). | No session (`readSession()` returns null, `src/api/index.ts:243-250`). |
| **Renter** | Registered tenant looking for an apartment. Manages only their own profile, saved apartments, comparisons and inquiries. | `User.role: "tenant"` (`src/types/index.ts:111`). **"Renter" ≡ existing "tenant".** |
| **Landlord** | Property owner who creates and manages *their own* apartment listings and handles inquiries for *their own* listings. | `User.role: "landlord"` (`src/types/index.ts:111`); portal scoped by `landlordId` (`src/data/listings.ts:692`, `LANDLORD_PROFILE`). |
| **Admin** | Internal system administrator, reached only through a separate private `/admin` area. Manages platform-wide records: moderation, verification, users, reports, featured, audit, settings. | **No `admin` role exists in any user type.** Admin is a separate `sessionStorage` flag (`danest.admin.session = "1"`, `src/pages/admin/layout.tsx:29,49-59`). A real `admin` role must be added when the backend is built. |
| **Agent / Property Manager** *(EXCLUDED — BRD scope deviation)* | BRD §5.2/FR-03/FR-04/UR-11/UR-13 define a fourth role: "Môi giới / Đơn vị quản lý" that manages only apartments within a recorded authorization scope delegated by a landlord/owner. | **Excluded from current project scope.** This project implements only **Guest, Renter, Landlord, Admin**. No Agent permissions are created and no delegation-scope entity is implemented. This is an explicit, approved **deviation from the BRD** (see §9a C1). |

> **Role set (final):** **Guest, Renter, Landlord, Admin** only. The BRD's Agent/Property-Manager role is **out of scope for this project** — documented as a BRD scope deviation in §9a **C1** (not an open question).

**Role assignment rules (target, per BRD):**
- Guests self-register into **Renter** or **Landlord** only. (BRD FR-01 email+password; FR-02 Admin must approve Landlord accounts before they can post.)
- **Admin is never self-registered** — provisioned only through a secure internal process (G2). Public registration must never allow a user to assign themselves the Admin role.
- A person could hold both Renter and Landlord capabilities; they receive the union but still **not** Admin.
- Agent/Property-Manager accounts are **not created** — that role is out of project scope (§9a C1).

---

## 2. Role × Permission Matrix

Legend: ✅ allow · 🟡 allow, **own records only** · 🚫 deny · ⚪ public-only

| Permission group | Guest | Renter | Landlord | Admin |
|---|---|---|---|---|
| **Auth & account** | register, log in 🚫private | manage **own** profile/session 🟡 | manage **own** profile/session 🟡 | manage own session 🟡 |
| **Browsing / search / filter** | ✅ (visible only) | ✅ | ✅ | ✅ (+ non-visible via admin tools) |
| **Saved apartments & compare** | 🚫 (prompt to log in) | 🟡 own, max 3 compare | ✅ as renter 🟡 | ✅ platform (audit) |
| **Inquiries & viewing requests** | 🚫 must log in as Renter (G3) | 🟡 create/read **own** | 🟡 read/reply/accept/decline **own listings'** inquiries | ✅ platform (read/moderate) |
| **Landlord listing management** | 🚫 | 🚫 | 🟡 create/edit/pause/republish/draft/reconfirm **own** | ✅ platform (status control) + reconfirm any (audited as Admin, G10) |
| **Listing moderation & verification** | 🚫 | 🚫 | 🚫 **may not approve/verify own listing** | ✅ approve/reject/corrections/hide/restore + **verify badge** |
| **User management** | 🚫 | 🚫 | 🚫 | ✅ suspend/activate |
| **Reports & complaints** | 🚫 (must log in — FR-42) | 🟡 submit a report | 🟡 submit a report | ✅ resolve/reopen/hide listing |
| **Featured listings** | 🚫 | 🚫 | 🟡 request a featured slot for **own** listing (FR-35) | ✅ **activate** featured with start/end dates for any listing (FR-35, BRULE-07) |
| **Audit logs & system settings** | 🚫 | 🚫 | 🚫 | ✅ read audit · write settings |

> **No Agent/Property-Manager column:** that role is **excluded from current project scope** (BRD scope deviation, §9a C1). Automated/system actions are recorded under a distinct **SYSTEM** actor, never attributed to an Admin (G7).

---

## 3. Detailed permissions by module

### 3.1 Authentication & account management
| Permission | Guest | Renter | Landlord | Admin | Current code |
|---|---|---|---|---|---|
| `auth.register` (email+password; FR-01) | ✅ | — | — | — | `mockAuthRepository.register` `src/api/index.ts:218-236` |
| `auth.login` / `auth.logout` | ✅ | ✅ | ✅ | ✅ | `login`/`logout` `api/index.ts:202-217,237-240` |
| `auth.password-reset` (email link; FR-01) | ✅ | ✅ | ✅ | ✅ | **Absent** — must be built |
| `auth.consent` (terms + privacy, timestamp; FR-43) | ✅ at register | — | — | — | **Absent** — must be built |
| `account.read-own` / `account.update-own` (name/phone/email; FR-05) | 🚫 | 🟡 | 🟡 | 🟡 | Session only; **no profile-edit endpoint yet** |
| `account.approve` / `account.lock` / `account.unlock` (FR-02) | 🚫 | 🚫 | 🚫 | ✅ | **Absent** — Landlord cannot post until approved; locked accounts cannot log in |
| `admin.auth` | 🚫 | 🚫 | 🚫 | ✅ | `AdminLogin` `src/pages/admin/layout.tsx:41-97` |

> Current auth is a **mock**: passwords are ignored (`void password;` `api/index.ts:214`), login always assigns `tenant` (`:209`), there is no approval, no password reset and no consent record. The BRD (FR-01/02/05/43) makes these **Must** requirements; they are a backend deliverable, not part of this spec's implementation.

### 3.2 Apartment browsing, searching and filtering
| Permission | Allowed to | Current code |
|---|---|---|
| `listing.browse` / `listing.search` / `listing.filter` / `listing.sort` | Guest✅ (only status "Đang hiển thị"/visible; FR-14), Renter, Landlord, Admin | search page + `fetchListings` `src/api/index.ts:98-138` |
| `listing.read-public` (detail, photos, costs, verification level + date; FR-15/22) | Guest✅ | `src/pages/apartment-detail.tsx` |
| `listing.read-unpublished` (draft/pending/temp-hidden/rented) | **Admin only** (and owning Landlord for own) | Not exposed publicly today |

### 3.3 Saved apartments and comparison
| Permission | Allowed to | Current code |
|---|---|---|
| `saved.add` / `saved.remove` / `saved.list-own` | Renter/Landlord 🟡 own | `toggleSaved` `src/state/app-state.tsx:74-81`; key `livora.saved` (`api/index.ts:29`) |
| `compare.add` / `compare.remove` / `compare.clear` (max 3) | Renter 🟡 own | `toggleCompare`, `MAX_COMPARE=3` `app-state.tsx:28,85-99` |

### 3.4 Rental inquiries and viewing requests
Statuses follow **BRD FR-31** (five states): `new` (Mới tiếp nhận), `replied` (Đã phản hồi), `viewing_scheduled` (Đã hẹn xem), `rented` (Đã thuê), `not_proceeding` (Không tiếp tục). Every status change writes history (time + actor).

| Permission | Allowed to | Current code / BRD |
|---|---|---|
| `inquiry.create` (question or viewing-request) | **Renter 🟡 only** (Guest must register/log in — **G3**, BRD §5.2) | `mockInquiriesRepository.create` `api/index.ts:180-189`, forced `status:"new"`; `ContactCard` |
| `inquiry.read-own` | Renter 🟡 | **No endpoint today** |
| `inquiry.read-for-own-listings` | Landlord 🟡 | `listForLandlord` `api/index.ts:175-178` |
| `inquiry.reply` (`new|replied → replied`) | Landlord 🟡 own | `requests.tsx:234-238` |
| `inquiry.schedule-viewing` (`replied → viewing_scheduled`; BRULE-09 only from `replied`/`viewing_scheduled`) | Landlord 🟡 own (renter requested slot) | `requests.tsx:240-243`; `schedule.tsx:174-178` (maps to accepted today) |
| `inquiry.mark-rented` (`viewing_scheduled|replied → rented`) | Landlord 🟡 own | **Absent** — must be built |
| `inquiry.mark-not-proceeding` (`→ not_proceeding`) | Landlord 🟡 own | `requests.tsx:245-248` (declined today → maps to not_proceeding) |
| `inquiry.read-all` / moderate | Admin ✅ | `allInquiries()` `api/admin.ts:249-253` |
| `contact.landlord-view` (reveal private contact) | **Renter 🟡 only after their inquiry is submitted — §4.6 (G4, BRULE-11)** | Currently everyone; must be gated |

> **BRULE-09:** a viewing can only be booked/changed while the inquiry is `replied` or `viewing_scheduled`; `rented` and `not_proceeding` cannot book new viewings. **FR-31** requires every transition to append history (timestamp, actor). **FR-32** records first-request and first-response times for response-time KPIs.

### 3.4a Contact-information visibility (G4)
| Actor | Can see landlord **business** info (name, area) | Can see landlord **private contact** (phone/email revealed on listing) |
|---|---|---|
| Guest | ✅ (public listing fields) | 🚫 |
| Renter **before** submitting an inquiry on that listing | ✅ | 🚫 |
| Renter **after** a successful inquiry submission on that listing | ✅ | ✅ (for that listing) |
| Landlord (owner) / Admin | ✅ | ✅ |

> Landlord private contact is revealed to a Renter **only after** their inquiry on that specific listing has been successfully submitted. `contact.landlord-view` is evaluated server-side against "does this Renter have an inquiry for this listing?" (**resolved: G4, §9**).

### 3.5 Landlord apartment management (owns only)
| Permission | Allowed to | Current code |
|---|---|---|
| `listing.create` (status from moderation) | Landlord 🟡 | `property-form.tsx:173-185`; `addListing` `app-state.tsx:12` |
| `listing.edit` (fields, rent, availability) | Landlord 🟡 own | `properties.tsx:44-52`; `updateListing` `app-state.tsx` |
| `listing.pause` / `listing.republish` | Landlord 🟡 own | `properties.tsx:73-76` |
| `listing.move-to-draft` | Landlord 🟡 own | `properties.tsx:80` |
| `listing.submit-for-verification` | Landlord 🟡 own | `properties.tsx:85` |
| `listing.reconfirm-availability` | Landlord 🟡 own | `properties.tsx:92` + `adminListingRepository.reconfirmAvailability` `api/admin.ts:114-128` |

> Ownership predicate: `listing.landlordId === session.landlordId`. Today the portal hardcodes `LANDLORD_PROFILE.id = "ld-an"` (`src/data/listings.ts:692`) and filters by it (`overview.tsx:99`, `requests.tsx:217`, `schedule.tsx:160`).

### 3.6 Listing moderation and verification (three distinct stages — G11)

Verification is explicitly split into **three separate stages** that must not be conflated:

**Stage 1 — Automated content moderation** (`moderation.auto-run`, system only; no badge authority)
| Check | Result set | Current code |
|---|---|---|
| Required info / content screening / pricing / images / duplicates | `passed` · `needs-attention` · `rejected` · `incomplete` | `runModeration` `src/lib/moderation.ts:81-186` |
| Sets listing **status** only (`published`/`needs-attention`/`rejected`/`draft`) | — | `statusForModeration` `moderation.ts:238-243` |

> Stage 1 **never** grants a Verified badge, and automated checks alone are **insufficient** for verification.

**Stage 2 — Evidence review** (`verification.review-evidence`, **Admin only**)
- An authorized Admin reviews the required **identity evidence** and **rental-right evidence** (the `VerificationCheck`s `landlord-identity` and `rental-authorization`, plus `listing-info`). Automated results are an input, not a substitute.
- Landlords may **submit** evidence but may never review/approve it, and never for their own listing.

**Stage 3 — Verification level** (`verification.grant` / `verification.revoke`, **Admin only**)
- BRD FR-21 defines exactly **two levels**: `unverified` (Chưa xác minh, the default) and `basic_verified` (Xác minh cơ bản). Admin assigns the level and the verification date (FR-21); the level, checked scope and last-confirmed date are published on the listing (FR-22).
- The level can be raised to `basic_verified` **only after** an authorized Admin has reviewed the required evidence (Stage 2) and explicitly approved (BRULE-05). Automated moderation output can **never** produce `basic_verified`.

| Permission | Allowed to | Current code / BRD |
|---|---|---|
| `moderation.auto-run` (Stage 1) | system (not a role); sets status only | `runModeration` `moderation.ts:81-186`; **never sets level** |
| `moderation.decide` — approve(review→visible)/reject/corrections/hide/restore | **Admin only** (FR-10, must give reason) | `updateStatus` `api/admin.ts:62-92`; UI `listing-detail.tsx` |
| `verification.review-evidence` (Stage 2; evidence Admin-only, each open audited — FR-24) | **Admin only** | Evidence fields on `VerificationCheck`; review UI in `listing-detail.tsx` |
| `verification.set-level` (Stage 3: `unverified`↔`basic_verified` + date) | **Admin only**, `basic_verified` only after evidence review | `setVerification` `api/admin.ts:94-112` (boolean today → maps to level) |
| `verification.read` (public level + scope + date) | Guest ✅ (summary only, never evidence) | `VerificationCard` |
| `listing.reconfirm-availability` (FR-23/47) | Landlord 🟡 own; **and Admin** for any listing (G10) | `properties.tsx:92`; `reconfirmAvailability` `api/admin.ts:114-128` |

> **Business rules enforced here (BRD):**
> 1. A Landlord **must not** reach `moderation.decide`, `verification.review-evidence`, or `verification.set-level` for **their own** (or any) listing (FR-03, FR-44).
> 2. Automated moderation sets `status` only; it **never** sets the verification level (BR-04, BRULE-05).
> 3. `basic_verified` requires prior Admin evidence review + explicit approval (Stage 2 → Stage 3).
> 4. **Overdue/hide (FR-23/47, BRULE-06):** a listing not reconfirmed within 14 days is flagged overdue and the owner is reminded; if still unconfirmed 3 days after the reminder it becomes `temp_hidden` and drops from search until reconfirmed. (The 3-day threshold is itself marked "needs Project-Owner confirmation" — §9a D2.)
> 5. **Evidence access is restricted to Admin and audited** (FR-24).
> 6. **Admin-assisted reconfirmation (G10):** Admin may reconfirm availability for any listing, but **only** with an explicit audit event recording the acting Admin (`actorType='admin'` + `actorId`). This is kept **separate** from Landlord self-reconfirmation (a landlord reconfirming its own listing is a distinct action with `actorType='landlord'`).

### 3.7 User management
| Permission | Allowed to | Current code |
|---|---|---|
| `user.list` | Admin ✅ | `adminUserRepository.list` `api/admin.ts:149` |
| `user.suspend` / `user.activate` (reason required) | Admin ✅ | `setStatus` `api/admin.ts:150-161`; UI `users.tsx:75-93` |

### 3.8 Reports and complaints
| Permission | Allowed to | Current code / BRD |
|---|---|---|
| `report.submit` (suspicious/inaccurate listing; FR-42) | **Renter / Landlord 🟡 only** (must be logged in) | **No UI/data path today** |
| `report.read` | Admin ✅ | `adminReportRepository.list` `api/admin.ts:165` |
| `report.resolve` / `report.reopen` (record outcome; reporter notified) | Admin ✅ | `update` `api/admin.ts:166-179` |
| `report.hide-listing` (linked listing → temp hidden) | Admin ✅ | `reports.tsx:76-84` |

> **FR-42:** only **authenticated** users may file reports (guests cannot) — this resolves the earlier nullable-reporter assumption. Admin records the resolution outcome and the reporter receives feedback.

### 3.9 Featured listings
| Permission | Allowed to | Current code / BRD |
|---|---|---|
| `featured.request` (apply for a featured slot for **own** listing; FR-35) | Landlord 🟡 | `landlord/featured.tsx:63` (self-promote today) |
| `featured.activate` / `featured.deactivate` (set start/end dates, platform; FR-35, BRULE-07) | **Admin ✅ only** | **No admin UI/API today** — listed as a gap below |
| `featured.label` / metrics (sponsored label, still filter-matched, not prioritised when overdue; FR-36; view/contact counts; FR-37) | system | `listing-card` label exists; metrics absent |

> **Resolved (BRD):** featured listings are **Admin-activated** with manual start/end dates (FR-35); a landlord **requests**, Admin **activates**. Sponsored listings keep the "được tài trợ" label, must still match filters (FR-36), and are **not** prioritised if overdue (BRULE-07). Basic listings are free; the pilot fee (≈600k VND/month) is a **hypothesis** and **online payment is out of scope** (OOS-03) — see §9a P1. So the *permission* model is settled; the *paid transaction* is explicitly not built.

> **Resolved model:** landlords self-promote their **own** listings (as today, no payment processed); **Admin** may override feature/unfeature for **any** listing, with an audit entry. This closes the current gap where Admin has no featured control.

### 3.10 Audit logs and system settings
| Permission | Allowed to | Current code |
|---|---|---|
| `audit.read` | Admin ✅ | `adminAuditRepository.list` `api/admin.ts:144-146`; `audit.tsx` |
| `settings.read` / `settings.write` (availability grace/reminder days) | Admin ✅ | `adminSettingsRepository.get/set` `api/admin.ts:183-192`; `settings.tsx:36-94` |
| `audit.append` | system (on every mutation) | `appendAudit` `api/admin.ts:131-142` |

---

## 4. Record ownership and access-control rules

All rules are **server-enforced** in the target design; the current client cannot enforce them (see §9).

### 4.1 Renters
- A Renter may read/update **only their own** profile and session.
- A Renter may add/remove **only their own** saved apartments and comparisons (keyed by their user id, not a shared browser store).
- A Renter may create inquiries and read **only their own** inquiries.
- A Renter may **never** see another renter's saved list, inquiries, contact details, or any landlord/admin private record.

### 4.2 Landlords
- A Landlord may create/edit/manage **only listings where `listing.landlordId === session.landlordId`.**
- A Landlord may read/reply/accept/decline **only inquiries whose `inquiry.listingId` belongs to one of that landlord's listings.**
- A Landlord may self-promote **only their own** listings.
- A Landlord **cannot** approve, reject, hide, restore, or verify **their own** (or any) listing — moderation/verification is Admin-only.

### 4.3 Admin
- Admin may manage **platform-wide** records: any listing status/verification, any user account status, any report, any featured state, all audit, and settings.
- Admin actions are **always audited** with the acting admin's identity (§9 — today it's a demo string).

### 4.4 Guests
- Guests may perform **public reads only**: browse, search, filter, sort, view visible ("Đang hiển thị") listing detail/photos/costs/verification level+date (FR-14/15/22).
- Guests **must not** access private account data or authenticated actions (saved, compare, inquiries, reports, contact submission, landlord/admin areas, settings).
- **Guests cannot submit rental inquiries or viewing requests or file reports** — they must register or log in first (G3; FR-42). Browsing/searching public listings stays open to Guests.
- Guests must not see a landlord's private contact information (see §4.6).

> **BRD nuance (G3 wording):** BRD §5.2 says a Renter "can browse without logging in but must register to send rental requests, save and compare (proposed — needs confirmation)". This spec treats public browsing as open and saving/comparing/inquiring/reporting as login-required. The "browse without login" allowance is noted as the BRD's own *proposal* to confirm (§9a D1).

### 4.5 Record linkage gaps to resolve in the DB
- **`Inquiry` has no `tenantId`** — only `tenantName`/`tenantEmail` (`src/types/index.ts:256-270`). Since inquiries are Renter-only (G3), `tenantId` becomes **required** and is set from the authenticated session (no guest inquiries).
- **Saved/comparison** — `SavedApartment` keyed only by `listingId` in browser-global `livora.saved`; must become per-`userId`.
- **Admin identity is a flag, not a user** — audit actor falls back to `"Admin (demo)"` (`api/admin.ts:54-57`); BRD FR-41 requires real actor + old/new values.
- **Verification** — today a boolean `verificationBadge`; the BRD needs a two-level `verification_level` + date + published scope, plus an Admin-only audited evidence store.
- **Inquiry status history** — the current model has no change log; BRD FR-31 requires one (timestamp, actor).

### 4.6 Contact-information visibility (G4 / BRULE-11)
- **Landlord private contact** (the phone/email revealed on a listing) is shown to a Renter **only after** that Renter has successfully submitted an inquiry (question or viewing-request) on that specific listing — **explicitly per BRULE-11** ("contact info of both parties shared only after the renter submits a request").
- **Guests** and **Renters with no submitted inquiry on that listing** must not access the landlord's private contact. They may see public landlord business info already in the listing.
- The gate is evaluated server-side per `(renterId, listingId)`: `contact.landlord-view` ⇒ `exists inquiry where tenantId = session.userId and listingId = :listingId`.
- Landlords (owner) and Admin see full contact data for their scope.

---

## 5. Authentication and authorization workflow (target)

### 5.1 Registration & login (per BRD FR-01/02/43)
1. **Register:** user supplies name/email/password/role (Renter or Landlord; Admin rejected) and **must accept terms + privacy policy**; the system stores the consent timestamp (FR-43). Password hashed server-side (today: ignored). Returns a pending/active session depending on role.
2. **Account approval (FR-02):** Landlord accounts are **pending** until an Admin approves them; pending accounts cannot post listings; **locked** accounts cannot log in. Admin accounts are provisioned only through a secure internal process (G2) — never via public registration.
3. **Login:** credentials verified server-side; session/token issued carrying `{ userId, role }`. **Password reset** via email link (FR-01).
4. **Logout:** session invalidated server-side; client clears it.
5. **Admin login:** separate private entry point; verifies Admin role; **not** a client `sessionStorage` flag.

### 5.2 Authorization on every request (deny-by-default)
1. **Authenticate:** resolve caller → `{ userId, role }` or Guest.
2. **Authorize (role gate):** check the permission is allowed for the role (§2).
3. **Authorize (object gate):** check ownership predicate (e.g. `listing.landlordId === caller.userId`, `inquiry.listingId ∈ caller's listings`).
4. **Deny** with `401` (unauthenticated) or `403` (authenticated but not permitted).
5. **Audit** every sensitive mutation (who, what, target, old→new, reason) — BRD FR-41.

### 5.3 Route guards (UX only — never the security boundary)
- Private routes (`/landlord/*`, `/admin/*`, `/saved`, `/account/*`) redirect Guests to login.
- `/landlord/*` requires the **Landlord** capability; a Renter without it is redirected.
- `/admin` requires **Admin** and is served on a private origin; direct URL entry still re-verifies on the server.

### 5.4 Inquiry lifecycle (BRD FR-31 / BRULE-09 — five states)
```
                 ┌── reply ───────────► replied ──► schedule ──► viewing_scheduled
   create ──► new ┤                       │             │                  │
                 ├── schedule ────────► viewing_scheduled                  │
                 └── not_proceeding ◄─────────────┬──────────────┬────────┘
                                                    │              │
                              (from replied/viewing_scheduled)──► rented
```
- States: `new` (Mới tiếp nhận), `replied` (Đã phản hồi), `viewing_scheduled` (Đã hẹn xem), `rented` (Đã thuê), `not_proceeding` (Không tiếp tục).
- **BRULE-09:** a viewing can be booked or changed only from `replied`/`viewing_scheduled`; `rented` and `not_proceeding` cannot book new viewings.
- Every transition appends **history** (timestamp + actor; FR-31). Creation forces `status:'new'`; only an authenticated Renter may create (G3), with `tenantId` from the session.
- Legacy mapping from the current code: `accepted` → `viewing_scheduled`; `declined` → `not_proceeding`. `rented` is new (post-viewing outcome).

### 5.5 Moderation & verification workflow (BRD: three stages, two levels)
```
Landlord submits → (Stage 1) runModeration (auto) → statusForModeration
                     └─ status ∈ {draft|pending_review|visible|needs_correction|rejected|temp_hidden|rented}  (never sets level)
                                                     │
Admin reviews listing (moderation.decide) ──► approve(visible) | reject | request-corrections | hide | restore
Admin reviews evidence  (Stage 2: verification.review-evidence, audited; FR-24)
Admin sets level        (Stage 3: verification.set-level, basic_verified only after Stage 2; FR-21/BRULE-05)  ← Admin only
```
Stage 1 (automated content moderation) sets status only and can **never** grant `basic_verified`. Stage 2 (evidence review) and Stage 3 (verification level + date) are Admin-only and audited. Landlords may submit evidence but never review/approve it. The published level, scope and date are shown to the public (FR-22).

---

## 6. Proposed database entities and relationships (specification, not built)

```
User(id PK, email UNIQUE, passwordHash, name, role ENUM(renter,landlord,admin),
     status ENUM(pending,active,rejected,suspended/locked) ,
     approvedBy FK→User NULL, approvedAt, lockedAt,
     termsAcceptedAt,           -- FR-43 consent timestamp
     avatarInitials, createdAt)  -- admin rows provisioned only via secure internal process (G2)
PasswordReset(id PK, userId FK→User, tokenHash, expiresAt, usedAt)   -- FR-01
Session(id PK, userId FK→User, token, createdAt, expiresAt)

Listing(id PK, landlordId FK→User, slug UNIQUE, title, summary, description,
        neighborhood, address, type, monthlyRent, bedrooms, bathrooms, floorArea,
        furnishing, availability, availableFrom,
        status ENUM(draft,pending_review,visible,needs_correction,rejected,temp_hidden,rented),
        verification_level ENUM(unverified,basic_verified) default unverified,   -- FR-21
        verifiedAt, verifiedScope,        -- FR-21/22 (date + published scope)
        featured BOOL default false, sponsored BOOL default false,
        lastAvailabilityConfirmedAt, availabilityReminderSentAt, listedAt, isSample)
VerificationCheck(id PK, listingId FK→Listing, kind ENUM(listing-info,landlord-identity,rental-authorization),
        status ENUM(verified,in-review,not-started), lastUpdated)
ListingModeration(id PK, listingId FK→Listing (1:1), result, checks JSON, reasons JSON,
        duplicateRisk BOOL, autoReviewedAt,
        reviewedBy FK→User NULL, reviewedAt, decision, reason)   -- manualReview folded in
Inquiry(id PK, tenantId FK→User NOT NULL, listingId FK→Listing, tenantName, tenantEmail,
        type ENUM(question,viewing-request), message, moveInDate, durationMonths,
        tenantPreferences JSON,
        status ENUM(new,replied,viewing_scheduled,rented,not_proceeding),   -- FR-31 five states
        firstRequestedAt, firstRespondedAt,            -- FR-32 response-time KPI
        scheduledAt, preferredTime, createdAt)          -- tenantId required: Renter-only (G3)
InquiryStatusHistory(id PK, inquiryId FK→Inquiry, fromStatus, toStatus,
        actorId FK→User, changedAt, note)               -- FR-31 change history
EvidenceReview(id PK, listingId FK→Listing, reviewerId FK→User, evidenceRefs JSON,
        decision ENUM(approved,rejected,corrections-requested), reviewedAt, reason)
        -- Stage 2: explicit identity/rental-right evidence review record (G11)
EvidenceAccessLog(id PK, evidenceId FK→VerificationCheck, actorId FK→User, accessedAt)
        -- FR-24: every evidence open is audited
SavedApartment(id PK, userId FK→User, listingId FK→Listing, savedAt, UNIQUE(userId,listingId))
ListingPromotion(id PK, listingId FK→Listing, kind ENUM(featured,sponsored),
        requestedBy FK→User NULL, activatedBy FK→User, startDate, endDate, active BOOL, createdAt)
        -- FR-35/BRULE-07: landlord requests, Admin activates with manual dates
Report(id PK, listingId FK→Listing, reporterId FK→User NOT NULL,   -- FR-42: authenticated only
        category, message, status ENUM(open,resolved,unresolved), createdAt,
        resolvedBy FK→User NULL, resolutionNote)
AuditLogEntry(id PK, actorType ENUM(admin,landlord,renter,system), actorId FK→User NULL,
        action ENUM(...), target, reason,
        oldValues JSON, newValues JSON, createdAt)       -- FR-41 immutable before/after
        -- actorType='system' + actorId NULL for automated actions (G7): never attributed to an Admin
AdminSettings(id PK singleton, availabilityGraceDays, availabilityReminderDays, updatedAt)
```

**Ownership-enforcing relationships:**
- `Listing.landlordId → User(role=landlord)` — the landlord-management predicate.
- `Inquiry.listingId → Listing.landlordId` — lands landlord read/reply/transition scope.
- `Inquiry.tenantId → User(role=renter)` (**required**) — lands "renter reads own inquiries"; guest inquiries no longer exist (G3).
- `Inquiry(tenantId, listingId)` — also the **contact-visibility predicate** (G4/BRULE-11).
- `InquiryStatusHistory.inquiryId → Inquiry` + `actorId → User` — FR-31 audit trail (timestamp+actor).
- `EvidenceReview.reviewerId → User(role=admin)` + `Listing.verification_level='basic_verified'` — Stage 3 is grantable only with a matching approved `EvidenceReview` (Stage 2) by an Admin; automated moderation never produces either (G11).
- `EvidenceAccessLog` — FR-24 evidence access is Admin-only and audited.
- `SavedApartment.userId → User` — lands per-renter saved/compare isolation.
- `ListingPromotion.requestedBy/activatedBy → User` — separates landlord request from Admin activation (FR-35).
- `AuditLogEntry.actorType/actorId` — real actor identity; automated actions use `actorType='system'` with `actorId = NULL` (a distinct SYSTEM actor), never an Admin (G7). Replaces `"Admin (demo)"`.

**Mapping from today's localStorage entities:** `livora.session`→Session; `livora.saved`→SavedApartment; `livora.inquiries`+`livora.inquiry-overrides`→Inquiry(+InquiryStatusHistory); `livora.listings.overrides`→Listing; `danest.admin.listings/users/reports/audit/settings`→Listing override/User/Report/AuditLogEntry/AdminSettings.

---

## 7. API authorization requirements

Server-side, deny-by-default, object-level checks are mandatory. Client-side hiding is **UX only**.

| Endpoint (illustrative) | Role required | Object rule | Notes |
|---|---|---|---|
| `POST /auth/register` | Guest | role ∈ {renter,landlord}; record `termsAcceptedAt` (FR-43) | reject `admin` self-signup |
| `POST /auth/login` | Guest | — | verify credentials; reject `pending`/`locked` (FR-02) |
| `POST /auth/password-reset` | Guest | — | email reset link (FR-01) |
| `GET /listings` `GET /listings/:id` | Guest+ | `visible` only for public | non-visible ⇒ owner Landlord or Admin |
| `POST /listings` | Landlord (active) | `landlordId = session.userId` | status from auto-moderation; `pending` accounts forbidden |
| `PATCH /listings/:id` | Landlord owner **or** Admin | owner: `landlordId=session`; Admin: any | landlord edits own only |
| `POST /listings/:id/pause|republish|draft` | Landlord owner | own only | |
| `POST /listings/:id/reconfirm` | Landlord owner **or** Admin | owner: own; Admin: any | G10: writes an audit event identifying the actor; Admin reconfirm is a distinct action from landlord self-reconfirm |
| `POST /listings/:id/decide` (approve/reject/corrections/hide/restore) | **Admin only** | — | **Landlord forbidden even on own listing** |
| `GET /listings/:id/evidence` (Stage 2 review) | **Admin only** | — | identity + rental-right evidence; each access logged (FR-24) |
| `POST /listings/:id/verification` (Stage 3 set level+date) | **Admin only** | `basic_verified` must reference an approved `EvidenceReview` | automated moderation insufficient; publish level/scope (FR-22) |
| `GET /listings/:id/contact` (landlord private contact) | Renter | `exists inquiry(tenantId=session, listingId=:id)` | **G4/BRULE-11** — hidden from Guests / Renters without an inquiry |
| `GET /inquiries` | Landlord owner / Admin | Landlord: `listingId ∈ own`; Admin: all | |
| `POST /inquiries` | **Renter only** | `tenantId = session` (set server-side) | Guest → 401/redirect to register (G3); forces `status:new` |
| `GET /inquiries/mine` | Renter | `tenantId = session` | own only |
| `PATCH /inquiries/:id` (reply/schedule-viewing/mark-rented/not-proceeding) | Landlord owner | `inquiry.listingId ∈ own` | BRULE-09 transitions only; writes `InquiryStatusHistory` (FR-31) |
| `GET /saved` `POST/DELETE /saved/:listingId` | Renter | `userId = session` | |
| `POST /reports` | **Renter / Landlord (authenticated)** | attributed `reporterId = session` | FR-42: guests forbidden |
| `PATCH /reports/:id` (resolve/reopen) | Admin | — | record outcome; notify reporter |
| `POST /users/:id/status` (approve/lock/unlock/suspend) | Admin | — | FR-02 |
| `POST /listings/:id/feature` (request) | Landlord owner | own only | creates a promotion request |
| `POST /listings/:id/feature/activate` (activate with dates) | **Admin only** | — | FR-35/BRULE-07; audited |
| `GET /admin/audit` `PATCH /admin/settings` | Admin | — | audit is immutable (FR-41) |

**Middleware requirements:** an authn layer, a role guard per route, an object-ownership guard per record, consistent `401/403` semantics, and mandatory audit-on-write.

---

## 8. Edge cases, security risks and affected features

### 8.1 Edge cases & security risks
1. **Direct URL/API access by Guests/Renters** to `/landlord` and `/admin` — must 401/403 on the server, not rely on client redirects.
2. **Admin gate bypass:** today `sessionStorage["danest.admin.session"]="1"` unlocks admin (`admin/layout.tsx:57,219`). Must be replaced by a verified Admin session.
3. **Landlord approves own listing:** a crafted `POST /listings/:id/decide` must be rejected for any non-Admin, including the owner.
4. **Auto-moderation raising the level:** must remain impossible — Stage 1 sets status only; `basic_verified` requires Admin evidence review (Stage 2) + explicit approval (Stage 3) via `verification.set-level`.
5. **Inquiry tenant linkage mandatory:** since inquiries are Renter-only (G3), `tenantId` must be set from the session; unauthenticated `POST /inquiries` is rejected (not silently attributed).
6. **Multi-landlord leakage:** with three landlords (`ld-an`, `ld-linh`, `ld-minh`) but a portal hardcoded to An, an unscoped query would leak other landlords' inquiries. Scope by `session.landlordId`.
7. **Saved/compare cross-user leakage:** browser-global `livora.saved` means two users on one device share a list. Key by `userId`.
8. **Report reporter PII** — visible only to Admin; reports are authenticated-only (FR-42), `reporterId` always set.
9. **Featured self-promotion without payment** — resolved: Admin activates featured with manual dates (FR-35); online payment is out of scope (OOS-03, §9a P1).
10. **Audit actor spoofing (G7)** — replace the `"Admin (demo)"` fallback. Interactive actions record `actorType` + verified `actorId`; automated/system actions record `actorType='system'` with `actorId = NULL` and are **never** attributed to an Admin. Entries are immutable with old/new values (FR-41).
10a. **Admin self-registration (G2)** — public registration accepts only Renter/Landlord; Admin rows are provisioned solely via a secure internal process.
11. **Suspended/locked/pending accounts** must be denied authenticated actions even with a valid token (check `User.status`; FR-02).
12. **Contact-info leakage (G4/BRULE-11):** landlord private contact must never be returned to a Guest or a Renter without a submitted inquiry on that listing. Enforce server-side per `(renterId, listingId)`; never rely on hiding the UI.
13. **Verification-stage conflation (G11):** automated moderation output must never be treated as evidence review or as an approval. `basic_verified` requires an Admin-approved `EvidenceReview` record.
14. **Evidence access (FR-24):** evidence is Admin-only and each open is logged (`EvidenceAccessLog`); never expose evidence via public listing endpoints.
15. **Password reset abuse (FR-01):** tokens are single-use, hashed at rest, expire quickly; a reset must not reveal whether an email exists.

### 8.2 Existing features that may be affected
- **Login / registration** (`src/pages/login.tsx`, `api/index.ts:202-241`) — mock auth must become real; role assignment tightened.
- **Admin gateway** (`src/pages/admin/layout.tsx`) — sessionStorage flag → verified Admin session.
- **Landlord portal** (`src/pages/landlord/layout.tsx`, `properties.tsx`, `requests.tsx`, `schedule.tsx`, `featured.tsx`, `settings.tsx`) — must be gated and scoped by the authenticated landlord.
- **Admin pages** (`listings.tsx`, `listing-detail.tsx`, `users.tsx`, `reports.tsx`, `settings.tsx`, `audit.tsx`, `kpis.tsx`, `overview.tsx`) — keep behaviour; add server-side role/ownership enforcement and real audit actors.
- **Saved/compare** (`src/state/app-state.tsx`) — move from browser-global to per-user records.
- **Inquiry creation** (`src/components/detail/contact-card.tsx`) — keep UI, but **require a logged-in Renter** (G3); the server sets `tenantId`; Guests are redirected to register/log in.
- **Listing contact reveal** (`ContactCard`) — show landlord private contact **only after** the Renter's inquiry is submitted (G4); gate server-side.
- **Moderation** (`src/lib/moderation.ts`) — keep logic; Stage 1 sets status only; `basic_verified` requires Admin evidence review + explicit approval (Stage 2 → Stage 3, G11).
- **Public listing visibility** (`getListings`/`fetchListings`) — `visible`-only for Guests/Renters; non-visible visible to owning Landlord + Admin.
- **Header links** to `/landlord` (`src/components/layout/header.tsx:12,148`) — keep, but redirect Guests to login/landlord-signup as appropriate.

---

## 9. Conflicts & prior assumptions (status after BRD reconciliation)

> Earlier revisions wrongly stated "BRD absent (G1)". The BRD **is** present (`public/BRD-NHÓM-27.docx.pdf`) and is now the authoritative source; §9a lists what the BRD changed. G1 is therefore closed.

| ID | Gap / Conflict | Current reality | Resolution / assumption |
|---|---|---|---|
| **G1** | **BRD now supplied & authoritative** | Was marked absent | **✅ RESOLVED** — reconciled in §9a |
| **G2** | **No `admin` role** | Admin is a `sessionStorage` flag, not a user role | **✅ RESOLVED** — add `admin` to the role enum; Admin accounts are provisioned **only** through a secure internal process. Public registration can never self-assign Admin. |
| **G3** | **Guest inquiry policy** | Guests can file inquiries (name/email only) | **✅ RESOLVED** — Guests cannot submit inquiries/viewing requests/reports; must register/log in. `Inquiry.tenantId` required (§3.4, §4.4, §5.4) |
| **G4** | **Contact-information access rule** | Contact shown to everyone | **✅ RESOLVED (BRD BRULE-11)** — revealed only after the Renter submits an inquiry on that listing (§3.4, §4.6, §7) |
| **G5** | **Inquiry tenant linkage** | No `tenantId` | **Resolved by G3** — required (§6) |
| **G6** | **Featured control** | Landlord self-promotes; Admin has none | **✅ RESOLVED (BRD FR-35)** — landlord **requests**, Admin **activates** with manual start/end dates; sponsored label + metrics (FR-36/37) |
| **G7** | **Audit actor** | Falls back to `"Admin (demo)"` | **✅ RESOLVED** — automated actions use a distinct **SYSTEM** actor (`actorType='system'`, `actorId NULL`), **never** attributed to an Admin; interactive actions record verified `actorId`; immutable before/after (FR-41) |
| **G8** | **Multi-landlord data** | 3 landlords; portal hardcodes An | **✅ RESOLVED** — enforce true per-`landlordId` isolation across all landlords |
| **G9** | **"Renter" vs "tenant" naming** | Code uses `tenant` | **✅ RESOLVED** — model uses Guest/Renter/Landlord/Admin; Renter ≡ tenant; code mapping documented |
| **G10** | **Admin reconfirm-availability** | API exists, no UI/audit | **✅ RESOLVED** — Admin may reconfirm any listing **only** with an explicit audit event identifying the Admin actor; kept **separate** from Landlord self-reconfirmation |
| **G11** | **Verification scope** | Admin toggles boolean badge | **✅ RESOLVED (BRD FR-21/22/24, BRULE-05)** — three stages; two levels (`unverified`/`basic_verified`) + date + published scope; evidence Admin-only + audited (§3.6, §5.5) |

**All G-items (G1–G11) are now resolved.** The remaining unresolved items are the DB-side opens tracked in `DATABASE-DESIGN.md` §8.2 (notification delivery, counters, FTS config, evidence storage, inquiry contact snapshot, renter profile) plus the pre-production confirmations noted in §9a. The role-set deviation (**C1**) is recorded as an approved scope deviation, not an open question.

---

## 9a. BRD reconciliation — confirmed decisions & recorded deviations

**Corrections applied from the BRD (not open questions — already fixed in this doc):**

| # | BRD ref | What changed / what this doc now says |
|---|---|---|
| R1 | §5.2, FR-03/04 | Role model **deviates** from BRD: BRD has 4 roles incl. **Agent/Property Manager**; this project implements only Guest/Renter/Landlord/Admin — a recorded scope deviation (**C1** below). |
| R2 | FR-01/02/05/43 | Auth now requires: email+password, **password reset link**, **Admin account approval/lock** (pending accounts can't post; locked can't log in), profile edit, **consent timestamp**. |
| R3 | FR-31/32, BRULE-09 | Inquiry now has **5 states** (`new`, `replied`, `viewing_scheduled`, `rented`, `not_proceeding`) + **history** (time+actor) + first-request/response KPIs. `accepted→viewing_scheduled`, `declined→not_proceeding`. |
| R4 | FR-14/15/09 | Listing states reconciled toward BRD five-state lifecycle (visible/draft/pending/correction/rejected/hidden/rented); public sees only visible. |
| R5 | FR-21/22/24, BRULE-05 | Verification is now **two levels** (`unverified`, `basic_verified`) + **date** + **published scope**; evidence **Admin-only + audited**; overdue → remind → temp-hide (FR-23/47). |
| R6 | FR-35/36/37, BRULE-07 | Featured is **Admin-activated** with **manual start/end dates**; landlord only **requests**; sponsored label must still match filters; not prioritised when overdue; view/contact metrics. |
| R7 | FR-42 | Reports are **authenticated-only** (resolves the old nullable reporter). |
| R8 | FR-41 | Audit is **immutable** and records **old→new values** + actor + reason. |
| R9 | FR-34 | Notifications are in-app **and email** (delivery transport remains a DB-side open — `DATABASE-DESIGN.md` §8.2). |

**Final project decisions (approved — not open):**

| ID | Decision |
|---|---|
| **C1** | **Agent / Property-Manager role is EXCLUDED from the current project scope.** Only Guest, Renter, Landlord, Admin are implemented. No Agent permissions and **no `DelegationScope` entity** are created. This is an **explicit, approved deviation from BRD §5.2/FR-03/FR-04/UR-11/UR-13**. |
| **G2** | **Admin provisioning** is via a secure internal process only. Public registration **never** allows self-assignment of the Admin role. |
| **G7** | **System audit:** automated actions use a distinct **SYSTEM** actor (`actorType='system'`, `actorId NULL`); automated actions are **never** attributed to an Admin. |
| **G8** | **Multi-landlord isolation** — RESOLVED: enforce true per-`landlordId` isolation across all landlords. |
| **G9** | **Role naming** — RESOLVED: Guest / Renter / Landlord / Admin; Renter ≡ tenant. |
| **G10** | **Admin-assisted reconfirmation** is allowed **only** with an explicit audit event identifying the Admin actor, kept **separate** from Landlord self-reconfirmation. |
| **P1** | **Featured payment:** **no online payment or billing** in the current scope (BRD **OOS-03**). The featured **permission model** (Admin activation, FR-35) is kept **separate** from payment; the pilot fee stays a config value only. |

**Pre-production review items (not blockers for design; must be confirmed before production):**

| ID | Item | Status |
|---|---|---|
| **D2** | **BRULE-06** — the 3-day grace (hide after reminder) is kept as a **configurable proposed default** (`availabilityGraceDays`), **clearly marked for Project-Owner confirmation** before production. | Proposed default — confirm |
| **D3** | **BRULE-13** — legal guidance and legal compliance are **pre-production review items** (legal/content sign-off), not technical blockers. | Pre-production review |

Other BRD items this doc does **not** model and are non-RBAC (tracked in the DB doc): messaging, AI/Q&A, availability calendar, email transport, FTS config, view/inquiry counters, renter profile preferences.

---

## 10. Out of scope / next step

This document is **analysis and specification only**. It does **not** implement the backend, database, authentication, API, or any UI change, and it does **not** alter mock data, demo workflows, or existing features.

**Resolved & recorded this revision:** all G-items (G1–G11) are resolved; **C1** (Agent role excluded — BRD scope deviation), **G2** (internal Admin provisioning), **G7** (SYSTEM actor), **G8/G9** (resolved baselines), **G10** (Admin reconfirm audited + separated), **P1** (no billing, OOS-03).

**Final unresolved items** (DB-side, mirrored in `DATABASE-DESIGN.md` §8.2): notification delivery/email transport, view/inquiry counters, full-text search config, evidence storage backend, inquiry contact snapshot, renter profile fields. **Pre-production confirmations:** BRULE-06 3-day grace default and BRULE-13 legal review. Nothing else blocks implementation.

---

## 11. Implementation status on the Paletto Backend Hub (this build)

This section records what is **actually implemented and verified** in the DaNest
frontend + Paletto Backend Hub, and how each RBAC rule is enforced. It does **not**
claim production-grade authorization. Verified hub facts (see `db/baas/README.md`):
real email/password **auth works**; **public reads** of listings + child collections
work; **client database writes are denied** on every collection; **user-scoped
document permissions are rejected**; query filters/offset are unreliable (25-row cap).

### 11.1 Enforcement matrix (honest)

| Rule / capability | Enforcement in this build | Where |
| --- | --- | --- |
| Register / log in / session restore / logout | **Real** (Appwrite Auth) | `src/api/backend/auth.ts`, `src/state/app-state.tsx` |
| Public listing browse / detail | **Real reads** (hub) + rich demo data | `src/api/backend/listings.ts` (capability), `applyQuery` |
| Saved apartments — own only | **Demo** (`localStorage`) | `src/api/index.ts` (`livora.saved`) |
| Renter / Landlord role assignment | **Demo mapping** (`localStorage`, keyed by real account email) — **not** server RBAC | `src/api/backend/role-map.ts` |
| G3 — Guest must log in as Renter to inquire | **Frontend gate** (form hidden for guests, login prompt) | `src/components/detail/contact-card.tsx` |
| G4 — reveal landlord private contact only after a renter's inquiry on that listing | **Frontend demo check** (`hasInquiryFor`) | `contact-card.tsx`, `src/data/private-contacts.ts` |
| G11 — automated moderation never grants Basic Verified | **Demo** — only Admin `verify()` sets the badge | `src/api/admin.ts`, admin UI |
| Landlord data isolation (own listings/inquiries) | **Demo** — scoped by signed-in landlord id | `src/pages/landlord/*` (`use-landlord-identity.ts`) |
| Landlord area access control | **Client-only route gate** (login + role check) — UX boundary, not security | `src/pages/landlord/layout.tsx` |
| Admin back-office access | **Client-only demo gate** (`sessionStorage`) — not in public nav | `src/pages/admin/layout.tsx` |
| Admin cannot approve/verify own listing | **Demo guard** (reserved `admin` landlord id blocked) | `src/pages/admin/listing-detail.tsx` |
| Inquiry five-state lifecycle + history | **Demo** (`localStorage`, append-only) | `src/api/index.ts`, `src/types/index.ts` |
| Audit trail | **Demo** (`localStorage`) | `src/api/admin.ts` |
| Server-side authorization (RLS, cross-user reads, DB-level audit immutability) | **NOT POSSIBLE** on this hub (no RLS, no client writes, functions not deployable) | documented limitation |

### 11.2 What this means for security

- **Authentication is real.** Passwords and sessions are handled by the platform;
  a wrong password fails and does not silently fall back to a demo login.
- **Authorization of data is demo-level.** Route gates, role mapping, G3/G4 and
  inquiry transitions run in the browser. A determined user can bypass them. This
  is acceptable for a **demonstrable prototype**, not for a production release.
- **No private data leaks through the hub reads.** The public reads only touch
  `read("any")` collections; `landlord_profiles` (private contact) and `evidence_*`
  are not readable from the client and are never rendered.
- **Admin is not a real privilege.** Admin is an internal demo back-office gate; no
  client-side field can grant a public user real Admin access.

### 11.3 Role model shipped

Guest, Renter, Landlord, Admin only (Agent/Property-Manager excluded — see §9a C1).
`User.role` uses `"tenant"` for Renter; the demo role map stores `tenant | landlord`
only and can never store `admin`.
