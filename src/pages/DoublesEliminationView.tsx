import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { TheLineLayout } from "@/components/layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import { useDoublesElimination, Tournament, Team, Match } from "@/hooks/useDoublesElimination";
import { useDoublesEliminationReferees } from "@/hooks/useDoublesEliminationReferees";
import { useVisibilityRefresh } from "@/hooks/useVisibilityRefresh";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { RefereeManagement } from "@/components/quicktable/RefereeManagement";
import {
  Share2, Check, Trophy, Users,
  Calendar, Trash2, RefreshCw,
} from "lucide-react";
import { format } from "date-fns";
import { vi as viLocale, enUS } from "date-fns/locale";
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
import DoublesEliminationBracket from "@/components/tournament/DoublesEliminationBracket";
import { useI18n } from "@/i18n";

const surfaceCard: React.CSSProperties = {
  background: "var(--tl-bg-elev)",
  border: "1px solid var(--tl-border)",
  borderRadius: "var(--tl-radius-lg)",
  padding: 24,
};

const sectionTitle: React.CSSProperties = {
  fontFamily: "Instrument Serif, serif",
  fontStyle: "italic",
  fontWeight: 400,
  fontSize: 22,
  letterSpacing: "-0.015em",
  margin: 0,
  color: "var(--tl-fg)",
};

