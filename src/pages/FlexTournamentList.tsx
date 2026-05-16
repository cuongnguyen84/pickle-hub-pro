import { useI18n } from "@/i18n";
import { TheLineLayout } from "@/components/layout";
import { HreflangTags, WebApplicationSchema, FlexTournamentSeoContent, ToolsInternalLinks, FAQSchema } from "@/components/seo";
import { useFlexTournament } from "@/hooks/useFlexTournament";
import { useUserCreateQuota } from "@/hooks/useUserCreateQuota";
import { useAuth } from "@/hooks/useAuth";
import { Plus, Eye, Trash2, Globe, Lock, Loader2, LogIn, Layers } from "lucide-react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { format } from "date-fns";
import { useState, useEffect } from "react";
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
import { useToast } from "@/hooks/use-toast";
import { getLoginUrl } from "@/lib/auth-config";

const surfaceCard: React.CSSProperties = {
  background: "var(--tl-bg-elev)",
  border: "1px solid var(--tl-border)",
  borderRadius: "var(--tl-radius-lg)",
  padding: 24,
};

const FlexTournamentList = () => {
  const { t, language, setLanguageFromUrl } = useI18n();
  const { user } = useAuth();
  const location = useLocation();

  // EN route — force English regardless of persisted language state
  useEffect(() => {
    setLanguageFromUrl("en");
  }, [setLanguageFromUrl]);
  const { myTournaments, isLoadingTournaments, publicTournaments, isLoadingPublic, deleteTournament, isDeleting } = useFlexTournament();
  const { quota, used: totalUsed } = useUserCreateQuota();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // W3.2 — quota usage for the stats-row. Reads the same column the
  // create_flex_tournament_with_quota RPC enforces against, so the UI
  // and the server agree on "X / Y".
  const usedCount = myTournaments.length;
  // TOTAL quota across all 4 tournament tools (Codex P1 fix on #106):
  // quota check + stats-row "X/Y" must reflect the cross-tool sum, not the
  // per-tool count. usedCount above remains the per-tool "Của tôi" display.
  const quotaPct = quota > 0 ? Math.min(100, Math.round((totalUsed / quota) * 100)) : 0;
  const quotaReached = totalUsed >= quota;

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteTournament(deleteId);
      toast({ title: t.common.delete, description: t.tools.flexTournament.updateSuccess });
    } catch (error) {
      toast({ title: t.common.error, description: t.tools.flexTournament.deleteError, variant: "destructive" });
    }
    setDeleteId(null);
  };

  return (
    <TheLineLayout
      title="Pickleball Flex Tournament – Custom Bracket Maker"
      description="Create flexible pickleball tournament brackets with custom groups, team play, singles, doubles, and mixed formats."
      active="lab"
    >
      <HreflangTags enPath="/tools/flex-tournament" />
      <WebApplicationSchema
        name="Flex Tournament - Custom Pickleball Bracket Maker"
        description="Create flexible pickleball tournament brackets with custom groups, team play, singles, doubles, and mixed formats. Real-time scoring and live standings."
        url="https://www.thepicklehub.net/tools/flex-tournament"
        applicationCategory="SportsApplication"
        featureList={[
          "Custom group creation",
          "Singles and doubles matches",
          "Team-based tournaments",
          "Real-time scoring",
          "Live standings",
          "Mobile-friendly interface",
        ]}
      />
      <FAQSchema items={faqItems} />

      <div className="tl-shell">
        <nav className="tl-breadcrumb">
          <Link to="/tools">{language === "vi" ? "Bracket Lab" : "Bracket Lab"}</Link>
          <span className="sep">/</span>
          <span className="current">Flex Tournament</span>
        </nav>

        <header className="tl-page-head">
          <div className="kicker">
            {language === "vi"
              ? "◆ Format tự do · Power user · Miễn phí"
              : "◆ Custom format · Power user · Free"}
          </div>
          <h1>
            <em className="tl-serif">Flex</em>{" "}
            <span className="sans">tournament.</span>
          </h1>
          <p>{t.tools.flexTournament.subtitle}</p>

          <div style={{ display: "flex", gap: 10, marginTop: 28, flexWrap: "wrap" }}>
            {user ? (
              <button
                type="button"
                className="tl-btn green"
                onClick={() => navigate('/tools/flex-tournament/new')}
                disabled={quotaReached}
                title={quotaReached ? t.quickTable.quota.limitReached : undefined}
              >
                <Plus className="w-4 h-4" />
                {quotaReached ? t.quickTable.quota.limitReached : t.tools.flexTournament.createNew}
              </button>
            ) : (
              <Link to={getLoginUrl(location.pathname)} className="tl-btn green">
                <LogIn className="w-4 h-4" />
                {t.auth.login}
              </Link>
            )}
          </div>
        </header>

        {/* W3.2 — Quota stats-row (matches Quick Tables visual language). */}
        {user && (
          <section className="tl-stats-row" style={{ marginTop: 32 }}>
            <div className="tl-stat-box">
              <div className="lbl">{language === "vi" ? "Của tôi" : "Mine"}</div>
              <div className="val">
                <span className={usedCount > 0 ? "green" : ""}>{usedCount}</span>
              </div>
              <div className="sub">{language === "vi" ? "Tổng số giải" : "Tournaments"}</div>
            </div>
            <div className="tl-stat-box">
              <div className="lbl">{language === "vi" ? "Hạn mức" : "Quota"}</div>
              <div className="val">
                <span className={quotaReached ? "" : "green"}>{totalUsed}</span>
                <span style={{ color: "var(--tl-fg-4)", fontSize: "0.6em" }}>/{quota}</span>
              </div>
              <div className="sub">{quotaPct}% {language === "vi" ? "đã dùng" : "used"}</div>
            </div>
          </section>
        )}

        {/* Microcopy strip */}
        <section style={{ marginTop: 32 }}>
          <div
            style={{
              padding: "14px 18px",
              borderRadius: "var(--tl-radius)",
              background: "var(--tl-bg-elev)",
              border: "1px dashed var(--tl-border)",
              display: "flex",
              alignItems: "flex-start",
              gap: 12,
            }}
          >
            <Layers
              className="w-4 h-4"
              style={{ color: "var(--tl-green)", flexShrink: 0, marginTop: 2 }}
            />
            <p
              style={{
                fontSize: 13.5,
                color: "var(--tl-fg-2)",
                margin: 0,
                lineHeight: 1.5,
              }}
            >
              {t.tools.flexTournament.subtitleFull}
            </p>
          </div>
        </section>

        {/* My Tournaments — only when logged in */}
        {user && (
          <section style={{ marginTop: 40 }}>
            <div className="tl-sec-head">
              <h2>
                <em className="tl-serif">
                  {language === "vi" ? "Của tôi." : "Mine."}
                </em>{" "}
                <span className="sans">{myTournaments.length}</span>
              </h2>
            </div>
            {isLoadingTournaments ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "48px 0",
                }}
              >
                <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--tl-fg-3)" }} />
              </div>
            ) : myTournaments.length === 0 ? (
              <div className="tl-empty-card">
                <span className="tl-empty-card-mark">◌</span>
                <span className="tl-empty-card-label">
                  {language === "vi" ? "Chưa có giải nào" : "No tournaments yet"}
                </span>
                <p className="tl-empty-card-hint">{t.tools.flexTournament.noTournaments}</p>
                <button
                  type="button"
                  className="tl-btn green"
                  onClick={() => navigate('/tools/flex-tournament/new')}
                  style={{ marginTop: 14 }}
                >
                  <Plus className="w-4 h-4" />
                  {t.tools.flexTournament.create}
                </button>
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                  gap: 14,
                }}
              >
                {myTournaments.map((tournament) => (
                  <TournamentCard
                    key={tournament.id}
                    name={tournament.name}
                    isPublic={tournament.is_public}
                    createdAt={tournament.created_at}
                    onView={() => navigate(`/tools/flex-tournament/${tournament.share_id}`)}
                    onDelete={() => setDeleteId(tournament.id)}
                    publicLabel={t.tools.flexTournament.public}
                    unlistedLabel={t.tools.flexTournament.unlisted}
                    viewLabel={t.tools.flexTournament.viewTournament}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {/* Public tournaments */}
        <section style={{ marginTop: 48, marginBottom: 56 }}>
          <div className="tl-sec-head">
            <h2>
              <em className="tl-serif">
                {language === "vi" ? "Công khai." : "Public."}
              </em>{" "}
              <span className="sans">{publicTournaments.length}</span>
            </h2>
          </div>
          {isLoadingPublic ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "48px 0",
              }}
            >
              <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--tl-fg-3)" }} />
            </div>
          ) : publicTournaments.length === 0 ? (
            <div className="tl-empty-card">
              <span className="tl-empty-card-mark">◌</span>
              <span className="tl-empty-card-label">
                {language === "vi" ? "Chưa có giải công khai" : "No public tournaments yet"}
              </span>
            </div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                gap: 14,
              }}
            >
              {publicTournaments.map((tournament) => (
                <TournamentCard
                  key={tournament.id}
                  name={tournament.name}
                  isPublic={true}
                  createdAt={tournament.created_at}
                  onView={() => navigate(`/tools/flex-tournament/${tournament.share_id}`)}
                  publicLabel={t.tools.flexTournament.public}
                  unlistedLabel={t.tools.flexTournament.unlisted}
                  viewLabel={t.tools.flexTournament.viewTournament}
                />
              ))}
            </div>
          )}
        </section>

        {/* Delete dialog */}
        <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t.common.delete}</AlertDialogTitle>
              <AlertDialogDescription>
                {t.tools.flexTournament.deleteConfirm}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={isDeleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {t.common.delete}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* SEO + Internal links — child SEO content left for PR C.2 */}
        <section style={{ marginBottom: 80 }}>
          <ToolsInternalLinks currentTool="flex-tournament" />
          <div style={{ marginTop: 40 }}>
            <FlexTournamentSeoContent />
          </div>
        </section>
      </div>
    </TheLineLayout>
  );
};

