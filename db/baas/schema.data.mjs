// Canonical DaNest schema for the Backend Hub (Appwrite 1.8).
//
// This is DATA, not logic: the reconciler (schema.mjs) reads it and creates
// whatever is missing. Every deviation from DATABASE-DESIGN.md is recorded in
// db/baas/README.md and db/baas/functions/README.md.
//
// Type mapping (Postgres -> Appwrite):
//   uuid -> string(64)        citext -> email
//   numeric -> double         date -> string(10)  (ISO yyyy-mm-dd)
//   timestamptz -> datetime   text[] / jsonb -> string(65535) holding JSON
//   CREATE TYPE enum -> string(32) with `elements`
//
// `rules` lists CHECK/FK constraints that Appwrite cannot express. They are
// metadata for the enforcement function — see db/baas/functions/README.md.

export const SENTINEL = "SENTINEL";

const uuid = (key, extra = {}) => ({ type: "string", key, size: 64, required: false, ...extra });
const str = (key, size = 255, extra = {}) => ({ type: "string", key, size, required: false, ...extra });
const big = (key, extra = {}) => ({ type: "string", key, size: 65535, required: false, ...extra });
const email = (key, extra = {}) => ({ type: "email", key, required: false, ...extra });
const int = (key, extra = {}) => ({ type: "integer", key, required: false, ...extra });
const num = (key, extra = {}) => ({ type: "double", key, required: false, ...extra });
const bool = (key, extra = {}) => ({ type: "boolean", key, required: false, ...extra });
const dt = (key, extra = {}) => ({ type: "datetime", key, required: false, ...extra });
const day = (key, extra = {}) => ({ type: "string", key, size: 10, required: false, ...extra });
const en = (key, elements, extra = {}) => ({ type: "enum", key, elements, required: false, ...extra });

const USER_ROLE = ["renter", "landlord", "admin"];
const ACCOUNT_STATUS = ["pending", "active", "rejected", "suspended"];
const LISTING_TYPE = ["apartment", "studio", "serviced-apartment", "penthouse"];
const FURNISHING = ["furnished", "semi-furnished", "unfurnished"];
const AVAILABILITY = ["available", "reserved", "unavailable"];
const LISTING_STATUS = ["draft", "pending_review", "visible", "needs_correction", "rejected", "temp_hidden", "rented"];
const COST_STATE = ["fixed", "variable", "reported", "unknown"];
const COST_CADENCE = ["monthly", "one-time"];
const VERIFICATION_LEVEL = ["unverified", "basic_verified"];
const VERIFICATION_KIND = ["listing-info", "landlord-identity", "rental-authorization"];
const VERIFICATION_STATUS = ["verified", "in-review", "not-started"];
const MODERATION_RESULT = ["passed", "needs-attention", "rejected", "incomplete"];
const MODERATION_DECISION = ["approved", "rejected", "corrections-requested", "hidden", "restored"];
const EVIDENCE_DECISION = ["approved", "rejected", "corrections-requested"];
const EVIDENCE_KIND = ["identity", "rental-authorization", "listing-proof"];
const INQUIRY_TYPE = ["question", "viewing-request"];
const INQUIRY_STATUS = ["new", "replied", "viewing_scheduled", "rented", "not_proceeding"];
const PROMOTION_KIND = ["featured", "sponsored"];
const REPORT_CATEGORY = ["inaccurate", "hidden-fees", "duplicate", "misleading-photos", "other"];
const REPORT_STATUS = ["open", "resolved", "unresolved"];
const NOTIFICATION_TYPE = [
  "inquiry-created",
  "inquiry-replied",
  "inquiry-viewing-scheduled",
  "inquiry-rented",
  "inquiry-not-proceeding",
  "availability-reminder",
  "listing-moderated",
  "verification-changed",
  "report-resolved",
  "account-status-changed",
];
const AUDIT_ACTION = [
  "listing-approved",
  "listing-rejected",
  "listing-corrections-requested",
  "listing-hidden",
  "listing-restored",
  "listing-submitted",
  "listing-status-changed",
  "verification-level-changed",
  "evidence-reviewed",
  "evidence-accessed",
  "account-approved",
  "account-rejected",
  "account-suspended",
  "account-activated",
  "report-resolved",
  "report-reopened",
  "settings-updated",
  "availability-reconfirmed",
  "featured-requested",
  "featured-activated",
  "featured-deactivated",
];
const AUDIT_ACTOR_TYPE = ["admin", "landlord", "renter", "system"];

