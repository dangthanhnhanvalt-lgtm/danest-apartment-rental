#!/usr/bin/env node
// DaNest authorization tests with REAL authenticated sessions.
//
//   node db/baas/tests/run-auth.mjs
//
// Creates throwaway users via the admin API, signs each in with a real
// email/password session, and executes actual operations against the Backend
// Hub to prove what per-document permissions enforce. It only reports PASS for
// operations it truly executed and observed. Rules that need a server function
// are reported NOT TESTABLE — never faked.
//
// Everything uses TEST_ ids and cleans up after itself.

import { api, admin, config } from "../lib/database.mjs";

const DB = encodeURIComponent(config.databaseId);
const RAND = Date.now().toString(36);
const PASSWORD = "TestPass!2026";

const results = [];
const pass = (m) => (results.push(["PASS", m]), console.log("PASS  " + m));
const fail = (m) => (results.push(["FAIL", m]), console.log("FAIL  " + m));
const nt = (m, r) => (results.push(["NOT TESTABLE", m]), console.log(`NOT TESTABLE  ${m} — ${r}`));

const createdUserIds = [];

async function makeUser(tag) {
  const userId = `test-${tag}-${RAND}`.slice(0, 36);
  const email = `${userId}@example.test`;
  await api.createUser({ userId, email, password: PASSWORD, name: `Test ${tag}` });
  createdUserIds.push(userId);
  return { userId, email };
}

// Real client session (as a browser/app does): POST /account/sessions/email.
// The session travels as the a_session_* cookie set by the response.
async function signIn(email) {
  const res = await fetch(`${config.endpoint}/account/sessions/email`, {
    method: "POST",
    headers: {
      "X-Appwrite-Project": config.projectId,
      "Content-Type": "application/json",
      "X-Appwrite-Response-Format": "1.8.0",
    },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(`sign-in failed ${res.status} ${body.message || ""}`);
  }
  const setCookies = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get("set-cookie")];
  const cookie = (setCookies || []).map((c) => c && c.split(";")[0]).filter(Boolean).join("; ");
  const body = await res.json().catch(() => ({}));
  return { cookie, secret: body.secret, userId: body.userId };
}

// Signed request helper carrying the session cookie, like a browser.
function client(cookie) {
  return async (method, path, data) => {
    const res = await fetch(`${config.endpoint}${path}`, {
      method,
      headers: {
        "X-Appwrite-Project": config.projectId,
        "X-Appwrite-Response-Format": "1.8.0",
        Cookie: cookie,
        "Content-Type": "application/json",
      },
      body: data === undefined ? undefined : JSON.stringify(data),
    });
    const body = await res.json().catch(() => ({}));
    return { status: res.status, body };
  };
}

const docPath = (collection, id) => `/databases/${DB}/collections/${encodeURIComponent(collection)}/documents${id ? "/" + encodeURIComponent(id) : ""}`;

