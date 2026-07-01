import { useParams, useNavigate, Link } from 'react-router-dom';
import { TheLineLayout } from '@/components/layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
} from '@/components/ui/alert-dialog';
import { Users, Trophy, Calendar, Settings, Copy, Plus, Trash2, RefreshCw } from 'lucide-react';
import { useTeamMatchTournament, useTeamMatch } from '@/hooks/useTeamMatch';
import { useUserTeam, useUserMembership, useTeamMatchTeams, TeamMatchTeam } from '@/hooks/useTeamMatchTeams';
import { useTeamMatchMatches, useTeamMatchMatchManagement, TeamMatchMatch } from '@/hooks/useTeamMatchMatches';
import { useTeamMatchStandings } from '@/hooks/useTeamMatchStandings';
import { useTeamMatchGroups, useTeamMatchGroupManagement } from '@/hooks/useTeamMatchGroups';
import { useAuth } from '@/hooks/useAuth';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { vi as viLocale, enUS } from 'date-fns/locale';
import { useState, useCallback } from 'react';
import {
  CreateTeamDialog,
  TeamRegistrationDialog,
  QuickRegisterCTA,
  TeamList,
  TeamDetailSheet,
  MatchDetailSheet,
  GenerateMatchesDialog,
  StandingsTable,
  TeamRosterDisplay,
  LineupSelectionSheet,
  PlayoffSetupDialog,
  GroupSetupDialog,
  GroupStandingsTable,
  InviteTeamDialog,
  SingleEliminationSetupDialog,
  TeamMatchSettingsDialog,
  TeamMatchOverviewTab,
  TeamMatchMatchesTab,
} from '@/components/teamMatch';
import { useTeamMatchRefereeManagement } from '@/hooks/useTeamMatchRefereeManagement';
import { useTeamMatchRealtime } from '@/hooks/useTeamMatchRealtime';
import { useVisibilityRefresh } from '@/hooks/useVisibilityRefresh';
import { useI18n } from '@/i18n';
import { useQueryClient } from '@tanstack/react-query';

const surfaceCard: React.CSSProperties = {
  background: 'var(--tl-bg-elev)',
  border: '1px solid var(--tl-border)',
  borderRadius: 'var(--tl-radius-lg)',
};

// Status pill — token-driven so it tracks light/dark mode
const statusPillStyle = (status: string): React.CSSProperties => {
  if (status === 'completed') return { background: 'var(--tl-surface)', color: 'var(--tl-fg-3)' };
  if (status === 'ongoing') return { background: 'var(--tl-green-glow)', color: 'var(--tl-green)' };
  if (status === 'registration') return { background: 'rgba(79, 155, 255, 0.12)', color: 'rgb(79, 155, 255)' };
  return { background: 'rgba(233, 182, 73, 0.12)', color: 'var(--tl-gold)' };
};

// shadcn TabsList override — flatten the rounded pill bg, replace with token border-bottom + flex.
const tlTabsListClass =
  'flex w-full !h-auto !p-0 !bg-transparent !border-b !border-[var(--tl-border)] !rounded-none gap-2';

// shadcn TabsTrigger override — green underline on active state.
const tlTabsTriggerClass = [
  'flex-1 inline-flex items-center justify-center gap-1.5',
  '!px-3 !py-2',
  '!text-[11px] !font-medium tracking-[0.06em] uppercase',
  'font-[family-name:Geist_Mono,ui-monospace,monospace]',
  '!text-[var(--tl-fg-3)] !bg-transparent !rounded-none !shadow-none',
  'border-b-2 border-transparent',
  'data-[state=active]:!text-[var(--tl-fg)]',
  'data-[state=active]:!border-[var(--tl-green)]',
  'data-[state=active]:!bg-transparent data-[state=active]:!shadow-none',
  'transition-colors',
  'hover:!text-[var(--tl-fg-2)]',
].join(' ');