// Collections in dependency order: the reconciler creates them all first,
// THEN adds attributes (so relationships can reference collections that exist).
export const collections = [
  {
    id: "users_profile",
    name: "users_profile",
    attrs: [
      uuid("userId"),
      email("email", { required: true }),
      str("name", 200, { required: true }),
      en("role", USER_ROLE, { required: true, xdefault: "renter" }),
      en("status", ACCOUNT_STATUS, { required: true, xdefault: "pending" }),
      uuid("approvedBy"),
      dt("approvedAt"),
      dt("termsAcceptedAt"),
      str("avatarInitials", 2),
      bool("isSample"),
      str("seedKey", 64),
    ],
    indexes: [
      { key: "idx_users_email", type: "unique", attributes: ["email"] },
      { key: "idx_users_role_status", type: "key", attributes: ["role", "status"] },
      { key: "idx_users_seed", type: "key", attributes: ["seedKey"] },
    ],
    rules: ["unique(email) case-insensitive — enforced in function", "avatarInitials length 1..2"],
  },
  {
    id: "landlord_profiles",
    name: "landlord_profiles",
    attrs: [
      uuid("userId", { required: true }),
      str("displayName", 200, { required: true }),
      str("businessRole", 200),
      big("languages"),
      str("responseTime", 100),
      day("memberSince"),
      email("contactEmail"),
      str("contactPhone", 40),
      bool("isSample"),
      str("seedKey", 64),
    ],
    indexes: [
      { key: "idx_landlord_user", type: "unique", attributes: ["userId"] },
      { key: "idx_landlord_seed", type: "key", attributes: ["seedKey"] },
    ],
    rules: ["businessRole is a display label, never an auth role"],
  },
  {
    id: "neighborhoods",
    name: "neighborhoods",
    attrs: [
      str("neighborhoodId", 64, { required: true }),
      str("name", 200, { required: true }),
      str("tagline", 255),
      big("description"),
      str("imagePath", 500),
      num("lat"),
      num("lng"),
      big("lifestyle"),
    ],
    indexes: [{ key: "idx_hood_nid", type: "unique", attributes: ["neighborhoodId"] }],
    rules: [],
  },
  {
    id: "amenities",
    name: "amenities",
    attrs: [str("amenityId", 64, { required: true }), str("label", 200, { required: true })],
    indexes: [{ key: "idx_amenity_aid", type: "unique", attributes: ["amenityId"] }],
    rules: [],
  },
  {
    id: "listings",
    name: "listings",
    attrs: [
      uuid("landlordId", { required: true }),
      str("slug", 200, { required: true }),
      str("neighborhoodId", 64, { required: true }),
      str("title", 300, { required: true }),
      big("summary"),
      big("description"),
      en("type", LISTING_TYPE, { required: true, xdefault: "apartment" }),
      num("monthlyRent", { required: true }),
      int("bedrooms", { required: true }),
      int("bathrooms", { required: true }),
      num("floorArea"),
      str("floorLevel", 100),
      en("furnishing", FURNISHING, { required: true }),
      en("availability", AVAILABILITY, { required: true, xdefault: "available" }),
      day("availableFrom"),
      int("minMonths", { required: true }),
      int("maxMonths", { required: true }),
      num("lat"),
      num("lng"),
      str("address", 500),
      en("status", LISTING_STATUS, { required: true, xdefault: "draft" }),
      en("verificationLevel", VERIFICATION_LEVEL, { required: true, xdefault: "unverified" }),
      day("verifiedAt"),
      str("verifiedScope", 500),
      day("lastAvailabilityConfirmedAt"),
      dt("availabilityReminderSentAt"),
      dt("listedAt"),
      bool("isSample"),
      str("seedKey", 64),
      bool("demoTenant_flag"),
    ],
    indexes: [
      { key: "idx_listings_slug", type: "unique", attributes: ["slug"] },
      { key: "idx_listings_landlord", type: "key", attributes: ["landlordId"] },
      { key: "idx_listings_status_avail", type: "key", attributes: ["status", "availability"] },
      { key: "idx_listings_hood", type: "key", attributes: ["neighborhoodId"] },
      { key: "idx_listings_rent", type: "key", attributes: ["monthlyRent"] },
      { key: "idx_listings_verified", type: "key", attributes: ["verificationLevel"] },
      { key: "idx_listings_avail_confirmed", type: "key", attributes: ["lastAvailabilityConfirmedAt"] },
      { key: "idx_listings_seed", type: "key", attributes: ["seedKey"] },
    ],
    rules: [
      "monthlyRent >= 0",
      "bedrooms >= 1",
      "bathrooms >= 1",
      "floorArea >= 0",
      "minMonths >= 1",
      "maxMonths >= minMonths",
      "verificationLevel='basic_verified' requires an approved evidence_review AND verifiedAt — enforced in function",
      "landlordId is the ownership anchor — enforced in function",
    ],
  },
  {
    id: "listing_image",
    name: "listing_image",
    attrs: [
      uuid("listingId", { required: true }),
      str("url", 500, { required: true }),
      int("position", { required: true }),
    ],
    indexes: [
      { key: "idx_image_listing_pos", type: "unique", attributes: ["listingId", "position"] },
    ],
    rules: [],
  },
  {
    id: "listing_amenity",
    name: "listing_amenity",
    attrs: [
      uuid("listingId", { required: true }),
      str("amenityId", 64, { required: true }),
    ],
    indexes: [
      { key: "idx_la_unique", type: "unique", attributes: ["listingId", "amenityId"] },
      { key: "idx_la_amenity", type: "key", attributes: ["amenityId"] },
    ],
    rules: [],
  },
  {
    id: "listing_cost",
    name: "listing_cost",
    attrs: [
      uuid("listingId", { required: true }),
      str("code", 64),
      str("label", 200, { required: true }),
      num("amount"),
      str("unit", 100),
      en("state", COST_STATE, { required: true }),
      en("cadence", COST_CADENCE, { required: true }),
      bool("refundable", { required: true }),
      str("note", 500),
      int("position"),
    ],
    indexes: [{ key: "idx_cost_listing", type: "key", attributes: ["listingId"] }],
    rules: ["amount IS NULL implies state='unknown'", "missing cost is never coerced to 0"],
  },
  {
    id: "rental_terms",
    name: "rental_terms",
    attrs: [
      uuid("listingId", { required: true }),
      int("paymentDayOfMonth", { required: true }),
      big("utilitiesIncluded"),
      big("notes"),
      big("neighborhoodNotes"),
      str("distanceToBeach", 200),
    ],
    indexes: [{ key: "idx_terms_listing", type: "unique", attributes: ["listingId"] }],
    rules: ["paymentDayOfMonth 1..28"],
  },
  {
    id: "verification_check",
    name: "verification_check",
    attrs: [
      uuid("listingId", { required: true }),
      en("kind", VERIFICATION_KIND, { required: true }),
      en("status", VERIFICATION_STATUS, { required: true, xdefault: "not-started" }),
      dt("lastUpdated"),
    ],
    indexes: [{ key: "idx_vcheck_unique", type: "unique", attributes: ["listingId", "kind"] }],
    rules: ["represents reviewed evidence only — never granted by automated moderation"],
  },
  {
    id: "moderation_auto",
    name: "moderation_auto",
    attrs: [
      uuid("listingId", { required: true }),
      en("result", MODERATION_RESULT, { required: true }),
      big("checks"),
      big("reasons"),
      bool("duplicateRisk"),
      day("autoReviewedAt"),
    ],
    indexes: [{ key: "idx_modauto_listing", type: "unique", attributes: ["listingId"] }],
    rules: ["Stage 1 — sets listing status only; can NEVER set verification level"],
  },
  {
    id: "moderation_review",
    name: "moderation_review",
    attrs: [
      uuid("listingId", { required: true }),
      uuid("reviewerId", { required: true }),
      en("decision", MODERATION_DECISION, { required: true }),
      big("reason", { required: true }),
      dt("reviewedAt", { required: true }),
    ],
    indexes: [{ key: "idx_modreview_listing", type: "key", attributes: ["listingId", "reviewedAt"] }],
    rules: ["reviewerId must be an Admin — enforced in function"],
  },
  {
    id: "evidence_review",
    name: "evidence_review",
    attrs: [
      uuid("listingId", { required: true }),
      uuid("reviewerId", { required: true }),
      en("decision", EVIDENCE_DECISION, { required: true }),
      big("reason", { required: true }),
      dt("reviewedAt", { required: true }),
    ],
    indexes: [{ key: "idx_evreview_listing", type: "key", attributes: ["listingId", "reviewedAt"] }],
    rules: ["reviewerId must be an Admin", "an approved row here is the prerequisite for basic_verified"],
  },
  {
    id: "evidence_document",
    name: "evidence_document",
    attrs: [
      uuid("listingId", { required: true }),
      uuid("evidenceReviewId"),
      en("kind", EVIDENCE_KIND, { required: true }),
      str("storageRef", 500, { required: true }),
      dt("uploadedAt", { required: true }),
    ],
    indexes: [{ key: "idx_evdoc_listing", type: "key", attributes: ["listingId"] }],
    rules: ["storageRef is an internal reference, never a public URL"],
  },
  {
    id: "evidence_access_log",
    name: "evidence_access_log",
    attrs: [
      uuid("evidenceId", { required: true }),
      uuid("actorId", { required: true }),
      dt("accessedAt", { required: true }),
    ],
    indexes: [
      { key: "idx_evalog_evidence", type: "key", attributes: ["evidenceId", "accessedAt"] },
      { key: "idx_evalog_actor", type: "key", attributes: ["actorId"] },
    ],
    rules: ["append-only", "every evidence open is audited (FR-24)"],
  },
  {
    id: "inquiries",
    name: "inquiries",
    attrs: [
      uuid("listingId", { required: true }),
      uuid("tenantId", { required: true }),
      en("type", INQUIRY_TYPE, { required: true }),
      big("message", { required: true }),
      day("moveInDate"),
      int("durationMonths"),
      big("tenantPreferences"),
      en("status", INQUIRY_STATUS, { required: true, xdefault: "new" }),
      dt("firstRequestedAt"),
      dt("firstRespondedAt"),
      day("scheduledAt"),
      str("preferredTime", 100),
      bool("isSample"),
      str("seedKey", 64),
    ],
    indexes: [
      { key: "idx_inq_listing", type: "key", attributes: ["listingId"] },
      { key: "idx_inq_tenant", type: "key", attributes: ["tenantId"] },
      { key: "idx_inq_status", type: "key", attributes: ["status"] },
      { key: "idx_inq_tenant_listing", type: "key", attributes: ["tenantId", "listingId"] },
      { key: "idx_inq_seed", type: "key", attributes: ["seedKey"] },
    ],
    rules: [
      "tenantId required — guests cannot create inquiries",
      "status forced to 'new' on create",
      "scheduledAt only when type='viewing-request'",
      "five-state lifecycle with BRULE-09 transition guard — enforced in function",
    ],
  },
  {
    id: "inquiry_status_history",
    name: "inquiry_status_history",
    attrs: [
      uuid("inquiryId", { required: true }),
      en("fromStatus", INQUIRY_STATUS),
      en("toStatus", INQUIRY_STATUS, { required: true }),
      uuid("actorId", { required: true }),
      dt("changedAt", { required: true }),
      str("note", 500),
    ],
    indexes: [{ key: "idx_inqhist_inquiry", type: "key", attributes: ["inquiryId", "changedAt"] }],
    rules: ["append-only — never updated or deleted"],
  },
  {
    id: "saved_apartments",
    name: "saved_apartments",
    attrs: [uuid("userId", { required: true }), uuid("listingId", { required: true }), dt("savedAt")],
    indexes: [
      { key: "idx_saved_unique", type: "unique", attributes: ["userId", "listingId"] },
      { key: "idx_saved_user", type: "key", attributes: ["userId"] },
    ],
    rules: [],
  },
  {
    id: "listing_promotion",
    name: "listing_promotion",
    attrs: [
      uuid("listingId", { required: true }),
      en("kind", PROMOTION_KIND, { required: true }),
      uuid("requestedBy", { required: true }),
      uuid("activatedBy"),
      bool("active", { required: true }),
      day("startDate"),
      day("endDate"),
      dt("createdAt"),
      dt("endedAt"),
    ],
    indexes: [{ key: "idx_promo_listing", type: "key", attributes: ["listingId", "kind"] }],
    rules: ["one active promotion per (listing, kind) — enforced in function", "no payment/billing model"],
  },
  {
    id: "reports",
    name: "reports",
    attrs: [
      uuid("listingId", { required: true }),
      uuid("reporterId", { required: true }),
      str("reporterName", 200),
      email("reporterEmail"),
      en("category", REPORT_CATEGORY, { required: true }),
      big("message", { required: true }),
      en("status", REPORT_STATUS, { required: true, xdefault: "open" }),
      uuid("resolvedBy"),
      big("resolutionNote"),
      dt("updatedAt"),
      bool("isSample"),
      str("seedKey", 64),
    ],
    indexes: [
      { key: "idx_reports_status", type: "key", attributes: ["status"] },
      { key: "idx_reports_listing", type: "key", attributes: ["listingId"] },
      { key: "idx_reports_seed", type: "key", attributes: ["seedKey"] },
    ],
    rules: ["reporterId required — authenticated reporters only"],
  },
  {
    id: "notifications",
    name: "notifications",
    attrs: [
      uuid("recipientId", { required: true }),
      uuid("inquiryId"),
      en("type", NOTIFICATION_TYPE, { required: true }),
      big("payload"),
      dt("readAt"),
    ],
    indexes: [
      { key: "idx_notif_recipient", type: "key", attributes: ["recipientId", "readAt"] },
      { key: "idx_notif_inquiry", type: "key", attributes: ["inquiryId"] },
    ],
    rules: ["in-app record only; email/SMS transport is out of scope (D1)"],
  },
  {
    id: "audit_log",
    name: "audit_log",
    attrs: [
      en("actorType", AUDIT_ACTOR_TYPE, { required: true }),
      uuid("actorId"),
      en("action", AUDIT_ACTION, { required: true }),
      str("targetType", 64, { required: true }),
      str("targetId", 64),
      str("targetLabel", 200),
      big("reason"),
      big("oldValues"),
      big("newValues"),
      str("seedKey", 64),
    ],
    indexes: [
      { key: "idx_audit_created", type: "key", attributes: ["$createdAt"] },
      { key: "idx_audit_action", type: "key", attributes: ["action"] },
      { key: "idx_audit_target", type: "key", attributes: ["targetType", "targetId"] },
      { key: "idx_audit_actor", type: "key", attributes: ["actorType", "actorId"] },
      { key: "idx_audit_seed", type: "key", attributes: ["seedKey"] },
    ],
    rules: [
      "append-only + immutable",
      "(actorType='system') = (actorId IS NULL) — automated actions never attributed to an Admin",
    ],
  },
  {
    id: "admin_settings",
    name: "admin_settings",
    attrs: [
      str("singleton", 16, { required: true }),
      int("availabilityGraceDays", { required: true }),
      int("availabilityReminderDays", { required: true }),
      big("featuredFeeConfig"),
      dt("updatedAt"),
    ],
    indexes: [{ key: "idx_settings_singleton", type: "unique", attributes: ["singleton"] }],
    rules: [
      "singleton — exactly one row (singleton='main')",
      "availabilityGraceDays 0..30 (proposed default 3, pending owner confirmation)",
      "availabilityReminderDays 7..30",
      "featuredFeeConfig is config only — no payment table",
    ],
  },
];

