"use client";

import Link from "next/link";

interface WorldCardProps {
  readonly worldId: string;
  readonly thumbnail: string | null;
  readonly title: string;
  readonly author: string;
  readonly playCount: number;
  readonly likeCount: number;
  readonly tags: readonly string[];
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default function WorldCard({
  worldId,
  thumbnail,
  title,
  author,
  playCount,
  likeCount,
  tags,
}: WorldCardProps) {
  return (
    <Link
      href={`/play/${worldId}`}
      style={{ textDecoration: "none", color: "inherit", display: "block" }}
    >
      <div
        style={{
          position: "relative",
          borderRadius: 16,
          overflow: "hidden",
          background: "rgba(255, 255, 255, 0.05)",
          backdropFilter: "blur(16px)",
          border: "1px solid rgba(255, 255, 255, 0.1)",
          transition: "transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease",
          cursor: "pointer",
        }}
        onMouseEnter={(e) => {
          const el = e.currentTarget;
          el.style.transform = "translateY(-4px) scale(1.02)";
          el.style.boxShadow = "0 12px 40px rgba(0, 0, 0, 0.4)";
          el.style.borderColor = "rgba(96, 165, 250, 0.4)";
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget;
          el.style.transform = "translateY(0) scale(1)";
          el.style.boxShadow = "none";
          el.style.borderColor = "rgba(255, 255, 255, 0.1)";
        }}
      >
        {/* Thumbnail */}
        <div
          style={{
            width: "100%",
            height: 180,
            background: thumbnail
              ? `url(${thumbnail}) center/cover no-repeat`
              : "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
            position: "relative",
          }}
        >
          {!thumbnail && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "rgba(255, 255, 255, 0.3)",
                fontSize: 40,
              }}
            >
              🌍
            </div>
          )}
        </div>

        {/* Content */}
        <div style={{ padding: "12px 16px 16px" }}>
          <h3
            style={{
              margin: 0,
              fontSize: 16,
              fontWeight: 600,
              color: "#f1f5f9",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {title}
          </h3>

          <p
            style={{
              margin: "4px 0 0",
              fontSize: 13,
              color: "rgba(148, 163, 184, 0.8)",
            }}
          >
            by {author}
          </p>

          {/* Stats */}
          <div
            style={{
              display: "flex",
              gap: 12,
              marginTop: 10,
              fontSize: 12,
              color: "rgba(148, 163, 184, 0.7)",
            }}
          >
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              {formatCount(playCount)}
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
              {formatCount(likeCount)}
            </span>
          </div>

          {/* Tags */}
          {tags.length > 0 && (
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 4,
                marginTop: 10,
              }}
            >
              {tags.slice(0, 4).map((tag) => (
                <span
                  key={tag}
                  style={{
                    padding: "2px 8px",
                    borderRadius: 9999,
                    background: "rgba(96, 165, 250, 0.12)",
                    color: "rgba(96, 165, 250, 0.9)",
                    fontSize: 11,
                    fontWeight: 500,
                    border: "1px solid rgba(96, 165, 250, 0.15)",
                  }}
                >
                  {tag}
                </span>
              ))}
              {tags.length > 4 && (
                <span
                  style={{
                    padding: "2px 8px",
                    borderRadius: 9999,
                    background: "rgba(255, 255, 255, 0.05)",
                    color: "rgba(148, 163, 184, 0.6)",
                    fontSize: 11,
                  }}
                >
                  +{tags.length - 4}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </Link>
  );
}
