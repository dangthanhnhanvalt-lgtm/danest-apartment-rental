import { SAMPLE_LANDLORDS } from "~/data/listings";
import type { AdminUser, AuditLogEntry, Listing, Report } from "~/types";

/** Admin-only sample records. They are intentionally kept out of the public marketing listings and
 *  are labelled as sample data wherever they appear. */

const landlordLinh = SAMPLE_LANDLORDS[1];
const landlordMinh = SAMPLE_LANDLORDS[2];

const baseListing = {
  availability: "available" as const,
  availableFrom: "2026-12-15",
  floorLevel: "2nd floor",
  neighborhoodNotes: ["Sample record for the admin prototype."],
  distanceToBeach: "1.0 km to My Khe Beach",
  isSample: true,
  featured: false,
  sponsored: false,
  views: 0,
  inquiries: 0,
  rentalTerms: {
    minMonths: 1,
    maxMonths: 12,
    paymentDayOfMonth: 1,
    utilitiesIncluded: [],
    notes: ["Sample data for the moderation queue."],
  },
};

const pendingListing: Listing = {
  ...baseListing,
  id: "lst-admin-01",
  slug: "seaview-two-bed-pending",
  title: "Sea-View Two-Bedroom on Vo Nguyen Giap",
  summary: "Newly listed apartment with a wide balcony and direct sea views.",
  description:
    "A bright two-bedroom on the eighth floor facing the sea, with a wide balcony, a full kitchen and air-conditioning in both bedrooms. The building has an elevator and covered parking. The landlord asks for a passport copy at the viewing.",
  neighborhood: "an-thuong",
  address: "Vo Nguyen Giap 286, Ngu Hanh Son District, Da Nang",
  location: { lat: 16.0534, lng: 108.2488 },
  type: "apartment",
  monthlyRent: 680,
  bedrooms: 2,
  bathrooms: 2,
  floorArea: 64,
  furnishing: "furnished",
  amenities: ["wifi", "air-conditioning", "kitchen", "balcony", "elevator", "parking", "sea-view"],
  rentalDurationMonths: [1, 12],
  images: ["/images/l3.jpg", "/images/l9.jpg", "/images/l1.jpg"],
  verification: {
    checks: [
      { id: "listing-info", label: "Listing information", description: "Rent, size, layout and amenities checked against the landlord's documentation.", status: "in-review", lastUpdated: "2026-11-13" },
      { id: "landlord-identity", label: "Landlord identity", description: "Government ID matched to the property documents on file.", status: "not-started", lastUpdated: null },
      { id: "rental-authorization", label: "Rental authorization", description: "Confirmation that the landlord is allowed to rent the apartment on a monthly basis.", status: "not-started", lastUpdated: null },
    ],
    lastAvailabilityConfirmed: "2026-11-13",
  },
  verificationBadge: false,
  costs: {
    monthlyRent: 680,
    depositMonths: 2,
    depositAmount: 1360,
    items: [
      { id: "electricity", label: "Electricity", amount: 60, unit: "per month, estimated", state: "reported", cadence: "monthly" },
      { id: "water", label: "Water", amount: 8, unit: "per month, estimated", state: "reported", cadence: "monthly" },
      { id: "internet", label: "Internet", amount: 12, unit: "per month", state: "fixed", cadence: "monthly" },
      { id: "management", label: "Building management fee", amount: 20, unit: "per month", state: "fixed", cadence: "monthly" },
    ],
  },
  landlordId: landlordLinh.id,
  landlord: landlordLinh,
  status: "pending",
  moderation: {
    result: "passed",
    checks: [
      { id: "required-info", label: "Required information", result: "passed", detail: "Every required field is filled in." },
      { id: "duplicates", label: "Duplicate detection", result: "passed", detail: "No similar address, title or cover photo found." },
      { id: "content", label: "Content screening", result: "passed", detail: "No prohibited or misleading wording detected." },
      { id: "pricing", label: "Pricing sanity", result: "passed", detail: "Rent sits inside the range for this neighbourhood." },
      { id: "images", label: "Image relevance", result: "passed", detail: "Photos look consistent with the listing description." },
    ],
    reasons: [],
    duplicateRisk: false,
    autoReviewedAt: "2026-11-13",
    manualReview: null,
  },
  lastAvailabilityConfirmedAt: "2026-11-13",
  availabilityReminderSentAt: null,
  listedAt: "2026-11-13",
};

