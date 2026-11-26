// DaNest Backend Hub data client (Appwrite 1.8 REST) — hardened.
//
// Server-side only. Never import from src/**. Credentials come from
// .paletto/baas.env and are never printed.
//
// This fork of the Backend Hub API has proven unreliable for:
//   - filtered document queries using equal(...)   → filters are ignored
//   - offset pagination                            → offset is ignored
//   - trusting `total` as the real document count  → unreliable
//
// What DOES work reliably: GET a document by its exact id. Therefore every
// operation here is built on direct id access:
//   - existence is checked with getDocument(id) → 404 means "absent"
//   - create uses an explicit deterministic document id
//   - update/delete target that exact id
//   - any non-404 error THROWS (never silently treated as absence)
//   - 409 (already exists) is surfaced explicitly
//
// pageAllDocuments() provides the only safe full read: it pages by limit and
// dedupes by $id, stopping when a page adds nothing new (since offset is
// ignored, this terminates after the first page for small collections and is
// still correct for larger ones as long as the server honours limit).

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ENV_PATH = resolve(process.cwd(), ".paletto/baas.env");

function loadEnv() {
  let text;
  try {
    text = readFileSync(ENV_PATH, "utf8");
  } catch {
    throw new Error("Missing .paletto/baas.env — connect the Backend Hub first.");
  }
  const env = {};
  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  for (const key of ["APPWRITE_ENDPOINT", "APPWRITE_PROJECT_ID", "APPWRITE_DATABASE_ID", "APPWRITE_API_KEY"]) {
    if (!env[key]) throw new Error(`.paletto/baas.env is missing ${key}`);
  }
  return env;
}

const env = loadEnv();

export const config = {
  endpoint: env.APPWRITE_ENDPOINT.replace(/\/$/, ""),
  projectId: env.APPWRITE_PROJECT_ID,
  databaseId: env.APPWRITE_DATABASE_ID,
  ownerTeamId: env.APPWRITE_OWNER_TEAM_ID || "",
};

export class ApiError extends Error {
  constructor(method, path, status, body) {
    const type = body && typeof body === "object" ? body.type : "";
    const message = body && typeof body === "object" ? body.message : String(body ?? "");
    super(`${method} ${path} -> ${status} ${type || ""} ${message || ""}`.trim());
    this.status = status;
    this.type = type;
    this.body = body;
  }
}

function db() {
  return encodeURIComponent(config.databaseId);
}
const enc = encodeURIComponent;

