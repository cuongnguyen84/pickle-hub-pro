import { useState, useEffect } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { TheLineLayout } from "@/components/layout";
import { HreflangTags, WebApplicationSchema, DoublesEliminationSeoContent, ToolsInternalLinks, FAQSchema } from "@/components/seo";
import { useAuth } from "@/hooks/useAuth";
import { useDoublesElimination, Tournament } from "@/hooks/useDoublesElimination";
import { useUserCreateQuota } from "@/hooks/useUserCreateQuota";
import { useI18n } from "@/i18n";
import { Plus, Trophy, Calendar, Users, Mail, LogIn } from "lucide-react";
import { format, type Locale } from "date-fns";
import { vi, enUS } from "date-fns/locale";
import { getLoginUrl } from "@/lib/auth-config";

const surfaceCard: React.CSSProperties = {
  background: "var(--tl-bg-elev)",
  border: "1px solid var(--tl-border)",
  borderRadius: "var(--tl-radius-lg)",
  padding: 24,
};

export default function DoublesEliminationList() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, language, setLanguageFromUrl } = useI18n();
  const location = useLocation();

  // EN route — force English regardless of persisted language state
  useEffect(() => {
    setLanguageFromUrl("en");
  }, [setLanguageFromUrl]);
  const { getUserTournaments } = useDoublesElimination();
  const { quota, used: totalUsed } = useUserCreateQuota();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);

  // TOTAL quota across all 4 tournament tools (Codex P1 fix on #106):
  // quota check + stats-row "X/Y" reflects the cross-tool sum. usedCount
  // below stays the per-tool count for the "Của tôi" display box.
  const usedCount = tournaments.length;
  const quotaPct = quota > 0 ? Math.min(100, Math.round((totalUsed / quota) * 100)) : 0;
  const quotaReached = totalUsed >= quota;

  const dateLocale = language === 'vi' ? vi : enUS;

  useEffect(() => {
    if (user) {
      loadTournaments();
    } else {
      setLoading(false);
    }
  }, [user]);

  const loadTournaments = async () => {
    setLoading(true);
    const data = await getUserTournaments();
    setTournaments(data);
    setLoading(false);
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'setup': return t.doublesElimination.status.setup;
      case 'ongoing': return t.doublesElimination.status.ongoing;
      case 'completed': return t.doublesElimination.status.completed;
      default: return status;
    }
  };

  const statusPillStyle = (status: string): React.CSSProperties => {
    if (status === 'completed') {
      return { background: 'var(--tl-surface)', color: 'var(--tl-fg-3)' };
    }
    if (status === 'ongoing') {
      return { background: 'var(--tl-green-glow)', color: 'var(--tl-green)' };
    }
    return { background: 'rgba(233, 182, 73, 0.12)', color: 'var(--tl-gold)' };
  };

  const getFormatLabel = (fmt: string) => {
    switch (fmt) {
      case 'bo1': return t.doublesElimination.format.bo1;
      case 'bo3': return t.doublesElimination.format.bo3;
      case 'bo5': return t.doublesElimination.format.bo5;
      default: return fmt;
    }
  };

  const ongoingTournaments = tournaments.filter(t => t.status !== 'completed');
  const completedTournaments = tournaments.filter(t => t.status === 'completed');

  return (
    <TheLineLayout
      title="Pickleball Double Elimination Bracket Generator"
      description="Free double elimination bracket generator for pickleball tournaments. Create winners and losers brackets for 32-128+ teams."
      active="lab"
    >
      <HreflangTags enPath="/tools/doubles-elimination" />
      <WebApplicationSchema
        name="Doubles Elimination Bracket Generator"
        description="Create doubles elimination brackets for pickleball tournaments. Support for 4-32 teams with best-of-1, best-of-3, or best-of-5 match formats."
        url="https://www.thepicklehub.net/tools/doubles-elimination"
        applicationCategory="SportsApplication"
        featureList={[
          "4-32 teams support",
          "Best-of-1, 3, or 5 formats",
          "Automatic bracket generation",
          "Real-time scoring",
          "Third place match option",
        ]}
      />
      <FAQSchema items={faqItems} />

      <div className="tl-shell">
        <nav className="tl-breadcrumb">
          <Link to="/tools">{language === "vi" ? "Bracket Lab" : "Bracket Lab"}</Link>
          <span className="sep">/</span>
          <span className="current">Doubles Elimination</span>
        </nav>

        <header className="tl-page-head">
          <div className="kicker">
            {language === "vi"
              ? "◆ Loại kép · 32+ đội · Miễn phí"
              : "◆ Double elimination · 32+ teams · Free"}
          </div>
          <h1>
            <em className="tl-serif">Double</em>{" "}
            <span className="sans">elimination.</span>
          </h1>
          <p>{t.doublesElimination.description}</p>

          {user && (
            <div style={{ display: "flex", gap: 10, marginTop: 28, flexWrap: "wrap" }}>
              <button
                type="button"
                className="tl-btn green"
                onClick={() => navigate('/tools/doubles-elimination/new')}
                disabled={quotaReached}
                title={quotaReached ? t.quickTable.quota.limitReached : undefined}
              >
                <Plus className="w-4 h-4" />
                {quotaReached ? t.quickTable.quota.limitReached : t.doublesElimination.createNew}
              </button>
            </div>
          )}
        </header>

        {/* W3.2 — Quota stats-row (matches Quick Tables visual language). */}
        {user && !loading && (
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

        {/* Login gate */}
        {!user ? (
          <section style={{ padding: "48px 0 0" }}>
            <div
              style={{
                ...surfaceCard,
                maxWidth: 480,
                margin: "0 auto",
                textAlign: "center",
                padding: "40px 28px",
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  background: "var(--tl-green-glow)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 20,
                }}
              >
                <Trophy className="w-7 h-7" style={{ color: "var(--tl-green)" }} />
              </div>
              <h2
                style={{
                  fontFamily: "Instrument Serif, serif",
                  fontStyle: "italic",
                  fontWeight: 400,
                  fontSize: 24,
                  letterSpacing: "-0.015em",
                  color: "var(--tl-fg)",
                  margin: "0 0 10px",
                }}
              >
                {t.doublesElimination.loginRequired}
              </h2>
              <p style={{ fontSize: 14, color: "var(--tl-fg-3)", marginBottom: 24, lineHeight: 1.5 }}>
                {t.doublesElimination.loginRequiredDesc}
              </p>
              <button
                type="button"
                className="tl-btn green"
                onClick={() => navigate(getLoginUrl(location.pathname))}
              >
                <LogIn className="w-4 h-4" />
                {t.nav.login}
              </button>
            </div>
          </section>
        ) : loading ? (
          /* Loading skeleton */
          <section style={{ marginTop: 40 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  style={{
                    ...surfaceCard,
                    padding: 16,
                    opacity: 0.6,
                    animation: "tl-pulse 1.6s ease-in-out infinite",
                  }}
                >
                  <div
                    style={{
                      height: 20,
                      width: "33%",
                      background: "var(--tl-surface)",
                      borderRadius: 4,
                      marginBottom: 8,
                    }}
                  />
                  <div
                    style={{
                      height: 14,
                      width: "25%",
                      background: "var(--tl-surface)",
                      borderRadius: 4,
                    }}
                  />
                </div>
              ))}
            </div>
          </section>
        ) : tournaments.length === 0 ? (
          /* Empty state */
          <section style={{ marginTop: 40 }}>
            <div className="tl-empty-card">
              <span className="tl-empty-card-mark">◌</span>
              <span className="tl-empty-card-label">
                {t.doublesElimination.noTournaments}
              </span>
              <p className="tl-empty-card-hint">{t.doublesElimination.noTournamentsDesc}</p>
              <button
                type="button"
                className="tl-btn green"
                onClick={() => navigate('/tools/doubles-elimination/new')}
                style={{ marginTop: 16 }}
              >
                <Plus className="w-4 h-4" />
                {t.doublesElimination.createNew}
              </button>
            </div>
          </section>
        ) : (
          <>
            {/* My ongoing */}
            {ongoingTournaments.length > 0 && (
              <section style={{ marginTop: 40, marginBottom: 32 }}>
                <div className="tl-sec-head">
                  <h2>
                    {language === "vi" ? "Đang" : "In"}{" "}
                    <em className="tl-serif">
                      {language === "vi" ? "diễn ra." : "progress."}
                    </em>{" "}
                    <span className="sans">{ongoingTournaments.length}</span>
                  </h2>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {ongoingTournaments.map((tournament) => (
                    <TournamentRow
                      key={tournament.id}
                      tournament={tournament}
                      dateLocale={dateLocale}
                      onClick={() => navigate(`/tools/doubles-elimination/${tournament.share_id}`)}
                      statusLabel={getStatusLabel(tournament.status)}
                      statusStyle={statusPillStyle(tournament.status)}
                      formatLabel={getFormatLabel}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Completed */}
            {completedTournaments.length > 0 && (
              <section style={{ marginBottom: 56 }}>
                <div className="tl-sec-head">
                  <h2>
                    <em className="tl-serif">
                      {language === "vi" ? "Hoàn tất." : "Completed."}
                    </em>{" "}
                    <span className="sans">{completedTournaments.length}</span>
                  </h2>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {completedTournaments.map((tournament) => (
                    <TournamentRow
                      key={tournament.id}
                      tournament={tournament}
                      dateLocale={dateLocale}
                      onClick={() => navigate(`/tools/doubles-elimination/${tournament.share_id}`)}
                      statusLabel={getStatusLabel(tournament.status)}
                      statusStyle={statusPillStyle(tournament.status)}
                      formatLabel={getFormatLabel}
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        {/* About section — token-driven info card */}
        {user && (
          <section style={{ marginBottom: 56 }}>
            <div style={surfaceCard}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  paddingBottom: 14,
                  borderBottom: "1px solid var(--tl-border)",
                  marginBottom: 16,
                }}
              >
                <Trophy className="w-4 h-4" style={{ color: "var(--tl-green)" }} />
                <h3
                  style={{
                    fontFamily: "Instrument Serif, serif",
                    fontStyle: "italic",
                    fontWeight: 400,
                    fontSize: 22,
                    letterSpacing: "-0.015em",
                    margin: 0,
                    color: "var(--tl-fg)",
                  }}
                >
                  {t.doublesElimination.about.title}
                </h3>
              </div>
              <p style={{ fontSize: 14, color: "var(--tl-fg-2)", lineHeight: 1.65, margin: "0 0 12px" }}>
                <strong style={{ color: "var(--tl-fg)" }}>{t.doublesElimination.title}</strong>{" "}
                {t.doublesElimination.about.description}
              </p>
              <ul
                style={{
                  margin: "0 0 12px",
                  padding: 0,
                  listStyle: "none",
                  fontSize: 13.5,
                  color: "var(--tl-fg-2)",
                  lineHeight: 1.7,
                }}
              >
                {[
                  ["Round 1", t.doublesElimination.about.round1],
                  ["Round 2", t.doublesElimination.about.round2],
                  ["Round 3", t.doublesElimination.about.round3],
                  ["Round 4+", t.doublesElimination.about.round4Plus],
                ].map(([k, v]) => (
                  <li key={k} style={{ paddingLeft: 18, position: "relative", margin: "6px 0" }}>
                    <span
                      style={{
                        position: "absolute",
                        left: 0,
                        top: 0,
                        color: "var(--tl-green)",
                        fontFamily: "Geist Mono, ui-monospace, monospace",
                        fontSize: 12,
                      }}
                    >
                      ◆
                    </span>
                    <strong style={{ color: "var(--tl-fg)", fontWeight: 600 }}>{k}:</strong> {v}
                  </li>
                ))}
              </ul>
              <p style={{ fontSize: 13, color: "var(--tl-fg-3)", margin: 0 }}>
                {t.doublesElimination.about.minTeams} {t.doublesElimination.about.suggestion}
              </p>
            </div>
          </section>
        )}

        {/* SEO Content + Internal Links — bottom of page */}
        <section style={{ marginBottom: 80 }}>
          <DoublesEliminationSeoContent />
          <ToolsInternalLinks currentTool="doubles-elimination" />
        </section>
      </div>
    </TheLineLayout>
  );
}

function TournamentRow({
  tournament, dateLocale, onClick, statusLabel, statusStyle, formatLabel,
}: {
  tournament: Tournament;
  dateLocale: Locale;
  onClick: () => void;
  statusLabel: string;
  statusStyle: React.CSSProperties;
  formatLabel: (fmt: string) => string;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        padding: "14px 16px",
        borderRadius: "var(--tl-radius)",
        border: "1px solid var(--tl-border)",
        background: "var(--tl-bg-elev)",
        cursor: "pointer",
        transition: "background 0.15s, border-color 0.15s",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = "var(--tl-surface)";
        (e.currentTarget as HTMLElement).style.borderColor = "var(--tl-border-2)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = "var(--tl-bg-elev)";
        (e.currentTarget as HTMLElement).style.borderColor = "var(--tl-border)";
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
        <h3
          style={{
            flex: 1,
            minWidth: 0,
            fontFamily: "Instrument Serif, serif",
            fontStyle: "italic",
            fontWeight: 400,
            fontSize: 19,
            letterSpacing: "-0.015em",
            lineHeight: 1.2,
            color: "var(--tl-fg)",
            margin: 0,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {tournament.name}
        </h3>
        <span
          style={{
            fontFamily: "Geist Mono, ui-monospace, monospace",
            fontSize: 10.5,
            fontWeight: 500,
            padding: "3px 8px",
            borderRadius: 4,
            letterSpacing: "0.06em",
            textTransform: "uppercase",
            whiteSpace: "nowrap",
            flexShrink: 0,
            ...statusStyle,
          }}
        >
          {statusLabel}
        </span>
      </div>

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "4px 10px",
          fontFamily: "Geist Mono, ui-monospace, monospace",
          fontSize: 11,
          color: "var(--tl-fg-3)",
          letterSpacing: "0.02em",
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <Users className="w-3.5 h-3.5" />
          <span style={{ color: "var(--tl-fg-2)", fontWeight: 500 }}>{tournament.team_count}</span>
        </span>
        <span style={{ color: "var(--tl-fg-4)" }}>·</span>
        <span>
          {formatLabel(tournament.early_rounds_format)}
          {tournament.finals_format !== tournament.early_rounds_format && (
            <span> → {formatLabel(tournament.finals_format)}</span>
          )}
        </span>
        <span style={{ color: "var(--tl-fg-4)" }}>·</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
          <Calendar className="w-3.5 h-3.5" />
          {format(new Date(tournament.created_at), 'dd/MM/yyyy', { locale: dateLocale })}
        </span>
        {tournament.creator_display_name && (
          <>
            <span style={{ color: "var(--tl-fg-4)" }}>·</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
              <Mail className="w-3.5 h-3.5" />
              {tournament.creator_display_name}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

const faqItems = [
  { question: "What is the minimum number of teams for a double elimination bracket?", answer: "Double elimination works best with 8 or more teams, though the tool supports as few as 4. Below 8 teams, the bracket has very few losers bracket rounds, reducing the format's advantage over single elimination. For larger competitive events, 16–64 teams is the ideal range." },
  { question: "Does the tool automatically move teams between winners and losers brackets?", answer: "Yes. All bracket progression is fully automatic. When you enter a match result, the winning team advances in the winners bracket and the losing team drops to the correct position in the losers bracket. No manual bracket management is needed — the system handles all seeding and advancement logic." },
  { question: "Can I use different match formats in different rounds?", answer: "Yes. You can configure best-of-1 for early rounds to save time, then switch to best-of-3 for quarterfinals and semifinals, and best-of-5 for the grand final. Each round can have an independently configured match format, giving you full control over how your event flows." },
  { question: "What happens if the losers bracket winner beats the winners bracket finalist in the grand final?", answer: "In true double elimination, a bracket reset (true final) is required because the winners bracket finalist has no losses yet. Our tool flags this scenario automatically and creates the bracket reset match. The team that wins the reset match is crowned champion with both teams having lost exactly once." },
  { question: "Is double elimination fair for all skill levels?", answer: "Double elimination is one of the fairest competitive formats available because every team is guaranteed at least two matches before elimination. This is especially important for events where teams have traveled significant distances or paid registration fees — a single bad game doesn't end their tournament." },
];
