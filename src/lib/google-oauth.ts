import { store } from "./store";
import { settingsSync } from "./settings";

/**
 * Google OAuth for connecting a user's *own* YouTube channel.
 *
 * Only the owner can see analytics for their channel, so this is what unlocks
 * real traffic sources, watch time, retention and subscribers-gained per video
 * (see `yt-analytics.ts`). Public-only data never needs this.
 *
 * The refresh token is stored server-side per user; access tokens are cached
 * until shortly before they expire.
 */

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

export const YT_SCOPES = [
  "https://www.googleapis.com/auth/yt-analytics.readonly",
  "https://www.googleapis.com/auth/youtube.readonly",
];

/** Sign-in only: who the person is, no YouTube access. */
export const LOGIN_SCOPES = ["openid", "email", "profile"];

export interface GoogleIdentity {
  email: string;
  name: string;
  picture: string;
}

export interface ChannelConnection {
  userId: string;
  channelId: string;
  channelTitle: string;
  thumbnail: string;
  refreshToken: string;
  accessToken: string;
  /** Epoch ms when `accessToken` stops working. */
  expiresAt: number;
  connectedAt: string;
  scope: string;
}

const connKey = (userId: string) => `ytconn:${userId}`;
const stateKey = (state: string) => `ytstate:${state}`;

export function googleConfigured(): boolean {
  const s = settingsSync();
  return Boolean(s.googleClientId && s.googleClientSecret);
}

function credentials(): { clientId: string; clientSecret: string; redirectUri: string } {
  const { googleClientId: clientId, googleClientSecret: clientSecret, appUrl } = settingsSync();
  if (!clientId || !clientSecret) {
    throw new Error("Google sign-in is not configured on the server");
  }
  return { clientId, clientSecret, redirectUri: `${appUrl}/api/auth/google/callback` };
}

/** Build the consent URL and remember which user started the flow. */
export async function startAuth(userId: string): Promise<string> {
  const { clientId, redirectUri } = credentials();
  const state = crypto.randomUUID();
  await store.set(stateKey(state), { userId, at: Date.now() });

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: YT_SCOPES.join(" "),
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "consent",
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export async function consumeState(state: string): Promise<string | null> {
  const row = await store.get<{ userId: string; at: number }>(stateKey(state));
  if (!row) return null;
  await store.del(stateKey(state));
  // States are single-use and short lived.
  if (Date.now() - row.at > 15 * 60 * 1000) return null;
  return row.userId;
}

/* ---------------------------- sign in with Google ------------------------- */

const loginStateKey = (state: string) => `ytlogin:${state}`;

function loginRedirectUri(): string {
  return `${settingsSync().appUrl}/api/auth/google/login/callback`;
}

/** Consent URL for "Sign in with Google", remembering where to land after. */
export async function startGoogleLogin(next: string): Promise<string> {
  const { clientId } = credentials();
  const state = crypto.randomUUID();
  await store.set(loginStateKey(state), { next, at: Date.now() });

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: loginRedirectUri(),
    response_type: "code",
    scope: LOGIN_SCOPES.join(" "),
    prompt: "select_account",
    state,
  });
  return `${AUTH_URL}?${params.toString()}`;
}

export async function consumeLoginState(state: string): Promise<string | null> {
  const row = await store.get<{ next: string; at: number }>(loginStateKey(state));
  if (!row) return null;
  await store.del(loginStateKey(state));
  if (Date.now() - row.at > 15 * 60 * 1000) return null;
  return row.next || "/connect";
}

/** Exchange the sign-in code for the person's Google email and name. */
export async function completeGoogleLogin(code: string): Promise<GoogleIdentity> {
  const { clientId, clientSecret } = credentials();
  const token = await tokenRequest({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: loginRedirectUri(),
    grant_type: "authorization_code",
  });
  if (!token.access_token) throw new Error("Google did not return an access token");

  const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${token.access_token}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Could not read your Google profile");
  const data = (await res.json()) as { email?: string; name?: string; picture?: string };
  if (!data.email) throw new Error("This Google account has no email address");
  return { email: data.email, name: data.name ?? "", picture: data.picture ?? "" };
}

interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
}

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
    cache: "no-store",
  });
  const data = (await res.json()) as TokenResponse;
  if (!res.ok || data.error) {
    throw new Error(data.error_description || data.error || "Google token request failed");
  }
  return data;
}

/** Exchange the callback code for tokens and resolve which channel was granted. */
export async function completeAuth(userId: string, code: string): Promise<ChannelConnection> {
  const { clientId, clientSecret, redirectUri } = credentials();
  const token = await tokenRequest({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });
  if (!token.access_token) throw new Error("Google did not return an access token");

  const channel = await ownChannel(token.access_token);
  const existing = await getConnection(userId);
  const refreshToken = token.refresh_token || existing?.refreshToken || "";
  if (!refreshToken) {
    throw new Error(
      "Google did not return a refresh token — remove the app under your Google account permissions and connect again."
    );
  }

  const conn: ChannelConnection = {
    userId,
    channelId: channel.channelId,
    channelTitle: channel.title,
    thumbnail: channel.thumbnail,
    refreshToken,
    accessToken: token.access_token,
    expiresAt: Date.now() + (token.expires_in ?? 3600) * 1000,
    connectedAt: new Date().toISOString(),
    scope: token.scope ?? YT_SCOPES.join(" "),
  };
  await store.set(connKey(userId), conn);
  return conn;
}

export async function getConnection(userId: string): Promise<ChannelConnection | null> {
  return store.get<ChannelConnection>(connKey(userId));
}

export async function disconnect(userId: string): Promise<void> {
  await store.del(connKey(userId));
}

/** A valid access token for the user, refreshing it when needed. */
export async function accessTokenFor(userId: string): Promise<string | null> {
  const conn = await getConnection(userId);
  if (!conn) return null;
  if (conn.accessToken && conn.expiresAt - 60_000 > Date.now()) return conn.accessToken;

  const { clientId, clientSecret } = credentials();
  const token = await tokenRequest({
    refresh_token: conn.refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
  });
  if (!token.access_token) return null;

  const updated: ChannelConnection = {
    ...conn,
    accessToken: token.access_token,
    expiresAt: Date.now() + (token.expires_in ?? 3600) * 1000,
  };
  await store.set(connKey(userId), updated);
  return updated.accessToken;
}

interface MineChannelResponse {
  items?: {
    id?: string;
    snippet?: { title?: string; thumbnails?: Record<string, { url?: string }> };
  }[];
}

/** The channel behind an access token (`channels.list?mine=true`). */
async function ownChannel(
  accessToken: string
): Promise<{ channelId: string; title: string; thumbnail: string }> {
  const res = await fetch(
    "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
    { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store" }
  );
  if (!res.ok) throw new Error("Could not read your channel from Google");
  const data = (await res.json()) as MineChannelResponse;
  const item = data.items?.[0];
  if (!item?.id) throw new Error("This Google account has no YouTube channel");
  const thumbs = item.snippet?.thumbnails ?? {};
  return {
    channelId: item.id,
    title: item.snippet?.title ?? "",
    thumbnail: thumbs.medium?.url ?? thumbs.default?.url ?? "",
  };
}
