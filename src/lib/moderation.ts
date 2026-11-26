import { LISTING_TYPE_LABEL, NEIGHBORHOOD_LABEL } from "~/data/constants";
import type { Listing, ListingDraft, ListingModeration, ModerationCheck, ModerationResult } from "~/types";
import { todayISO } from "~/lib/format";

/**
 * Simulated automated moderation for the DaNest prototype.
 *
 * These checks look only at the information the landlord typed in. They do NOT read documents,
 * prove ownership, authenticate IDs or verify anything against an external service. Only checks
 * an admin has actually reviewed may ever set the verified badge elsewhere in the app.
 */

const PROHIBITED = [
  "guaranteed approval",
  "no documents",
  "cash only, no contract",
  "cash only no contract",
  "100% verified",
  "official owner",
  "under the table",
];

const MISLEADING = [
  "luxury for cheap",
  "views maybe",
  "best price guaranteed",
  "definitely quiet",
];

const MIN_RENT: Record<string, number> = {
  "an-thuong": 250,
  "my-an": 220,
  "son-tra": 200,
  "han-river": 200,
};

const MAX_RENT: Record<string, number> = {
  "an-thuong": 3000,
  "my-an": 2600,
  "son-tra": 3000,
  "han-river": 3500,
};

function normalise(text: string): string {
  return text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function similarity(a: string, b: string): number {
  const wordsA = new Set(normalise(a).split(" ").filter((w) => w.length > 2));
  const wordsB = new Set(normalise(b).split(" ").filter((w) => w.length > 2));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  let shared = 0;
  wordsA.forEach((w) => {
    if (wordsB.has(w)) shared += 1;
  });
  return shared / Math.min(wordsA.size, wordsB.size);
}

function check(id: ModerationCheck["id"], label: string, result: ModerationResult, detail: string): ModerationCheck {
  return { id, label, result, detail };
}

export interface ModerationInput {
  title: string;
  summary: string;
  description: string;
  neighborhood: string;
  address: string;
  monthlyRent: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  floorArea: number | null;
  images: string[];
  availableFrom: string;
  depositMonths: number | null;
  feesProvided: boolean;
}

const PLACEHOLDER_IMAGE = /(placeholder|lorem|via\.placeholder|dummyimage|example\.com)/i;

export function runModeration(
  input: ModerationInput,
  existing: Listing[],
  selfId?: string,
): ListingModeration {
  const checks: ModerationCheck[] = [];
  const reasons: string[] = [];

  const missing: string[] = [];
  if (input.title.trim().length < 8) missing.push("a listing title of at least 8 characters");
  if (input.description.trim().length < 40) missing.push("a description of at least 40 characters");
  if (!input.monthlyRent || input.monthlyRent <= 0) missing.push("the monthly rent");
  if (!input.neighborhood) missing.push("the neighborhood");
  if (!input.address.trim()) missing.push("the street address");
  if (!input.bedrooms || input.bedrooms < 1) missing.push("the number of bedrooms");
  if (!input.bathrooms || input.bathrooms < 1) missing.push("the number of bathrooms");
  if (!input.floorArea || input.floorArea <= 0) missing.push("the floor area");
  if (input.images.length === 0) missing.push("at least one photo");
  if (!input.availableFrom) missing.push("the available-from date");
  if (input.depositMonths === null || Number.isNaN(input.depositMonths)) missing.push("the deposit amount");

  checks.push(
    missing.length === 0
      ? check("required-info", "Required information", "passed", "Every required field is filled in.")
      : check("required-info", "Required information", "incomplete", `Missing: ${missing.join(", ")}.`),
  );
  if (missing.length > 0) reasons.push(`Please complete: ${missing.join(", ")}.`);

  const haystack = `${input.title} ${input.summary} ${input.description}`.toLowerCase();
  const prohibitedHits = PROHIBITED.filter((p) => haystack.includes(p));
  const misleadingHits = MISLEADING.filter((p) => haystack.includes(p));
  const shouty = (input.title.match(/!/g) ?? []).length >= 2 || input.title === input.title.toUpperCase();
  if (prohibitedHits.length > 0) {
    checks.push(check("content", "Content screening", "rejected", `Prohibited wording found: "${prohibitedHits[0]}".`));
    reasons.push(`Remove prohibited wording: "${prohibitedHits[0]}". Listings may not promise approval or skip a contract.`);
  } else if (misleadingHits.length > 0 || shouty) {
    checks.push(check("content", "Content screening", "needs-attention", misleadingHits.length > 0 ? `Potentially misleading wording: "${misleadingHits[0]}".` : "Title uses all-capitals or repeated exclamation marks."));
    reasons.push(misleadingHits.length > 0 ? `Reword the claim "${misleadingHits[0]}" so it can be checked.` : "Use a normal title instead of all capitals or repeated exclamation marks.");
  } else {
    checks.push(check("content", "Content screening", "passed", "No prohibited or misleading wording detected."));
  }

  const neighbourhoodKey = input.neighborhood;
  const min = MIN_RENT[neighbourhoodKey] ?? 200;
  const max = MAX_RENT[neighbourhoodKey] ?? 3000;
  if (input.monthlyRent && input.monthlyRent > 0) {
    if (input.monthlyRent > max * 1.6 || (input.monthlyRent < min * 0.5 && input.monthlyRent > 0)) {
      checks.push(check("pricing", "Pricing sanity", "needs-attention", `$${input.monthlyRent} is far from the usual range for ${NEIGHBORHOOD_LABEL[neighbourhoodKey as keyof typeof NEIGHBORHOOD_LABEL] ?? "this area"} ($${min}–$${max}).`));
      reasons.push("The rent looks unusual for this area. Double-check the figure and explain anything that justifies it.");
    } else if (input.monthlyRent < min || input.monthlyRent > max) {
      checks.push(check("pricing", "Pricing sanity", "needs-attention", `Rent sits slightly outside the usual $${min}–$${max} range for this area.`));
      reasons.push("Rent is outside the typical range for this area. Add a short note in the description if that is intentional.");
    } else {
      checks.push(check("pricing", "Pricing sanity", "passed", "Rent sits inside the range for this neighbourhood."));
    }
  } else {
    checks.push(check("pricing", "Pricing sanity", "incomplete", "No rent provided."));
  }

  const placeholderImages = input.images.filter((src) => PLACEHOLDER_IMAGE.test(src));
  const mentions = input.images.length;
  if (placeholderImages.length > 0) {
    checks.push(check("images", "Image relevance", "needs-attention", "One or more photos look like placeholders rather than property photos."));
    reasons.push("Replace placeholder images with real photos of the apartment.");
  } else if (mentions > 0 && input.floorArea && input.floorArea < 25 && input.bedrooms && input.bedrooms >= 3) {
    checks.push(check("images", "Image relevance", "needs-attention", "A three-bedroom layout in less than 25 m² is inconsistent with the usual photos of this size."));
    reasons.push("The number of bedrooms and the floor area do not match. Check the measurements.");
  } else {
    checks.push(check("images", "Image relevance", "passed", "Photos are the apartment's own images from the listing."));
  }

  const addressKey = normalise(input.address);
  const cover = input.images[0] ?? "";
  const others = existing.filter((l) => l.id !== selfId && l.status !== "archived");
  const duplicateMatches = others.filter((l) => {
    const sameAddress = addressKey.length > 8 && normalise(l.address) === addressKey;
    const similarTitle = similarity(input.title, l.title) >= 0.75;
    const sameCover = cover.length > 0 && l.images[0] === cover;
    return sameAddress || (similarTitle && sameCover) || (similarTitle && sameAddress);
  });
  const duplicateRisk = duplicateMatches.length > 0;
  checks.push(
    duplicateRisk
      ? check("duplicates", "Duplicate detection", "needs-attention", `Similar to "${duplicateMatches[0].title}" (address, title or cover photo).`)
      : check("duplicates", "Duplicate detection", "passed", "No similar address, title or cover photo found."),
  );
  if (duplicateRisk) reasons.push(`This may duplicate "${duplicateMatches[0].title}". A duplicate is flagged for review, never rejected automatically.`);

  if (input.monthlyRent && input.monthlyRent > 0 && !input.feesProvided) {
    checks.push(check("required-info", "Required information", "incomplete", "Deposit or additional fees are not complete."));
  }

  let result: ModerationResult = "passed";
  if (missing.length > 0) result = "incomplete";
  else if (checks.some((c) => c.result === "rejected")) result = "rejected";
  else if (checks.some((c) => c.result === "needs-attention")) result = "needs-attention";

  return {
    result,
    checks,
    reasons,
    duplicateRisk,
    autoReviewedAt: todayISO(),
    manualReview: null,
  };
}

export function moderationFromListing(listing: Listing): ModerationInput {
  return {
    title: listing.title,
    summary: listing.summary,
    description: listing.description,
    neighborhood: listing.neighborhood,
    address: listing.address,
    monthlyRent: listing.monthlyRent,
    bedrooms: listing.bedrooms,
    bathrooms: listing.bathrooms,
    floorArea: listing.floorArea,
    images: listing.images,
    availableFrom: listing.availableFrom,
    depositMonths: listing.costs.depositMonths,
    feesProvided: listing.costs.items.every((i) => i.amount !== null || i.state === "unknown"),
  };
}

export function moderationInputFromDraft(draft: ListingDraft): ModerationInput {
  return {
    title: draft.title,
    summary: draft.summary,
    description: draft.description,
    neighborhood: draft.neighborhood,
    address: draft.address,
    monthlyRent: draft.monthlyRent ? Number(draft.monthlyRent) : null,
    bedrooms: draft.bedrooms ? Number(draft.bedrooms) : null,
    bathrooms: draft.bathrooms ? Number(draft.bathrooms) : null,
    floorArea: draft.floorArea ? Number(draft.floorArea) : null,
    images: draft.images,
    availableFrom: draft.availableFrom,
    depositMonths: draft.depositMonths ? Number(draft.depositMonths) : null,
    feesProvided: draft.extraCosts.every((c) => c.amount.trim().length > 0 || c.state === "unknown"),
  };
}

export const MODERATION_LABEL: Record<ModerationResult, string> = {
  passed: "Passed automated checks",
  "needs-attention": "Needs attention",
  rejected: "Rejected",
  incomplete: "Incomplete",
};

export const MODERATION_DESCRIPTION: Record<ModerationResult, string> = {
  passed: "Every automated check passed. Publication still follows the platform's verification rules.",
  "needs-attention": "Some details are inconsistent or might be duplicated. An admin reviews these before publication.",
  rejected: "The listing breaks a clear platform requirement and cannot be published as written.",
  incomplete: "Required information is missing. Complete the listing and submit it again.",
};

export function statusForModeration(result: ModerationResult): Listing["status"] {
  if (result === "passed") return "published";
  if (result === "needs-attention") return "needs-attention";
  if (result === "rejected") return "rejected";
  return "draft";
}

export function listingTypeLabel(listing: Listing): string {
  return LISTING_TYPE_LABEL[listing.type];
}
