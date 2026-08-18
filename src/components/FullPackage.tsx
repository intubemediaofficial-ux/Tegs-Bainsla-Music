"use client";

import { useState } from "react";
import Image from "next/image";
import { CopyButton } from "./Copy";
import { VideoDetailModal, TagRankBlock, type VideoRef, type RankedTag } from "./VideoDetail";

const LANGS = [
  { hl: "en", gl: "IN", label: "English (India)" },
  { hl: "hi", gl: "IN", label: "Hindi" },
  { hl: "pa", gl: "IN", label: "Punjabi" },
  { hl: "en", gl: "US", label: "English (US)" },
];

interface TitleRow {
  title: string;
  source: "ranking" | "optimized";
  views?: number;
  videoId?: string;
  rank?: number;
  score: number;
  reasons: string[];
  tags: string[];
}
interface Thumb {
  videoId: string;
  title: string;
  channel: string;
  thumbnail: string;
  url: string;
  views: number;
  tags: string[];
}
interface Playlist {
  playlistId: string;
  title: string;
  channel: string;
  videoCount: number;
  thumbnail: string;
  url: string;
}
interface PackageResult {
  seed: string;
  keywords: string[];
  tagBox: { text: string; used: string[] };
  titles: TitleRow[];
  hashtags: string[];
  questions: string[];
  thumbnails: Thumb[];
  playlists: Playlist[];
  score: { difficulty: number; volume: number; competition: number; opportunity: number };
  realTags: RankedTag[];
}

