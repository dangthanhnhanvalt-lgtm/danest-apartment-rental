export type ID = string;

export type NeighborhoodId = string;

export interface Neighborhood {
  id: NeighborhoodId;
  name: string;
  tagline: string;
  description: string;
  image: string;
  center: GeoPoint;
  lifestyle: string[];
}

export interface GeoPoint {
  lat: number;
  lng: number;
  precision?: "owner-selected" | "approximate";
}

export type ListingType = "apartment" | "studio" | "serviced-apartment" | "penthouse";
export type FurnishingStatus = "furnished" | "semi-furnished" | "unfurnished";
export type Availability = "available" | "reserved" | "unavailable";
export type ListingStatus =
  | "published"
  | "draft"
  | "paused"
  | "pending"
  | "needs-attention"
  | "rejected"
  | "hidden"
  | "archived";

export type AmenityId = string;

export interface Amenity {
  id: AmenityId;
  label: string;
}

/** A fee the landlord has told us about. `reported` means the landlord gave an amount but it has
 *  not yet been confirmed against a utility bill; `unknown` means no figure is available yet. */
export type CostState = "fixed" | "variable" | "reported" | "unknown";

export type CostCadence = "monthly" | "one-time";

export interface CostItem {
  id: string;
  label: string;
  amount: number | null;
  unit: string;
  state: CostState;
  cadence: CostCadence;
  note?: string;
}

export interface RentalCosts {
  monthlyRent: number;
  depositMonths: number;
  depositAmount: number;
  items: CostItem[];
}

export type VerificationStatus = "verified" | "in-review" | "not-started";

export interface VerificationCheck {
  id: "listing-info" | "landlord-identity" | "rental-authorization";
  label: string;
  description: string;
  status: VerificationStatus;
  lastUpdated: string | null;
}

export interface Verification {
  checks: VerificationCheck[];
  lastAvailabilityConfirmed: string | null;
}

export interface RentalTerms {
  minMonths: number;
  maxMonths: number;
  paymentDayOfMonth: number;
  utilitiesIncluded: string[];
  notes: string[];
}

export interface LandlordSummary {
  id: ID;
  displayName: string;
  role: string;
  languages: string[];
  responseTime: string;
  memberSince: string;
}

export type AccountStatus = "pending" | "active" | "rejected" | "suspended";

export interface User {
  id: ID;
  name: string;
  email: string;
  role: "tenant" | "landlord" | "admin";
  avatarInitials: string;
  accountStatus?: AccountStatus;
}

export type ModerationResult = "passed" | "needs-attention" | "rejected" | "incomplete";

export interface ModerationCheck {
  id: "required-info" | "duplicates" | "content" | "pricing" | "images";
  label: string;
  result: ModerationResult;
  detail: string;
}

export interface ListingModeration {
  result: ModerationResult;
  checks: ModerationCheck[];
  reasons: string[];
  duplicateRisk: boolean;
  autoReviewedAt: string | null;
  manualReview: {
    reviewedBy: string;
    reviewedAt: string;
    decision: "approved" | "rejected" | "corrections-requested" | "hidden" | "restored";
    reason: string;
  } | null;
}

export interface AdminUser {
  id: ID;
  name: string;
  email: string;
  role: "tenant" | "landlord" | "admin";
  status: AccountStatus;
  approvedAt?: string | null;
  joinedAt: string;
  listings: number;
  inquiries: number;
  isSample: boolean;
}

export interface Report {
  id: ID;
  listingId: ID;
  reporterName: string;
  reporterEmail: string;
  category: "inaccurate" | "hidden-fees" | "duplicate" | "misleading-photos" | "other";
  message: string;
  status: "open" | "resolved" | "unresolved";
  createdAt: string;
  resolvedBy: string | null;
  resolutionNote: string | null;
}

export interface AdminSettings {
  availabilityGraceDays: number;
  availabilityReminderDays: number;
}

export interface AuditLogEntry {
  id: ID;
  action: string;
  oldValues?: unknown;
  newValues?: unknown;
  isSeeded?: boolean;
  actor: string;
  target: string;
  reason: string;
  createdAt: string;
}

