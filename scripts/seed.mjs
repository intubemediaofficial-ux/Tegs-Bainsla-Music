import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import bcrypt from "bcryptjs";

/**
 * Seeds the admin account into the local JSON store (.data/db.json).
 * For the "kv" driver, the admin is created automatically on first login.
 */
const DATA_DIR = path.join(process.cwd(), ".data");
const DB_FILE = path.join(DATA_DIR, "db.json");

const email = (process.env.ADMIN_EMAIL || "admin@bainslamusic.com").toLowerCase();
const password = process.env.ADMIN_PASSWORD || "admin12345";

async function main() {
  let db = {};
  try {
    db = JSON.parse(await fs.readFile(DB_FILE, "utf8"));
  } catch {
    db = {};
  }

  if (db[`email:${email}`]) {
    console.log(`Admin already exists: ${email}`);
    return;
  }

  const id = crypto.randomUUID();
  const apiKey = "bmt_" + crypto.randomBytes(24).toString("hex");
  const user = {
    id,
    email,
    name: "Admin",
    passwordHash: await bcrypt.hash(password, 10),
    plan: "admin",
    role: "admin",
    apiKey,
    createdAt: new Date().toISOString(),
  };
  db[`user:${id}`] = user;
  db[`email:${email}`] = id;
  db[`apikey:${apiKey}`] = id;

  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(DB_FILE, JSON.stringify(db, null, 2), "utf8");
  console.log(`Seeded admin: ${email} (password: ${password})`);
  console.log(`Extension API key: ${apiKey}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
