# Bainsla Music Tags

A YouTube SEO & growth product for music creators — the best of **vidIQ + RapidTags + TubeBuddy + KeywordTool**, merged and tuned for singers/songs (e.g. "DG Mawai"). Includes a full web **dashboard**, **backend**, **admin panel**, **subscription plans**, a **trending/viral monitor**, and a **Chrome extension** that all share one backend.

Everything works with YouTube's free public endpoints — **no API key required to start**.

## Features

- **Full Package (1 click):** enter a singer/song → best titles, a 500-char premium tag box, hashtags and top thumbnails, ready to paste.
- **Tag Generator:** merges YouTube autocomplete with the real tags used by videos already ranking. Packed to YouTube's 500-char limit.
- **Real high-rank titles:** taken from the actual top-ranking videos (not AI guesses) + optimized variations, each **scored /100** with reasons.
- **Keyword Research:** difficulty / volume / competition / opportunity, related keywords, questions, hashtags and top videos.
- **Rank Checker:** where your video ranks for any keyword (top 50).
- **Competitor Tags:** read the real tags on any public video.
- **Trending / Viral Monitor:** per-category background tracking, virality score (view velocity + recency) and a **why-viral** explainer — the common tags, hashtags and title patterns to copy.
- **Artist Presets:** save singers/songs and jump straight to a package.
- **Admin Panel:** manage users, plans, daily quotas, ban/delete, tracked trending categories, manual trend refresh, and view usage.
- **Chrome Extension (MV3):** popup tool + auto-suggest panel inside **YouTube Studio** + seed from any **watch page**. Connects via an API key.

## Tech

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind. JWT httpOnly-cookie auth (`jose` + `bcryptjs`). Pluggable storage: JSON file (default) or Upstash/Vercel KV.

## Local setup

```bash
npm install
cp .env.example .env      # set AUTH_SECRET (+ ADMIN_EMAIL / ADMIN_PASSWORD)
npm run seed              # create the admin account
npm run dev               # http://localhost:3000
```

Sign in with the admin credentials, or register a normal user. Grab your **API key** from Settings for the extension.

## Environment variables

See `.env.example`. Key ones:

| Var | Purpose |
| --- | --- |
| `AUTH_SECRET` | signs session JWTs (**required in prod**) |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | seeded admin account |
| `STORAGE_DRIVER` | `file` (default) or `kv` |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | Upstash/Vercel KV (when `STORAGE_DRIVER=kv`) |
| `CRON_SECRET` | protects `/api/cron/refresh` |
| `YOUTUBE_API_KEY` | optional — for more exact metrics later |

## Trending refresh

`GET/POST /api/cron/refresh` refreshes all tracked categories. On Vercel it runs every 3h via `vercel.json`. Admins can trigger it manually from the dashboard/admin panel. Authorize with `Authorization: Bearer $CRON_SECRET` (or an admin session).

## Chrome extension

1. `chrome://extensions` → enable Developer mode → **Load unpacked** → select the `extension/` folder.
2. Open the extension **options**, set the **Dashboard URL** (e.g. `http://localhost:3000`) and paste your **API key** (dashboard → Settings).
3. Use the popup anywhere, or open **YouTube Studio** / a watch page to see the floating **Bainsla Tags** panel.

## Data & accuracy note

Volume / difficulty / competition are **smart estimates** derived from real autocomplete + search data (like the free tiers of RapidTags/KeywordTool). For exact Google figures, add a `YOUTUBE_API_KEY` or a paid data source later. Titles/tags/thumbnails/rank use **real** YouTube data. Not affiliated with YouTube.