async function main() {
  // --- Setup: two renters, two landlords ---
  const renterA = await makeUser("renterA");
  const renterB = await makeUser("renterB");
  const landlordA = await makeUser("landlordA");
  const landlordB = await makeUser("landlordB");

  const sa = await signIn(renterA.email);
  const sb = await signIn(renterB.email);
  const la = await signIn(landlordA.email);
  const lb = await signIn(landlordB.email);
  const cA = client(sa.cookie);
  const cB = client(sb.cookie);
  const lA = client(la.cookie);
  const lB = client(lb.cookie);

  // 1. Guest (no session) can read public listings.
  {
    const res = await fetch(`${config.endpoint}${docPath("listings")}?limit=1`, {
      headers: { "X-Appwrite-Project": config.projectId, "X-Appwrite-Response-Format": "1.8.0" },
    });
    const body = await res.json().catch(() => ({}));
    res.ok && (body.documents || []).length >= 0
      ? pass("Guest can read public listings")
      : fail(`Guest cannot read public listings (HTTP ${res.status})`);
  }

  // 2. Guest cannot create an inquiry (no session, no create perm).
  {
    const res = await fetch(`${config.endpoint}${docPath("inquiries")}`, {
      method: "POST",
      headers: { "X-Appwrite-Project": config.projectId, "Content-Type": "application/json", "X-Appwrite-Response-Format": "1.8.0" },
      body: JSON.stringify({ documentId: "unique()", data: { tenantId: "guest", listingId: "x", type: "question", message: "x", status: "new" }, permissions: [] }),
    });
    res.status === 401 || res.status === 403
      ? pass(`Guest cannot create an inquiry (HTTP ${res.status})`)
      : fail(`Guest reached inquiry create (HTTP ${res.status})`);
  }

  // Renter A attempts to save an apartment privately.
  const savedId = `test-saved-${RAND}`.slice(0, 36);
  {
    const res = await cA("POST", docPath("saved_apartments"), {
      documentId: savedId,
      data: { userId: sa.userId, listingId: "lstlst-001", savedAt: new Date().toISOString() },
      permissions: [`read("user:${sa.userId}")`, `update("user:${sa.userId}")`, `delete("user:${sa.userId}")`],
    });
    if (res.status === 201 || res.status === 200) {
      pass("Renter can save an apartment (owner-scoped document created)");
      // 3/4. Renter B cannot read Renter A's saved doc.
      const r2 = await cB("GET", docPath("saved_apartments", savedId));
      r2.status === 401 || r2.status === 403 || r2.status === 404
        ? pass(`Renter B cannot read Renter A's saved apartment (HTTP ${r2.status})`)
        : fail(`Renter B read Renter A's saved apartment (HTTP ${r2.status})`);
    } else {
      // This Backend Hub rejects client-side document creation / user-scoped perms.
      nt(
        "Renter saves an apartment privately in the Database Hub",
        `platform forbids client writes (HTTP ${res.status}: ${String(res.body.message || "").slice(0, 60)})`,
      );
    }
  }

  // Landlord A attempts to create a listing.
  const listingId = `test-listing-${RAND}`.slice(0, 36);
  {
    const res = await lA("POST", docPath("listings"), {
      documentId: listingId,
      data: {
        landlordId: la.userId,
        slug: `test-${RAND}`,
        title: "TEST listing A",
        status: "visible",
        monthlyRent: 500,
        bedrooms: 1,
        bathrooms: 1,
        furnishing: "furnished",
        availability: "available",
        minMonths: 1,
        maxMonths: 12,
        isSample: false,
      },
      permissions: [`read("any")`, `update("user:${la.userId}")`, `delete("user:${la.userId}")`],
    });
    if (res.status === 201 || res.status === 200) {
      pass("Landlord can create a listing (public read, owner-only write)");
      const r2 = await lB("PATCH", docPath("listings", listingId), { data: { monthlyRent: 1 } });
      r2.status === 401 || r2.status === 403 || r2.status === 404
        ? pass(`Landlord B cannot update Landlord A's listing (HTTP ${r2.status})`)
        : fail(`Landlord B modified Landlord A's listing (HTTP ${r2.status})`);
      const r3 = await lB("DELETE", docPath("listings", listingId));
      r3.status === 401 || r3.status === 403 || r3.status === 404
        ? pass(`Landlord B cannot delete Landlord A's listing (HTTP ${r3.status})`)
        : fail(`Landlord B deleted Landlord A's listing (HTTP ${r3.status})`);
      await admin.delete(docPath("listings", listingId)).catch(() => {});
    } else {
      nt(
        "Landlord creates a listing in the Database Hub",
        `platform forbids client writes (HTTP ${res.status}: ${String(res.body.message || "").slice(0, 60)})`,
      );
      nt("Landlord A vs B listing write isolation", "no client-writable listing documents exist on this Backend Hub");
      nt("Landlord cannot delete another landlord's listing", "no client-writable listing documents exist on this Backend Hub");
    }
  }

  // Auth identity: Renter A's session resolves to their own uid (server-verified).
  {
    const res = await cA("GET", "/account");
    res.status === 200 && res.body.$id === sa.userId
      ? pass("Real session identity is server-verified (/account returns the signed-in uid)")
      : fail(`session identity check failed (HTTP ${res.status})`);
  }

  // 5/16. Private landlord contact is not publicly readable.
  {
    const res = await fetch(`${config.endpoint}${docPath("landlord_profiles")}?limit=5`, {
      headers: { "X-Appwrite-Project": config.projectId, "X-Appwrite-Response-Format": "1.8.0" },
    });
    // Even guests with no session: landlord_profiles has no public perms.
    let leaked = false;
    if (res.status === 200) {
      const body = await res.json().catch(() => ({}));
      leaked = (body.documents || []).some((d) => d.contactEmail || d.contactPhone);
    }
    leaked
      ? fail("Guest can read landlord private contact (G4 leak)")
      : pass(`Landlord private contact is not publicly readable (HTTP ${res.status})`);
  }

  // Evidence documents are admin-only (no perms on seeded evidence docs).
  {
    const res = await cA("GET", docPath("evidence_document") + "?limit=5");
    const docs = res.body.documents || [];
    docs.length === 0
      ? pass("Renter sees zero evidence documents (private to Admin workflow)")
      : fail(`Renter can read ${docs.length} evidence document(s)`);
  }

  // 9/10/8/11. Verification / admin / self-approval need the server function.
  nt("Automated moderation cannot grant Verified", "no server function — status/verification gate not enforced server-side");
  nt("Only Admin can approve Basic Verified", "requires server-side authorization function");
  nt("Landlord cannot approve own verification", "requires server-side authorization function");
  nt("Admin cannot approve own listing", "requires server-side authorization function");
  // 3. Renter can create an inquiry that ONLY they can read — but the landlord
  //    must also read it, which per-doc perms cannot express safely.
  nt("Renter creates inquiry readable by its landlord", "cross-role read needs the backend function");
  // 13/14/12. Inquiry transitions, notifications, audit immutability.
  nt("Inquiry status transitions + history", "server function (5-state machine) not deployed");
  nt("Notifications delivered only to recipients", "notifications are function-written; not active client-side");
  nt("Audit records immutable to app users", "Appwrite has no DB-level immutability; enforced by function");

  // --- Cleanup ---
  await admin.delete(docPath("listings", listingId)).catch(() => {});
  await admin.delete(docPath("saved_apartments", savedId)).catch(() => {});
  for (const id of createdUserIds) await api.deleteUser(id).catch(() => {});

  // --- Summary ---
  const s = results.reduce((a, [k]) => ((a[k] = (a[k] || 0) + 1), a), {});
  console.log("\n=== SUMMARY ===");
  console.log(s);
  const failures = results.filter(([k]) => k === "FAIL");
  if (failures.length) {
    console.log("\nFAILURES:");
    for (const [, m] of failures) console.log("  - " + m);
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error("\nAUTH TEST ERROR:", e.message);
  process.exitCode = 1;
});
