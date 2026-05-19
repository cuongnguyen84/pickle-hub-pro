import { useMemo } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useI18n } from "@/i18n";
import { useAuth } from "@/hooks/useAuth";
import { useForumPosts } from "@/hooks/useForumPosts";
import { useForumCategories } from "@/hooks/useForumCategories";
import { TheLineLayout } from "@/components/layout/TheLineLayout";
import { formatRelative } from "./preview/_shell";

const Forum = () => {
  const { language } = useI18n();
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const categorySlug = searchParams.get("category") || undefined;

  const { data: categories = [] } = useForumCategories();
  const { data: posts = [], isLoading } = useForumPosts({ categorySlug, limit: 60 });

  const setCategory = (slug: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (slug) next.set("category", slug);
    else next.delete("category");
    setSearchParams(next, { replace: true });
  };

  const totalPosts = useMemo(() => posts.length, [posts]);

  return (
    <TheLineLayout
      title={language === "vi" ? "Diễn đàn" : "Forum"}
      description={language === "vi"
        ? "Cộng đồng pickleball — câu hỏi, tìm bạn đánh, đánh giá thiết bị, bàn luận giải đấu."
        : "Pickleball community — questions, partner finder, equipment reviews, tournament chat."}
    >
      <div className="tl-shell">
        <nav className="tl-breadcrumb">
          <Link to={language === "vi" ? "/vi" : "/"}>{language === "vi" ? "Trang chủ" : "Home"}</Link>
          <span className="sep">/</span>
          <span className="current">{language === "vi" ? "Diễn đàn" : "Forum"}</span>
        </nav>

        <header
          className="tl-page-head"
          style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 24, flexWrap: "wrap" }}
        >
          <div>
            <div className="kicker">◆ {language === "vi" ? "Cộng đồng" : "Community"}</div>
            <h1>
              {language === "vi" ? (
                <>
                  Đặt câu hỏi, <em className="tl-serif">chia sẻ,</em> <br />
                  <span className="dim">tìm bạn đánh,</span> <span className="sans">cùng cộng đồng.</span>
                </>
              ) : (
                <>
                  Ask, share, <em className="tl-serif">find partners,</em> <br />
                  <span className="dim">talk shop</span> <span className="sans">with the community.</span>
                </>
              )}
            </h1>
            <p>
              {language === "vi"
                ? "Câu hỏi luật, đánh giá vợt, tìm bạn đánh đôi, bàn luận giải đấu — viết cho nhau, không cho thuật toán."
                : "Rules questions, paddle reviews, partner finder, tournament chat — written for each other, not the algorithm."}
            </p>
          </div>
          {user ? (
            <Link to="/forum/new" className="tl-btn green">
              + {language === "vi" ? "Bài mới" : "New post"}
            </Link>
          ) : (
            <Link to="/login" className="tl-btn">
              {language === "vi" ? "Đăng nhập để đăng bài" : "Sign in to post"}
            </Link>
          )}
        </header>

        {/* Category filter pills */}
        {categories.length > 0 && (
          <div className="tl-filters">
            <button
              type="button"
              className={`tl-filter ${!categorySlug ? "active" : ""}`}
              onClick={() => setCategory(null)}
            >
              {language === "vi" ? "Tất cả" : "All"}
              <span className="count">{totalPosts}</span>
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                className={`tl-filter ${categorySlug === cat.slug ? "active" : ""}`}
                onClick={() => setCategory(cat.slug)}
              >
                {language === "en" && cat.name_en ? cat.name_en : cat.name}
              </button>
            ))}
          </div>
        )}

        <div style={{ paddingBottom: 80 }}>
          {isLoading ? (
            <div className="tl-empty">
              <p style={{ fontFamily: "Geist Mono", fontSize: 12, letterSpacing: "0.04em" }}>
                {language === "vi" ? "Đang tải bài viết…" : "Loading discussions…"}
              </p>
            </div>
          ) : posts.length === 0 ? (
            <div className="tl-empty">
              <h3>{language === "vi" ? "Chưa có thảo luận." : "No discussions yet."}</h3>
              <p>
                {language === "vi"
                  ? "Là người đầu tiên đặt câu hỏi hoặc chia sẻ — cộng đồng đang chờ bạn."
                  : "Be the first to start a discussion — the community is waiting."}
              </p>
              {user ? (
                <Link to="/forum/new" className="tl-btn green">
                  + {language === "vi" ? "Đăng bài đầu tiên" : "Post the first thread"}
                </Link>
              ) : (
                <Link to="/login" className="tl-btn">
                  {language === "vi" ? "Đăng nhập" : "Sign in"}
                </Link>
              )}
            </div>
          ) : (
            <div className="tl-thread-list">
              {posts.map((post) => (
                <Link key={post.id} to={`/forum/post/${post.id}`} className="tl-thread-row">
                  <div className="tl-thread-body">
                    <div className="tl-thread-meta-top">
                      {post.is_pinned && (
                        <span className="tl-thread-pin">📌 {language === "vi" ? "Ghim" : "Pinned"}</span>
                      )}
                      {post.category_name && <span className="tl-thread-cat">◆ {post.category_name}</span>}
                      {post.is_qa && (
                        <span className="tl-thread-qa">{language === "vi" ? "Q&A" : "Q&A"}</span>
                      )}
                    </div>
                    <h3 className="tl-thread-title">{post.title}</h3>
                    <div className="tl-thread-meta">
                      <span><b>{post.author_name ?? "—"}</b></span>
                      <span className="sep">·</span>
                      <span>{formatRelative(post.created_at)}</span>
                      {post.tags.length > 0 && (
                        <>
                          <span className="sep">·</span>
                          <span>{post.tags.slice(0, 3).map((t) => `#${t}`).join(" ")}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="tl-thread-stats">
                    <div>
                      <span className="n">{post.comment_count}</span>
                      <span className="lbl">{language === "vi" ? "câu trả lời" : "replies"}</span>
                    </div>
                    <div>
                      <span className="n">{post.like_count}</span>
                      <span className="lbl">{language === "vi" ? "lượt thích" : "likes"}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </TheLineLayout>
  );
};

export default Forum;
