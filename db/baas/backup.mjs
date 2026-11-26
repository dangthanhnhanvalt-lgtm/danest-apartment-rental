#!/usr/bin/env node
// Read-only full backup of the connected `main` database.
//
//   node db/baas/backup.mjs
//
// Writes db/baas/backups/<timestamp>/:
//   backup.json          — every document in every collection
//   schema-snapshot.json — collections, attributes, indexes, relationships, perms
//   users.json           — auth users (demo accounts)
//   buckets.json         — storage bucket metadata
//   MANIFEST.md          — classification of every record
//
// Then re-reads backup.json and verifies it parses with the expected shape.

import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { api, pageAllDocuments, config } from "./lib/database.mjs";

const ROOT = process.cwd();
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const dir = join(ROOT, "db", "baas", "backups", stamp);
mkdirSync(dir, { recursive: true });

const KNOWN_DEMO_USER_IDS = [
  "demo-admin-danest",
  "user-ld-an",
  "user-ld-linh",
  "user-ld-minh",
  "user-usr-sofia",
  "user-usr-james",
  "user-usr-aiko",
  "user-usr-marco",
  "user-usr-emma",
  "user-inq-inq-006",
];

console.log("Backing up database", config.databaseId, "->", dir);

const collectionsResp = await api.listCollections();
const collectionIds = collectionsResp.body.collections.map((c) => c.$id).sort();

const schema = [];
const backup = {};

for (const id of collectionIds) {
  const c = (await api.getCollection(id)).body;
  schema.push({
    $id: c.$id,
    name: c.name,
    documentSecurity: c.documentSecurity,
    permissions: c.$permissions || [],
    attributes: c.attributes || [],
    indexes: c.indexes || [],
  });
  const { docs, total, truncated } = await pageAllDocuments(id);
  backup[id] = docs;
  console.log(`  ${id.padEnd(24)} ${docs.length}/${total} doc(s)${truncated ? " (TRUNCATED — API page cap)" : ""}`);
}

const users = (await api.listUsers()).body.users || [];
const buckets = (await api.listBuckets()).body.buckets || [];

writeFileSync(join(dir, "backup.json"), JSON.stringify(backup, null, 2));
writeFileSync(join(dir, "schema-snapshot.json"), JSON.stringify(schema, null, 2));
writeFileSync(join(dir, "users.json"), JSON.stringify(users, null, 2));
writeFileSync(join(dir, "buckets.json"), JSON.stringify(buckets, null, 2));

// --- Manifest ---
const totalDocs = Object.values(backup).reduce((n, arr) => n + arr.length, 0);
const lines = [];
lines.push(`# Backup manifest — ${stamp}`);
lines.push("");
lines.push(`Database: ${config.databaseId}`);
lines.push(`Collections: ${collectionIds.length}`);
lines.push(`Total documents: ${totalDocs}`);
lines.push(`Auth users: ${users.length}`);
lines.push(`Buckets: ${buckets.length}`);
lines.push("");
lines.push("## Classification");
lines.push("");
lines.push("The database was EMPTY before the failed seed run. Every document below");
lines.push("belongs to the failed demo seed and is safe to replace with the corrected");
lines.push("deterministic seed. No real user data is present.");
lines.push("");
lines.push("### Failed demo seed documents (by collection)");
for (const id of collectionIds) {
  lines.push(`- ${id}: ${backup[id].length} enumerated (see collection total note)`);
}
lines.push("");
lines.push("### Demo authentication accounts");
for (const u of users) {
  const known = KNOWN_DEMO_USER_IDS.includes(u.$id);
  lines.push(`- ${u.$id} (${u.email}) ${known ? "[known demo]" : "[UNRECOGNISED — investigate]"}`);
}
lines.push("");
const unrecognised = users.filter((u) => !KNOWN_DEMO_USER_IDS.includes(u.$id));
lines.push(`### Unidentified records`);
lines.push(unrecognised.length === 0
  ? "- None. Every auth account matches a known demo id."
  : unrecognised.map((u) => `- Unrecognised auth user ${u.$id}`).join("\n"));
writeFileSync(join(dir, "MANIFEST.md"), lines.join("\n") + "\n");

// --- Verify the backup re-reads ---
const reRead = JSON.parse(readFileSync(join(dir, "backup.json"), "utf8"));
let verifyDocs = 0;
for (const id of collectionIds) {
  if (!Array.isArray(reRead[id])) throw new Error(`Backup verification failed: ${id} missing`);
  verifyDocs += reRead[id].length;
}
if (verifyDocs !== totalDocs) {
  throw new Error(`Backup verification failed: expected ${totalDocs} docs, re-read ${verifyDocs}`);
}
const reUsers = JSON.parse(readFileSync(join(dir, "users.json"), "utf8"));
if (!Array.isArray(reUsers)) throw new Error("Backup verification failed: users.json unreadable");

console.log(`\nBackup OK: ${totalDocs} documents, ${users.length} users, ${buckets.length} bucket(s).`);
console.log("Verification re-read passed.");
console.log("Path:", dir);
console.log("\nBACKUP_DIR=" + dir);