function Bar({ label, value }: { label: string; value: number }) {
  const color =
    label === "Difficulty" || label === "Competition"
      ? value > 66
        ? "bg-red-500"
        : value > 33
          ? "bg-yellow-500"
          : "bg-green-500"
      : value > 66
        ? "bg-green-500"
        : value > 33
          ? "bg-yellow-500"
          : "bg-red-500";
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs text-slate-400">
        <span>{label}</span>
        <span>{value}</span>
      </div>
      <div className="h-2 rounded-full bg-ink-soft">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

export function FullPackage({ initialQuery = "" }: { initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery);
  const [lang, setLang] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<PackageResult | null>(null);
  const [openVideo, setOpenVideo] = useState<VideoRef | null>(null);

  async function run(e?: React.FormEvent) {
    e?.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const { hl, gl } = LANGS[lang];
      const res = await fetch("/api/generate/package", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, hl, gl }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed");
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={run} className="card flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="label">Singer, song or keyword</label>
          <input
            className="input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. bhajan, punjabi song, artist or singer name"
          />
        </div>
        <div>
          <label className="label">Language / Region</label>
          <select
            className="input"
            value={lang}
            onChange={(e) => setLang(Number(e.target.value))}
          >
            {LANGS.map((l, i) => (
              <option key={l.label} value={i}>
                {l.label}
              </option>
            ))}
          </select>
        </div>
        <button className="btn-primary" disabled={loading}>
          {loading ? "Generating…" : "Generate"}
        </button>
      </form>

      {error && <div className="card border-red-500/40 text-red-300">{error}</div>}

      {data && (
        <>
          <div className="card">
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
              Keyword scores for “{data.seed}”
            </h2>
            <div className="grid gap-4 sm:grid-cols-4">
              <Bar label="Opportunity" value={data.score.opportunity} />
              <Bar label="Volume" value={data.score.volume} />
              <Bar label="Difficulty" value={data.score.difficulty} />
              <Bar label="Competition" value={data.score.competition} />
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Estimates from real autocomplete + search data. Add a YouTube API key later for exact
              figures.
            </p>
          </div>

          <div className="card">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                Suggested titles
              </h2>
              <span className="text-xs text-slate-500">
                click a ranking title → its real tags with rank (won&apos;t open YouTube)
              </span>
            </div>
            <div className="space-y-3">
              {data.titles.map((t) => {
                const expandable = t.source === "ranking" && !!t.videoId;
                return (
                  <div key={t.title} className="rounded-lg border border-ink-line bg-ink-soft">
                    <div
                      role={expandable ? "button" : undefined}
                      className={`flex w-full items-start justify-between gap-3 p-3 text-left ${
                        expandable ? "cursor-pointer hover:border-brand-400/40" : ""
                      }`}
                      onClick={() =>
                        expandable &&
                        setOpenVideo({
                          videoId: t.videoId!,
                          title: t.title,
                          views: t.views,
                          rank: t.rank,
                          url: `https://www.youtube.com/watch?v=${t.videoId}`,
                        })
                      }
                    >
                      <div>
                        <div className="font-medium text-slate-100">
                          {expandable && <span className="mr-1 text-slate-500">▸</span>}
                          {t.title}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-400">
                          <span className="chip">
                            {t.source === "ranking" ? "Real ranking title" : "Optimized"}
                          </span>
                          {typeof t.rank === "number" && (
                            <span className="chip">Rank #{t.rank}</span>
                          )}
                          {typeof t.views === "number" && (
                            <span className="chip">{t.views.toLocaleString()} views</span>
                          )}
                          {t.reasons[0] && <span className="text-slate-500">{t.reasons[0]}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`rounded-md px-2 py-1 text-xs font-bold ${
                            t.score >= 70
                              ? "bg-green-500/20 text-green-300"
                              : t.score >= 45
                                ? "bg-yellow-500/20 text-yellow-300"
                                : "bg-red-500/20 text-red-300"
                          }`}
                        >
                          {t.score}
                        </span>
                        <span onClick={(e) => e.stopPropagation()}>
                          <CopyButton
                            text={t.title}
                            label="Copy"
                            className="btn-ghost px-2 py-1"
                          />
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                Tags — {data.tagBox.text.length}/500 chars · {data.tagBox.used.length} tags
              </h2>
              <CopyButton text={data.tagBox.text} label="Copy all tags" />
            </div>
            <textarea readOnly className="input h-28 font-mono text-xs" value={data.tagBox.text} />
            {data.realTags.length > 0 && (
              <div className="mt-4">
                <TagRankBlock
                  title="Premium tags found on ranking videos (search rank)"
                  tags={data.realTags}
                  emptyNote="No public tags on the ranking videos."
                  highlight
                />
                <p className="mt-2 text-xs text-slate-500">
                  Rank = position in live YouTube autocomplete (what people search) — an honest
                  demand proxy, not an official metric.
                </p>
              </div>
            )}
          </div>

          <div className="card">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
                Hashtags
              </h2>
              <CopyButton text={data.hashtags.join(" ")} label="Copy hashtags" />
            </div>
            <div className="flex flex-wrap gap-2">
              {data.hashtags.map((h) => (
                <span key={h} className="chip text-brand-300">
                  {h}
                </span>
              ))}
            </div>
          </div>

          {data.playlists.length > 0 && (
            <div className="card">
              <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-400">
                Trending playlists to submit to
              </h2>
              <p className="mb-3 text-xs text-slate-500">
                Real playlists ranking for “{data.seed}” — copy a name to reuse it, or open it to
                request adding your video.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {data.playlists.map((p) => (
                  <div
                    key={p.playlistId}
                    className="flex gap-3 rounded-lg border border-ink-line bg-ink-soft p-2"
                  >
                    {p.thumbnail && (
                      <Image
                        src={p.thumbnail}
                        alt={p.title}
                        width={120}
                        height={68}
                        className="aspect-video w-28 shrink-0 rounded object-cover"
                        unoptimized
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-slate-100">{p.title}</div>
                      <div className="mt-1 text-xs text-slate-400">{p.channel}</div>
                      {p.videoCount > 0 && (
                        <div className="mt-0.5 text-xs text-slate-500">
                          {p.videoCount.toLocaleString()} videos
                        </div>
                      )}
                      <div className="mt-2 flex items-center gap-2">
                        <CopyButton
                          text={p.title}
                          label="Copy name"
                          className="btn-ghost px-2 py-0.5 text-xs"
                        />
                        <a
                          href={p.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-slate-500 hover:text-brand-300"
                        >
                          Open ↗
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.thumbnails.length > 0 && (
            <div className="card">
              <h2 className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-400">
                Top thumbnails (for reference)
              </h2>
              <p className="mb-3 text-xs text-slate-500">
                Click to play the video, see its real tags (with rank) and download the thumbnail.
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {data.thumbnails.map((t, i) => (
                  <button
                    key={t.videoId}
                    type="button"
                    onClick={() =>
                      setOpenVideo({
                        videoId: t.videoId,
                        title: t.title,
                        channel: t.channel,
                        views: t.views,
                        thumbnail: t.thumbnail,
                        url: t.url,
                        rank: i + 1,
                      })
                    }
                    className="group overflow-hidden rounded-lg border border-ink-line text-left"
                  >
                    <Image
                      src={t.thumbnail}
                      alt={t.title}
                      width={320}
                      height={180}
                      className="aspect-video w-full object-cover transition group-hover:scale-105"
                      unoptimized
                    />
                    <div className="truncate p-2 text-xs text-slate-400">
                      {t.views.toLocaleString()} views
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {data.questions.length > 0 && (
            <div className="card">
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
                Questions people search
              </h2>
              <div className="flex flex-wrap gap-2">
                {data.questions.map((q) => (
                  <span key={q} className="chip">
                    {q}
                  </span>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {openVideo && (
        <VideoDetailModal
          video={openVideo}
          seed={data?.seed}
          onClose={() => setOpenVideo(null)}
        />
      )}
    </div>
  );
}
