import { useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { TheLineLayout } from '@/components/layout';
import { Plus, Users, Calendar, Trophy, Trash2, ExternalLink, Mail, LogIn } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useTeamMatch, TeamMatchTournament } from '@/hooks/useTeamMatch';
import { useI18n } from '@/i18n';
import { getLoginUrl } from '@/lib/auth-config';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { HreflangTags, WebApplicationSchema, TeamMatchSeoContent, ToolsInternalLinks, FAQSchema } from '@/components/seo';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const surfaceCard: React.CSSProperties = {
  background: "var(--tl-bg-elev)",
  border: "1px solid var(--tl-border)",
  borderRadius: "var(--tl-radius-lg)",
  padding: 18,
};

// Status pill colour map — token-driven so it tracks light/dark mode.
const statusPillStyle = (status: string): React.CSSProperties => {
  if (status === 'completed') return { background: 'var(--tl-surface)', color: 'var(--tl-fg-3)' };
  if (status === 'ongoing') return { background: 'var(--tl-green-glow)', color: 'var(--tl-green)' };
  if (status === 'registration') return { background: 'rgba(79, 155, 255, 0.12)', color: 'rgb(79, 155, 255)' };
  return { background: 'rgba(233, 182, 73, 0.12)', color: 'var(--tl-gold)' };
};

function TournamentCard({
  tournament,
  isOwner,
  onDelete,
  t,
}: {
  tournament: TeamMatchTournament;
  isOwner: boolean;
  onDelete: () => void;
  t: any;
}) {
  const navigate = useNavigate();
  const goView = () => navigate(`/tools/team-match/${tournament.share_id}`);

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'setup': return t.teamMatch.statusSetup;
      case 'registration': return t.teamMatch.statusRegistration;
      case 'ongoing': return t.teamMatch.statusOngoing;
      case 'completed': return t.teamMatch.statusCompleted;
      default: return status;
    }
  };

  const getFormatLabel = (fmt: string) => {
    switch (fmt) {
      case 'round_robin': return t.teamMatch.formatRoundRobin;
      case 'single_elimination': return t.teamMatch.formatSingleElim;
      case 'rr_playoff': return t.teamMatch.formatRrPlayoff;
      default: return fmt;
    }
  };

  return (
    <div
      style={{
        ...surfaceCard,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        cursor: 'pointer',
        transition: 'border-color 0.15s, background 0.15s',
      }}
      onClick={goView}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = 'var(--tl-border-2)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = 'var(--tl-border)';
      }}
    >
      {/* Header: name + status pill */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <h3
          style={{
            flex: 1,
            minWidth: 0,
            fontFamily: 'Instrument Serif, serif',
            fontStyle: 'italic',
            fontWeight: 400,
            fontSize: 20,
            letterSpacing: '-0.015em',
            lineHeight: 1.2,
            color: 'var(--tl-fg)',
            margin: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {tournament.name}
        </h3>
        <span
          style={{
            fontFamily: 'Geist Mono, ui-monospace, monospace',
            fontSize: 10.5,
            fontWeight: 500,
            padding: '3px 8px',
            borderRadius: 4,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
            flexShrink: 0,
            ...statusPillStyle(tournament.status),
          }}
        >
          {getStatusLabel(tournament.status)}
        </span>
      </div>

      {/* Meta row */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          gap: '4px 12px',
          fontFamily: 'Geist Mono, ui-monospace, monospace',
          fontSize: 11,
          color: 'var(--tl-fg-3)',
          letterSpacing: '0.02em',
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <Calendar className="w-3.5 h-3.5" />
          {format(new Date(tournament.created_at), 'dd/MM/yyyy', { locale: vi })}
        </span>
        <span style={{ color: 'var(--tl-fg-4)' }}>·</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <Users className="w-3.5 h-3.5" />
          <span style={{ color: 'var(--tl-fg-2)' }}>
            {tournament.team_count} {t.teamMatch.teams} × {tournament.team_roster_size}
          </span>
        </span>
        <span style={{ color: 'var(--tl-fg-4)' }}>·</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <Trophy className="w-3.5 h-3.5" />
          {getFormatLabel(tournament.format)}
        </span>
        {tournament.creator_display_name && !isOwner && (
          <>
            <span style={{ color: 'var(--tl-fg-4)' }}>·</span>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: '100%',
              }}
            >
              <Mail className="w-3.5 h-3.5" />
              {tournament.creator_display_name}
            </span>
          </>
        )}
      </div>

      {/* Owner actions */}
      {isOwner && (
        <div
          style={{ display: 'flex', gap: 6, marginTop: 'auto', paddingTop: 4 }}
          onClick={e => e.stopPropagation()}
        >
          <button
            type="button"
            className="tl-btn"
            onClick={goView}
            style={{ flex: 1, justifyContent: 'center', padding: '8px 12px', fontSize: 12.5 }}
          >
            <ExternalLink className="w-4 h-4" />
            {t.teamMatch.viewDetails}
          </button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                type="button"
                className="tl-btn"
                style={{ padding: '8px 10px', color: 'var(--tl-live)' }}
                aria-label={t.teamMatch.delete}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t.teamMatch.confirmDelete}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t.teamMatch.confirmDeleteDesc.replace('{name}', tournament.name)}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t.teamMatch.cancel}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={onDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {t.teamMatch.delete}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </div>
  );
}

