import { useProfilePosts } from "@/hooks/social/useProfilePosts";
import { SOCIAL_POST_TOPICS } from "@/hooks/social/useSocialPosts";
import { formatMatchWhen } from "@/lib/social/feed-formatters";
import type { Language } from "@/lib/social/feed-formatters";

/**
 * "Community posts" section on the public profile page: the user's
 * approved social_posts, newest first, as a compact photo grid list.
 * Renders nothing while loading or when the user has no approved
 * posts (most athlete profiles), so it never adds an empty block.
 */
export function ProfilePosts({
  userId,
  language,
}: {
  userId: string;
  language: Language;
}) {
  const { data } = useProfilePosts(userId);
  if (!data || data.total === 0) return null;

  return (
    <section style={{ marginTop: 32 }} aria-label={language === "vi" ? "Bài viết cộng đồng" : "Community posts"}>
      <h2
        style={{
          fontFamily: "'Geist Mono', monospace",
          fontSize: 12,
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          color: "var(--tl-fg-2)",
          margin: "0 0 14px",
        }}
      >
        {language === "vi" ? "Bài viết cộng đồng" : "Community posts"} ({data.total})
      </h2>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: 16,
        }}
      >
        {data.posts.map((post) => {
          const topic = SOCIAL_POST_TOPICS.find((t) => t.key === post.topic);
          return (
            <article
              key={post.id}
              style={{
                border: "1px solid var(--tl-border)",
                borderRadius: 10,
                overflow: "hidden",
                background: "var(--tl-surface, transparent)",
              }}
            >
              <img
                src={post.image_url}
                alt={post.body ?? ""}
                loading="lazy"
                decoding="async"
                style={{
                  width: "100%",
                  aspectRatio: "4 / 3",
                  objectFit: "cover",
                  display: "block",
                }}
              />
              <div style={{ padding: "10px 12px 12px" }}>
                <p
                  style={{
                    fontSize: 11,
                    color: "var(--tl-fg-2)",
                    margin: "0 0 6px",
                    fontFamily: "'Geist Mono', monospace",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                  }}
                >
                  {formatMatchWhen(post.created_at, language, "desktop")}
                  {topic ? ` · ${language === "vi" ? topic.vi : topic.en}` : ""}
                </p>
                {post.body && (
                  <p
                    style={{
                      fontSize: 13.5,
                      lineHeight: 1.5,
                      color: "var(--tl-fg)",
                      margin: 0,
                      display: "-webkit-box",
                      WebkitLineClamp: 3,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {post.body}
                  </p>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