export default function TeamMatchView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isAdmin } = useAdminAuth();
  const { toast } = useToast();
  const { t, language } = useI18n();

  const STATUS_LABELS: Record<string, string> = {
    setup: t.teamMatch.statusSetup,
    registration: t.teamMatch.statusRegistration,
    ongoing: t.teamMatch.statusOngoing,
    completed: t.teamMatch.statusCompleted,
  };

  const FORMAT_LABELS: Record<string, string> = {
    round_robin: t.teamMatch.formatRoundRobin,
    single_elimination: t.teamMatch.formatSingleElim,
    rr_playoff: t.teamMatch.formatRrPlayoff,
  };

  const { data: tournament, isLoading, error } = useTeamMatchTournament(id);
  const { data: userTeam } = useUserTeam(tournament?.id);
  const { data: membership } = useUserMembership(tournament?.id);
  const { updateTournamentStatus, isUpdatingStatus, deleteTournament } = useTeamMatch();

  const { data: teams } = useTeamMatchTeams(tournament?.id);
  const { data: matches } = useTeamMatchMatches(tournament?.id);
  const { data: groups } = useTeamMatchGroups(tournament?.id);
  const { generateMatches, isGenerating, generatePlayoffMatches, isGeneratingPlayoff, generateSingleElimination, isGeneratingSE } = useTeamMatchMatchManagement();
  const { createGroups, isCreatingGroups } = useTeamMatchGroupManagement();
  const {
    standings,
    roundRobinComplete,
    hasPlayoff,
    hasGroups: standingsHasGroups,
    generatePlayoffSeeding,
  } = useTeamMatchStandings(tournament?.id, {
    topPerGroup: tournament?.top_per_group || 2,
  });

  const {
    referees,
    loading: refereesLoading,
    userRole,
    addRefereeByEmail,
    removeReferee,
  } = useTeamMatchRefereeManagement(tournament?.id, tournament?.created_by);

  useTeamMatchRealtime(tournament?.id);

  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [dialogMode, setDialogMode] = useState<'select' | 'create' | 'use-existing'>('select');
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<TeamMatchTeam | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<TeamMatchMatch | null>(null);
  const [lineupMatch, setLineupMatch] = useState<TeamMatchMatch | null>(null);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [showStartTournamentDialog, setShowStartTournamentDialog] = useState(false);
  const [showPlayoffDialog, setShowPlayoffDialog] = useState(false);
  const [showGroupSetupDialog, setShowGroupSetupDialog] = useState(false);
  const [showInviteTeamDialog, setShowInviteTeamDialog] = useState(false);
  const [showSESetupDialog, setShowSESetupDialog] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const queryClient = useQueryClient();

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['team-match-matches', tournament?.id] });
    await queryClient.invalidateQueries({ queryKey: ['team-match-teams', tournament?.id] });
    await queryClient.invalidateQueries({ queryKey: ['team-match-tournament'] });
    setTimeout(() => setIsRefreshing(false), 600);
  }, [queryClient, tournament?.id]);

  useVisibilityRefresh(
    useCallback(() => {
      queryClient.invalidateQueries({ queryKey: ['team-match-matches', tournament?.id] });
      queryClient.invalidateQueries({ queryKey: ['team-match-teams', tournament?.id] });
    }, [queryClient, tournament?.id]),
    { minInterval: 5000, pollingInterval: 20000 },
  );

  const [lineupTeamId, setLineupTeamId] = useState<string | null>(null);

  const isOwner = tournament?.created_by === user?.id;
  const canManage = isOwner || isAdmin;
  const canRegister = (tournament?.status === 'registration' || tournament?.status === 'setup') && !userTeam && !membership && user;
  const approvedTeamsCount = teams?.filter(t => t.status === 'approved').length || 0;
  const pendingTeamsCount = teams?.filter(t => t.status === 'pending').length || 0;

  const openRegisterDialog = (mode: 'create' | 'use-existing') => {
    setDialogMode(mode);
    setShowCreateTeam(true);
  };

  // Shared registration CTA — rendered on both Overview and Teams tabs.
  // Captains get the one-tap QuickRegister; the organizer keeps the legacy
  // "add a team" card (opens CreateTeamDialog).
  const registerCTA =
    canRegister && tournament ? (
      isOwner ? (
        <div
          style={{
            ...surfaceCard,
            borderStyle: 'dashed',
            padding: 18,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <p style={{ fontWeight: 500, color: 'var(--tl-fg)', margin: 0, fontSize: 14.5 }}>
              {t.teamMatch.view.registerForTournament}
            </p>
            <p style={{ fontSize: 13, color: 'var(--tl-fg-3)', marginTop: 4, margin: 0, lineHeight: 1.5 }}>
              {t.teamMatch.view.createTeamToJoin}
            </p>
          </div>
          <button type="button" className="tl-btn green" onClick={() => openRegisterDialog('create')}>
            <Plus className="w-4 h-4" />
            {t.teamMatch.view.createTeam}
          </button>
        </div>
      ) : (
        <QuickRegisterCTA
          tournamentId={tournament.id}
          requireDupr={tournament.require_dupr ?? false}
          duprMaxMale={tournament.dupr_max_male ?? null}
          duprMaxFemale={tournament.dupr_max_female ?? null}
          onOpenDialog={openRegisterDialog}
          onSuccess={() => setActiveTab('overview')}
        />
      )
    ) : null;

  // Player who joined a team (not the captain) — show their request status.
  const memberTeam = membership ? teams?.find((tm) => tm.id === membership.teamId) : null;
  const membershipBanner =
    membership && !membership.isCaptain && memberTeam ? (
      <button
        type="button"
        onClick={() => setSelectedTeam(memberTeam)}
        style={{
          ...surfaceCard,
          width: '100%',
          textAlign: 'left',
          padding: 16,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          cursor: 'pointer',
        }}
      >
        <div>
          <p style={{ fontWeight: 500, color: 'var(--tl-fg)', margin: 0, fontSize: 14.5 }}>
            {language === 'vi' ? `Đội của bạn: ${membership.teamName}` : `Your team: ${membership.teamName}`}
          </p>
          <p style={{ fontSize: 13, color: 'var(--tl-fg-3)', marginTop: 4, margin: 0 }}>
            {membership.status === 'pending'
              ? language === 'vi'
                ? 'Đang chờ đội trưởng duyệt'
                : 'Awaiting captain approval'
              : language === 'vi'
                ? 'Đã được duyệt vào đội'
                : 'Approved on the team'}
          </p>
        </div>
        <span
          style={{
            fontFamily: 'Geist Mono, ui-monospace, monospace',
            fontSize: 10.5,
            fontWeight: 500,
            padding: '3px 9px',
            borderRadius: 4,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            whiteSpace: 'nowrap',
            ...(membership.status === 'pending'
              ? { background: 'rgba(233, 182, 73, 0.12)', color: 'var(--tl-gold)' }
              : { background: 'var(--tl-green-glow)', color: 'var(--tl-green)' }),
          }}
        >
          {membership.status === 'pending'
            ? language === 'vi' ? 'Chờ duyệt' : 'Pending'
            : language === 'vi' ? 'Đã duyệt' : 'Approved'}
        </span>
      </button>
    ) : null;
  const hasMatches = matches && matches.length > 0;
  const hasGroups = groups && groups.length > 0;
  const isGroupPlayoffFormat = tournament?.format === 'rr_playoff';
  const canStartGroupSetup = canManage && isGroupPlayoffFormat && !hasGroups && pendingTeamsCount === 0 && approvedTeamsCount >= 6;

  const handleDeleteTournament = async () => {
    if (!tournament) return;
    try {
      await deleteTournament(tournament.id);
      navigate('/tools/team-match');
    } catch (error) {
      // Error handled in hook
    }
  };

  const displayTeams = teams?.filter(t => t.status !== 'rejected') || [];

  const handleCopyLink = () => {
    const shareUrl = `${window.location.origin}/tools/team-match/${tournament?.share_id}`;
    navigator.clipboard.writeText(shareUrl);
    toast({ title: t.teamMatch.view.linkCopied });
  };

  const handleGenerateMatches = async () => {
    if (!tournament || !teams) return;
    try {
      const { data: templates, error: templatesError } = await supabase
        .from('team_match_game_templates')
        .select('*')
        .eq('tournament_id', tournament.id)
        .order('order_index');

      if (templatesError) throw templatesError;

      const gameTemplates = (templates || []).map(t => ({
        game_type: t.game_type as 'WD' | 'MD' | 'MX' | 'WS' | 'MS',
        scoring_type: t.scoring_type as 'rally21' | 'sideout11',
        display_name: t.display_name,
        order_index: t.order_index,
      }));

      await generateMatches({
        tournamentId: tournament.id,
        teams,
        gameTemplates,
        hasDreambreaker: tournament.has_dreambreaker,
      });
      setShowGenerateDialog(false);
    } catch (error) {
      // Error handled in hook
    }
  };

  const handleStartTournament = async () => {
    if (!tournament) return;
    try {
      await updateTournamentStatus({ tournamentId: tournament.id, status: 'ongoing' });
      setShowStartTournamentDialog(false);
    } catch (error) {
      // Error handled in hook
    }
  };

  const handleStartRound = async (roundNumber: number) => {
    if (!tournament || !matches) return;

    const roundMatches = matches.filter(m => m.round_number === roundNumber);

    try {
      for (const match of roundMatches) {
        await supabase
          .from('team_match_matches')
          .update({ status: 'in_progress' })
          .eq('id', match.id);
      }

      toast({ title: t.teamMatch.view.roundStarted + ' ' + roundNumber });
      window.location.reload();
    } catch (error) {
      toast({ title: t.teamMatch.view.errorOccurred, variant: 'destructive' });
    }
  };

  const handleCreatePlayoff = async (teamCount: number) => {
    if (!tournament) return;

    try {
      const playoffSeeding = generatePlayoffSeeding(teamCount);
      const qualifyingTeams = playoffSeeding.seeds.map((seed, index) => ({
        teamId: seed.teamId,
        seed: index + 1,
      }));

      const { data: templates, error: templatesError } = await supabase
        .from('team_match_game_templates')
        .select('*')
        .eq('tournament_id', tournament.id)
        .order('order_index');

      if (templatesError) throw templatesError;

      const gameTemplates = (templates || []).map(t => ({
        game_type: t.game_type as 'WD' | 'MD' | 'MX' | 'WS' | 'MS',
        scoring_type: t.scoring_type as 'rally21' | 'sideout11',
        display_name: t.display_name,
        order_index: t.order_index,
      }));

      await generatePlayoffMatches({
        tournamentId: tournament.id,
        qualifyingTeams,
        gameTemplates,
        hasDreambreaker: tournament.has_dreambreaker,
        pairings: playoffSeeding.pairings.map(p => ({
          matchIndex: p.matchIndex,
          bracketSide: p.bracketSide,
          team1Id: p.team1.teamId,
          team2Id: p.team2.teamId,
        })),
      });

      setShowPlayoffDialog(false);
      setActiveTab('matches');
    } catch (error) {
      toast({
        title: t.teamMatch.view.errorOccurred,
        description: (error as Error).message || t.teamMatch.view.errorOccurred,
        variant: 'destructive',
      });
    }
  };

  const handleCreateGroups = async (
    groupCount: number,
    distribution: Array<Array<{ id: string; name: string }>>,
    randomizeGameOrder?: boolean,
  ) => {
    if (!tournament) return;

    try {
      const { data: templates, error: templatesError } = await supabase
        .from('team_match_game_templates')
        .select('*')
        .eq('tournament_id', tournament.id)
        .order('order_index');

      if (templatesError) throw templatesError;

      const gameTemplates = (templates || []).map(t => ({
        game_type: t.game_type as 'WD' | 'MD' | 'MX' | 'WS' | 'MS',
        scoring_type: t.scoring_type as 'rally21' | 'sideout11',
        display_name: t.display_name,
        order_index: t.order_index,
      }));

      await createGroups({
        tournamentId: tournament.id,
        groupCount,
        distribution,
        gameTemplates,
        hasDreambreaker: tournament.has_dreambreaker,
        randomizeGameOrder,
      });

      setShowGroupSetupDialog(false);
      setActiveTab('matches');
    } catch (error) {
      // Error handled in hook
    }
  };

  const handleGenerateSingleElimination = async (
    pairingType: 'random' | 'manual',
    manualPairings?: Array<{ team1Id: string; team2Id: string }>,
  ) => {
    if (!tournament || !teams) return;

    try {
      const { data: templates, error: templatesError } = await supabase
        .from('team_match_game_templates')
        .select('*')
        .eq('tournament_id', tournament.id)
        .order('order_index');

      if (templatesError) throw templatesError;

      const gameTemplates = (templates || []).map(t => ({
        game_type: t.game_type as 'WD' | 'MD' | 'MX' | 'WS' | 'MS',
        scoring_type: t.scoring_type as 'rally21' | 'sideout11',
        display_name: t.display_name,
        order_index: t.order_index,
      }));

      await generateSingleElimination({
        tournamentId: tournament.id,
        teams,
        gameTemplates,
        hasDreambreaker: tournament.has_dreambreaker,
        hasThirdPlaceMatch: tournament.has_third_place_match || false,
        pairingType,
        manualPairings,
      });

      setShowSESetupDialog(false);
      setActiveTab('matches');
    } catch (error) {
      // Error handled in hook
    }
  };

  // ─── Loading + 404 states ────────────────────────────────────────────────
  if (isLoading) {
    return (
      <TheLineLayout title="Team Match" noindex={true} active="lab">
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

  if (error || !tournament) {
    return (
      <TheLineLayout title="Team Match" noindex={true} active="lab">
        <div className="tl-shell">
          <div className="tl-empty" style={{ marginTop: 56 }}>
            <h3>{t.teamMatch.view.notFound}</h3>
            <p>{t.teamMatch.view.notFoundDesc}</p>
            <Link to="/tools/team-match" className="tl-btn">
              ← {t.teamMatch.view.backToList}
            </Link>
          </div>
        </div>
      </TheLineLayout>
    );
  }

  const showStandingsTab = tournament.format !== 'single_elimination';
  const dateLocale = language === 'vi' ? viLocale : enUS;

  return (
    <TheLineLayout
      title={`${tournament.name} | Team Match`}
      description={`${tournament.name} – Team Match Pickleball`}
      noindex={true}
      active="lab"
    >
      <div className="tl-shell">
        <nav className="tl-breadcrumb">
          <Link to="/tools">{language === 'vi' ? 'Bracket Lab' : 'Bracket Lab'}</Link>
          <span className="sep">/</span>
          <Link to="/tools/team-match">Team Match</Link>
          <span className="sep">/</span>
          <span className="current">{tournament.name}</span>
        </nav>

        <header className="tl-page-head">
          <div className="kicker">
            ◆ {language === 'vi' ? 'Team Match · MLP' : 'Team Match · MLP'}
            <span style={{ color: 'var(--tl-fg-4)', margin: '0 8px' }}>·</span>
            {tournament.team_count} {t.teamMatch.teams} × {tournament.team_roster_size}
            <span style={{ color: 'var(--tl-fg-4)', margin: '0 8px' }}>·</span>
            {FORMAT_LABELS[tournament.format]}
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
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                ...statusPillStyle(tournament.status),
              }}
            >
              {STATUS_LABELS[tournament.status]}
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
              <button type="button" className="tl-btn" onClick={handleCopyLink}>
                <Copy className="w-4 h-4" />
                <span className="hidden sm:inline">{t.teamMatch.view.copyLink}</span>
              </button>
              {canManage && (
                <>
                  <button
                    type="button"
                    className="tl-btn"
                    onClick={() => setShowSettingsDialog(true)}
                  >
                    <Settings className="w-4 h-4" />
                    <span className="hidden sm:inline">{t.teamMatch.view.settings}</span>
                  </button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button
                        type="button"
                        className="tl-btn"
                        style={{ color: 'var(--tl-live)' }}
                        aria-label={t.teamMatch.view.deleteBtn}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>{t.teamMatch.view.deleteConfirm}</AlertDialogTitle>
                        <AlertDialogDescription>
                          {t.teamMatch.view.deleteConfirmDesc}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t.teamMatch.view.cancelBtn}</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDeleteTournament}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          {t.teamMatch.view.deleteAction}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              )}
            </div>
          </div>
        </header>

        <section style={{ marginTop: 32, marginBottom: 56 }}>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className={tlTabsListClass}>
              <TabsTrigger value="overview" className={tlTabsTriggerClass}>
                {t.teamMatch.view.overview}
              </TabsTrigger>
              <TabsTrigger value="teams" className={tlTabsTriggerClass}>
                {t.teamMatch.view.teams}
              </TabsTrigger>
              <TabsTrigger value="matches" className={tlTabsTriggerClass}>
                {t.teamMatch.view.matches}
              </TabsTrigger>
              {showStandingsTab && (
                <TabsTrigger value="standings" className={tlTabsTriggerClass}>
                  {t.teamMatch.view.standings}
                </TabsTrigger>
              )}
            </TabsList>

            <TabsContent value="overview" className="space-y-4 mt-6">
              {registerCTA}
              {membershipBanner}

              <TeamMatchOverviewTab
                tournament={{
                  id: tournament.id,
                  format: tournament.format,
                  status: tournament.status,
                  team_roster_size: tournament.team_roster_size,
                  top_per_group: tournament.top_per_group,
                }}
                isOwner={isOwner}
                userTeam={userTeam || null}
                displayTeams={displayTeams}
                hasMatches={!!hasMatches}
                hasGroups={!!hasGroups}
                approvedTeamsCount={approvedTeamsCount}
                pendingTeamsCount={pendingTeamsCount}
                canStartGroupSetup={canStartGroupSetup}
                onTeamClick={(team) => setSelectedTeam(team)}
                onGenerateMatches={() => setShowGenerateDialog(true)}
                onShowInviteTeam={() => setShowInviteTeamDialog(true)}
                onShowGroupSetup={() => setShowGroupSetupDialog(true)}
                onShowSESetup={() => setShowSESetupDialog(true)}
              />
            </TabsContent>

            <TabsContent value="teams" className="mt-6 space-y-4">
              {/* Registration prompt — one-tap for captains, legacy card for owner */}
              {registerCTA}
              {membershipBanner}

              {/* Captain's team roster — child component (deferred PR D.2) */}
              {userTeam && (
                <TeamRosterDisplay
                  team={userTeam}
                  maxRosterSize={tournament.team_roster_size}
                  onManageClick={() => setSelectedTeam(userTeam)}
                />
              )}

              {/* Other teams list — child component (deferred PR D.2) */}
              {(isOwner || !userTeam) && (
                <TeamList
                  tournamentId={tournament.id}
                  isOwner={false}
                  onTeamClick={(team) => setSelectedTeam(team)}
                />
              )}
            </TabsContent>

            <TabsContent value="matches" className="mt-6 space-y-4">
              <TeamMatchMatchesTab
                tournament={{
                  id: tournament.id,
                  format: tournament.format,
                  status: tournament.status,
                  has_dreambreaker: tournament.has_dreambreaker,
                  has_third_place_match: tournament.has_third_place_match,
                }}
                isOwner={isOwner}
                userTeam={userTeam || null}
                matches={matches}
                hasMatches={!!hasMatches}
                hasGroups={!!hasGroups}
                hasPlayoff={hasPlayoff}
                roundRobinComplete={roundRobinComplete}
                standings={standings}
                approvedTeamsCount={approvedTeamsCount}
                pendingTeamsCount={pendingTeamsCount}
                userRole={userRole}
                isUpdatingStatus={isUpdatingStatus}
                onGenerateMatches={() => setShowGenerateDialog(true)}
                onShowSESetup={() => setShowSESetupDialog(true)}
                onShowStartTournament={() => setShowStartTournamentDialog(true)}
                onShowPlayoffDialog={() => setShowPlayoffDialog(true)}
                onMatchClick={(match) => setSelectedMatch(match)}
                onLineupClick={(match, teamId) => {
                  setLineupMatch(match);
                  setLineupTeamId(teamId || null);
                }}
                onStartRound={handleStartRound}
                onScoreMatch={(match) => navigate(`/tools/team-match/match/${match.id}/score`)}
                onStartTournament={handleStartTournament}
              />
            </TabsContent>

            {showStandingsTab && (
              <TabsContent value="standings" className="mt-6">
                {hasGroups ? (
                  <GroupStandingsTable
                    tournamentId={tournament.id}
                    topPerGroup={tournament.top_per_group || 2}
                  />
                ) : (
                  <StandingsTable tournamentId={tournament.id} />
                )}
              </TabsContent>
            )}
          </Tabs>
        </section>

        {/* Dialog wiring — all kept intact, child components handle their own visuals */}
        {!isOwner && (
          <TeamRegistrationDialog
            open={showCreateTeam}
            onOpenChange={setShowCreateTeam}
            tournamentId={tournament.id}
            maxRosterSize={tournament.team_roster_size}
            requireDupr={tournament.require_dupr ?? false}
            duprMaxMale={tournament.dupr_max_male ?? null}
            duprMaxFemale={tournament.dupr_max_female ?? null}
            initialMode={dialogMode}
            onSuccess={() => setActiveTab('overview')}
          />
        )}

        {isOwner && (
          <CreateTeamDialog
            open={showCreateTeam}
            onOpenChange={setShowCreateTeam}
            tournamentId={tournament.id}
            onSuccess={() => setActiveTab('overview')}
          />
        )}

        <TeamDetailSheet
          open={!!selectedTeam}
          onOpenChange={(open) => !open && setSelectedTeam(null)}
          team={selectedTeam}
          maxRosterSize={tournament.team_roster_size}
          isOwner={isOwner}
          tournament={{
            status: tournament.status,
            require_dupr: tournament.require_dupr,
            dupr_max_male: tournament.dupr_max_male,
            dupr_max_female: tournament.dupr_max_female,
          }}
        />

        <MatchDetailSheet
          open={!!selectedMatch}
          onOpenChange={(open) => !open && setSelectedMatch(null)}
          match={selectedMatch}
          isOwner={userRole.canEditScores}
          tournamentId={tournament.id}
          onScoreMatch={(match) => {
            setSelectedMatch(null);
            navigate(`/tools/team-match/match/${match.id}/score`);
          }}
        />

        {(userTeam || isOwner) && lineupMatch && (
          <LineupSelectionSheet
            open={!!lineupMatch}
            onOpenChange={(open) => {
              if (!open) {
                setLineupMatch(null);
                setLineupTeamId(null);
              }
            }}
            match={lineupMatch}
            teamId={lineupTeamId || userTeam?.id || ''}
            tournamentId={tournament.id}
            hasDreambreaker={tournament.has_dreambreaker}
            isOwner={isOwner}
          />
        )}

        <InviteTeamDialog
          open={showInviteTeamDialog}
          onOpenChange={setShowInviteTeamDialog}
          tournamentId={tournament.id}
          tournamentName={tournament.name}
        />

        <GenerateMatchesDialog
          open={showGenerateDialog}
          onOpenChange={setShowGenerateDialog}
          teams={teams || []}
          gameTemplatesCount={5}
          maxRosterSize={tournament.team_roster_size}
          isGenerating={isGenerating}
          onConfirm={handleGenerateMatches}
        />

        <PlayoffSetupDialog
          open={showPlayoffDialog}
          onOpenChange={setShowPlayoffDialog}
          standings={standings}
          hasGroups={standingsHasGroups}
          generatePlayoffSeeding={generatePlayoffSeeding}
          isCreating={isGeneratingPlayoff}
          onConfirm={handleCreatePlayoff}
        />

        <GroupSetupDialog
          open={showGroupSetupDialog}
          onOpenChange={setShowGroupSetupDialog}
          teams={teams || []}
          isCreating={isCreatingGroups}
          rosterSize={tournament.team_roster_size}
          requireDupr={tournament.require_dupr ?? false}
          onConfirm={handleCreateGroups}
        />

        <SingleEliminationSetupDialog
          open={showSESetupDialog}
          onOpenChange={setShowSESetupDialog}
          teams={teams || []}
          hasThirdPlaceMatch={tournament.has_third_place_match || false}
          isCreating={isGeneratingSE}
          onConfirm={handleGenerateSingleElimination}
        />

        <TeamMatchSettingsDialog
          open={showSettingsDialog}
          onOpenChange={setShowSettingsDialog}
          tournamentName={tournament.name}
          referees={referees}
          refereesLoading={refereesLoading}
          onAddReferee={addRefereeByEmail}
          onRemoveReferee={removeReferee}
        />

        <AlertDialog open={showStartTournamentDialog} onOpenChange={setShowStartTournamentDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t.teamMatch.view.startTournamentTitle}</AlertDialogTitle>
              <AlertDialogDescription>
                {t.teamMatch.view.startTournamentDesc}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t.teamMatch.view.cancelBtn}</AlertDialogCancel>
              <AlertDialogAction onClick={handleStartTournament} disabled={isUpdatingStatus}>
                {t.teamMatch.view.startBtn}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TheLineLayout>
  );
}