export default function TeamMatchList() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, language, setLanguageFromUrl } = useI18n();
  const location = useLocation();

  // EN route — force English regardless of persisted language state
  useEffect(() => {
    setLanguageFromUrl("en");
  }, [setLanguageFromUrl]);
  const { myTournaments, isLoading, deleteTournament } = useTeamMatch();

  return (
    <TheLineLayout
      title="Pickleball Team Match Tool – MLP Style Tournament Format"
      description="Create MLP-style pickleball team competitions. Features lineup management, dreambreaker games, rally scoring, and team standings."
      active="lab"
    >
      <HreflangTags enPath="/tools/team-match" />
      <WebApplicationSchema
        name="Team Match - MLP Style Pickleball Tournament"
        description="Create team match competitions with MLP-style format. Features lineup management, dreambreaker games, rally scoring, and team tournament organization."
        url="https://www.thepicklehub.net/tools/team-match"
        applicationCategory="SportsApplication"
        featureList={[
          "MLP-style team format",
          "Lineup management",
          "Dreambreaker games",
          "Rally scoring support",
          "Team roster management",
          "Round robin and playoff formats",
        ]}
      />
      <FAQSchema items={faqItems} />

      <div className="tl-shell">
        <nav className="tl-breadcrumb">
          <Link to="/tools">{language === "vi" ? "Bracket Lab" : "Bracket Lab"}</Link>
          <span className="sep">/</span>
          <span className="current">Team Match</span>
        </nav>

        <header className="tl-page-head">
          <div className="kicker">
            {language === "vi"
              ? "◆ MLP format · 2 đội · Lineup chiến thuật"
              : "◆ MLP format · 2 teams · Lineup strategy"}
          </div>
          <h1>
            <em className="tl-serif">Team</em>{" "}
            <span className="sans">match.</span>
          </h1>
          <p>{t.teamMatch.pageSubtitle}</p>

          {user && (
            <div style={{ display: "flex", gap: 10, marginTop: 28, flexWrap: "wrap" }}>
              <button
                type="button"
                className="tl-btn green"
                onClick={() => navigate('/tools/team-match/new')}
              >
                <Plus className="w-4 h-4" />
                {t.teamMatch.createNew}
              </button>
            </div>
          )}
        </header>

        {/* My Tournaments */}
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
            {isLoading ? (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                  gap: 14,
                }}
              >
                {[1, 2].map(i => (
                  <div
                    key={i}
                    style={{
                      ...surfaceCard,
                      opacity: 0.6,
                      animation: 'tl-pulse 1.6s ease-in-out infinite',
                    }}
                  >
                    <div style={{ height: 20, width: '75%', background: 'var(--tl-surface)', borderRadius: 4, marginBottom: 8 }} />
                    <div style={{ height: 14, width: '50%', background: 'var(--tl-surface)', borderRadius: 4 }} />
                  </div>
                ))}
              </div>
            ) : myTournaments.length === 0 ? (
              <div className="tl-empty-card">
                <span className="tl-empty-card-mark">◌</span>
                <span className="tl-empty-card-label">
                  {language === "vi" ? "Chưa có giải nào" : "No tournaments yet"}
                </span>
                <p className="tl-empty-card-hint">{t.teamMatch.noTournaments}</p>
                <button
                  type="button"
                  className="tl-btn green"
                  onClick={() => navigate('/tools/team-match/new')}
                  style={{ marginTop: 14 }}
                >
                  <Plus className="w-4 h-4" />
                  {t.teamMatch.createFirst}
                </button>
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
                  gap: 14,
                }}
              >
                {myTournaments.map(tournament => (
                  <TournamentCard
                    key={tournament.id}
                    tournament={tournament}
                    isOwner={true}
                    onDelete={() => deleteTournament(tournament.id)}
                    t={t}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {/* Login gate */}
        {!user && (
          <section style={{ marginTop: 40 }}>
            <div
              style={{
                ...surfaceCard,
                maxWidth: 480,
                margin: '0 auto',
                textAlign: 'center',
                padding: '40px 28px',
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  background: 'var(--tl-green-glow)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 20,
                }}
              >
                <Users className="w-7 h-7" style={{ color: 'var(--tl-green)' }} />
              </div>
              <h2
                style={{
                  fontFamily: 'Instrument Serif, serif',
                  fontStyle: 'italic',
                  fontWeight: 400,
                  fontSize: 24,
                  letterSpacing: '-0.015em',
                  color: 'var(--tl-fg)',
                  margin: '0 0 10px',
                }}
              >
                {language === 'vi' ? 'Đăng nhập để tạo giải' : 'Sign in to create'}
              </h2>
              <p style={{ fontSize: 14, color: 'var(--tl-fg-3)', marginBottom: 24, lineHeight: 1.5 }}>
                {t.teamMatch.loginPrompt}
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
        )}

        {/* SEO + Internal links */}
        <section style={{ marginTop: 56, marginBottom: 80 }}>
          <ToolsInternalLinks currentTool="team-match" />
          <div style={{ marginTop: 40 }}>
            <TeamMatchSeoContent />
          </div>
        </section>
      </div>
    </TheLineLayout>
  );
}

const faqItems = [
  { question: "What is the dreambreaker in a pickleball team match?", answer: "The dreambreaker is a tiebreaker format used when a team match is tied after all doubles and mixed doubles games. Each team selects one player for a sudden-death singles rally-scoring match. The first player to reach 21 points (win by 2) wins the match for their team. It's the MLP's signature finish to close matches." },
  { question: "How many teams can compete in a Team Match tournament?", answer: "The Team Match tool supports 2 to 16 teams per event. You can run a simple head-to-head match between two clubs or a full league season with up to 16 teams across round robin and playoff stages." },
  { question: "Does Team Match support both round robin and playoff formats?", answer: "Yes. You can run a round robin league where every team plays each other, a single elimination playoff for rapid-fire competition, or a combined format with a round robin group stage that feeds into an elimination playoff." },
  { question: "Can team captains manage their own lineups?", answer: "Yes. Captains can be assigned to their teams and given access to submit lineups before each match." },
  { question: "What scoring system does the Team Match tool use?", answer: "Rally scoring is the default (every rally scores a point, regardless of who served), matching the MLP format. Traditional side-out scoring is also supported if your league prefers it." },
];