function TournamentCard({
  name, isPublic, createdAt, onView, onDelete, publicLabel, unlistedLabel, viewLabel,
}: {
  name: string;
  isPublic: boolean;
  createdAt: string;
  onView: () => void;
  onDelete?: () => void;
  publicLabel: string;
  unlistedLabel: string;
  viewLabel: string;
}) {
  const visibilityBg = isPublic ? "var(--tl-green-glow)" : "var(--tl-surface)";
  const visibilityFg = isPublic ? "var(--tl-green)" : "var(--tl-fg-3)";

  return (
    <div
      style={{
        ...surfaceCard,
        padding: 18,
        display: "flex",
        flexDirection: "column",
        gap: 14,
        transition: "border-color 0.15s",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "var(--tl-border-2)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = "var(--tl-border)";
      }}
    >
      <div>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
          <h3
            style={{
              flex: 1,
              minWidth: 0,
              fontFamily: "Instrument Serif, serif",
              fontStyle: "italic",
              fontWeight: 400,
              fontSize: 20,
              letterSpacing: "-0.015em",
              lineHeight: 1.2,
              color: "var(--tl-fg)",
              margin: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {name}
          </h3>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              flexShrink: 0,
              fontFamily: "Geist Mono, ui-monospace, monospace",
              fontSize: 10,
              fontWeight: 500,
              padding: "3px 8px",
              borderRadius: 4,
              background: visibilityBg,
              color: visibilityFg,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            {isPublic ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
            {isPublic ? publicLabel : unlistedLabel}
          </span>
        </div>
        <div
          style={{
            fontFamily: "Geist Mono, ui-monospace, monospace",
            fontSize: 11,
            color: "var(--tl-fg-3)",
            letterSpacing: "0.02em",
            marginTop: 6,
          }}
        >
          {format(new Date(createdAt), 'dd/MM/yyyy HH:mm')}
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, marginTop: "auto" }}>
        <button
          type="button"
          className="tl-btn"
          onClick={onView}
          style={{ flex: 1, justifyContent: "center", padding: "8px 12px", fontSize: 12.5 }}
        >
          <Eye className="w-4 h-4" />
          {viewLabel}
        </button>
        {onDelete && (
          <button
            type="button"
            className="tl-btn"
            onClick={onDelete}
            style={{ padding: "8px 10px", color: "var(--tl-live)" }}
            aria-label="Delete"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

const faqItems = [
  { question: "What types of tournaments can I run with Flex Tournament?", answer: "Flex Tournament supports any format you can design: singles, doubles, mixed doubles, team events, or combinations of all of these within a single tournament. You can create multiple groups with different player counts, define custom match formats per group, and structure your knockout rounds however you like. It's the only tool on The Pickle Hub with no restrictions on tournament structure." },
  { question: "Can Flex Tournament handle non-standard group sizes?", answer: "Yes. Unlike Quick Tables (which is optimized for standard group sizes), Flex Tournament lets you create groups with any number of players or teams — 3, 5, 7, 11, or any other count. You manually assign matches within each group, so there are no algorithmic restrictions on group composition." },
  { question: "How is Flex Tournament different from Quick Tables?", answer: "Quick Tables is optimized for standard round robin brackets — it auto-generates balanced schedules for 4–48 players in seconds. Flex Tournament gives you full manual control: you build every group, match, and scoring rule yourself. Quick Tables is faster for straightforward events; Flex Tournament is the right choice when your event structure doesn't fit standard round robin rules." },
  { question: "Can I share my Flex Tournament bracket publicly?", answer: "Yes. Each Flex Tournament has a public visibility toggle. When enabled, anyone with the link can view the bracket, group standings, and match scores in real-time — no account required. This is useful for sharing live updates with spectators, posting the link on social media, or embedding tournament results in a club newsletter." },
  { question: "Is Flex Tournament suitable for training sessions and clinic formats?", answer: "It's one of the best tools for structured training. You can design rotating partner rounds, skill-based groupings, or drill-style match formats that standard bracket generators can't handle. Many coaches use Flex Tournament to run round-robin skill sessions where players rotate through different partners and opponents, with scores tracked in real-time." },
];

export default FlexTournamentList;
