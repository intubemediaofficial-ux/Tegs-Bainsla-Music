"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { CopyButton } from "./Copy";

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
  realTags: string[];
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

/**
 * Shows a video's real tags. Uses inline tags if we already have them, otherwise
 * fetches them on demand (many YouTube videos no longer expose public tags).
 */
function VideoTagList({ videoId, inline }: { videoId: string; inline: string[] }) {
  const [tags, setTags] = useState<string[]>(inline ?? []);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if ((inline?.length ?? 0) > 0) {
      setTags(inline);
      return;
    }
    let active = true;
    setLoading(true);
    fetch(`/api/video/tags?video=${videoId}`)
      .then((r) => r.json())
      .then((j) => active && setTags(j.tags ?? []))
      .catch(() => {})
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [videoId, inline]);

  return (
    <>
      <div className="mb-2 flex items-center justify-between">
        <div className="label">Tags actually used on this video</div>
        {tags.length > 0 && (
          <CopyButton text={tags.join(",")} label="Copy tags" className="btn-ghost px-2 py-1" />
        )}
      </div>
      {loading ? (
        <p className="text-sm text-slate-400">Loading tags…</p>
      ) : tags.length === 0 ? (
        <p className="text-sm text-slate-400">
          This video exposes no public tags (YouTube hides most videos&apos; tags now).
        </p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {tags.map((t) => (
            <span key={t} className="chip">
              {t}
            </span>
          ))}
        </div>
      )}
    </>
  );
}

/** Modal: plays the video next to its thumbnail and shows its real tags. */
function VideoModal({ video, onClose }: { video: Thumb; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="card max-h-[90vh] w-full max-w-4xl overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <h3 className="text-sm font-semibold text-slate-100">{video.title}</h3>
          <button className="btn-ghost px-2 py-1 text-lg leading-none" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-3">
            <div className="aspect-video w-full overflow-hidden rounded-lg border border-ink-line">
              <iframe
                src={`https://www.youtube.com/embed/${video.videoId}?autoplay=1&rel=0`}
                title={video.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="h-full w-full"
              />
            </div>
            <div className="text-xs text-slate-400">
              {video.channel && <span className="chip">{video.channel}</span>}{" "}
              <span className="chip">{video.views.toLocaleString()} views</span>
            </div>
          </div>
          <div>
            <VideoTagList videoId={video.videoId} inline={video.tags} />
          </div>
        </div>
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
  const [openTitle, setOpenTitle] = useState<number | null>(null);
  const [modal, setModal] = useState<Thumb | null>(null);

  async function run(e?: React.FormEvent) {
    e?.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setOpenTitle(null);
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
            placeholder="e.g. bhajan, punjabi song, DG Mawai"
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
              <span className="text-xs text-slate-500">click a title to see its real tags</span>
            </div>
            <div className="space-y-3">
              {data.titles.map((t, i) => {
                const open = openTitle === i;
                const expandable = t.source === "ranking" && !!t.videoId;
                return (
                  <div key={t.title} className="rounded-lg border border-ink-line bg-ink-soft">
                    <div
                      role={expandable ? "button" : undefined}
                      className={`flex w-full items-start justify-between gap-3 p-3 text-left ${
                        expandable ? "cursor-pointer" : ""
                      }`}
                      onClick={() => expandable && setOpenTitle(open ? null : i)}
                    >
                      <div>
                        <div className="font-medium text-slate-100">
                          {expandable && (
                            <span className="mr-1 text-slate-500">{open ? "▾" : "▸"}</span>
                          )}
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
                    {open && t.videoId && (
                      <div className="border-t border-ink-line p-3">
                        <VideoTagList videoId={t.videoId} inline={t.tags} />
                        <a
                          href={`https://www.youtube.com/watch?v=${t.videoId}`}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-3 inline-block text-xs text-brand-300 hover:underline"
                        >
                          Open video on YouTube ↗
                        </a>
                      </div>
                    )}
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
              <div className="mt-3">
                <div className="label">Premium tags found on ranking videos</div>
                <div className="flex flex-wrap gap-2">
                  {data.realTags.slice(0, 20).map((t) => (
                    <span key={t} className="chip">
                      {t}
                    </span>
                  ))}
                </div>
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
                Real playlists ranking for “{data.seed}” — getting added to these can drive
                playlist views.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {data.playlists.map((p) => (
                  <a
                    key={p.playlistId}
                    href={p.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex gap-3 rounded-lg border border-ink-line bg-ink-soft p-2 transition hover:border-brand-400/50"
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
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-slate-100">{p.title}</div>
                      <div className="mt-1 text-xs text-slate-400">{p.channel}</div>
                      {p.videoCount > 0 && (
                        <div className="mt-1 text-xs text-slate-500">
                          {p.videoCount.toLocaleString()} videos
                        </div>
                      )}
                    </div>
                  </a>
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
                Click to play the video and see its real tags.
              </p>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {data.thumbnails.map((t) => (
                  <button
                    key={t.videoId}
                    type="button"
                    onClick={() => setModal(t)}
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

      {modal && <VideoModal video={modal} onClose={() => setModal(null)} />}
    </div>
  );
}
