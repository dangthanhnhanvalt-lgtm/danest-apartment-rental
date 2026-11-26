#!/usr/bin/env node
// DaNest — idempotent schema reconciler for the Backend Hub (Appwrite 1.8).
//
//   node db/baas/schema.mjs            # create whatever is missing
//   node db/baas/schema.mjs --verify   # only report, never write
//   node db/baas/schema.mjs --drop     # remove DaNest collections + bucket
//
// It reads db/baas/schema.data.mjs, then for each collection:
//   1. POST the collection if absent (documentSecurity:true, NO collection perms)
//   2. add every attribute (poll until status=available before the next batch)
//   3. create every index once its attributes are available
// and finally ensures the private evidence bucket exists.
//
// All access is through per-document permissions written by the backend
// enforcement function — see db/baas/functions/README.md.

import { api } from "./lib/appwrite.mjs";
import { collections, buckets, relationships } from "./schema.data.mjs";

const args = new Set(process.argv.slice(2));
const VERIFY = args.has("--verify");
const DROP = args.has("--drop");

const TYPE_API = {
  string: "string",
  email: "email",
  url: "url",
  ip: "ip",
  enum: "enum",
  integer: "integer",
  double: "float",
  boolean: "boolean",
  datetime: "datetime",
  relationship: "relationship",
};

