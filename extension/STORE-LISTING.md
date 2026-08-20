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

**Name**

```
Bainsla Music Tags — YouTube Tags, Titles & Trends
```

**Short description** (132 char max)

```
Real ranking titles, 500-char tag box, hashtags and live 60-min/48-hour view pulse for the YouTube video you are watching.
```

**Category:** Productivity — **Language:** Hindi (also English)

**Detailed description**

```
Bainsla Music Tags turns any YouTube page into a research desk for music creators — Bhajan, Haryanvi, Rajasthani, Punjabi, Gurjar Rasiya, DJ remix or any other category.

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

Requires a free account at https://tag.bainslamusic.com — paste your API key once in the extension options.
```

## Privacy practices tab

- **Single purpose:** "Show YouTube SEO research (tags, titles, trends and view velocity) for the
  YouTube page the user is viewing."
- **Permission justifications:**
  - `storage` — saves the user's dashboard address and API key.
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
