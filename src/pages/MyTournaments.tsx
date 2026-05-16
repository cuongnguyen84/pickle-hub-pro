import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Eye, Share2, Trash2, LogIn } from "lucide-react";
import { useI18n } from "@/i18n";
import { useAuth } from "@/hooks/useAuth";
import { useUserCreateQuota } from "@/hooks/useUserCreateQuota";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { TheLineLayout } from "@/components/layout/TheLineLayout";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { getLoginUrl } from "@/lib/auth-config";

type ToolKind = "quick" | "doubles" | "flex" | "team";
type FilterKind = "all" | ToolKind;

interface UnifiedTournament {
  id: string;
  toolKind: ToolKind;
  name: string;
  status: string;
  created_at: string | null;
  url: string;
  shareUrl: string;
}

const toolAccent: Record<ToolKind, string> = {
  quick: "#00b96b",
  doubles: "#e9b649",
  flex: "#4f9bff",
  team: "#ff7a4d",
};

const toolBadge = (kind: ToolKind, isVi: boolean): string => {
  if (kind === "quick") return isVi ? "BẢNG NHANH" : "QUICK";
  if (kind === "doubles") return isVi ? "LOẠI ĐÔI" : "DOUBLES";
  if (kind === "flex") return isVi ? "LINH HOẠT" : "FLEX";
  return isVi ? "ĐỒNG ĐỘI" : "TEAM MATCH";
};

const statusPillStyle = (status: string): React.CSSProperties => {
  if (status === "completed") return { background: "var(--tl-surface)", color: "var(--tl-fg-3)" };
  if (status === "ongoing" || status === "active") return { background: "var(--tl-green-glow)", color: "var(--tl-green)" };
  if (status === "registration") return { background: "rgba(79, 155, 255, 0.12)", color: "rgb(79, 155, 255)" };
  return { background: "rgba(233, 182, 73, 0.12)", color: "var(--tl-gold)" };
};

const tlTabsListClass =
  "flex w-full overflow-x-auto !p-0 !bg-transparent !border-b !border-[var(--tl-border)] !rounded-none gap-2";

const formatDate = (iso: string | null): string => {
  if (!iso) return "—";
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
};

