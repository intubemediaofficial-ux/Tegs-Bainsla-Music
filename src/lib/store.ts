import { promises as fs } from "fs";
import path from "path";

/**
 * Minimal key/value document store used across the app.
 *
 * Two drivers:
 *  - "file" (default): a single JSON file under ./.data/db.json. Zero external
 *    services, great for local/dev and single-instance servers.
 *  - "kv": Upstash / Vercel KV over the REST API (set STORAGE_DRIVER=kv and the
 *    KV_REST_API_URL / KV_REST_API_TOKEN env vars). Use this on serverless.
 *
 * Keys are namespaced strings like "user:<id>" and values are JSON documents.
 */

type Json = unknown;

interface Driver {
  get<T = Json>(key: string): Promise<T | null>;
  set(key: string, value: Json): Promise<void>;
  del(key: string): Promise<void>;
  keys(prefix: string): Promise<string[]>;
}

/* ------------------------------- file driver ------------------------------ */

const DATA_DIR = path.join(process.cwd(), ".data");
const DB_FILE = path.join(DATA_DIR, "db.json");

let cache: Record<string, Json> | null = null;
let writeChain: Promise<void> = Promise.resolve();

async function loadFile(): Promise<Record<string, Json>> {
  if (cache) return cache;
  try {
    const raw = await fs.readFile(DB_FILE, "utf8");
    cache = JSON.parse(raw) as Record<string, Json>;
  } catch {
    cache = {};
  }
  return cache;
}

async function persist(): Promise<void> {
  const data = cache ?? {};
  writeChain = writeChain.then(async () => {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(DB_FILE, JSON.stringify(data, null, 2), "utf8");
  });
  return writeChain;
}

const fileDriver: Driver = {
  async get<T>(key: string): Promise<T | null> {
    const db = await loadFile();
    return (db[key] as T) ?? null;
  },
  async set(key: string, value: Json): Promise<void> {
    const db = await loadFile();
    db[key] = value;
    await persist();
  },
  async del(key: string): Promise<void> {
    const db = await loadFile();
    delete db[key];
    await persist();
  },
  async keys(prefix: string): Promise<string[]> {
    const db = await loadFile();
    return Object.keys(db).filter((k) => k.startsWith(prefix));
  },
};

/* -------------------------------- kv driver ------------------------------- */

function kvEnv() {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) {
    throw new Error("STORAGE_DRIVER=kv requires KV_REST_API_URL and KV_REST_API_TOKEN");
  }
  return { url, token };
}

async function kvCmd<T>(command: (string | number)[]): Promise<T> {
  const { url, token } = kvEnv();
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`KV command failed: ${res.status}`);
  const data = (await res.json()) as { result: T };
  return data.result;
}

const kvDriver: Driver = {
  async get<T>(key: string): Promise<T | null> {
    const result = await kvCmd<string | null>(["GET", key]);
    if (result == null) return null;
    try {
      return JSON.parse(result) as T;
    } catch {
      return result as unknown as T;
    }
  },
  async set(key: string, value: Json): Promise<void> {
    await kvCmd(["SET", key, JSON.stringify(value)]);
  },
  async del(key: string): Promise<void> {
    await kvCmd(["DEL", key]);
  },
  async keys(prefix: string): Promise<string[]> {
    const found: string[] = [];
    let cursor = "0";
    do {
      const [next, batch] = await kvCmd<[string, string[]]>([
        "SCAN",
        cursor,
        "MATCH",
        `${prefix}*`,
        "COUNT",
        1000,
      ]);
      found.push(...batch);
      cursor = next;
    } while (cursor !== "0");
    return Array.from(new Set(found));
  },
};

/* --------------------------------- public --------------------------------- */

const driver: Driver = process.env.STORAGE_DRIVER === "kv" ? kvDriver : fileDriver;

export const store = {
  get: <T = Json>(key: string) => driver.get<T>(key),
  set: (key: string, value: Json) => driver.set(key, value),
  del: (key: string) => driver.del(key),
  keys: (prefix: string) => driver.keys(prefix),
  async list<T = Json>(prefix: string): Promise<T[]> {
    const keys = await driver.keys(prefix);
    const rows = await Promise.all(keys.map((k) => driver.get<T>(k)));
    return rows.filter((r): r is Awaited<T> => r != null);
  },
};