export interface Listing {
  id: ID;
  slug: string;
  title: string;
  summary: string;
  description: string;
  neighborhood: NeighborhoodId;
  address: string;
  location: GeoPoint;
  type: ListingType;
  monthlyRent: number;
  bedrooms: number;
  bathrooms: number;
  floorArea: number;
  floorLevel: string;
  furnishing: FurnishingStatus;
  amenities: AmenityId[];
  availability: Availability;
  availableFrom: string;
  rentalDurationMonths: [number, number];
  images: string[];
  imageRecords?: { id: string; url: string | null }[];
  verification: Verification;
  verificationBadge: boolean;
  costs: RentalCosts;
  rentalTerms: RentalTerms;
  neighborhoodNotes: string[];
  distanceToBeach: string;
  landlordId: ID;
  landlord: LandlordSummary;
  status: ListingStatus;
  moderation: ListingModeration;
  lastAvailabilityConfirmedAt: string;
  availabilityReminderSentAt: string | null;
  availabilityHiddenAt?: string | null;
  featured: boolean;
  sponsored: boolean;
  listedAt: string;
  updatedAt?: string;
  views: number;
  inquiries: number;
  isSample: boolean;
}

export interface ListingFilters {
  q?: string;
  neighborhoods: NeighborhoodId[];
  minRent: number;
  maxRent: number;
  duration: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  types: ListingType[];
  furnishing: FurnishingStatus | null;
  amenities: AmenityId[];
  verifiedOnly: boolean;
  availability: Availability | null;
  checkIn: string | null;
}

export type SortKey = "recommended" | "price-asc" | "price-desc" | "newest" | "updated-asc" | "updated-desc";

export interface ListingQuery extends Partial<ListingFilters> {
  sort?: SortKey;
  landlordId?: ID;
  ids?: ID[];
  limit?: number;
}

/** BRD FR-31 five-state inquiry lifecycle. */
export type InquiryStatus = "new" | "replied" | "viewing_scheduled" | "rented" | "not_proceeding";

export interface Inquiry {
  id: ID;
  listingId: ID;
  tenantId?: ID | null;
  tenantName: string;
  tenantEmail: string;
  type: "question" | "viewing-request";
  message: string;
  moveInDate: string | null;
  durationMonths: number | null;
  tenantPreferences: string[];
  status: InquiryStatus;
  createdAt: string;
  updatedAt?: string | null;
  scheduledAt?: string | null;
  preferredTime?: string | null;
  /** Landlord's proposed alternative viewing time, if any. */
  proposedAt?: string | null;
  proposedTime?: string | null;
  firstRequestedAt?: string | null;
  firstRespondedAt?: string | null;
}

/** Append-only inquiry status change history (FR-31). Demo/localStorage only. */
export interface InquiryStatusEvent {
  id: ID;
  inquiryId: ID;
  fromStatus: InquiryStatus | null;
  toStatus: InquiryStatus;
  actor: string;
  note: string | null;
  changedAt: string;
}

export type ViewingRequest = Inquiry;

export interface SavedApartment {
  listingId: ID;
  savedAt: string;
}

export interface Session {
  user: User;
  isDemo: boolean;
}

export interface ListingDraft {
  title: string;
  summary: string;
  description: string;
  neighborhood: NeighborhoodId | "";
  address: string;
  monthlyRent: string;
  depositMonths: string;
  bedrooms: string;
  bathrooms: string;
  floorArea: string;
  furnishing: FurnishingStatus | "";
  amenities: AmenityId[];
  minMonths: string;
  maxMonths: string;
  availableFrom: string;
  images: string[];
  type?: ListingType;
  location?: GeoPoint;
  floorLevel?: string;
  availability?: Availability;
  paymentDay?: string;
  rentalNotes?: string;
  extraCosts: { label: string; amount: string; state: CostState; unit?: string; cadence?: CostCadence }[];
}

export interface ListingModerationOverride {
  listingId: ID;
  moderation: ListingModeration;
}
