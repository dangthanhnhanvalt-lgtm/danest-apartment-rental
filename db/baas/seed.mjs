#!/usr/bin/env node
// Seed the Backend Hub `main` database with the existing DaNest demo data.
//
//   node db/baas/seed.mjs            # deterministic upsert (idempotent)
//   node db/baas/seed.mjs --reset     # SAFELY delete every demo doc, then exit
//   node db/baas/seed.mjs --verify    # read-only: verify seeded state by id
//
// Reads db/baas/demo-data.json (produced by extract-demo.mjs) and writes:
// neighborhoods, amenities, users_profile + landlord_profiles, listings + all
// child rows, verification/moderation/evidence, inquiries + initial history,
// promotions (from featured/sponsored), reports, audit rows, settings.
//
// IDEMPOTENCY: every document uses an explicit DETERMINISTIC id derived from
// the source id (e.g. listing "lst-001" -> "lst-001"; a child ->
// "lst-001-img-0"). We check existence with a direct GET by id, then create or
// update that exact id. Running twice never duplicates and never touches
// unrelated ids.
//
// This fork's REST API ignores equal() filters and offset pagination, so the
// seed and reset NEVER rely on them. Reset enumerates via pageAllDocuments()
// and deletes by id, asserting each collection reaches zero.
//
// Legacy->schema mapping:
//   listing.status  published->visible, pending->pending_review,
//                   needs-attention->needs_correction, rejected->rejected, draft->draft
//   inquiry.status  accepted->viewing_scheduled, declined->not_proceeding
//   verificationBadge true -> verificationLevel='basic_verified' WITH an approved
//                             evidence_review + evidence_document written FIRST
//   featured/sponsored -> one active listing_promotion per (listing, kind)

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  api,
  getDocument,
  upsertById,
  deleteById,
  pageAllDocuments,
  countDocuments,
} from "./lib/database.mjs";

const args = new Set(process.argv.slice(2));
const RESET = args.has("--reset");
const VERIFY = args.has("--verify");
const ROOT = process.cwd();
const data = JSON.parse(readFileSync(join(ROOT, "db", "baas", "demo-data.json"), "utf8"));

const OWNER = "demo-admin-danest"; // stable uid for the admin_danest seed account
const PASSWORD = "DemoPass!2026";

const LISTING_STATUS = {
  published: "visible",
  draft: "draft",
  pending: "pending_review",
  "needs-attention": "needs_correction",
  rejected: "rejected",
  hidden: "temp_hidden",
  archived: "temp_hidden",
};
const INQUIRY_STATUS = {
  new: "new",
  replied: "replied",
  accepted: "viewing_scheduled",
  declined: "not_proceeding",
};

const json = (v) => (v == null ? null : JSON.stringify(v));
const iso = (v) => (v ? new Date(v).toISOString() : null);
const day = (v) => (v ? String(v).slice(0, 10) : null);
const now = () => new Date().toISOString();

// Explicit success accounting: counts reflect writes the API confirmed by
// returning the expected id — never just "attempted".
const stats = { created: 0, updated: 0, unchanged: 0, failed: 0, byCollection: {} };
function record(collection, outcome) {
  stats[outcome] += 1;
  const c = (stats.byCollection[collection] ||= { created: 0, updated: 0, unchanged: 0, failed: 0 });
  c[outcome] += 1;
}

// Deterministic, valid Appwrite document id (a-z A-Z 0-9 . - _, <=36 chars).
// We keep original ids where they are already valid (e.g. "lst-001").
function docId(...parts) {
  const raw = parts.join("-").toLowerCase();
  let id = raw.replace(/[^a-z0-9.\-_]/g, "").replace(/^[-_.]+/, "").slice(0, 36);
  if (!id) id = "doc";
  return id;
}

// Upsert by exact deterministic id; verifies the returned id matches.
async function put(collection, id, dataObj, permissions = ['read("any")']) {
  const expected = id;
  const { created, doc } = await upsertById(collection, expected, dataObj, permissions);
  if (!doc || doc.$id !== expected) {
    stats.failed += 1;
    throw new Error(
      `Write mismatch on ${collection}: expected id ${expected}, got ${doc && doc.$id}`,
    );
  }
  record(collection, created ? "created" : "updated");
  return doc;
}

