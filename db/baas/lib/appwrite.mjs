// Minimal admin client for the Backend Hub (Appwrite 1.8) REST API.
// Credentials come from .paletto/baas.env and are never printed.
// Server-side only — never import this from src/**.

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
  const allowStatus = opts.allowStatus || [];
  if (!res.ok && !allowStatus.includes(res.status)) {
    const message = json && typeof json === "object" ? json.message : String(json);
    const type = json && typeof json === "object" ? json.type : "";
    const err = new Error(`${method} ${path} -> ${res.status} ${type || ""} ${message || ""}`.trim());
    err.status = res.status;
    err.body = json;
    throw err;
  }
  return { status: res.status, body: json };
}

export const admin = {
  get: (path, opts) => req("GET", path, undefined, opts),
  post: (path, body, opts) => req("POST", path, body, opts),
  put: (path, body, opts) => req("PUT", path, body, opts),
  patch: (path, body, opts) => req("PATCH", path, body, opts),
  delete: (path, opts) => req("DELETE", path, undefined, opts),
};

const db = () => encodeURIComponent(config.databaseId);
const enc = encodeURIComponent;

export const api = {
  // Databases + collections
  listCollections: () => req("GET", `/databases/${db()}/collections?limit=100`),
  createCollection: (body) => req("POST", `/databases/${db()}/collections`, body),
  getCollection: (id) =>
    req("GET", `/databases/${db()}/collections/${enc(id)}`, undefined, { allowStatus: [404] }),
  deleteCollection: (id) =>
    req("DELETE", `/databases/${db()}/collections/${enc(id)}`, undefined, { allowStatus: [404] }),

  // Attributes
  createAttribute: (collectionId, type, body) =>
    req("POST", `/databases/${db()}/collections/${enc(collectionId)}/attributes/${type}`, body),
  listAttributes: (collectionId, limit = 200) =>
    req("GET", `/databases/${db()}/collections/${enc(collectionId)}/attributes?limit=${limit}`),
  deleteAttribute: (collectionId, key) =>
    req("DELETE", `/databases/${db()}/collections/${enc(collectionId)}/attributes/${enc(key)}`, undefined, {
      allowStatus: [404],
    }),

  // Indexes
  createIndex: (collectionId, body) =>
    req("POST", `/databases/${db()}/collections/${enc(collectionId)}/indexes`, body),
  listIndexes: (collectionId, limit = 100) =>
    req("GET", `/databases/${db()}/collections/${enc(collectionId)}/indexes?limit=${limit}`),

  // Documents
  createDocument: (collectionId, body) =>
    req("POST", `/databases/${db()}/collections/${enc(collectionId)}/documents`, body),
  updateDocument: (collectionId, docId, data) =>
    req("PATCH", `/databases/${db()}/collections/${enc(collectionId)}/documents/${enc(docId)}`, { data }),
  deleteDocument: (collectionId, docId) =>
    req("DELETE", `/databases/${db()}/collections/${enc(collectionId)}/documents/${enc(docId)}`, undefined, {
      allowStatus: [404],
    }),
  getDocument: (collectionId, docId) =>
    req("GET", `/databases/${db()}/collections/${enc(collectionId)}/documents/${enc(docId)}`, undefined, {
      allowStatus: [404],
    }),
  listDocuments: (collectionId, queries = []) => {
    const qs = new URLSearchParams();
    for (const q of queries) qs.append("query[]", q);
    const suffix = qs.toString() ? `?${qs}` : "";
    return req("GET", `/databases/${db()}/collections/${enc(collectionId)}/documents${suffix}`);
  },

  // Storage
  createBucket: (body) => req("POST", "/storage/buckets", body),
  listBuckets: () => req("GET", "/storage/buckets?limit=100"),

  // Teams (Admin identity = membership of the app-owner team)
  getTeam: (teamId) => req("GET", `/teams/${enc(teamId)}`, undefined, { allowStatus: [404] }),

  // Users (admin)
  createUser: (body) => req("POST", "/users", body),
  listUsers: () => req("GET", "/users?limit=100"),
  deleteUser: (userId) => req("DELETE", `/users/${enc(userId)}`, undefined, { allowStatus: [404] }),
  updateUserLabels: (userId, labels) => req("PUT", `/users/${enc(userId)}/labels`, { labels }),
};

export { req, env };
