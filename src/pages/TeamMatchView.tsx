import { useParams, useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DynamicMeta } from '@/components/seo';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
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
import { ArrowLeft, Users, Trophy, Calendar, Settings, Gamepad2, Copy, Plus, Play, ClipboardList, LayoutGrid, Mail, Trash2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTeamMatchTournament, useTeamMatch } from '@/hooks/useTeamMatch';
import { useUserTeam, useTeamMatchTeams, TeamMatchTeam } from '@/hooks/useTeamMatchTeams';
import { useTeamMatchMatches, useTeamMatchMatchManagement, TeamMatchMatch } from '@/hooks/useTeamMatchMatches';
import { useTeamMatchStandings } from '@/hooks/useTeamMatchStandings';
import { useTeamMatchGroups, useTeamMatchGroupManagement } from '@/hooks/useTeamMatchGroups';
import { useAuth } from '@/hooks/useAuth';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { vi as viLocale, enUS } from 'date-fns/locale';
import { useState, useMemo, useCallback } from 'react';
import { 
  CreateTeamDialog,
  TeamRegistrationDialog,
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
  TeamMatchScoringSheet,
  TeamMatchOverviewTab,
  TeamMatchMatchesTab,
} from '@/components/teamMatch';
import { useTeamMatchRefereeManagement } from '@/hooks/useTeamMatchRefereeManagement';
import { useTeamMatchRealtime } from '@/hooks/useTeamMatchRealtime';
import { useVisibilityRefresh } from '@/hooks/useVisibilityRefresh';
import { useI18n } from '@/i18n';
import { useQueryClient } from '@tanstack/react-query';

const STATUS_COLORS: Record<string, string> = {
  setup: 'bg-muted text-muted-foreground',
  registration: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  ongoing: 'bg-green-500/10 text-green-500 border-green-500/20',
  completed: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
};

