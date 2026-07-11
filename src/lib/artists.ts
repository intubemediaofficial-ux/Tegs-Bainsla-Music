import { randomUUID } from "crypto";
import { store } from "./store";
import type { ArtistPreset } from "./types";

export async function listArtists(userId: string): Promise<ArtistPreset[]> {
  const all = await store.list<ArtistPreset>("artist:");
  return all
    .filter((a) => a.userId === userId)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
}

export async function addArtist(
  userId: string,
  name: string,
  language: string,
  keywords: string[]
): Promise<ArtistPreset> {
  const artist: ArtistPreset = {
    id: randomUUID(),
    userId,
    name: name.trim(),
    language: language || "hi",
    keywords: keywords.map((k) => k.trim()).filter(Boolean).slice(0, 50),
    createdAt: new Date().toISOString(),
  };
  await store.set(`artist:${artist.id}`, artist);
  return artist;
}

export async function removeArtist(userId: string, id: string): Promise<boolean> {
  const artist = await store.get<ArtistPreset>(`artist:${id}`);
  if (!artist || artist.userId !== userId) return false;
  await store.del(`artist:${id}`);
  return true;
}