const MyTournaments = () => {
  const { language } = useI18n();
  const isVi = language === "vi";
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { quota, used: quotaUsed } = useUserCreateQuota();

  const [filter, setFilter] = useState<FilterKind>("all");
  const [deleteTarget, setDeleteTarget] = useState<UnifiedTournament | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Force /vi prefix language when arriving via /vi/account/*. The
  // I18nProvider already picks up /vi/ prefixes, so this is just defensive.
  useEffect(() => {
    if (!user) return;
  }, [user]);

  const { data: quickRows = [], isLoading: loadingQuick } = useQuery({
    queryKey: ["my-tournaments", "quick", user?.id ?? null],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quick_tables")
        .select("id, name, status, created_at, share_id")
        .eq("creator_user_id", user!.id);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 30_000,
  });

  const { data: doublesRows = [], isLoading: loadingDoubles } = useQuery({
    queryKey: ["my-tournaments", "doubles", user?.id ?? null],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("doubles_elimination_tournaments")
        .select("id, name, status, created_at, share_id")
        .eq("creator_user_id", user!.id);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 30_000,
  });

  const { data: flexRows = [], isLoading: loadingFlex } = useQuery({
    queryKey: ["my-tournaments", "flex", user?.id ?? null],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("flex_tournaments")
        .select("id, name, status, created_at, share_id")
        .eq("creator_user_id", user!.id);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 30_000,
  });

  const { data: teamRows = [], isLoading: loadingTeam } = useQuery({
    queryKey: ["my-tournaments", "team", user?.id ?? null],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_match_tournaments")
        .select("id, name, status, created_at")
        .eq("created_by", user!.id);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 30_000,
  });

  const isLoading = loadingQuick || loadingDoubles || loadingFlex || loadingTeam;

  const unified = useMemo<UnifiedTournament[]>(() => {
    const origin = typeof window !== "undefined" ? window.location.origin : "https://www.thepicklehub.net";
    const rows: UnifiedTournament[] = [];

    quickRows.forEach((r) => {
      rows.push({
        id: r.id,
        toolKind: "quick",
        name: r.name ?? "",
        status: r.status ?? "active",
        created_at: r.created_at,
        url: `/tools/quick-tables/${r.share_id}`,
        shareUrl: `${origin}/tools/quick-tables/${r.share_id}`,
      });
    });

    doublesRows.forEach((r) => {
      rows.push({
        id: r.id,
        toolKind: "doubles",
        name: r.name ?? "",
        status: r.status ?? "active",
        created_at: r.created_at,
        url: `/tools/doubles-elimination/${r.share_id}`,
        shareUrl: `${origin}/tools/doubles-elimination/${r.share_id}`,
      });
    });

    flexRows.forEach((r) => {
      rows.push({
        id: r.id,
        toolKind: "flex",
        name: r.name ?? "",
        status: r.status ?? "active",
        created_at: r.created_at,
        url: `/tools/flex-tournament/${r.share_id}`,
        shareUrl: `${origin}/tools/flex-tournament/${r.share_id}`,
      });
    });

    teamRows.forEach((r) => {
      // team_match URLs use raw UUID, not share_id
      rows.push({
        id: r.id,
        toolKind: "team",
        name: r.name ?? "",
        status: r.status ?? "active",
        created_at: r.created_at,
        url: `/tools/team-match/${r.id}`,
        shareUrl: `${origin}/tools/team-match/${r.id}`,
      });
    });

    return rows.sort((a, b) => {
      const ta = a.created_at ? new Date(a.created_at).getTime() : 0;
      const tb = b.created_at ? new Date(b.created_at).getTime() : 0;
      return tb - ta;
    });
  }, [quickRows, doublesRows, flexRows, teamRows]);

  const visible = useMemo(() => {
    if (filter === "all") return unified;
    return unified.filter((t) => t.toolKind === filter);
  }, [unified, filter]);

  const counts = useMemo(() => ({
    all: unified.length,
    quick: unified.filter((t) => t.toolKind === "quick").length,
    doubles: unified.filter((t) => t.toolKind === "doubles").length,
    flex: unified.filter((t) => t.toolKind === "flex").length,
    team: unified.filter((t) => t.toolKind === "team").length,
  }), [unified]);

  const handleShare = async (row: UnifiedTournament) => {
    try {
      await navigator.clipboard.writeText(row.shareUrl);
      toast({
        title: isVi ? "Đã sao chép link" : "Link copied",
        description: row.shareUrl,
      });
    } catch {
      toast({
        title: isVi ? "Lỗi" : "Error",
        description: isVi ? "Không thể sao chép link" : "Could not copy link",
        variant: "destructive",
      });
    }
  };

  const performDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      let error: { message: string } | null = null;
      if (deleteTarget.toolKind === "quick") {
        const res = await supabase.rpc("delete_quick_table", { _table_id: deleteTarget.id });
        error = res.error;
      } else if (deleteTarget.toolKind === "doubles") {
        const res = await supabase.from("doubles_elimination_tournaments").delete().eq("id", deleteTarget.id);
        error = res.error;
      } else if (deleteTarget.toolKind === "flex") {
        const res = await supabase.from("flex_tournaments").delete().eq("id", deleteTarget.id);
        error = res.error;
      } else {
        const res = await supabase.from("team_match_tournaments").delete().eq("id", deleteTarget.id);
        error = res.error;
      }

      if (error) throw new Error(error.message);

      toast({
        title: isVi ? "Đã xóa" : "Deleted",
        description: deleteTarget.name,
      });

      // Invalidate all 4 query slices + any quota-dependent ones
      queryClient.invalidateQueries({ queryKey: ["my-tournaments"] });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      toast({
        title: isVi ? "Lỗi" : "Error",
        description: msg,
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  const tabsConfig: { key: FilterKind; labelEn: string; labelVi: string; count: number }[] = [
    { key: "all", labelEn: "All", labelVi: "Tất cả", count: counts.all },
    { key: "quick", labelEn: "Quick Tables", labelVi: "Bảng đấu nhanh", count: counts.quick },
    { key: "doubles", labelEn: "Doubles", labelVi: "Loại trực tiếp Đôi", count: counts.doubles },
    { key: "flex", labelEn: "Flex", labelVi: "Linh hoạt", count: counts.flex },
    { key: "team", labelEn: "Team Match", labelVi: "Đấu đồng đội", count: counts.team },
  ];

  return (
    <TheLineLayout
      title={isVi ? "Giải đấu của tôi" : "My Tournaments"}
      description={isVi
        ? "Quản lý tất cả giải đấu pickleball bạn đã tạo trên ThePickleHub."
        : "Manage all pickleball tournaments you've created on ThePickleHub."}
      noindex
    >
      <div className="tl-shell">
        <nav className="tl-breadcrumb">
          <Link to="/">{isVi ? "Trang chủ" : "Home"}</Link>
          <span className="sep">/</span>
          <Link to="/account">{isVi ? "Tài khoản" : "Account"}</Link>
          <span className="sep">/</span>
          <span className="current">{isVi ? "Giải đấu của tôi" : "My Tournaments"}</span>
        </nav>

        <header className="tl-page-head">
          <div className="kicker">
            {isVi ? "◆ Cá nhân · Tất cả công cụ" : "◆ Personal · All tools"}
          </div>
          <h1>
            <em className="tl-serif">
              {isVi ? "Giải đấu" : "Tournaments"}
            </em>{" "}
            <span className="sans">
              {isVi ? "của tôi." : "of mine."}
            </span>
          </h1>
          <p>
            {isVi
              ? "Tất cả giải đấu bạn đã tạo qua Bảng đấu nhanh, Loại trực tiếp Đôi, Linh hoạt, và Đấu đồng đội. Xem, chia sẻ, hoặc xóa từ một nơi."
              : "Every tournament you've created across Quick Tables, Doubles Elimination, Flex, and Team Match. View, share, or delete from one place."}
          </p>
        </header>

        {!user ? (
          <section style={{ marginTop: 32 }}>
            <div className="tl-empty-card">
              <span className="tl-empty-card-mark">◌</span>
              <span className="tl-empty-card-label">
                {isVi ? "Vui lòng đăng nhập" : "Please sign in"}
              </span>
              <p className="tl-empty-card-hint">
                {isVi
                  ? "Đăng nhập để xem các giải đấu bạn đã tạo."
                  : "Sign in to see tournaments you've created."}
              </p>
              <Link
                to={getLoginUrl(location.pathname)}
                className="tl-btn green"
                style={{ marginTop: 14 }}
              >
                <LogIn className="w-4 h-4" />
                {isVi ? "Đăng nhập" : "Sign in"}
              </Link>
            </div>
          </section>
        ) : (
          <>
            {/* Quota stats */}
            <section className="tl-stats-row" style={{ marginTop: 32 }}>
              <div className="tl-stat-box">
                <div className="lbl">{isVi ? "Tổng đã tạo" : "Total created"}</div>
                <div className="val">
                  <span className={unified.length > 0 ? "green" : ""}>{unified.length}</span>
                </div>
                <div className="sub">{isVi ? "Mọi công cụ" : "All tools"}</div>
              </div>
              <div className="tl-stat-box">
                <div className="lbl">{isVi ? "Hạn mức" : "Quota"}</div>
                <div className="val">
                  <span className={quotaUsed >= quota ? "" : "green"}>{quotaUsed}</span>
                  <span style={{ color: "var(--tl-fg-4)", fontSize: "0.6em" }}>/{quota}</span>
                </div>
                <div className="sub">
                  {quota > 0 ? Math.min(100, Math.round((quotaUsed / quota) * 100)) : 0}%{" "}
                  {isVi ? "đã dùng" : "used"}
                </div>
              </div>
            </section>

            {/* Filter tabs */}
            <section style={{ marginTop: 32 }}>
              <div className={tlTabsListClass} role="tablist">
                {tabsConfig.map((tab) => {
                  const active = filter === tab.key;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setFilter(tab.key)}
                      style={{
                        padding: "8px 12px",
                        fontSize: 11,
                        fontWeight: 500,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        fontFamily: "Geist Mono, ui-monospace, monospace",
                        color: active ? "var(--tl-fg)" : "var(--tl-fg-3)",
                        background: "transparent",
                        border: "none",
                        borderBottom: `2px solid ${active ? "var(--tl-green)" : "transparent"}`,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                        transition: "color 0.15s",
                      }}
                    >
                      {isVi ? tab.labelVi : tab.labelEn} · {tab.count}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* List */}
            <section style={{ marginTop: 24, marginBottom: 56 }}>
              {isLoading ? (
                <div style={{ display: "flex", justifyContent: "center", padding: "48px 0" }}>
                  <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--tl-fg-3)" }} />
                </div>
              ) : visible.length === 0 ? (
                <div className="tl-empty-card">
                  <span className="tl-empty-card-mark">◌</span>
                  <span className="tl-empty-card-label">
                    {filter === "all"
                      ? (isVi ? "Chưa có giải đấu nào" : "No tournaments yet")
                      : (isVi ? "Không có giải đấu trong mục này" : "No tournaments in this filter")}
                  </span>
                  <p className="tl-empty-card-hint">
                    {isVi
                      ? "Bắt đầu bằng cách tạo một bảng đấu trong Bracket Lab."
                      : "Start by creating a bracket in Bracket Lab."}
                  </p>
                  <Link to="/tools" className="tl-btn green" style={{ marginTop: 14 }}>
                    {isVi ? "Tạo giải đấu đầu tiên" : "Create your first tournament"}
                  </Link>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {visible.map((row) => (
                    <article
                      key={`${row.toolKind}-${row.id}`}
                      style={{
                        background: "var(--tl-bg-elev)",
                        border: "1px solid var(--tl-border)",
                        borderLeft: `3px solid ${toolAccent[row.toolKind]}`,
                        borderRadius: "var(--tl-radius-lg)",
                        padding: "16px 20px",
                        display: "flex",
                        alignItems: "center",
                        gap: 16,
                        flexWrap: "wrap",
                      }}
                    >
                      <span
                        style={{
                          fontFamily: "Geist Mono, ui-monospace, monospace",
                          fontSize: 10,
                          fontWeight: 600,
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                          color: toolAccent[row.toolKind],
                          padding: "3px 8px",
                          border: `1px solid ${toolAccent[row.toolKind]}`,
                          borderRadius: 4,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {toolBadge(row.toolKind, isVi)}
                      </span>

                      <div style={{ flex: "1 1 200px", minWidth: 0 }}>
                        <Link
                          to={row.url}
                          style={{
                            fontFamily: "Instrument Serif, serif",
                            fontStyle: "italic",
                            fontSize: 22,
                            fontWeight: 400,
                            color: "var(--tl-fg)",
                            textDecoration: "none",
                            lineHeight: 1.2,
                            display: "block",
                          }}
                        >
                          {row.name || (isVi ? "Không tên" : "Untitled")}
                        </Link>
                        <div
                          style={{
                            fontFamily: "Geist Mono, ui-monospace, monospace",
                            fontSize: 11,
                            color: "var(--tl-fg-3)",
                            marginTop: 4,
                            letterSpacing: "0.04em",
                          }}
                        >
                          {formatDate(row.created_at)}
                        </div>
                      </div>

                      <span
                        style={{
                          fontFamily: "Geist Mono, ui-monospace, monospace",
                          fontSize: 10,
                          fontWeight: 600,
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                          padding: "4px 10px",
                          borderRadius: 999,
                          ...statusPillStyle(row.status),
                        }}
                      >
                        {row.status}
                      </span>

                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <button
                          type="button"
                          className="tl-btn"
                          onClick={() => navigate(row.url)}
                          style={{ padding: "8px 12px", fontSize: 13 }}
                          aria-label={isVi ? "Xem" : "View"}
                          title={isVi ? "Xem" : "View"}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>{isVi ? "Xem" : "View"}</span>
                        </button>
                        <button
                          type="button"
                          className="tl-btn"
                          onClick={() => handleShare(row)}
                          style={{ padding: "8px 12px", fontSize: 13 }}
                          aria-label={isVi ? "Chia sẻ" : "Share"}
                          title={isVi ? "Chia sẻ" : "Share"}
                        >
                          <Share2 className="w-3.5 h-3.5" />
                          <span>{isVi ? "Chia sẻ" : "Share"}</span>
                        </button>
                        <button
                          type="button"
                          className="tl-btn"
                          onClick={() => setDeleteTarget(row)}
                          style={{
                            padding: "8px 12px",
                            fontSize: 13,
                            color: "var(--tl-fg-2)",
                          }}
                          aria-label={isVi ? "Xóa" : "Delete"}
                          title={isVi ? "Xóa" : "Delete"}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>{isVi ? "Xóa" : "Delete"}</span>
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>

      <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && !isDeleting && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isVi ? "Xóa giải đấu?" : "Delete tournament?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isVi
                ? `"${deleteTarget?.name ?? ""}" sẽ bị xóa vĩnh viễn cùng tất cả dữ liệu liên quan. Hành động này không thể hoàn tác.`
                : `"${deleteTarget?.name ?? ""}" will be permanently deleted along with all related data. This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              {isVi ? "Hủy" : "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                performDelete();
              }}
              disabled={isDeleting}
            >
              {isDeleting ? (isVi ? "Đang xóa..." : "Deleting...") : (isVi ? "Xóa" : "Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TheLineLayout>
  );
};

export default MyTournaments;
