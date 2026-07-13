"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { CopyButton } from "./Copy";

export interface RankedTag {
  tag: string;
  rank: number;
}

export interface VideoRef {
  videoId: string;
  title: string;
  channel?: string;
  views?: number;
  publishedText?: string;
  thumbnail?: string;
  url?: string;
  rank?: number; // search-result position
}

interface Details {
  videoId: string;
  title: string;
  channel: string;
  published: string;
  description: string;
  tags: string[];
  onlyDefault?: boolean;
  trending: RankedTag[];
  notTrending: string[];
  suggestions: RankedTag[];
}

export function VideoDetailModal({
  video,
  seed,
  onClose,
}: {
  video: VideoRef;
  seed?: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<Details | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const q = new URLSearchParams({ video: video.videoId });
        if (seed) q.set("seed", seed);
        const r = await fetch(`/api/video/details?${q.toString()}`);
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "Failed");
        if (alive) setData(j);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "Failed");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [video.videoId, seed]);

  const thumb =
    video.thumbnail || `https://i.ytimg.com/vi/${video.videoId}/hqdefault.jpg`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-ink-line bg-ink-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-ink-line p-3">
          <div className="min-w-0">
            <div className="truncate font-semibold text-slate-100">{video.title}</div>
            <div className="mt-0.5 text-xs text-slate-500">
              {(data?.channel || video.channel) ?? ""}
              {video.rank ? ` · search rank #${video.rank}` : ""}
              {typeof video.views === "number" ? ` · ${video.views.toLocaleString()} views` : ""}
              {data?.published ? ` · uploaded ${data.published}` : ""}
            </div>
          </div>
          <button onClick={onClose} className="btn-ghost shrink-0 px-2 py-1">
            ✕
          </button>
        </div>

        <div className="grid gap-4 overflow-y-auto p-4 md:grid-cols-2">
          {/* left: player / thumbnail */}
          <div>
            <div className="relative aspect-video overflow-hidden rounded-lg bg-black">
              {playing ? (
                <iframe
                  src={`https://www.youtube.com/embed/${video.videoId}?autoplay=1&rel=0`}
                  title={video.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="h-full w-full"
                />
              ) : (
                <button
                  onClick={() => setPlaying(true)}
                  className="group relative h-full w-full"
                >
                  <Image
                    src={thumb}
                    alt={video.title}
                    fill
                    unoptimized
                    className="object-cover"
                  />
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="rounded-full bg-black/60 px-4 py-2 text-sm text-white group-hover:bg-brand-600">
                      ▶ Play here
                    </span>
                  </span>
                </button>
              )}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <a
                href={`/api/video/thumbnail?video=${video.videoId}`}
                className="text-xs text-brand-300 hover:underline"
              >
                ⬇ Download thumbnail
              </a>
              {video.url && (
                <a
                  href={video.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-slate-500 hover:text-brand-300"
                >
                  Open on YouTube ↗
                </a>
              )}
            </div>

            <div className="mt-3">
              <div className="label">Description</div>
              <div className="mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap rounded-lg border border-ink-line bg-ink-soft p-2 text-xs text-slate-300">
                {loading
                  ? "Loading…"
                  : data?.description?.trim() || "No public description."}
              </div>
            </div>
          </div>

          {/* right: tags with rank + suggestions */}
          <div className="space-y-4">
            {error && <div className="text-sm text-red-300">{error}</div>}

            <TagRankBlock
              title="Video tags (trending — search rank)"
              tags={data?.trending ?? []}
              loading={loading}
              emptyNote={
                data?.onlyDefault
                  ? "Creator hid custom tags (only YouTube defaults)."
                  : "None of this video's tags currently rank in live search."
              }
            />

            {data && data.notTrending.length > 0 && (
              <div>
                <div className="label">Tags not trending (skip these)</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {data.notTrending.map((t) => (
                    <span key={t} className="chip text-slate-500 line-through">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <TagRankBlock
              title="Better tags to add (higher search rank)"
              tags={data?.suggestions ?? []}
              loading={loading}
              emptyNote="No stronger tags found."
              highlight
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export function TagRankBlock({
  title,
  tags,
  loading,
  emptyNote,
  highlight = false,
}: {
  title: string;
  tags: RankedTag[];
  loading?: boolean;
  emptyNote?: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <div className="label mb-0">{title}</div>
        {tags.length > 0 && (
          <CopyButton
            text={tags.map((t) => t.tag).join(", ")}
            label="Copy"
            className="btn-ghost px-2 py-0.5 text-xs"
          />
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {loading ? (
          <span className="text-xs text-slate-500">Loading…</span>
        ) : tags.length === 0 ? (
          <span className="text-xs text-slate-500">{emptyNote}</span>
        ) : (
          tags.map((t) => (
            <span
              key={t.tag}
              className={`chip flex items-center gap-1 ${
                highlight ? "border-brand-500/50 text-brand-200" : ""
              }`}
            >
              <span
                className={`rounded px-1 text-[10px] font-bold ${
                  highlight ? "bg-brand-600/40 text-brand-100" : "bg-ink-soft text-slate-400"
                }`}
              >
                #{t.rank}
              </span>
              {t.tag}
            </span>
          ))
        )}
      </div>
    </div>
  );
}