// Convenience wrappers preserving readable call sites.
//   putBySeed(coll, seedKey, data)      -> id = docId(seedKey)
//   putByKey(coll, keyAttr, keyVal, data) -> id = docId(keyAttr, keyVal)
const putBySeed = (collection, seedKey, dataObj, perms) =>
  put(collection, docId(seedKey), dataObj, perms);
const putByKey = (collection, keyAttr, keyVal, dataObj, perms) =>
  put(collection, docId(keyAttr, keyVal), dataObj, perms);

async function ensureUser(uid, email, name, role, status) {
  try {
    await api.createUser({ userId: uid, email, password: PASSWORD, name });
  } catch (e) {
    if (e.status !== 409) throw e; // 409 = already exists, keep it
  }
  return putBySeed("users_profile", `user:${uid}`, {
    userId: uid,
    email,
    name,
    role,
    status,
    approvedBy: role === "landlord" || role === "admin" ? OWNER : null,
    approvedAt: role === "landlord" ? now() : null,
    termsAcceptedAt: now(),
    avatarInitials: (name || "?").replace(/[^A-Za-z]/g, "").slice(0, 2).toUpperCase() || "??",
    isSample: true,
    seedKey: `user:${uid}`,
  });
}

// Collections written by the seed (all demo data). Ordered children-first for
// safe deletion. Every one of these is enumerated and emptied by --reset.
const SEEDED_COLLECTIONS = [
  "inquiry_status_history",
  "evidence_access_log",
  "evidence_document",
  "evidence_review",
  "moderation_review",
  "moderation_auto",
  "verification_check",
  "listing_image",
  "listing_amenity",
  "listing_cost",
  "rental_terms",
  "saved_apartments",
  "listing_promotion",
  "notifications",
  "inquiries",
  "reports",
  "audit_log",
  "listings",
  "landlord_profiles",
  "users_profile",
  "neighborhoods",
  "amenities",
  "admin_settings",
];

async function resetSeeded() {
  console.log("Reset: deleting every demo document (drain page by page)…");
  let removed = 0;
  for (const t of SEEDED_COLLECTIONS) {
    let perCollection = 0;
    // The API returns at most 25 docs and ignores offset, but deleting the
    // current page shifts the next page into view — so we drain until total=0.
    for (let guard = 0; guard < 500; guard++) {
      const { docs, total } = await pageAllDocuments(t);
      if (total === 0 || docs.length === 0) break;
      for (const doc of docs) {
        const r = await deleteById(t, doc.$id);
        if (r.deleted) {
          removed += 1;
          perCollection += 1;
        }
      }
    }
    const after = await countDocuments(t);
    if (after !== 0) {
      throw new Error(`Reset failed: ${t} still has ${after} document(s) after delete.`);
    }
    console.log(`  ${t.padEnd(24)} removed ${perCollection}, now 0`);
  }
  console.log(`Reset complete: ${removed} document(s) removed.`);
}

