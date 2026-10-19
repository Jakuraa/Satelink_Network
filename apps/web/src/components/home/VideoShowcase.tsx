"use client";

import React, { useState } from "react";
import Image from "next/image";
import { Play, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";

export interface VideoItem {
  id: string;
  title: string;
  publisher: string;
  publisherUrl?: string;
  description: string;
  relevance: string;
  category: string;
}

export const CURATED_VIDEOS: VideoItem[] = [
  {
    id: "S6wc6yvoZLY",
    title: "AI agents are paying each other now…",
    publisher: "Fireship",
    publisherUrl: "https://www.youtube.com/@Fireship",
    description:
      "A technical walkthrough of the HTTP 402 Payment Required status code, the open x402 specification, and how autonomous AI agents purchase API access and digital compute without human credit card checkouts.",
    relevance:
      "Directly illustrates the machine-to-machine payment problem Satelink addresses: allowing agents to discover priced endpoints, authorize access, and pay keylessly over Base or prepaid vaults.",
    category: "Machine Payments & x402",
  },
  {
    id: "CQywdSdi5iA",
    title: "The Model Context Protocol (MCP)",
    publisher: "Anthropic",
    publisherUrl: "https://www.youtube.com/@anthropic-ai",
    description:
      "An overview of the Model Context Protocol (MCP) standard for connecting AI models to external tools, databases, and APIs via standardized client-server interfaces.",
    relevance:
      "Explains the open integration pattern connecting AI agents with external tools and service registries, directly reflecting Satelink's MCP server and machine discovery architecture.",
    category: "Agent Tool Protocols & MCP",
  },
];

export function VideoShowcase() {
  const [activeVideo, setActiveVideo] = useState<string | null>(null);

  return (
    <div className="grid gap-8 lg:grid-cols-2">
      {CURATED_VIDEOS.map((video) => {
        const isPlaying = activeVideo === video.id;

        return (
          <Card key={video.id} className="flex flex-col overflow-hidden p-0 border-sl-border bg-sl-surface">
            {/* Video Container (16:9) */}
            <div className="relative aspect-video w-full overflow-hidden bg-sl-bg-dark border-b border-sl-border">
              {isPlaying ? (
                <iframe
                  className="h-full w-full"
                  src={`https://www.youtube-nocookie.com/embed/${video.id}?autoplay=1&rel=0`}
                  title={video.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setActiveVideo(video.id)}
                  className="group relative flex h-full w-full items-center justify-center text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-sl-accent"
                  aria-label={`Play video: ${video.title} by ${video.publisher}`}
                >
                  {/* Thumbnail Image */}
                  <Image
                    src={`https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`}
                    alt={video.title}
                    fill
                    sizes="(max-width: 768px) 100vw, 50vw"
                    className="object-cover opacity-85 transition-transform duration-300 group-hover:scale-105 group-hover:opacity-100"
                    unoptimized
                  />

                  {/* Dark gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/10 transition-opacity group-hover:opacity-75" />

                  {/* Play Button Icon */}
                  <div className="relative z-10 flex size-14 items-center justify-center rounded-full bg-sl-accent text-sl-accent-ink shadow-lg transition-transform duration-200 group-hover:scale-110">
                    <Play className="ml-1 size-6 fill-current" />
                  </div>

                  {/* Video Badge on thumbnail */}
                  <div className="absolute top-3 left-3 z-10">
                    <span className="rounded bg-black/70 px-2 py-1 font-sl-mono text-[11px] text-white backdrop-blur-sm">
                      {video.category}
                    </span>
                  </div>

                  {/* Fallback & Prompt */}
                  <div className="absolute bottom-3 left-3 right-3 z-10 text-xs text-white/90">
                    <span className="font-medium">Click to load privacy-enhanced video</span>
                  </div>
                </button>
              )}
            </div>

            {/* Video Details */}
            <div className="flex flex-1 flex-col p-6">
              <div className="flex items-center justify-between gap-2">
                <Badge variant="neutral">{video.category}</Badge>
                <a
                  href={`https://www.youtube.com/watch?v=${video.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-sl-mono text-xs text-sl-text-subtle hover:text-sl-text transition-colors"
                >
                  <span>Watch on YouTube</span>
                  <ExternalLink className="size-3" />
                </a>
              </div>

              <h3 className="mt-3 font-semibold text-lg leading-snug text-sl-text">
                {video.title}
              </h3>

              <p className="mt-1 font-sl-mono text-xs text-sl-text-subtle">
                Published by{" "}
                <a
                  href={video.publisherUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-sl-text transition-colors"
                >
                  {video.publisher}
                </a>{" "}
                · Independent Technical Analysis
              </p>

              <p className="mt-3 text-sm leading-relaxed text-sl-text-muted flex-1">
                {video.description}
              </p>

              <div className="mt-4 rounded border border-sl-border bg-sl-bg-raised p-3 text-xs leading-relaxed text-sl-text-muted">
                <strong className="font-semibold text-sl-text">Relevance to Satelink: </strong>
                {video.relevance}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