export const buckets = [
  {
    id: "evidence",
    name: "evidence",
    permissions: [],
    fileSecurity: true,
    maximumFileSize: 10485760,
    allowedFileExtensions: ["pdf", "jpg", "jpeg", "png", "webp"],
    encryption: true,
    antivirus: true,
  },
];

export function sentinelFor(kind) {
  return SENTINEL;
}

export function isSentinel(v) {
  return v === SENTINEL;
}

// Relationships (Appwrite attributes). Each entry creates ONE relationship;
// with twoWay:true Appwrite creates the matching attribute on the related
// collection automatically. `side:'parent'` = the "one" side.
//
// onDelete:'cascade' is honoured by the runtime on document delete — this is
// the closest Appwrite gets to ON DELETE; there is no RESTRICT mode.
export const relationships = [
  // listings (one) -> listing_image (many)
  { parent: "listings", key: "images", child: "listing_image", childKey: "listing", type: "oneToMany", onDelete: "cascade" },
  // listings (one) -> listing_amenity (many)
  { parent: "listings", key: "amenityLinks", child: "listing_amenity", childKey: "listing", type: "oneToMany", onDelete: "cascade" },
  // listings (one) -> listing_cost (many)
  { parent: "listings", key: "costs", child: "listing_cost", childKey: "listing", type: "oneToMany", onDelete: "cascade" },
  // listings (one) -> inquiries (many)
  { parent: "listings", key: "inquiryLinks", child: "inquiries", childKey: "listing", type: "oneToMany", onDelete: "setNull" },
  // listings (one) -> listing_promotion (many)
  { parent: "listings", key: "promotionLinks", child: "listing_promotion", childKey: "listing", type: "oneToMany", onDelete: "cascade" },
  // listings (one) -> reports (many)
  { parent: "listings", key: "reportLinks", child: "reports", childKey: "listing", type: "oneToMany", onDelete: "setNull" },
  // listings (one) -> evidence_review (many)
  { parent: "listings", key: "evidenceReviews", child: "evidence_review", childKey: "listing", type: "oneToMany", onDelete: "setNull" },
  // inquiries (one) -> inquiry_status_history (many)
  { parent: "inquiries", key: "statusHistory", child: "inquiry_status_history", childKey: "inquiry", type: "oneToMany", onDelete: "cascade" },
  // inquiries (one) -> notifications (many)
  { parent: "inquiries", key: "notificationLinks", child: "notifications", childKey: "inquiry", type: "oneToMany", onDelete: "cascade" },
  // evidence_review (one) -> evidence_document (many)
  { parent: "evidence_review", key: "documents", child: "evidence_document", childKey: "review", type: "oneToMany", onDelete: "setNull" },
];