// --- Reference data ---
async function seedRun() {
  for (const n of data.neighborhoods) {
    await putByKey("neighborhoods", "neighborhoodId", n.id, {
      neighborhoodId: n.id,
      name: n.name,
      tagline: n.tagline || "",
      description: n.description || "",
      imagePath: n.image || "",
      lat: n.center?.lat ?? null,
      lng: n.center?.lng ?? null,
      lifestyle: json(n.lifestyle || []),
    });
  }
  for (const a of data.amenities) {
    await putByKey("amenities", "amenityId", a.id, { amenityId: a.id, label: a.label });
  }

  // --- Users: admin + landlords + sample renters ---
  await ensureUser(OWNER, "admin.demo@danest.example", "DaNest Admin (sample)", "admin", "active");

  const landlordUid = {}; // demo landlord id (ld-an) -> Appwrite uid
  for (const ll of data.landlords) {
    const uid = `user-${ll.id}`;
    landlordUid[ll.id] = uid;
    await ensureUser(uid, `${ll.id}@landlords.danest.example`, ll.displayName, "landlord", "active");
    // NO public read: this row carries private contact (G4). Public listing
    // pages must resolve display fields via a projection/function, never by
    // reading contactEmail/contactPhone. Seed with empty permissions.
    await putBySeed("landlord_profiles", `llp:${ll.id}`, {
      userId: uid,
      displayName: ll.displayName,
      businessRole: ll.role || "",
      languages: json(ll.languages || []),
      responseTime: ll.responseTime || "",
      memberSince: day(ll.memberSince),
      contactEmail: `${ll.id}.contact@landlords.danest.example`,
      contactPhone: "+84 90 000 0000",
      isSample: true,
      seedKey: `llp:${ll.id}`,
    }, []);
  }

  // Renters from ADMIN_SAMPLE_USERS (tenant) + inquiry emails.
  const renterUid = {}; // email -> uid
  for (const u of data.adminUsers.filter((x) => x.role === "tenant")) {
    const uid = `user-${u.id}`;
    renterUid[u.email] = uid;
    await ensureUser(uid, u.email, u.name, "renter", u.status === "suspended" ? "suspended" : "active");
  }

  // --- Listings ---
  const listingIdMap = {}; // demo id -> Appwrite doc id
  const allListings = [...data.publicListings, ...data.adminListings];

  for (const l of allListings) {
    const status = LISTING_STATUS[l.status] || "draft";
    const isVerified = l.verificationBadge === true;
    const doc = await putBySeed("listings", `lst:${l.id}`, {
      landlordId: landlordUid[l.landlordId] || l.landlordId,
      slug: l.slug,
      neighborhoodId: l.neighborhood,
      title: l.title,
      summary: l.summary || "",
      description: l.description || "",
      type: l.type,
      monthlyRent: l.monthlyRent,
      bedrooms: l.bedrooms,
      bathrooms: l.bathrooms,
      floorArea: l.floorArea ?? null,
      floorLevel: l.floorLevel || "",
      furnishing: l.furnishing,
      availability: l.availability,
      availableFrom: day(l.availableFrom),
      minMonths: l.rentalDurationMonths?.[0] ?? l.rentalTerms?.minMonths ?? 1,
      maxMonths: l.rentalDurationMonths?.[1] ?? l.rentalTerms?.maxMonths ?? 12,
      lat: l.location?.lat ?? null,
      lng: l.location?.lng ?? null,
      address: l.address,
      status,
      verificationLevel: isVerified ? "basic_verified" : "unverified",
      verifiedAt: isVerified ? day(l.verification?.checks?.find((c) => c.status === "verified")?.lastUpdated) || day(l.lastAvailabilityConfirmedAt) : null,
      verifiedScope: isVerified ? "Landlord identity, rental authorisation and listing information" : null,
      lastAvailabilityConfirmedAt: day(l.lastAvailabilityConfirmedAt),
      availabilityReminderSentAt: iso(l.availabilityReminderSentAt),
      listedAt: iso(l.listedAt),
      isSample: true,
      seedKey: `lst:${l.id}`,
    });
    listingIdMap[l.id] = doc.$id;

    // Images — deterministic ids (listing doc id + position)
    for (let i = 0; i < (l.images || []).length; i++) {
      await put("listing_image", docId(doc.$id, "img", String(i)), {
        listingId: doc.$id,
        url: l.images[i],
        position: i,
      });
    }
    // Amenities — deterministic ids (listing doc id + amenity)
    for (const aId of l.amenities || []) {
      await put("listing_amenity", docId(doc.$id, "am", aId), {
        listingId: doc.$id,
        amenityId: aId,
      });
    }
    // Costs — deterministic ids (listing doc id + position); deposit = pos 999
    for (let i = 0; i < (l.costs?.items || []).length; i++) {
      const c = l.costs.items[i];
      await put("listing_cost", docId(doc.$id, "cost", String(i)), {
        listingId: doc.$id,
        code: c.id || null,
        label: c.label,
        amount: c.amount ?? null,
        unit: c.unit || "",
        state: c.state,
        cadence: c.cadence,
        refundable: c.cadence === "one-time" && /deposit/i.test(c.label),
        note: c.note || "",
        position: i,
      });
    }
    if (l.costs?.depositAmount) {
      await put("listing_cost", docId(doc.$id, "cost", "999"), {
        listingId: doc.$id,
        code: "deposit",
        label: "Refundable deposit",
        amount: l.costs.depositAmount,
        unit: "one-time",
        state: "fixed",
        cadence: "one-time",
        refundable: true,
        note: null,
        position: 999,
      });
    }
    // Rental terms (1:1 — match on listingId)
    await putByKey("rental_terms", "listingId", doc.$id, {
      listingId: doc.$id,
      paymentDayOfMonth: l.rentalTerms?.paymentDayOfMonth ?? 1,
      utilitiesIncluded: json(l.rentalTerms?.utilitiesIncluded || []),
      notes: json(l.rentalTerms?.notes || []),
      neighborhoodNotes: json(l.neighborhoodNotes || []),
      distanceToBeach: l.distanceToBeach || "",
    });

    // Verification checks — deterministic ids (listing + kind)
    for (const chk of l.verification?.checks || []) {
      await put("verification_check", docId(doc.$id, "vc", chk.id), {
        listingId: doc.$id,
        kind: chk.id,
        status: chk.status,
        lastUpdated: iso(chk.lastUpdated),
      });
    }

    // Approved evidence BEFORE granting basic_verified (Stage 2 -> 3).
    if (isVerified) {
      await put("evidence_review", docId(doc.$id, "evrev"),
        {
          listingId: doc.$id,
          reviewerId: OWNER,
          decision: "approved",
          reason: "Seeded demo evidence review — identity and rental authorisation approved.",
          reviewedAt: iso(l.verifiedAt) || now(),
        },
        [],
      );
      await put("evidence_document", docId(doc.$id, "evdoc"),
        {
          listingId: doc.$id,
          evidenceReviewId: docId(doc.$id, "evrev"),
          kind: "identity",
          storageRef: `seed/evidence/${l.id}/identity.pdf`,
          uploadedAt: iso(l.verifiedAt) || now(),
        },
        [],
      );
    }

    // Automated moderation (Stage 1) — never touches verification.
    if (l.moderation) {
      await putByKey("moderation_auto", "listingId", doc.$id, {
        listingId: doc.$id,
        result: l.moderation.result,
        checks: json(l.moderation.checks || []),
        reasons: json(l.moderation.reasons || []),
        duplicateRisk: Boolean(l.moderation.duplicateRisk),
        autoReviewedAt: day(l.moderation.autoReviewedAt),
      });
    }

    // Promotions (featured / sponsored) — deterministic ids
    for (const kind of ["featured", "sponsored"]) {
      if (l[kind]) {
        await put("listing_promotion", docId(doc.$id, "promo", kind), {
          listingId: doc.$id,
          kind,
          requestedBy: landlordUid[l.landlordId] || l.landlordId,
          activatedBy: OWNER,
          active: true,
          startDate: day(l.listedAt),
          endDate: null,
          createdAt: iso(l.listedAt) || now(),
          endedAt: null,
        });
      }
    }
  }

  // --- Inquiries + initial history ---
  for (const inq of data.inquiries) {
    const listingDocId = listingIdMap[inq.listingId];
    if (!listingDocId) continue;
    let uid = renterUid[inq.tenantEmail];
    if (!uid) {
      uid = `user-inq-${inq.id}`;
      renterUid[inq.tenantEmail] = uid;
      await ensureUser(uid, inq.tenantEmail, inq.tenantName, "renter", "active");
    }
    const status = INQUIRY_STATUS[inq.status] || "new";
    const doc = await putBySeed("inquiries", `inq:${inq.id}`, {
      listingId: listingDocId,
      tenantId: uid,
      type: inq.type,
      message: inq.message,
      moveInDate: day(inq.moveInDate),
      durationMonths: inq.durationMonths ?? null,
      tenantPreferences: json(inq.tenantPreferences || []),
      status,
      firstRequestedAt: iso(inq.createdAt) || now(),
      firstRespondedAt: status === "new" ? null : iso(inq.createdAt) || now(),
      scheduledAt: inq.scheduledAt ? day(inq.scheduledAt) : null,
      preferredTime: inq.preferredTime || null,
      isSample: true,
      seedKey: `inq:${inq.id}`,
    });
    // History: creation row + one transition row (deterministic ids).
    await put("inquiry_status_history", docId(doc.$id, "hist", "0"),
      {
        inquiryId: doc.$id,
        fromStatus: null,
        toStatus: "new",
        actorId: uid,
        changedAt: iso(inq.createdAt) || now(),
        note: "Inquiry created.",
      },
      [],
    );
    if (status !== "new") {
      const owner = landlordUid[data.publicListings.find((l) => l.id === inq.listingId)?.landlordId] || OWNER;
      await put("inquiry_status_history", docId(doc.$id, "hist", "1"),
        {
          inquiryId: doc.$id,
          fromStatus: "new",
          toStatus: status,
          actorId: owner,
          changedAt: now(),
          note: "Seeded demo transition.",
        },
        [],
      );
    }
  }

  // --- Reports ---
  for (const r of data.reports) {
    const listingDocId = listingIdMap[r.listingId];
    if (!listingDocId) continue;
    const uid = renterUid[r.reporterEmail] || `user-rep-${r.id}`;
    await putBySeed("reports", `rpt:${r.id}`, {
      listingId: listingDocId,
      reporterId: uid,
      reporterName: r.reporterName,
      reporterEmail: r.reporterEmail,
      category: r.category,
      message: r.message,
      status: r.status,
      resolvedBy: r.resolvedBy ? OWNER : null,
      resolutionNote: r.resolutionNote || null,
      updatedAt: now(),
      isSample: true,
      seedKey: `rpt:${r.id}`,
    });
  }

  // --- Audit log (interactive=admin, system rows use actorType=system) ---
  for (const a of data.audit) {
    await putBySeed("audit_log", `audit:${a.id}`, {
      actorType: "admin",
      actorId: OWNER,
      action: a.action,
      targetType: "listing",
      targetId: null,
      targetLabel: a.target || "",
      reason: a.reason || "",
      oldValues: null,
      newValues: null,
      seedKey: `audit:${a.id}`,
    });
  }

  // --- Admin settings singleton ---
  await putByKey("admin_settings", "singleton", "main", {
    singleton: "main",
    availabilityGraceDays: 3,
    availabilityReminderDays: 14,
    featuredFeeConfig: json({ note: "Pilot fee config only — no billing (OOS-03)", amount: null, currency: "USD" }),
    updatedAt: now(),
  });

  // Report only writes the API confirmed (id matched), not attempts.
  console.log("\nSeed write results: created", stats.created, "| updated", stats.updated, "| failed", stats.failed);
  console.log("Per collection:");
  for (const [k, v] of Object.entries(stats.byCollection).sort()) {
    console.log(`  ${k.padEnd(24)} created ${v.created}, updated ${v.updated}`);
  }
  if (stats.failed > 0) {
    console.error("\nSEED INCOMPLETE: failures recorded.");
    process.exitCode = 1;
  }
}