export default function DoublesEliminationView() {
  const { shareId } = useParams<{ shareId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin } = useAdminAuth();
  const { getTournamentByShareId, deleteTournament } = useDoublesElimination();
  const { toast } = useToast();
  const { t, language } = useI18n();

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [activeTab, setActiveTab] = useState('preliminary');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const {
    referees,
    loading: refereesLoading,
    addRefereeByEmail,
    removeReferee,
  } = useDoublesEliminationReferees(tournament?.id);

  const preliminaryComplete = useMemo(() => {
    const r3Matches = matches.filter(m => m.round_number === 3);
    return r3Matches.length > 0 && r3Matches.every(m => m.status === 'completed');
  }, [matches]);

  const isCreator = user?.id === tournament?.creator_user_id;
  const canManage = isCreator || isAdmin;

  useEffect(() => {
    if (shareId) {
      loadData();
      setupRealtimeSubscription();
    }
  }, [shareId]);

  useEffect(() => {
    const checkPermissions = async () => {
      if (!user || !tournament) { setCanEdit(false); return; }
      if (isAdmin) { setCanEdit(true); return; }
      if (user.id === tournament.creator_user_id) { setCanEdit(true); return; }
      const { data: refereeData } = await supabase
        .from('doubles_elimination_referees')
        .select('id')
        .eq('tournament_id', tournament.id)
        .eq('user_id', user.id)
        .single();
      setCanEdit(!!refereeData);
    };
    checkPermissions();
  }, [user, tournament, isAdmin]);

  const loadData = async () => {
    if (!shareId) return;
    setLoading(true);
    const data = await getTournamentByShareId(shareId);
    setTournament(data.tournament);
    setTeams(data.teams);
    setMatches(data.matches);
    setLoading(false);
  };

  const softReload = useCallback(async () => {
    if (!shareId) return;
    const data = await getTournamentByShareId(shareId);
    setTournament(data.tournament);
    setTeams(data.teams);
    setMatches(data.matches);
  }, [shareId, getTournamentByShareId]);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await softReload();
    setTimeout(() => setIsRefreshing(false), 600);
  }, [softReload]);

  useVisibilityRefresh(softReload, { minInterval: 5000, pollingInterval: 20000 });

  const skipNextRealtimeRef = useRef(false);

  const handleMatchUpdated = (matchId: string, updates: Partial<Match>) => {
    skipNextRealtimeRef.current = true;
    setMatches(prevMatches =>
      prevMatches.map(m => m.id === matchId ? { ...m, ...updates } : m),
    );
    setTimeout(() => { skipNextRealtimeRef.current = false; }, 2000);
  };

  const handleR3Assigned = (tiedTeamsInfo?: { count: number; names: string[] }) => {
    if (tiedTeamsInfo) {
      toast({
        title: t.doublesElimination.view.r3AssignedTitle,
        description: t.doublesElimination.view.r3TiedDesc
          .replace('{count}', String(tiedTeamsInfo.count))
          .replace('{names}', tiedTeamsInfo.names.join(', ')),
        duration: 8000,
      });
    } else {
      toast({
        title: t.doublesElimination.view.r3AssignedTitle,
        description: t.doublesElimination.view.r3NormalDesc,
      });
    }
  };

  const setupRealtimeSubscription = () => {
    if (!shareId) return;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      channel = supabase
        .channel(`doubles_elimination_${shareId}:${Date.now()}_${Math.random().toString(36).slice(2, 7)}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'doubles_elimination_matches' }, () => {
          if (skipNextRealtimeRef.current) return;
          softReload();
        })
        .subscribe();
    } catch (err) {
      console.warn("[DoublesElimination] Realtime setup failed:", err);
    }
    return () => { if (channel) supabase.removeChannel(channel); };
  };

  const handleShare = async () => {
    const url = `https://www.thepicklehub.net/tools/doubles-elimination/${shareId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast({ title: t.doublesElimination.view.copied });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: t.doublesElimination.view.copyError, variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!tournament) return;
    const result = await deleteTournament(tournament.id);
    if (result.success) {
      toast({ title: t.doublesElimination.view.deleteSuccess });
      navigate('/tools/doubles-elimination');
    } else {
      toast({ title: t.doublesElimination.view.deleteError, variant: "destructive" });
    }
  };

  // ─── Loading + 404 states ────────────────────────────────────────────────
  if (loading) {
    return (
      <TheLineLayout title="Doubles Elimination" noindex={true} active="lab">
        <div className="tl-shell">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 400,
              color: 'var(--tl-fg-3)',
              fontFamily: 'Geist Mono, ui-monospace, monospace',
              fontSize: 12,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            {t.common.loading}
          </div>
        </div>
      </TheLineLayout>
    );
  }

  if (!tournament) {
    return (
      <TheLineLayout title="Doubles Elimination" noindex={true} active="lab">
        <div className="tl-shell">
          <div className="tl-empty" style={{ marginTop: 56 }}>
            <h3>{t.doublesElimination.view.notFound}</h3>
            <Link to="/tools/doubles-elimination" className="tl-btn">
              ← {t.doublesElimination.view.backToList}
            </Link>
          </div>
        </div>
      </TheLineLayout>
    );
  }

  const dateLocale = language === 'vi' ? viLocale : enUS;

  const statusKey = tournament.status;
  const statusLabel =
    statusKey === 'setup' ? t.doublesElimination.status.setup :
    statusKey === 'ongoing' ? t.doublesElimination.status.ongoing :
    statusKey === 'completed' ? t.doublesElimination.status.completed : statusKey;
  const statusPillBg =
    statusKey === 'completed' ? 'var(--tl-surface)' :
    statusKey === 'ongoing' ? 'var(--tl-green-glow)' :
    'rgba(233, 182, 73, 0.12)';
  const statusPillFg =
    statusKey === 'completed' ? 'var(--tl-fg-3)' :
    statusKey === 'ongoing' ? 'var(--tl-green)' :
    'var(--tl-gold)';

  return (
    <TheLineLayout
      title={`${tournament.name} - Doubles Elimination`}
      description={`${tournament.name} - ${tournament.team_count} ${t.doublesElimination.teams}`}
      noindex={true}
      active="lab"
    >
      <div className="tl-shell">
        <nav className="tl-breadcrumb">
          <Link to="/tools">{language === 'vi' ? 'Bracket Lab' : 'Bracket Lab'}</Link>
          <span className="sep">/</span>
          <Link to="/tools/doubles-elimination">Doubles Elimination</Link>
          <span className="sep">/</span>
          <span className="current">{tournament.name}</span>
        </nav>

        <header className="tl-page-head">
          <div className="kicker">
            ◆ {language === 'vi' ? 'Loại kép' : 'Double elimination'}
            <span style={{ color: 'var(--tl-fg-4)', margin: '0 8px' }}>·</span>
            {tournament.team_count} {t.doublesElimination.teams}
            <span style={{ color: 'var(--tl-fg-4)', margin: '0 8px' }}>·</span>
            {tournament.early_rounds_format.toUpperCase()} / {tournament.finals_format.toUpperCase()}
          </div>
          <h1 style={{ fontSize: 'clamp(28px, 4vw, 56px)' }}>
            <em className="tl-serif">{tournament.name}</em>
          </h1>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
              alignItems: 'center',
              marginTop: 14,
            }}
          >
            <span
              style={{
                fontFamily: 'Geist Mono, ui-monospace, monospace',
                fontSize: 10.5,
                fontWeight: 500,
                padding: '4px 10px',
                borderRadius: 4,
                background: statusPillBg,
                color: statusPillFg,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              {statusLabel}
            </span>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                fontFamily: 'Geist Mono, ui-monospace, monospace',
                fontSize: 11,
                color: 'var(--tl-fg-3)',
                letterSpacing: '0.02em',
              }}
            >
              <Calendar className="w-3.5 h-3.5" />
              {format(new Date(tournament.created_at), 'dd/MM/yyyy', { locale: dateLocale })}
            </span>

            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="tl-btn"
                onClick={handleRefresh}
                disabled={isRefreshing}
                aria-label={language === 'vi' ? 'Tải lại' : 'Refresh'}
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </button>
              <button type="button" className="tl-btn" onClick={handleShare}>
                {copied ? <Check className="w-4 h-4" /> : <Share2 className="w-4 h-4" />}
                <span className="hidden sm:inline">
                  {copied ? t.doublesElimination.view.copied : t.doublesElimination.view.share}
                </span>
              </button>
              {canManage && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <button
                      type="button"
                      className="tl-btn"
                      style={{ color: 'var(--tl-live)' }}
                      aria-label={t.common.delete}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t.doublesElimination.view.deleteConfirm}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {t.doublesElimination.view.deleteConfirmDesc}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDelete}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        {t.common.delete}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>
        </header>

        <section style={{ marginTop: 32, marginBottom: 56 }}>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="flex-wrap h-auto gap-1">
              <TabsTrigger value="preliminary">{t.doublesElimination.view.preliminary}</TabsTrigger>
              <TabsTrigger
                value="playoff"
                style={
                  preliminaryComplete
                    ? {
                        background: 'var(--tl-green-glow)',
                        color: 'var(--tl-green)',
                        fontWeight: 600,
                        animation: 'tl-pulse 1.6s ease-in-out infinite',
                      }
                    : undefined
                }
              >
                {preliminaryComplete && <Trophy className="w-3.5 h-3.5 mr-1.5" />}
                {t.doublesElimination.view.playoff}
              </TabsTrigger>
              <TabsTrigger value="teams">
                {t.doublesElimination.view.teams} ({teams.length})
              </TabsTrigger>
              {canManage && <TabsTrigger value="settings">{t.doublesElimination.view.settings}</TabsTrigger>}
            </TabsList>

            {/* Preliminary tab — bracket renderer is a child component left untouched */}
            <TabsContent value="preliminary" className="space-y-6">
              <DoublesEliminationBracket
                matches={matches} teams={teams} tournamentId={tournament?.id}
                showPreliminaryOnly={true} canEdit={canEdit}
                onScoreUpdated={softReload} onMatchUpdated={handleMatchUpdated} onR3Assigned={handleR3Assigned}
              />
            </TabsContent>

            <TabsContent value="playoff" className="space-y-6">
              <DoublesEliminationBracket
                matches={matches} teams={teams} tournamentId={tournament?.id}
                showPlayoffOnly={true} canEdit={canEdit}
                onScoreUpdated={softReload} onMatchUpdated={handleMatchUpdated} onR3Assigned={handleR3Assigned}
              />
            </TabsContent>

            <TabsContent value="teams">
              <div style={surfaceCard}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    paddingBottom: 14,
                    borderBottom: '1px solid var(--tl-border)',
                    marginBottom: 16,
                  }}
                >
                  <Users className="w-4 h-4" style={{ color: 'var(--tl-green)' }} />
                  <h3 style={{ ...sectionTitle, fontSize: 18 }}>{t.doublesElimination.view.teamList}</h3>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {teams.map((team) => (
                    <div
                      key={team.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 14px',
                        borderRadius: 'var(--tl-radius)',
                        background: 'var(--tl-bg)',
                        border: '1px solid var(--tl-border)',
                        opacity: team.status === 'eliminated' ? 0.5 : 1,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: '50%',
                            background: 'var(--tl-surface)',
                            border: '1px solid var(--tl-border)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontFamily: 'Geist Mono, ui-monospace, monospace',
                            fontSize: 12,
                            fontWeight: 500,
                            color: 'var(--tl-fg-2)',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          #{team.seed}
                        </span>
                        <div>
                          <div style={{ fontWeight: 500, fontSize: 14.5, color: 'var(--tl-fg)' }}>
                            {team.team_name}
                          </div>
                          <div style={{ fontSize: 12.5, color: 'var(--tl-fg-3)' }}>
                            {team.player1_name}
                            {team.player2_name && ` / ${team.player2_name}`}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                        <div
                          style={{
                            textAlign: 'right',
                            fontSize: 12.5,
                            fontFamily: 'Geist Mono, ui-monospace, monospace',
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          <div style={{ color: 'var(--tl-fg-3)' }}>
                            +{team.total_points_for} / -{team.total_points_against}
                          </div>
                          <div
                            style={{
                              fontWeight: 600,
                              color: team.point_diff >= 0 ? 'var(--tl-green)' : 'var(--tl-live)',
                            }}
                          >
                            {team.point_diff >= 0 ? '+' : ''}{team.point_diff}
                          </div>
                        </div>
                        {team.status === 'eliminated' && (
                          <span
                            style={{
                              fontFamily: 'Geist Mono, ui-monospace, monospace',
                              fontSize: 10.5,
                              fontWeight: 500,
                              padding: '3px 8px',
                              borderRadius: 4,
                              background: 'var(--tl-surface)',
                              color: 'var(--tl-fg-3)',
                              letterSpacing: '0.04em',
                              textTransform: 'uppercase',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {t.doublesElimination.view.eliminatedRound}{team.eliminated_at_round}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>

            {canManage && (
              <TabsContent value="settings" className="space-y-4">
                <div style={surfaceCard}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      paddingBottom: 14,
                      borderBottom: '1px solid var(--tl-border)',
                      marginBottom: 16,
                    }}
                  >
                    <Trophy className="w-4 h-4" style={{ color: 'var(--tl-green)' }} />
                    <h3 style={{ ...sectionTitle, fontSize: 18 }}>
                      {t.doublesElimination.view.tournamentSettings}
                    </h3>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                    <SettingItem
                      label={t.doublesElimination.earlyRounds}
                      value={tournament.early_rounds_format.toUpperCase()}
                    />
                    <SettingItem
                      label={t.doublesElimination.semifinalPlus}
                      value={tournament.finals_format.toUpperCase()}
                    />
                    <SettingItem
                      label={t.doublesElimination.view.thirdPlaceMatch}
                      value={tournament.has_third_place_match ? t.doublesElimination.view.yes : t.doublesElimination.view.no}
                    />
                    <SettingItem
                      label={t.doublesElimination.view.courts}
                      value={String(tournament.court_count)}
                    />
                  </div>
                </div>

                <RefereeManagement
                  referees={referees.map(r => ({ id: r.id, email: r.email, display_name: r.display_name }))}
                  loading={refereesLoading}
                  onAddReferee={addRefereeByEmail}
                  onRemoveReferee={removeReferee}
                />
              </TabsContent>
            )}
          </Tabs>
        </section>
      </div>
    </TheLineLayout>
  );
}

function SettingItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div
        style={{
          fontFamily: 'Geist Mono, ui-monospace, monospace',
          fontSize: 11,
          color: 'var(--tl-fg-3)',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: 'Geist Mono, ui-monospace, monospace',
          fontSize: 14,
          fontWeight: 600,
          color: 'var(--tl-fg)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </div>
    </div>
  );
}