const rejectedListing: Listing = {
  ...pendingListing,
  id: "lst-admin-02",
  slug: "guaranteed-cheap-studio",
  title: "GUARANTEED APPROVAL STUDIO!!",
  summary: "Cheap studio with no documents needed.",
  description:
    "Guaranteed approval for anyone, cash only, no contract. Very cheap studio near the beach. Message now for this luxury for cheap offer.",
  neighborhood: "my-an",
  address: "My An 3, Ngu Hanh Son District, Da Nang",
  location: { lat: 16.0443, lng: 108.2422 },
  monthlyRent: 140,
  bedrooms: 1,
  bathrooms: 1,
  floorArea: 24,
  images: ["/images/l10.jpg", "/images/l2.jpg"],
  landlordId: landlordMinh.id,
  landlord: landlordMinh,
  status: "rejected",
  moderation: {
    result: "rejected",
    checks: [
      { id: "required-info", label: "Required information", result: "passed", detail: "Every required field is filled in." },
      { id: "duplicates", label: "Duplicate detection", result: "passed", detail: "No similar listing found." },
      { id: "content", label: "Content screening", result: "rejected", detail: 'Prohibited wording found: "guaranteed approval".' },
      { id: "pricing", label: "Pricing sanity", result: "needs-attention", detail: "$140 is far from the usual range for My An ($220–$2600)." },
      { id: "images", label: "Image relevance", result: "passed", detail: "Photos look consistent with the listing description." },
    ],
    reasons: [
      'Remove prohibited wording: "guaranteed approval". Listings may not promise approval or skip a contract.',
      "The rent looks unusual for this area. Double-check the figure.",
    ],
    duplicateRisk: false,
    autoReviewedAt: "2026-11-09",
    manualReview: null,
  },
  lastAvailabilityConfirmedAt: "2026-11-09",
  listedAt: "2026-11-09",
};

const needsAttentionListing: Listing = {
  ...pendingListing,
  id: "lst-admin-03",
  slug: "river-loft-copy",
  title: "River-View Loft Near the Dragon Bridge (copy)",
  summary: "The same loft as another listing, submitted again by a different landlord.",
  description:
    "A one-bedroom loft with a full wall of glass facing the Han River, an open kitchen and a living space that suits someone working from home. The riverfront promenade is directly below the building and the night market is nearby.",
  neighborhood: "han-river",
  address: "Bach Dang Riverside, Hai Chau District, Da Nang",
  location: { lat: 16.0615, lng: 108.2281 },
  monthlyRent: 720,
  bedrooms: 1,
  bathrooms: 1,
  floorArea: 54,
  images: ["/images/l7.jpg", "/images/l4.jpg"],
  landlordId: landlordLinh.id,
  landlord: landlordLinh,
  status: "needs-attention",
  moderation: {
    result: "needs-attention",
    checks: [
      { id: "required-info", label: "Required information", result: "passed", detail: "Every required field is filled in." },
      { id: "duplicates", label: "Duplicate detection", result: "needs-attention", detail: 'Similar to "River-View Loft Near the Dragon Bridge" (address, title or cover photo).' },
      { id: "content", label: "Content screening", result: "passed", detail: "No prohibited or misleading wording detected." },
      { id: "pricing", label: "Pricing sanity", result: "passed", detail: "Rent sits inside the range for this neighbourhood." },
      { id: "images", label: "Image relevance", result: "passed", detail: "Photos look consistent with the listing description." },
    ],
    reasons: ['This may duplicate "River-View Loft Near the Dragon Bridge". A duplicate is flagged for review, never rejected automatically.'],
    duplicateRisk: true,
    autoReviewedAt: "2026-11-12",
    manualReview: null,
  },
  lastAvailabilityConfirmedAt: "2026-11-12",
  listedAt: "2026-11-12",
};

const incompleteListing: Listing = {
  ...pendingListing,
  id: "lst-admin-04",
  slug: "unfinished-studio-son-tra",
  title: "Studio in Son Tra",
  summary: "",
  description: "Studio close to the beach.",
  neighborhood: "son-tra",
  address: "",
  location: { lat: 16.0741, lng: 108.2412 },
  monthlyRent: 420,
  bedrooms: 1,
  bathrooms: 1,
  floorArea: 0,
  images: [],
  landlordId: landlordMinh.id,
  landlord: landlordMinh,
  status: "draft",
  moderation: {
    result: "incomplete",
    checks: [
      { id: "required-info", label: "Required information", result: "incomplete", detail: "Missing: a description of at least 40 characters, the street address, the floor area, at least one photo." },
      { id: "duplicates", label: "Duplicate detection", result: "passed", detail: "No similar listing found." },
      { id: "content", label: "Content screening", result: "passed", detail: "No prohibited or misleading wording detected." },
      { id: "pricing", label: "Pricing sanity", result: "passed", detail: "Rent sits inside the range for this neighbourhood." },
      { id: "images", label: "Image relevance", result: "incomplete", detail: "No photos provided." },
    ],
    reasons: ["Please complete: a description of at least 40 characters, the street address, the floor area, at least one photo."],
    duplicateRisk: false,
    autoReviewedAt: "2026-11-11",
    manualReview: null,
  },
  lastAvailabilityConfirmedAt: "2026-11-11",
  listedAt: "2026-11-11",
};

