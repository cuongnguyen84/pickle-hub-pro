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
import { ArrowLeft, Users, Trophy, Calendar, Settings, Gamepad2, Copy, Plus, Play, ClipboardList } from 'lucide-react';
import { useTeamMatchTournament, useTeamMatch } from '@/hooks/useTeamMatch';
import { useUserTeam, useTeamMatchTeams, TeamMatchTeam } from '@/hooks/useTeamMatchTeams';
import { useTeamMatchMatches, useTeamMatchMatchManagement, TeamMatchMatch } from '@/hooks/useTeamMatchMatches';
import { useTeamMatchStandings } from '@/hooks/useTeamMatchStandings';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { useState } from 'react';
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
} from '@/components/teamMatch';

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
  rr_playoff: 'Vòng tròn + Playoff',
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
  const { generateMatches, isGenerating, generatePlayoffMatches, isGeneratingPlayoff } = useTeamMatchMatchManagement();
  const { standings, roundRobinComplete, hasPlayoff } = useTeamMatchStandings(tournament?.id);
  
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<TeamMatchTeam | null>(null);
  const [selectedMatch, setSelectedMatch] = useState<TeamMatchMatch | null>(null);
  const [lineupMatch, setLineupMatch] = useState<TeamMatchMatch | null>(null);
  const [showGenerateDialog, setShowGenerateDialog] = useState(false);
  const [showStartTournamentDialog, setShowStartTournamentDialog] = useState(false);
  const [showPlayoffDialog, setShowPlayoffDialog] = useState(false);
  const [startRoundNumber, setStartRoundNumber] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState('overview');

  const isOwner = tournament?.created_by === user?.id;
  const canRegister = (tournament?.status === 'registration' || tournament?.status === 'setup') && !userTeam && user;
  const approvedTeamsCount = teams?.filter(t => t.status === 'approved').length || 0;
  const hasMatches = matches && matches.length > 0;
  const roundRobinMatches = matches?.filter(m => !m.is_playoff) || [];
  const playoffMatches = matches?.filter(m => m.is_playoff) || [];
  
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
      // TODO: Fetch actual game templates from database
      const gameTemplates: { game_type: 'WD' | 'MD' | 'MX' | 'WS' | 'MS'; scoring_type: 'rally21' | 'sideout11'; display_name: string | null; order_index: number }[] = [
        { game_type: 'WD', scoring_type: 'rally21', display_name: 'Đôi Nữ', order_index: 0 },
        { game_type: 'MD', scoring_type: 'rally21', display_name: 'Đôi Nam', order_index: 1 },
        { game_type: 'MX', scoring_type: 'rally21', display_name: 'Đôi Nam Nữ 1', order_index: 2 },
        { game_type: 'MX', scoring_type: 'rally21', display_name: 'Đôi Nam Nữ 2', order_index: 3 },
        { game_type: 'MX', scoring_type: 'rally21', display_name: 'Đôi Nam Nữ 3', order_index: 4 },
      ];
      
      await generateMatches({
        tournamentId: tournament.id,
        teams,
        gameTemplates,
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
      // Get qualifying teams based on standings
      const qualifyingTeams = standings.slice(0, teamCount).map((standing, index) => ({
        teamId: standing.team.id,
        seed: index + 1,
      }));

      // Game templates for playoff
      const gameTemplates: { game_type: 'WD' | 'MD' | 'MX' | 'WS' | 'MS'; scoring_type: 'rally21' | 'sideout11'; display_name: string | null; order_index: number }[] = [
        { game_type: 'WD', scoring_type: 'rally21', display_name: 'Đôi Nữ', order_index: 0 },
        { game_type: 'MD', scoring_type: 'rally21', display_name: 'Đôi Nam', order_index: 1 },
        { game_type: 'MX', scoring_type: 'rally21', display_name: 'Đôi Nam Nữ 1', order_index: 2 },
        { game_type: 'MX', scoring_type: 'rally21', display_name: 'Đôi Nam Nữ 2', order_index: 3 },
        { game_type: 'MX', scoring_type: 'rally21', display_name: 'Đôi Nam Nữ 3', order_index: 4 },
      ];

      await generatePlayoffMatches({
        tournamentId: tournament.id,
        qualifyingTeams,
        gameTemplates,
      });
      
      setShowPlayoffDialog(false);
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
              <Button variant="outline" size="sm">
                <Settings className="h-4 w-4 mr-2" />
                Cài đặt
              </Button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Tổng quan</TabsTrigger>
            <TabsTrigger value="teams">Đội</TabsTrigger>
            <TabsTrigger value="matches">Trận đấu</TabsTrigger>
            <TabsTrigger value="standings">Xếp hạng</TabsTrigger>
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
                onTeamClick={(team) => setSelectedTeam(team)}
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

            {/* Quick actions for owner */}
            {isOwner && tournament.status === 'registration' && !hasMatches && (
              <Card className="border-primary/50 bg-primary/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Hành động BTC</CardTitle>
                  <CardDescription>
                    Thêm đội hoặc tạo lịch thi đấu
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex gap-2">
                  <Button variant="outline" onClick={() => setShowCreateTeam(true)}>
                    <Users className="h-4 w-4 mr-2" />
                    Thêm đội
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
            {/* Generate matches action for owner */}
            {isOwner && !hasMatches && tournament.status !== 'completed' && (
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

            {/* Playoff Bracket - Show above Round Robin */}
            {playoffMatches.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-yellow-500" />
                  Vòng Playoff
                </h3>
                <PlayoffBracket 
                  matches={playoffMatches}
                  userTeamId={userTeam?.id}
                  isOwner={isOwner}
                  onMatchClick={(match) => setSelectedMatch(match)}
                  onLineupClick={(match) => setLineupMatch(match)}
                />
              </div>
            )}

            {/* Round Robin Match List */}
            {roundRobinMatches.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <Gamepad2 className="h-5 w-5" />
                  Vòng tròn
                </h3>
                <MatchList 
                  tournamentId={tournament.id}
                  userTeamId={userTeam?.id}
                  isOwner={isOwner}
                  onMatchClick={(match) => setSelectedMatch(match)}
                  onLineupClick={(match) => setLineupMatch(match)}
                  onStartRound={handleStartRound}
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

          <TabsContent value="standings" className="mt-4">
            <StandingsTable tournamentId={tournament.id} />
          </TabsContent>
        </Tabs>

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
        />

        {/* Match Detail Sheet */}
        <MatchDetailSheet
          open={!!selectedMatch}
          onOpenChange={(open) => !open && setSelectedMatch(null)}
          match={selectedMatch}
          isOwner={isOwner}
          tournamentId={tournament.id}
        />

        {/* Lineup Selection Sheet */}
        {userTeam && (
          <LineupSelectionSheet
            open={!!lineupMatch}
            onOpenChange={(open) => !open && setLineupMatch(null)}
            match={lineupMatch}
            teamId={userTeam.id}
            tournamentId={tournament.id}
            hasDreambreaker={tournament.has_dreambreaker}
          />
        )}

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
          isCreating={isGeneratingPlayoff}
          onConfirm={handleCreatePlayoff}
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
