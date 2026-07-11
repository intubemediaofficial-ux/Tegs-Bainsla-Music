import { randomUUID, randomBytes } from "crypto";
import { store } from "./store";
import { hashPassword } from "./auth";
import type { PlanId } from "./plans";
import type { User } from "./types";

export function newApiKey(): string {
  return "bmt_" + randomBytes(24).toString("hex");
}

export async function findUserByEmail(email: string): Promise<User | null> {
  const id = await store.get<string>(`email:${email.toLowerCase()}`);
  if (!id) return null;
  return store.get<User>(`user:${id}`);
}

export async function createUser(params: {
  email: string;
  name: string;
  password: string;
  plan?: PlanId;
  role?: "user" | "admin";
}): Promise<User> {
  const email = params.email.toLowerCase().trim();
  const existing = await findUserByEmail(email);
  if (existing) throw new Error("Email already registered");

  const id = randomUUID();
  const apiKey = newApiKey();
  const user: User = {
    id,
    email,
    name: params.name.trim() || email.split("@")[0],
    passwordHash: await hashPassword(params.password),
    plan: params.plan ?? "free",
    role: params.role ?? "user",
    apiKey,
    createdAt: new Date().toISOString(),
  };
  await store.set(`user:${id}`, user);
  await store.set(`email:${email}`, id);
  await store.set(`apikey:${apiKey}`, id);
  return user;
}

export async function saveUser(user: User): Promise<void> {
  await store.set(`user:${user.id}`, user);
  await store.set(`email:${user.email}`, user.id);
  await store.set(`apikey:${user.apiKey}`, user.id);
}

export async function listUsers(): Promise<User[]> {
  return store.list<User>("user:");
}

export async function regenerateApiKey(user: User): Promise<User> {
  await store.del(`apikey:${user.apiKey}`);
  user.apiKey = newApiKey();
  await saveUser(user);
  return user;
}

/** Ensure the seeded admin exists (called on demand). */
export async function ensureAdmin(): Promise<void> {
  const email = (process.env.ADMIN_EMAIL || "admin@bainslamusic.com").toLowerCase();
  const existing = await findUserByEmail(email);
  if (existing) return;
  await createUser({
    email,
    name: "Admin",
    password: process.env.ADMIN_PASSWORD || "admin12345",
    plan: "admin",
    role: "admin",
  });
}
