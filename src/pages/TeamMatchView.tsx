import { useParams, useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
} from '@/components/ui/alert-dialog';
import { ArrowLeft, Users, Trophy, Calendar, Settings, Gamepad2, Copy, Plus, Play, ClipboardList, LayoutGrid, Mail } from 'lucide-react';
import { useTeamMatchTournament, useTeamMatch } from '@/hooks/useTeamMatch';
import { useUserTeam, useTeamMatchTeams, TeamMatchTeam } from '@/hooks/useTeamMatchTeams';
import { useTeamMatchMatches, useTeamMatchMatchManagement, TeamMatchMatch } from '@/hooks/useTeamMatchMatches';
import { useTeamMatchStandings } from '@/hooks/useTeamMatchStandings';
import { useTeamMatchGroups, useTeamMatchGroupManagement } from '@/hooks/useTeamMatchGroups';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { useState, useMemo } from 'react';
import { 
  CreateTeamDialog,
  TeamRegistrationDialog,
  TeamList, 
  TeamDetailSheet,
  MatchList,
  MatchDetailSheet,
  GenerateMatchesDialog,
  StandingsTable,
  RegisteredTeamsSummary,
  TeamOverviewCard,
  TeamRosterDisplay,
  LineupSelectionSheet,
  AllTeamsOverview,
  PlayoffSetupDialog,
  PlayoffBracket,
  GroupSetupDialog,
  GroupMatchList,
  GroupStandingsTable,
  InviteTeamDialog,
  SingleEliminationSetupDialog,
  TeamMatchSettingsDialog,
} from '@/components/teamMatch';
import { useTeamMatchRefereeManagement } from '@/hooks/useTeamMatchRefereeManagement';

const STATUS_COLORS: Record<string, string> = {
  setup: 'bg-muted text-muted-foreground',
  registration: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  ongoing: 'bg-green-500/10 text-green-500 border-green-500/20',
  completed: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
};

const STATUS_LABELS: Record<string, string> = {
  setup: 'Đang thiết lập',
  registration: 'Đang đăng ký',
  ongoing: 'Đang diễn ra',
  completed: 'Đã kết thúc',
};

const FORMAT_LABELS: Record<string, string> = {
  round_robin: 'Vòng tròn',
  single_elimination: 'Loại trực tiếp',
  rr_playoff: 'Vòng bảng + Playoff',
};