function attributeBody(attr) {
  const base = {
    key: attr.key,
    required: Boolean(attr.required),
    array: Boolean(attr.array),
    xdefault: attr.xdefault ?? null,
  };
  switch (attr.type) {
    case "string":
      return { ...base, size: attr.size ?? 255, encrypt: Boolean(attr.encrypt) };
    case "email":
    case "url":
    case "ip":
      return base;
    case "enum":
      return { ...base, elements: attr.elements };
    case "integer":
      return { ...base, min: attr.min ?? null, max: attr.max ?? null };
    case "double":
      return { ...base, min: attr.min ?? null, max: attr.max ?? null };
    case "boolean":
    case "datetime":
      return base;
    default:
      throw new Error(`Unknown attribute type ${attr.type} for ${attr.key}`);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (...a) => console.log(...a);

async function listCollectionMap() {
  const { body } = await api.listCollections();
  const map = new Map();
  for (const c of body.collections || []) map.set(c.$id, c);
  return map;
}

async function ensureCollection(def) {
  const { status, body } = await api.getCollection(def.id);
  if (status === 404) {
    if (VERIFY) {
      log(`  - collection ${def.id}: MISSING`);
      return false;
    }
    await api.createCollection({
      collectionId: def.id,
      name: def.name,
      permissions: [],
      documentSecurity: true,
    });
    log(`  + collection ${def.id}`);
    return true;
  }
  // If it exists, warn if documentSecurity is off (we never mutate a live collection silently).
  if (!body.documentSecurity) {
    log(`  ! collection ${def.id} exists with documentSecurity=false — per-doc permissions would be ignored`);
  }
  if (VERIFY) log(`  = collection ${def.id}: ok`);
  return true;
}

async function listAllAttributes(collectionId) {
  const { status, body } = await api.getCollection(collectionId);
  if (status === 404) return null;
  return body.attributes || [];
}

async function ensureAttributes(def) {
  let missing = 0;
  let created = 0;
  const initial = await listAllAttributes(def.id);
  if (initial === null) {
    if (VERIFY) log(`  - attributes ${def.id}: MISSING (collection absent)`);
    return def.attrs.length;
  }
  const existing = new Set(initial.map((a) => a.key));
  for (const attr of def.attrs) {
    if (!existing.has(attr.key)) {
      missing += 1;
      if (VERIFY) {
        log(`  - attr ${def.id}.${attr.key}: MISSING`);
        continue;
      }
      const typePath = TYPE_API[attr.type];
      const res = await api.createAttribute(def.id, typePath, attributeBody(attr)).catch((e) => {
        if (e.status === 409) return null; // created by a concurrent/earlier run
        throw e;
      });
      if (res) created += 1;
    }
  }
  if (created > 0) {
    const deadline = Date.now() + 120_000;
    const wanted = new Set(def.attrs.map((a) => a.key));
    while (Date.now() < deadline) {
      const list = (await listAllAttributes(def.id)) || [];
      const pending = list.filter((a) => wanted.has(a.key) && a.status === "processing");
      const failed = list.filter((a) => wanted.has(a.key) && a.status !== "available" && a.status !== "processing");
      if (failed.length) {
        throw new Error(
          `Attribute(s) failed on ${def.id}: ${failed.map((a) => `${a.key}=${a.status}:${a.error || ""}`).join(", ")}`,
        );
      }
      if (pending.length === 0) break;
      await sleep(700);
    }
    log(`  + ${created} attribute(s) on ${def.id}`);
  }
  return missing;
}

async function ensureIndexes(def) {
  if (!def.indexes || def.indexes.length === 0) return 0;
  const { status, body } = await api.getCollection(def.id);
  if (status === 404) return 0;
  const existing = new Set((body.indexes || []).map((i) => i.key));
  let created = 0;
  for (const idx of def.indexes) {
    if (existing.has(idx.key)) continue;
    if (VERIFY) {
      log(`  - index ${def.id}.${idx.key}: MISSING`);
      continue;
    }
    try {
      await api.createIndex(def.id, {
        key: idx.key,
        type: idx.type,
        attributes: idx.attributes,
        orders: idx.attributes.map(() => "ASC"),
      });
      created += 1;
    } catch (err) {
      log(`  ! index ${def.id}.${idx.key} failed: ${err.message}`);
    }
  }
  if (created) log(`  + ${created} index(es) on ${def.id}`);
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    const res = await api.getCollection(def.id);
    const pending = (res.body.indexes || []).filter((i) => i.status === "processing");
    if (pending.length === 0) break;
    await sleep(700);
  }
  return created;
}

async function ensureBuckets() {
  const { body } = await api.listBuckets();
  const existing = new Set((body.buckets || []).map((b) => b.$id));
  for (const b of buckets) {
    if (existing.has(b.id)) {
      log(`  = bucket ${b.id}: ok`);
      continue;
    }
    if (VERIFY) {
      log(`  - bucket ${b.id}: MISSING`);
      continue;
    }
    await api.createBucket({ bucketId: b.id, name: b.name, permissions: b.permissions, fileSecurity: b.fileSecurity, maximumFileSize: b.maximumFileSize, allowedFileExtensions: b.allowedFileExtensions, encryption: b.encryption, antivirus: b.antivirus });
    log(`  + bucket ${b.id}`);
  }
}

async function dropAll() {
  log("Dropping DaNest collections…");
  for (const def of [...collections].reverse()) {
    await api.deleteCollection(def.id);
    log(`  - ${def.id}`);
  }
  log("Buckets are left intact (no delete bucket call enabled by design).");
}

async function main() {
  if (DROP) {
    await dropAll();
    return;
  }
  log(VERIFY ? "Verifying DaNest schema (read-only)…" : "Reconciling DaNest schema…");

  // Phase 1 — collections must all exist before any relationship attribute.
  log("\n[1/4] Collections");
  for (const def of collections) await ensureCollection(def);

  // Phase 2 — attributes.
  log("\n[2/4] Attributes");
  let missingAttrs = 0;
  for (const def of collections) missingAttrs += await ensureAttributes(def);

  // Phase 3 — indexes.
  log("\n[3/5] Indexes");
  for (const def of collections) await ensureIndexes(def);

  // Phase 4 — relationships (attributes, but on both ends — needs every
  // collection + its scalar attributes first).
  log("\n[4/5] Relationships");
  await ensureRelationships();

  // Phase 5 — buckets.
  log("\n[5/5] Storage buckets");
  await ensureBuckets();

  if (VERIFY && missingAttrs > 0) {
    process.exitCode = 1;
  }
  log("\nDone.");
}

async function ensureRelationships() {
  for (const rel of relationships) {
    const coll = (await api.getCollection(rel.parent)).body;
    const existing = (coll.attributes || []).find((a) => a.key === rel.key && a.type === "relationship");
    if (existing) {
      if (existing.onDelete === rel.onDelete) {
        log(`  = relation ${rel.parent}.${rel.key}: ok (onDelete=${rel.onDelete})`);
        continue;
      }
      if (VERIFY) {
        log(`  - relation ${rel.parent}.${rel.key}: onDelete ${existing.onDelete} != ${rel.onDelete} (DRIFT)`);
        continue;
      }
      // onDelete cannot be changed in place — delete and recreate this relation.
      log(`  ~ relation ${rel.parent}.${rel.key}: onDelete ${existing.onDelete} -> ${rel.onDelete}; recreating`);
      await api.deleteAttribute(rel.parent, rel.key).catch(() => {});
      // wait for the attribute to disappear
      const dl = Date.now() + 60_000;
      while (Date.now() < dl) {
        const c2 = (await api.getCollection(rel.parent)).body;
        if (!(c2.attributes || []).some((a) => a.key === rel.key)) break;
        await sleep(500);
      }
    } else if (VERIFY) {
      log(`  - relation ${rel.parent}.${rel.key}: MISSING`);
      continue;
    }
    const body = {
      key: rel.key,
      relatedCollectionId: rel.child,
      type: rel.type,
      twoWay: true,
      twoWayKey: rel.childKey,
      onDelete: rel.onDelete,
      side: "parent",
      relationType: "auto",
      xdefault: null,
      required: false,
      array: false,
    };
    try {
      await api.createAttribute(rel.parent, "relationship", body);
      log(`  + relation ${rel.parent}.${rel.key} -> ${rel.child}.${rel.childKey} (onDelete=${rel.onDelete})`);
    } catch (e) {
      if (e.status === 409) {
        log(`  = relation ${rel.parent}.${rel.key}: exists (409)`);
      } else {
        log(`  ! relation ${rel.parent}.${rel.key} failed: ${e.message}`);
      }
    }
  }
  // Wait for relationships to settle.
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    let pending = 0;
    for (const rel of relationships) {
      const coll = (await api.getCollection(rel.parent)).body;
      const a = (coll.attributes || []).find((x) => x.key === rel.key);
      if (a && a.status === "processing") pending += 1;
    }
    if (pending === 0) break;
    await sleep(800);
  }
}

main().catch((err) => {
  console.error("\nSCHEMA FAILED:", err.message);
  process.exitCode = 1;
});
