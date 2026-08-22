# Chrome Web Store submission — Bainsla Music Tags

Everything needed for the listing. Build the upload file with:

```bash
cd extension && zip -r ../BainslaMusicTags-store.zip . -x "STORE-LISTING.md" -x "*.DS_Store"
```

Upload rejects the package if `manifest.json` breaks these limits: `name` ≤ 75 chars and
`description` ≤ 132 chars (the store shows the same text as the short description).

## One-time developer account

1. Open https://chrome.google.com/webstore/devconsole and sign in with the Google account that
   should own the extension (use the same Gmail as the dashboard admin).
2. Pay the one-time **$5** registration fee and accept the developer agreement.
3. Fill the account contact email and verify it (required before publishing).

## Upload

1. Dev console → **Add new item** → upload `BainslaMusicTags-store.zip`.
2. Fill the listing fields below.
3. Complete **Privacy practices**, then **Submit for review** (review usually takes 1–3 days).

## Listing fields

Keywords people actually search in the store — use each one naturally in the name, short
description and first two lines of the detailed description (no keyword lists, that gets rejected):
`youtube tags`, `tag generator`, `youtube seo`, `keyword research`, `hashtag generator`,
`youtube analytics`, `title analyzer`, `trending videos`, `vidiq alternative`.

**Name** (75 char max — the strongest ranking field, keep the keywords in it)

```
Bainsla Music Tags: YouTube Tags, SEO Keywords & Analytics
```

**Short description** (132 char max)

```
YouTube tag generator & SEO keyword research: ranked tags, titles, hashtags and live 60-min/48-hour view analytics.
```

**Category:** Productivity — **Language:** Hindi (also English)

**Detailed description**

```
Bainsla Music Tags is a YouTube tag generator, keyword research and SEO analytics tool that works right on the YouTube page you are watching — a lightweight vidIQ-style alternative built for music creators (Bhajan, Haryanvi, Rajasthani, Punjabi, Gurjar Rasiya, DJ remix) and for any other category, channel or keyword.

Extract the tags of any video, see which keywords are actually searched, score your title, get hashtags and watch how fast a video is gaining views.

Open a video and a compact strip appears in the YouTube header:
• views gained in the last 60 minutes and last 48 hours (measured by sampling, updated every 5 minutes)
• current views per hour and total views

Click it for the full report:
• the video's real tags, ranked by live search demand, with one-click copy
• stronger tags to add, plus a ready 480–500 character tag box
• hashtag ideas and a title score with concrete fixes
• likes/comments ratios, upload age, length and thumbnail download
• channel stats: subscribers, average views per video, uploads per week and how fast the latest uploads are moving
• a short "why it is winning" read on whether the thumbnail, tags, title, channel audience or upload speed is doing the work

Connect your own channel with Google (optional) and your videos also show official YouTube Analytics: real traffic sources (search vs suggested vs browse), the exact search terms bringing views, watch time, average viewed percentage and subscribers gained. Other creators' videos always stay clearly labelled public estimates — YouTube keeps private analytics with the owner, and so do we.

Requires a free account at https://tag.bainslamusic.com. Click "Sign in / Sign up" in the extension, log in once, and the extension connects itself — no API key to copy.
```

## Privacy practices tab

- **Single purpose:** "Show YouTube SEO research (tags, titles, trends and view velocity) for the
  YouTube page the user is viewing."
- **Permission justifications:**
  - `storage` — saves the signed-in account (dashboard address and access key) locally.
  - `*://*.youtube.com/*` — the overlay renders on YouTube pages and reads the video id from the URL.
  - `https://tag.bainslamusic.com/*` — the extension calls the user's own dashboard API for results.
  - optional `https://*/*` — only requested if a user points the extension at a self-hosted
    dashboard.
- **Remote code:** No.
- **Data usage:** collects "Website content" (the video id of the open page) and "Authentication
  information" (the dashboard API key); not sold, not used for anything unrelated, not used for
  creditworthiness.
- **Privacy policy URL:** https://tag.bainslamusic.com/privacy
- **Support URL:** https://tag.bainslamusic.com/support

## Screenshots (1280×800 each, at least one required)

1. YouTube watch page with the header strip visible.
2. Report panel open showing tags with ranks.
3. Report panel scrolled to the channel section.
4. Dashboard Settings with "Connect my channel with Google".

## Sign-in flow (v1.2.0)

Install → a dashboard tab opens at `/connect` → sign in (or sign up) → the page hands the
extension the account automatically → the popup shows the email and plan. Nothing to paste.
