"use client";

import { useState } from "react";
import Image from "next/image";
import { CopyButton } from "./Copy";
import { VideoDetailModal, TagRankBlock, type VideoRef, type RankedTag } from "./VideoDetail";

interface ChannelVideo {
  videoId: string;
  title: string;
  channel: string;
  views: number;
  publishedText: string;
  thumbnail: string;
  url: string;
}

interface ChannelResult {
  channelId: string;
  title: string;
  thumbnail: string;
  subscribers: number;
  videoCount: number;
  views: number;
  keywords: string[];
  count: number;
  tagBox: { text: string; used: string[] };
  trending: RankedTag[];
  notTrending: string[];
  suggestions: RankedTag[];
  videos: ChannelVideo[];
}

const compact = (n: number) =>
  n >= 10_000_000
    ? `${(n / 10_000_000).toFixed(2)} Cr`
    : n >= 100_000
      ? `${(n / 100_000).toFixed(2)} L`
      : n.toLocaleString();

export function ChannelTags() {
  const [channel, setChannel] = useState("");
  const [data, setData] = useState<ChannelResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openVideo, setOpenVideo] = useState<VideoRef | null>(null);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    if (!channel.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/research/channel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Failed");
      setData(j);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5">
      <form onSubmit={run} className="card flex flex-col gap-3 sm:flex-row">
        <input
          className="input flex-1"
          value={channel}
          onChange={(e) => setChannel(e.target.value)}
          placeholder="Channel link, @handle or channel ID"
        />
        <button className="btn-primary" disabled={loading}>
          {loading ? "Reading…" : "Get channel tags"}
        </button>
      </form>

      {error && <div className="card border-red-500/40 text-red-300">{error}</div>}

      {data && (
        <>
          <div className="card space-y-5">
            <div className="flex items-center gap-4">
              {data.thumbnail && (
                <Image
                  src={data.thumbnail}
                  alt={data.title}
                  width={72}
                  height={72}
                  className="h-16 w-16 shrink-0 rounded-full object-cover"
                  unoptimized
                />
              )}
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-xl font-bold text-slate-50">{data.title}</h3>
                <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-400">
                  <span className="chip">{compact(data.subscribers)} subscribers</span>
                  <span className="chip">{data.videoCount.toLocaleString()} videos</span>
                  <span className="chip">{compact(data.views)} views</span>
                  <span className="chip">{data.count} channel tags</span>
                </div>
              </div>
              {data.count > 0 && <CopyButton text={data.tagBox.text} label="Copy all" />}
            </div>

            {data.count === 0 ? (
              <p className="text-sm text-slate-400">
                This channel has no public channel keywords set (many channels leave them empty).
                Video tags below still work.
              </p>
            ) : (
              <TagRankBlock
                title="Channel tags (currently trending — search rank)"
                tags={data.trending}
                emptyNote="None of this channel's tags currently rank in live search demand."
              />
            )}

            {data.notTrending.length > 0 && (
              <div>
                <div className="label">Channel tags NOT trending</div>
                <div className="mt-1 flex flex-wrap gap-1">
                  {data.notTrending.map((t) => (
                    <span key={t} className="chip text-slate-500 line-through">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {data.suggestions.length > 0 && (
              <TagRankBlock
                title="Stronger channel tags to add"
                tags={data.suggestions}
                emptyNote="No stronger tags found."
                highlight
              />
            )}

            <p className="text-xs text-slate-500">
              Rank = position in live YouTube autocomplete (what people actually search) — an
              honest demand proxy, not an official metric.
            </p>
          </div>

          <div className="card">
            <h3 className="text-lg font-bold text-slate-50">Videos on this channel</h3>
            <p className="mb-4 mt-1 text-xs text-slate-500">
              Click any video to see its real tags with rank, description and upload date.
            </p>
            {data.videos.length === 0 ? (
              <p className="text-sm text-slate-400">No public uploads found.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {data.videos.map((v, i) => (
                  <button
                    key={v.videoId}
                    type="button"
                    onClick={() =>
                      setOpenVideo({
                        videoId: v.videoId,
                        title: v.title,
                        channel: v.channel,
                        views: v.views,
                        publishedText: v.publishedText,
                        thumbnail: v.thumbnail,
                        url: v.url,
                        rank: i + 1,
                      })
                    }
                    className="group overflow-hidden rounded-xl border border-ink-line bg-ink-soft text-left transition hover:border-brand-400/60"
                  >
                    <Image
                      src={v.thumbnail}
                      alt={v.title}
                      width={320}
                      height={180}
                      className="aspect-video w-full object-cover"
                      unoptimized
                    />
                    <div className="p-3">
                      <div className="line-clamp-2 text-sm font-semibold text-slate-100">
                        {v.title}
                      </div>
                      <div className="mt-1.5 flex flex-wrap gap-1.5 text-xs text-slate-400">
                        <span className="chip">{compact(v.views)} views</span>
                        {v.publishedText && <span className="chip">{v.publishedText}</span>}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {openVideo && (
        <VideoDetailModal video={openVideo} onClose={() => setOpenVideo(null)} />
      )}
    </div>
  );
}