// STATUS_LABELS and FORMAT_LABELS moved inside component to use i18n

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
  
  // Referee management
  const {
    referees,
    loading: refereesLoading,
    userRole,
    addRefereeByEmail,
    removeReferee,
  } = useTeamMatchRefereeManagement(tournament?.id, tournament?.created_by);

  // Realtime subscription for matches and games
  useTeamMatchRealtime(tournament?.id);

  const [showCreateTeam, setShowCreateTeam] = useState(false);
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
  const [startRoundNumber, setStartRoundNumber] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const queryClient = useQueryClient();

  // Manual refresh handler
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ['team-match-matches', tournament?.id] });
    await queryClient.invalidateQueries({ queryKey: ['team-match-teams', tournament?.id] });
    await queryClient.invalidateQueries({ queryKey: ['team-match-tournament'] });
    setTimeout(() => setIsRefreshing(false), 600);
  }, [queryClient, tournament?.id]);

  // Layer 1 & 2: Visibility-change auto-refresh + polling fallback
  useVisibilityRefresh(
    useCallback(() => {
      queryClient.invalidateQueries({ queryKey: ['team-match-matches', tournament?.id] });
      queryClient.invalidateQueries({ queryKey: ['team-match-teams', tournament?.id] });
    }, [queryClient, tournament?.id]),
    { minInterval: 5000, pollingInterval: 20000 }
  );
  // For BTC lineup: track which team to lineup for
  const [lineupTeamId, setLineupTeamId] = useState<string | null>(null);
  // For scoring sheet
  const [scoringMatch, setScoringMatch] = useState<TeamMatchMatch | null>(null);

  const isOwner = tournament?.created_by === user?.id;
  const canManage = isOwner || isAdmin; // Admin or owner can manage
  const isSingleElimination = tournament?.format === 'single_elimination';
  const canRegister = (tournament?.status === 'registration' || tournament?.status === 'setup') && !userTeam && user;
  const approvedTeamsCount = teams?.filter(t => t.status === 'approved').length || 0;
  const pendingTeamsCount = teams?.filter(t => t.status === 'pending').length || 0;
  const hasMatches = matches && matches.length > 0;
  const hasGroups = groups && groups.length > 0;
  const roundRobinMatches = matches?.filter(m => !m.is_playoff) || [];
  const playoffMatches = matches?.filter(m => m.is_playoff) || [];
  const isGroupPlayoffFormat = tournament?.format === 'rr_playoff';
  const canStartGroupSetup = canManage && isGroupPlayoffFormat && !hasGroups && pendingTeamsCount === 0 && approvedTeamsCount >= 6;

  // Handle delete tournament
  const handleDeleteTournament = async () => {
    if (!tournament) return;
    try {
      await deleteTournament(tournament.id);
      navigate('/tools/team-match');
    } catch (error) {
      // Error handled in hook
    }
  };

  // Filter out rejected teams for display
  const displayTeams = teams?.filter(t => t.status !== 'rejected') || [];

  const handleCopyLink = () => {
    const shareUrl = `${window.location.origin}/tools/team-match/${tournament?.share_id}`;
    navigator.clipboard.writeText(shareUrl);
    toast({ title: t.teamMatch.view.linkCopied });
  };

  const handleGenerateMatches = async () => {
    if (!tournament || !teams) return;
    try {
      // Fetch actual game templates from database
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
    // Update all matches in this round to in_progress
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
      // Use cross-group seeding if available
      const playoffSeeding = generatePlayoffSeeding(teamCount);
      const qualifyingTeams = playoffSeeding.seeds.map((seed, index) => ({
        teamId: seed.teamId,
        seed: index + 1,
      }));

      // Fetch actual game templates from database
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

      // Pass pairings for proper bracket structure
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
    } catch (error: any) {
      toast({
        title: t.teamMatch.view.errorOccurred,
        description: error.message || t.teamMatch.view.errorOccurred,
        variant: 'destructive',
      });
    }
  };

  const handleCreateGroups = async (groupCount: number, distribution: Array<Array<{ id: string; name: string }>>) => {
    if (!tournament) return;
    
    try {
      // Fetch actual game templates from database
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
      });
      
      setShowGroupSetupDialog(false);
      setActiveTab('matches');
    } catch (error) {
      // Error handled in hook
    }
  };

  // Handler for Single Elimination bracket generation
  const handleGenerateSingleElimination = async (
    pairingType: 'random' | 'manual',
    manualPairings?: Array<{ team1Id: string; team2Id: string }>
  ) => {
    if (!tournament || !teams) return;
    
    try {
      // Fetch actual game templates from database
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

  if (isLoading) {
    return (
      <MainLayout>
        <div className="container max-w-4xl py-6 space-y-6">
          <div className="flex items-center gap-4">
            <Skeleton className="h-10 w-10" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-8 w-1/2" />
              <Skeleton className="h-4 w-1/3" />
            </div>
          </div>
          <Skeleton className="h-64 w-full" />
        </div>
      </MainLayout>
    );
  }

  if (error || !tournament) {
    return (
      <MainLayout>
        <div className="container max-w-4xl py-12 text-center">
          <Trophy className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h1 className="text-2xl font-bold mb-2">{t.teamMatch.view.notFound}</h1>
          <p className="text-muted-foreground mb-6">
            {t.teamMatch.view.notFoundDesc}
          </p>
          <Button onClick={() => navigate('/tools/team-match')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t.teamMatch.view.backToList}
          </Button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <DynamicMeta 
        title={`${tournament.name} | Team Match`}
        description={`${tournament.name} – Team Match Pickleball`}
        noindex={true}
      />
      <div className="container max-w-4xl py-6 space-y-6">
        {/* Sticky Header with Settings */}
        <div className="sticky top-14 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 -mx-4 px-4 py-3 border-b md:relative md:top-0 md:border-b-0 md:py-0 md:mx-0 md:px-0 md:bg-transparent md:backdrop-blur-none">
          <div className="flex items-start gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate('/tools/team-match')} className="shrink-0">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl md:text-2xl font-bold truncate">{tournament.name}</h1>
                <Badge variant="outline" className={cn("shrink-0", STATUS_COLORS[tournament.status])}>
                  {STATUS_LABELS[tournament.status]}
                </Badge>
              </div>
              <div className="flex items-center gap-3 mt-1 text-xs md:text-sm text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  {format(new Date(tournament.created_at), 'dd/MM/yyyy', { locale: language === 'vi' ? viLocale : enUS })}
                </span>
                <span className="flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  {tournament.team_count} {t.teamMatch.teams} × {tournament.team_roster_size} {t.teamMatch.players}
                </span>
                <span className="hidden sm:flex items-center gap-1">
                  <Trophy className="h-3.5 w-3.5" />
                  {FORMAT_LABELS[tournament.format]}
                </span>
              </div>
            </div>
            <div className="flex gap-2 shrink-0">
              <Button variant="outline" size="icon" onClick={handleRefresh} disabled={isRefreshing} title="Refresh">
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              </Button>
              <Button variant="outline" size="icon" onClick={handleCopyLink} title={t.teamMatch.view.copyLink}>
                <Copy className="h-4 w-4" />
              </Button>
              {canManage && (
                <>
                  <Button variant="outline" size="icon" onClick={() => setShowSettingsDialog(true)} title={t.teamMatch.view.settings}>
                    <Settings className="h-4 w-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" size="icon" className="text-destructive hover:bg-destructive/10" title={t.teamMatch.view.deleteBtn}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
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
                        <AlertDialogAction onClick={handleDeleteTournament} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          {t.teamMatch.view.deleteAction}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        {/* Hide standings tab for single_elimination format */}
        {(() => {
          const showStandingsTab = tournament.format !== 'single_elimination';
          return (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className={`grid w-full ${showStandingsTab ? 'grid-cols-4' : 'grid-cols-3'}`}>
                <TabsTrigger value="overview">{t.teamMatch.view.overview}</TabsTrigger>
                <TabsTrigger value="teams">{t.teamMatch.view.teams}</TabsTrigger>
                <TabsTrigger value="matches">{t.teamMatch.view.matches}</TabsTrigger>
                {showStandingsTab && <TabsTrigger value="standings">{t.teamMatch.view.standings}</TabsTrigger>}
              </TabsList>

          <TabsContent value="overview" className="space-y-4 mt-4">
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

          <TabsContent value="teams" className="mt-4 space-y-4">
            {/* Registration action for users - Only show if no team yet */}
            {canRegister && (
              <Card className="border-dashed border-2">
                <CardContent className="py-6 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{t.teamMatch.view.registerForTournament}</p>
                    <p className="text-sm text-muted-foreground">
                      {t.teamMatch.view.createTeamToJoin}
                    </p>
                  </div>
                  <Button onClick={() => setShowCreateTeam(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    {t.teamMatch.view.createTeam}
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Captain's team roster display - mobile-friendly large font */}
            {userTeam && (
              <TeamRosterDisplay
                team={userTeam}
                maxRosterSize={tournament.team_roster_size}
                onManageClick={() => setSelectedTeam(userTeam)}
              />
            )}

            {/* Other teams list - for BTC or viewing other teams */}
            {(isOwner || !userTeam) && (
              <TeamList
                tournamentId={tournament.id}
                isOwner={false}
                onTeamClick={(team) => setSelectedTeam(team)}
              />
            )}
          </TabsContent>

          <TabsContent value="matches" className="mt-4 space-y-4">
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
              onScoreMatch={(match) => setScoringMatch(match)}
              onStartTournament={handleStartTournament}
            />
          </TabsContent>

          {showStandingsTab && (
            <TabsContent value="standings" className="mt-4">
              {/* Group-based Standings for rr_playoff format */}
              {hasGroups ? (
                <GroupStandingsTable 
                  tournamentId={tournament.id} 
                  topPerGroup={(tournament as any).top_per_group || 2}
                />
              ) : (
                <StandingsTable tournamentId={tournament.id} />
              )}
            </TabsContent>
          )}
            </Tabs>
          );
        })()}

        {/* Team Registration Dialog - for users to register */}
        {!isOwner && (
          <TeamRegistrationDialog
            open={showCreateTeam}
            onOpenChange={setShowCreateTeam}
            tournamentId={tournament.id}
            maxRosterSize={tournament.team_roster_size}
            onSuccess={() => setActiveTab('overview')}
          />
        )}
        
        {/* Create Team Dialog - for BTC to add teams */}
        {isOwner && (
          <CreateTeamDialog
            open={showCreateTeam}
            onOpenChange={setShowCreateTeam}
            tournamentId={tournament.id}
            onSuccess={() => setActiveTab('overview')}
          />
        )}

        {/* Team Detail Sheet */}
        <TeamDetailSheet
          open={!!selectedTeam}
          onOpenChange={(open) => !open && setSelectedTeam(null)}
          team={selectedTeam}
          maxRosterSize={tournament.team_roster_size}
          isOwner={isOwner}
        />

        {/* Match Detail Sheet */}
        <MatchDetailSheet
          open={!!selectedMatch}
          onOpenChange={(open) => !open && setSelectedMatch(null)}
          match={selectedMatch}
          isOwner={userRole.canEditScores}
          tournamentId={tournament.id}
          onScoreMatch={(match) => {
            setSelectedMatch(null);
            setScoringMatch(match);
          }}
        />

        {/* Scoring Sheet for referees */}
        <TeamMatchScoringSheet
          open={!!scoringMatch}
          onOpenChange={(open) => !open && setScoringMatch(null)}
          match={scoringMatch}
          tournamentId={tournament.id}
        />

        {/* Lineup Selection Sheet - For Captain's own team OR BTC for any team */}
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

        {/* Invite Team Dialog */}
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

        {/* Playoff Setup Dialog */}
        <PlayoffSetupDialog
          open={showPlayoffDialog}
          onOpenChange={setShowPlayoffDialog}
          standings={standings}
          hasGroups={standingsHasGroups}
          generatePlayoffSeeding={generatePlayoffSeeding}
          isCreating={isGeneratingPlayoff}
          onConfirm={handleCreatePlayoff}
        />

        {/* Group Setup Dialog */}
        <GroupSetupDialog
          open={showGroupSetupDialog}
          onOpenChange={setShowGroupSetupDialog}
          teams={teams || []}
          isCreating={isCreatingGroups}
          onConfirm={handleCreateGroups}
        />

        {/* Single Elimination Setup Dialog */}
        <SingleEliminationSetupDialog
          open={showSESetupDialog}
          onOpenChange={setShowSESetupDialog}
          teams={teams || []}
          hasThirdPlaceMatch={tournament.has_third_place_match || false}
          isCreating={isGeneratingSE}
          onConfirm={handleGenerateSingleElimination}
        />

        {/* Settings Dialog with Referee Management */}
        <TeamMatchSettingsDialog
          open={showSettingsDialog}
          onOpenChange={setShowSettingsDialog}
          tournamentName={tournament.name}
          referees={referees}
          refereesLoading={refereesLoading}
          onAddReferee={addRefereeByEmail}
          onRemoveReferee={removeReferee}
        />

        {/* Start Tournament Confirmation */}
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
    </MainLayout>
  );
}
