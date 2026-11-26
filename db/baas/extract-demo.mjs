#!/usr/bin/env node
// Extract the existing demo data from src/data/*.ts into plain JSON so the
// seed script can write it to the Backend Hub WITHOUT a TypeScript runtime.
//
//   node db/baas/extract-demo.mjs
// -> writes db/baas/demo-data.json
//
// Strategy: copy the four data files to a temp folder with `~/` imports
// rewritten to relative paths and type-only imports dropped, then load them
// with Node's --experimental-strip-types loader.

import { mkdirSync, readFileSync, writeFileSync, cpSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const SRC = join(ROOT, "src");
const WORK = join(tmpdir(), `danest-extract-${Date.now()}`);
mkdirSync(join(WORK, "data"), { recursive: true });
mkdirSync(join(WORK, "types"), { recursive: true });

function rewrite(text) {
  // Drop import of types only (they vanish at runtime) and any `import type`.
  let out = text.replace(/^import\s+type\s+.*$/gm, "");
  // Rewrite `~/data/x` and `~/types` to local relative paths.
  out = out.replace(/from\s+["']~\/data\/([^"']+)["']/g, (m, p) =>
    `from "./../data/${p}${p.endsWith(".ts") ? "" : ".ts"}"`,
  );
  out = out.replace(/from\s+["']~\/types["']/g, 'from "../types/index.ts"');
  // Handle the remaining type-only named imports from `~/types` (e.g. `, type Listing`).
  out = out.replace(/,\s*type\s+[A-Za-z0-9_]+/g, "");
  return out;
}

// Provide an empty types module (types are erased; runtime never imports values from it).
writeFileSync(join(WORK, "types", "index.ts"), "export {};\n");

for (const file of ["constants", "listings", "landlord", "admin"]) {
  const text = readFileSync(join(SRC, "data", `${file}.ts`), "utf8");
  writeFileSync(join(WORK, "data", `${file}.ts`), rewrite(text));
}

const load = (name) =>
  import(pathToFileURL(join(WORK, "data", `${name}.ts`)).href);

const constants = await load("constants");
const listingsMod = await load("listings");
const landlordMod = await load("landlord");
const adminMod = await load("admin");

// Build the ops-enriched public listings (moderation + availability dates) the
// same way the app does, so seed values match what the UI shows.
const AVAILABILITY_CONFIRMED = (() => {
  const text = readFileSync(join(SRC, "data", "listings.ts"), "utf8");
  const m = text.match(/const AVAILABILITY_CONFIRMED[\s\S]*?=\s*(\{[\s\S]*?\});/);
  if (!m) return {};
  try {
    return Function(`return (${m[1]})`)();
  } catch {
    return {};
  }
})();

const publicListings = listingsMod.SAMPLE_LISTINGS_WITH_OPS || [];
const adminListings = adminMod.ADMIN_SAMPLE_LISTINGS || [];

const out = {
  generatedAt: new Date().toISOString(),
  neighborhoods: constants.NEIGHBORHOODS,
  amenities: constants.AMENITIES,
  landlords: listingsMod.SAMPLE_LANDLORDS,
  publicListings,
  adminListings,
  inquiries: landlordMod.SAMPLE_INQUIRIES,
  adminUsers: adminMod.ADMIN_SAMPLE_USERS,
  reports: adminMod.ADMIN_SAMPLE_REPORTS,
  audit: adminMod.ADMIN_SAMPLE_AUDIT,
};

// Sanity summary
console.log("Extracted:");
console.log("  neighborhoods:", out.neighborhoods.length);
console.log("  amenities:", out.amenities.length);
console.log("  landlords:", out.landlords.length);
console.log("  public listings:", out.publicListings.length);
console.log("  admin sample listings:", out.adminListings.length);
console.log("  inquiries:", out.inquiries.length);
console.log("  admin users:", out.adminUsers.length);
console.log("  reports:", out.reports.length);
console.log("  audit:", out.audit.length);

writeFileSync(join(ROOT, "db", "baas", "demo-data.json"), JSON.stringify(out, null, 2));
console.log("-> db/baas/demo-data.json");