export default function TeamMatchView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: tournament, isLoading, error } = useTeamMatchTournament(id);
  const { data: userTeam } = useUserTeam(tournament?.id);
  const { updateTournamentStatus, isUpdatingStatus } = useTeamMatch();
  
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
  // For BTC lineup: track which team to lineup for
  const [lineupTeamId, setLineupTeamId] = useState<string | null>(null);

  const isOwner = tournament?.created_by === user?.id;
  const isSingleElimination = tournament?.format === 'single_elimination';
  const canRegister = (tournament?.status === 'registration' || tournament?.status === 'setup') && !userTeam && user;
  const approvedTeamsCount = teams?.filter(t => t.status === 'approved').length || 0;
  const pendingTeamsCount = teams?.filter(t => t.status === 'pending').length || 0;
  const hasMatches = matches && matches.length > 0;
  const hasGroups = groups && groups.length > 0;
  const roundRobinMatches = matches?.filter(m => !m.is_playoff) || [];
  const playoffMatches = matches?.filter(m => m.is_playoff) || [];
  const isGroupPlayoffFormat = tournament?.format === 'rr_playoff';
  const canStartGroupSetup = isOwner && isGroupPlayoffFormat && !hasGroups && pendingTeamsCount === 0 && approvedTeamsCount >= 6;
  
  // Filter out rejected teams for display
  const displayTeams = teams?.filter(t => t.status !== 'rejected') || [];

  const handleCopyLink = () => {
    const shareUrl = `${window.location.origin}/tools/team-match/${tournament?.share_id}`;
    navigator.clipboard.writeText(shareUrl);
    toast({ title: 'Đã sao chép link!' });
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
      
      toast({ title: 'Đã bắt đầu vòng ' + roundNumber });
      // Refetch matches
      window.location.reload(); // Simple refresh for now
    } catch (error) {
      toast({ title: 'Lỗi', variant: 'destructive' });
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
        title: 'Lỗi tạo Playoff',
        description: error.message || 'Đã có lỗi xảy ra',
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
          <h1 className="text-2xl font-bold mb-2">Không tìm thấy giải đấu</h1>
          <p className="text-muted-foreground mb-6">
            Giải đấu này không tồn tại hoặc đã bị xóa
          </p>
          <Button onClick={() => navigate('/tools/team-match')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Quay lại danh sách
          </Button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container max-w-4xl py-6 space-y-6">
        {/* Header */}
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/tools/team-match')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{tournament.name}</h1>
              <Badge variant="outline" className={STATUS_COLORS[tournament.status]}>
                {STATUS_LABELS[tournament.status]}
              </Badge>
            </div>
            <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {format(new Date(tournament.created_at), 'dd/MM/yyyy', { locale: vi })}
              </span>
              <span className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                {tournament.team_count} đội × {tournament.team_roster_size} người
              </span>
              <span className="flex items-center gap-1">
                <Trophy className="h-4 w-4" />
                {FORMAT_LABELS[tournament.format]}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" onClick={handleCopyLink} title="Sao chép link">
              <Copy className="h-4 w-4" />
            </Button>
            {isOwner && (
              <Button variant="outline" size="sm" onClick={() => setShowSettingsDialog(true)}>
                <Settings className="h-4 w-4 mr-2" />
                Cài đặt
              </Button>
            )}
          </div>
        </div>

        {/* Tabs */}
        {/* Hide standings tab for single_elimination format */}
        {(() => {
          const showStandingsTab = tournament.format !== 'single_elimination';
          return (
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className={`grid w-full ${showStandingsTab ? 'grid-cols-4' : 'grid-cols-3'}`}>
                <TabsTrigger value="overview">Tổng quan</TabsTrigger>
                <TabsTrigger value="teams">Đội</TabsTrigger>
                <TabsTrigger value="matches">Trận đấu</TabsTrigger>
                {showStandingsTab && <TabsTrigger value="standings">Xếp hạng</TabsTrigger>}
              </TabsList>

          <TabsContent value="overview" className="space-y-4 mt-4">
            {/* Captain: Show team overview + all teams list */}
            {userTeam && !isOwner && (
              <>
                <TeamOverviewCard
                  team={userTeam}
                  maxRosterSize={tournament.team_roster_size}
                  totalTeamsRegistered={displayTeams.length}
                />
                {/* Captain can see all teams */}
                <AllTeamsOverview
                  teams={displayTeams}
                  tournamentId={tournament.id}
                  maxRosterSize={tournament.team_roster_size}
                />
              </>
            )}

            {/* BTC-only: Registered Teams Summary with approve actions */}
            {isOwner && displayTeams.length > 0 && (
              <RegisteredTeamsSummary
                teams={displayTeams}
                maxRosterSize={tournament.team_roster_size}
                isOwner={isOwner}
                tournamentId={tournament.id}
                hasMatches={hasMatches}
                onTeamClick={(team) => setSelectedTeam(team)}
                onGenerateMatches={() => setShowGenerateDialog(true)}
              />
            )}

            {/* Non-owner, non-captain: Show teams summary (view only) */}
            {!isOwner && !userTeam && displayTeams.length > 0 && (
              <RegisteredTeamsSummary
                teams={displayTeams}
                maxRosterSize={tournament.team_roster_size}
                isOwner={false}
                tournamentId={tournament.id}
                onTeamClick={(team) => setSelectedTeam(team)}
              />
            )}

            {/* Quick actions for owner - Group Playoff format */}
            {isOwner && isGroupPlayoffFormat && tournament.status === 'registration' && !hasGroups && (
              <Card className="border-primary/50 bg-primary/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Hành động BTC</CardTitle>
                  <CardDescription>
                    {pendingTeamsCount > 0 
                      ? `Duyệt ${pendingTeamsCount} đội đang chờ trước khi chia bảng`
                      : 'Thêm đội hoặc chia bảng thi đấu'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => setShowCreateTeam(true)}>
                    <Users className="h-4 w-4 mr-2" />
                    Thêm đội
                  </Button>
                  <Button variant="outline" onClick={() => setShowInviteTeamDialog(true)}>
                    <Mail className="h-4 w-4 mr-2" />
                    Mời đội
                  </Button>
                  <Button
                    onClick={() => setShowGroupSetupDialog(true)}
                    disabled={!canStartGroupSetup}
                  >
                    <LayoutGrid className="h-4 w-4 mr-2" />
                    Chia bảng ({approvedTeamsCount} đội)
                  </Button>
                </CardContent>
                {pendingTeamsCount > 0 && (
                  <CardContent className="pt-0">
                    <p className="text-xs text-amber-600">
                      ⚠️ Cần duyệt tất cả đội trước khi chia bảng
                    </p>
                  </CardContent>
                )}
                {approvedTeamsCount < 6 && pendingTeamsCount === 0 && (
                  <CardContent className="pt-0">
                    <p className="text-xs text-amber-600">
                      ⚠️ Cần ít nhất 6 đội để chia bảng
                    </p>
                  </CardContent>
                )}
              </Card>
            )}

            {/* Quick actions for owner - Single Elimination format */}
            {isOwner && isSingleElimination && tournament.status === 'registration' && !hasMatches && (
              <Card className="border-primary/50 bg-primary/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Hành động BTC</CardTitle>
                  <CardDescription>
                    {pendingTeamsCount > 0 
                      ? `Duyệt ${pendingTeamsCount} đội đang chờ trước khi tạo bracket`
                      : 'Thêm đội hoặc tạo bracket Single Elimination'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => setShowCreateTeam(true)}>
                    <Users className="h-4 w-4 mr-2" />
                    Thêm đội
                  </Button>
                  <Button variant="outline" onClick={() => setShowInviteTeamDialog(true)}>
                    <Mail className="h-4 w-4 mr-2" />
                    Mời đội
                  </Button>
                  <Button
                    onClick={() => setShowSESetupDialog(true)}
                    disabled={pendingTeamsCount > 0 || approvedTeamsCount < 4}
                  >
                    <Trophy className="h-4 w-4 mr-2" />
                    Sinh Bracket ({approvedTeamsCount} đội)
                  </Button>
                </CardContent>
                {pendingTeamsCount > 0 && (
                  <CardContent className="pt-0">
                    <p className="text-xs text-amber-600">
                      ⚠️ Cần duyệt tất cả đội trước khi tạo bracket
                    </p>
                  </CardContent>
                )}
              </Card>
            )}

            {/* Quick actions for owner - Other formats (Round Robin) */}
            {isOwner && !isGroupPlayoffFormat && !isSingleElimination && tournament.status === 'registration' && !hasMatches && (
              <Card className="border-primary/50 bg-primary/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Hành động BTC</CardTitle>
                  <CardDescription>
                    Thêm đội hoặc tạo lịch thi đấu
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  <Button variant="outline" onClick={() => setShowCreateTeam(true)}>
                    <Users className="h-4 w-4 mr-2" />
                    Thêm đội
                  </Button>
                  <Button variant="outline" onClick={() => setShowInviteTeamDialog(true)}>
                    <Mail className="h-4 w-4 mr-2" />
                    Mời đội
                  </Button>
                  <Button
                    onClick={() => setShowGenerateDialog(true)}
                    disabled={approvedTeamsCount < 2}
                  >
                    <Play className="h-4 w-4 mr-2" />
                    Tạo lịch thi đấu
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="teams" className="mt-4 space-y-4">
            {/* Registration action for users - Only show if no team yet */}
            {canRegister && (
              <Card className="border-dashed border-2">
                <CardContent className="py-6 flex items-center justify-between">
                  <div>
                    <p className="font-medium">Đăng ký tham gia giải đấu</p>
                    <p className="text-sm text-muted-foreground">
                      Tạo đội mới để tham gia
                    </p>
                  </div>
                  <Button onClick={() => setShowCreateTeam(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Tạo đội
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
            {/* Generate matches action for owner - NOT for single elimination */}
            {isOwner && !hasMatches && tournament.status !== 'completed' && !isSingleElimination && (
              <Card className="border-primary/50 bg-primary/5">
                <CardContent className="py-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium">Tạo lịch thi đấu</p>
                    <p className="text-sm text-muted-foreground">
                      {approvedTeamsCount} đội đã sẵn sàng
                    </p>
                  </div>
                  <Button 
                    onClick={() => setShowGenerateDialog(true)}
                    disabled={approvedTeamsCount < 2}
                  >
                    <Play className="h-4 w-4 mr-2" />
                    Tạo lịch
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Generate bracket action for owner - Single Elimination ONLY */}
            {isOwner && !hasMatches && tournament.status !== 'completed' && isSingleElimination && (
              <Card className="border-primary/50 bg-primary/5">
                <CardContent className="py-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium">Sinh Bracket</p>
                    <p className="text-sm text-muted-foreground">
                      {approvedTeamsCount} đội đã sẵn sàng (Single Elimination)
                    </p>
                  </div>
                  <Button 
                    onClick={() => setShowSESetupDialog(true)}
                    disabled={approvedTeamsCount < 4 || pendingTeamsCount > 0}
                  >
                    <Trophy className="h-4 w-4 mr-2" />
                    Sinh Bracket
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Start tournament action */}
            {isOwner && hasMatches && tournament.status === 'registration' && (
              <Card className="border-green-500/50 bg-green-500/5">
                <CardContent className="py-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-green-600">Bắt đầu giải đấu</p>
                    <p className="text-sm text-muted-foreground">
                      Đã có {matches?.length} trận đấu được tạo
                    </p>
                  </div>
                  <Button 
                    onClick={() => setShowStartTournamentDialog(true)}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Play className="h-4 w-4 mr-2" />
                    Bắt đầu
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Create Playoff action - show when round robin is complete */}
            {isOwner && roundRobinComplete && !hasPlayoff && (
              <Card className="border-yellow-500/50 bg-yellow-500/5">
                <CardContent className="py-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium text-yellow-600">Tạo vòng Playoff</p>
                    <p className="text-sm text-muted-foreground">
                      Vòng tròn đã hoàn thành - {standings.length} đội đủ điều kiện
                    </p>
                  </div>
                  <Button 
                    onClick={() => setShowPlayoffDialog(true)}
                    className="bg-yellow-600 hover:bg-yellow-700"
                  >
                    <Trophy className="h-4 w-4 mr-2" />
                    Tạo Playoff
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Playoff/SE Bracket - Show for playoff matches */}
            {playoffMatches.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-yellow-500" />
                  {isSingleElimination ? 'Bracket Loại Trực Tiếp' : 'Vòng Playoff'}
                </h3>
                <PlayoffBracket 
                  matches={playoffMatches}
                  userTeamId={userTeam?.id}
                  isOwner={isOwner}
                  canEditScores={userRole.canEditScores}
                  onMatchClick={(match) => setSelectedMatch(match)}
                  onLineupClick={(match, teamId) => {
                    setLineupMatch(match);
                    setLineupTeamId(teamId || null);
                  }}
                  onScoreMatch={(match) => setSelectedMatch(match)}
                  isSingleElimination={isSingleElimination}
                />
              </div>
            )}

            {/* Group-based Match List for rr_playoff format */}
            {hasGroups && roundRobinMatches.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Gamepad2 className="h-5 w-5" />
                  Vòng bảng
                </h3>
                <GroupMatchList 
                  tournamentId={tournament.id}
                  userTeamId={userTeam?.id}
                  isOwner={isOwner}
                  canEditScores={userRole.canEditScores}
                  onMatchClick={(match) => setSelectedMatch(match)}
                  onLineupClick={(match, teamId) => {
                    setLineupMatch(match);
                    setLineupTeamId(teamId || null);
                  }}
                  onStartRound={handleStartRound}
                  onScoreMatch={(match) => setSelectedMatch(match)}
                />
              </div>
            )}

            {/* Regular Round Robin Match List (no groups) */}
            {!hasGroups && roundRobinMatches.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Gamepad2 className="h-5 w-5" />
                  Vòng tròn
                </h3>
                <MatchList 
                  tournamentId={tournament.id}
                  userTeamId={userTeam?.id}
                  isOwner={isOwner}
                  canEditScores={userRole.canEditScores}
                  onMatchClick={(match) => setSelectedMatch(match)}
                  onLineupClick={(match, teamId) => {
                    setLineupMatch(match);
                    setLineupTeamId(teamId || null);
                  }}
                  onStartRound={handleStartRound}
                  onScoreMatch={(match) => setSelectedMatch(match)}
                />
              </div>
            )}

            {/* Empty state */}
            {!hasMatches && !isOwner && (
              <Card>
                <CardContent className="py-12 text-center text-muted-foreground">
                  <Gamepad2 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Chưa có trận đấu nào</p>
                  <p className="text-sm mt-1">Lịch thi đấu sẽ được BTC tạo</p>
                </CardContent>
              </Card>
            )}
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
              <AlertDialogTitle>Bắt đầu giải đấu?</AlertDialogTitle>
              <AlertDialogDescription>
                Sau khi bắt đầu, giải đấu sẽ chuyển sang trạng thái "Đang diễn ra" và 
                không thể thêm/xóa đội nữa.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Hủy</AlertDialogCancel>
              <AlertDialogAction onClick={handleStartTournament} disabled={isUpdatingStatus}>
                Bắt đầu
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </MainLayout>
  );
}