export const ADMIN_SAMPLE_LISTINGS: Listing[] = [pendingListing, rejectedListing, needsAttentionListing, incompleteListing];

export const ADMIN_SAMPLE_USERS: AdminUser[] = [
  { id: "usr-sofia", name: "Sofia Almeida", email: "sofia.almeida@example.com", role: "tenant", status: "active", joinedAt: "2026-10-21", listings: 0, inquiries: 2, isSample: true },
  { id: "usr-james", name: "James Whitfield", email: "j.whitfield@example.com", role: "tenant", status: "active", joinedAt: "2026-09-08", listings: 0, inquiries: 1, isSample: true },
  { id: "usr-aiko", name: "Aiko Tanaka", email: "aiko.tanaka@example.com", role: "tenant", status: "active", joinedAt: "2026-09-15", listings: 0, inquiries: 1, isSample: true },
  { id: "usr-marco", name: "Marco Rossi", email: "marco.rossi@example.com", role: "tenant", status: "suspended", joinedAt: "2026-08-02", listings: 0, inquiries: 4, isSample: true },
  { id: "usr-an", name: "An Nguyen", email: "an.nguyen@example.com", role: "landlord", status: "active", joinedAt: "2023-03-02", listings: 4, inquiries: 9, isSample: true },
  { id: "usr-linh", name: "Linh Tran", email: "linh.tran@example.com", role: "landlord", status: "active", joinedAt: "2022-08-14", listings: 4, inquiries: 7, isSample: true },
  { id: "usr-minh", name: "Minh Pham", email: "minh.pham@example.com", role: "landlord", status: "active", joinedAt: "2024-01-20", listings: 3, inquiries: 5, isSample: true },
  { id: "usr-emma", name: "Emma de Vries", email: "emma.devries@example.com", role: "tenant", status: "active", joinedAt: "2026-11-04", listings: 0, inquiries: 1, isSample: true },
];

export const ADMIN_SAMPLE_REPORTS: Report[] = [
  {
    id: "rpt-001",
    listingId: "lst-007",
    reporterName: "Sofia Almeida",
    reporterEmail: "sofia.almeida@example.com",
    category: "hidden-fees",
    message:
      "The listing says electricity is billed by the building but the amount shows as confirmed. When I viewed it the landlord quoted a much higher meter rate than stated.",
    status: "open",
    createdAt: "2026-11-10",
    resolvedBy: null,
    resolutionNote: null,
  },
  {
    id: "rpt-002",
    listingId: "lst-admin-03",
    reporterName: "Minh Pham",
    reporterEmail: "minh.pham@example.com",
    category: "duplicate",
    message: "I believe this is the same apartment as the River-View Loft listed earlier by another landlord.",
    status: "open",
    createdAt: "2026-11-12",
    resolvedBy: null,
    resolutionNote: null,
  },
  {
    id: "rpt-003",
    listingId: "lst-005",
    reporterName: "James Whitfield",
    reporterEmail: "j.whitfield@example.com",
    category: "inaccurate",
    message: "The listing says it is available but I was told it is reserved for longer.",
    status: "resolved",
    createdAt: "2026-10-28",
    resolvedBy: "Admin (demo)",
    resolutionNote: "Availability was reconfirmed by the landlord and the reserved state is clearly shown.",
  },
];

export const ADMIN_SAMPLE_AUDIT: AuditLogEntry[] = [
  { id: "aud-001", action: "listing-approved", actor: "Admin (demo)", target: "Sunlit Two-Bedroom Steps from My Khe", reason: "Requirements met and evidence reviewed.", createdAt: "2026-11-10T09:14:00" },
  { id: "aud-002", action: "listing-rejected", actor: "Admin (demo)", target: "GUARANTEED APPROVAL STUDIO!!", reason: "Prohibited wording and implausible rent.", createdAt: "2026-11-09T15:42:00" },
  { id: "aud-003", action: "account-suspended", actor: "Admin (demo)", target: "Marco Rossi", reason: "Repeated spam inquiries.", createdAt: "2026-11-08T11:05:00" },
  { id: "aud-004", action: "report-resolved", actor: "Admin (demo)", target: "Beachfront One-Bedroom with Sea View", reason: "Availability reconfirmed by landlord.", createdAt: "2026-10-29T10:20:00" },
];