async function verifySeeded() {
  // Read-only: confirm expected deterministic ids exist.
  const expected = {
    listings: [...data.publicListings, ...data.adminListings].map((l) => docId(`lst:${l.id}`)),
    inquiries: data.inquiries.map((i) => docId(`inq:${i.id}`)),
    users_profile: [
      OWNER,
      ...data.landlords.map((ll) => `user-${ll.id}`),
      ...data.adminUsers.filter((u) => u.role === "tenant").map((u) => `user-${u.id}`),
    ].map((uid) => docId(`user:${uid}`)),
    landlord_profiles: data.landlords.map((ll) => docId(`llp:${ll.id}`)),
    neighborhoods: data.neighborhoods.map((n) => docId("neighborhoodId", n.id)),
    amenities: data.amenities.map((a) => docId("amenityId", a.id)),
    reports: data.reports.map((r) => docId(`rpt:${r.id}`)),
    audit_log: data.audit.map((a) => docId(`audit:${a.id}`)),
  };
  let missing = 0;
  for (const [coll, ids] of Object.entries(expected)) {
    let ok = 0;
    for (const id of ids) {
      const r = await getDocument(coll, id);
      if (r.found) ok += 1;
      else {
        missing += 1;
        console.log(`  MISSING ${coll}/${id}`);
      }
    }
    console.log(`  ${coll.padEnd(22)} ${ok}/${ids.length}`);
  }
  console.log(missing === 0 ? "\nVERIFY OK" : `\nVERIFY FAILED: ${missing} missing`);
  if (missing > 0) process.exitCode = 1;
}

async function main() {
  if (RESET) return resetSeeded();
  if (VERIFY) return verifySeeded();
  console.log("Seeding DaNest demo data…");
  await seedRun();
}

main().catch((e) => {
  console.error("\nSEED FAILED:", e.message);
  process.exitCode = 1;
});