// Low-level request. Returns { status, body }. Does NOT throw on HTTP errors
// unless the caller opts in via opts.throwOnError (default true). 404 is
// special-cased only where documented.
async function req(method, path, body, opts = {}) {
  const p = path.startsWith("/") ? path : `/${path}`;
  const res = await fetch(`${config.endpoint}${p}`, {
    method,
    headers: {
      "X-Appwrite-Project": config.projectId,
      "X-Appwrite-Key": env.APPWRITE_API_KEY,
      "Content-Type": "application/json",
      "X-Appwrite-Response-Format": "1.8.0",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let json = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = text;
    }
  }
  const allow = opts.allowStatus || [];
  if (!res.ok && !allow.includes(res.status)) {
    throw new ApiError(method, path, res.status, json);
  }
  return { status: res.status, body: json };
}

// ---------------------------------------------------------------------------
// Document operations — the safe, id-addressed core.
// ---------------------------------------------------------------------------

/**
 * Fetch a document by exact id.
 * @returns {Promise<{found: boolean, doc: object|null}>}
 * 404 -> {found:false}. Any other non-2xx -> throws. Never guesses.
 */
export async function getDocument(collectionId, docId) {
  try {
    const { status, body } = await req(
      "GET",
      `/databases/${db()}/collections/${enc(collectionId)}/documents/${enc(docId)}`,
      undefined,
      { allowStatus: [404] },
    );
    if (status === 404) return { found: false, doc: null };
    return { found: true, doc: body };
  } catch (e) {
    // Only a genuine 404 means "does not exist"; everything else propagates.
    if (e instanceof ApiError && e.status === 404) return { found: false, doc: null };
    throw e;
  }
}

/**
 * Create a document with an explicit id.
 * @returns existing doc if id already exists (idempotent), else the new doc.
 * 409 is treated as "already exists" and the existing doc is fetched + returned.
 */
export async function createWithId(collectionId, docId, data, permissions = ['read("any")']) {
  const before = await getDocument(collectionId, docId);
  if (before.found) return { created: false, doc: before.doc };
  try {
    const { body } = await req(
      "POST",
      `/databases/${db()}/collections/${enc(collectionId)}/documents`,
      { documentId: docId, data, permissions },
    );
    return { created: true, doc: body };
  } catch (e) {
    if (e instanceof ApiError && e.status === 409) {
      const again = await getDocument(collectionId, docId);
      if (again.found) return { created: false, doc: again.doc };
      throw new ApiError("POST", `create ${collectionId}/${docId}`, 409, e.body);
    }
    throw e;
  }
}

/**
 * Update a document by exact id. Throws if it does not exist.
 * When `permissions` is provided, a full PUT is used so the document's
 * permissions are reconciled too (PATCH cannot change permissions).
 */
export async function updateById(collectionId, docId, data, permissions) {
  const exists = await getDocument(collectionId, docId);
  if (!exists.found) {
    throw new ApiError("PATCH", `update ${collectionId}/${docId}`, 404, {
      type: "document_not_found",
      message: `Cannot update ${collectionId}/${docId}: it does not exist.`,
    });
  }
  if (permissions) {
    const { body } = await req(
      "PUT",
      `/databases/${db()}/collections/${enc(collectionId)}/documents/${enc(docId)}`,
      { data, permissions },
    );
    return body;
  }
  const { body } = await req(
    "PATCH",
    `/databases/${db()}/collections/${enc(collectionId)}/documents/${enc(docId)}`,
    { data },
  );
  return body;
}

/** Upsert by exact id: create when absent, update when present. */
export async function upsertById(collectionId, docId, data, permissions = ['read("any")']) {
  const before = await getDocument(collectionId, docId);
  if (!before.found) {
    const r = await createWithId(collectionId, docId, data, permissions);
    return { created: r.created, doc: r.doc };
  }
  const doc = await updateById(collectionId, docId, data, permissions);
  return { created: false, doc };
}

/** Delete a document by exact id. Returns {deleted:boolean}. 404 -> deleted:false. */
export async function deleteById(collectionId, docId) {
  const before = await getDocument(collectionId, docId);
  if (!before.found) return { deleted: false };
  await req("DELETE", `/databases/${db()}/collections/${enc(collectionId)}/documents/${enc(docId)}`);
  return { deleted: true };
}

/**
 * Read a collection's documents and its authoritative `total`.
 *
 * IMPORTANT — this Backend Hub fork:
 *   - caps a page at 25 documents regardless of ?limit
 *   - ignores ?offset and ?cursorAfter (every page is the same first 25)
 *   - reports an ACCURATE `total`
 * So we cannot page past 25. We return { docs, total, truncated }: `docs` is
 * what is enumerable (≤25), `total` is the real count. Callers that need every
 * record must fetch by known id (getDocument); callers that need counts must
 * use `total`.
 *
 * @returns {Promise<{docs: object[], total: number, truncated: boolean}>}
 */
export async function pageAllDocuments(collectionId, pageSize = 100) {
  const seen = new Map();
  let offset = 0;
  let total = 0;
  for (let guard = 0; guard < 200; guard++) {
    const { body } = await req(
      "GET",
      `/databases/${db()}/collections/${enc(collectionId)}/documents?limit=${pageSize}&offset=${offset}`,
    );
    total = typeof body.total === "number" ? body.total : total;
    const docs = body.documents || [];
    let added = 0;
    for (const d of docs) {
      if (!seen.has(d.$id)) {
        seen.set(d.$id, d);
        added += 1;
      }
    }
    // Stop when a page adds nothing new (offset ignored => repeats).
    if (docs.length < pageSize || added === 0) break;
    offset += pageSize;
  }
  const docs = [...seen.values()];
  return { docs, total, truncated: total > docs.length };
}

/** Count a collection using the authoritative `total`. */
export async function countDocuments(collectionId) {
  const { body } = await req(
    "GET",
    `/databases/${db()}/collections/${enc(collectionId)}/documents?limit=1`,
  );
  return typeof body.total === "number" ? body.total : (body.documents || []).length;
}

// ---------------------------------------------------------------------------
// Schema, storage, users, account — thin wrappers over the low-level request.
// ---------------------------------------------------------------------------

export const api = {
  request: req,
  listCollections: () => req("GET", `/databases/${db()}/collections?limit=100`),
  getCollection: (id) =>
    req("GET", `/databases/${db()}/collections/${enc(id)}`, undefined, { allowStatus: [404] }),
  createCollection: (body) => req("POST", `/databases/${db()}/collections`, body),
  deleteCollection: (id) =>
    req("DELETE", `/databases/${db()}/collections/${enc(id)}`, undefined, { allowStatus: [404] }),
  createAttribute: (collectionId, type, body) =>
    req("POST", `/databases/${db()}/collections/${enc(collectionId)}/attributes/${type}`, body),
  deleteAttribute: (collectionId, key) =>
    req("DELETE", `/databases/${db()}/collections/${enc(collectionId)}/attributes/${enc(key)}`, undefined, {
      allowStatus: [404],
    }),
  createIndex: (collectionId, body) =>
    req("POST", `/databases/${db()}/collections/${enc(collectionId)}/indexes`, body),

  listBuckets: () => req("GET", "/storage/buckets?limit=100"),
  createBucket: (body) => req("POST", "/storage/buckets", body),

  getTeam: (teamId) => req("GET", `/teams/${enc(teamId)}`, undefined, { allowStatus: [404] }),
  listUsers: () => req("GET", "/users?limit=100"),
  createUser: (body) => req("POST", "/users", body),
  deleteUser: (userId) => req("DELETE", `/users/${enc(userId)}`, undefined, { allowStatus: [404] }),
  updateUserLabels: (userId, labels) => req("PUT", `/users/${enc(userId)}/labels`, { labels }),
};

// Backwards-compatible export names used by earlier scripts.
export const admin = {
  get: (path, opts) => req("GET", path, undefined, opts),
  post: (path, body, opts) => req("POST", path, body, opts),
  put: (path, body, opts) => req("PUT", path, body, opts),
  patch: (path, body, opts) => req("PATCH", path, body, opts),
  delete: (path, opts) => req("DELETE", path, undefined, opts),
};

export { env };
export const baasEnv = env;
