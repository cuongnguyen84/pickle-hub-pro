import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout";
import { DynamicMeta } from "@/components/seo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { useDoublesElimination, Tournament, Team, Match } from "@/hooks/useDoublesElimination";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  ArrowLeft, Share2, Copy, Check, Trophy, Users, 
  Calendar, Clock, Settings, Trash2 
} from "lucide-react";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
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

export default function DoublesEliminationView() {
  const { shareId } = useParams<{ shareId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { getTournamentByShareId, deleteTournament } = useDoublesElimination();
  const { toast } = useToast();

  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const isCreator = user?.id === tournament?.creator_user_id;

  useEffect(() => {
    if (shareId) {
      loadData();
      setupRealtimeSubscription();
    }
  }, [shareId]);

  const loadData = async () => {
    if (!shareId) return;
    setLoading(true);
    const data = await getTournamentByShareId(shareId);
    setTournament(data.tournament);
    setTeams(data.teams);
    setMatches(data.matches);
    setLoading(false);
  };

  const setupRealtimeSubscription = () => {
    if (!shareId) return;

    const channel = supabase
      .channel(`doubles_elimination_${shareId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'doubles_elimination_matches'
        },
        () => {
          loadData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  };

  const handleShare = async () => {
    const url = `${window.location.origin}/tools/doubles-elimination/${shareId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast({ title: "Đã sao chép link!" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Không thể sao chép", variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!tournament) return;
    const result = await deleteTournament(tournament.id);
    if (result.success) {
      toast({ title: "Đã xóa giải đấu" });
      navigate('/tools/doubles-elimination');
    } else {
      toast({ title: "Lỗi xóa giải đấu", variant: "destructive" });
    }
  };

  const getRoundTypeLabel = (roundType: string) => {
    switch (roundType) {
      case 'winner_r1': return 'Vòng 1 (Winner)';
      case 'loser_r2': return 'Vòng 2 (Loser)';
      case 'merge_r3': return 'Vòng 3 (Merge)';
      case 'elimination': return 'Vòng loại trực tiếp';
      case 'quarterfinal': return 'Tứ kết';
      case 'semifinal': return 'Bán kết';
      case 'third_place': return 'Tranh hạng 3';
      case 'final': return 'Chung kết';
      default: return roundType;
    }
  };

  const getTeamName = (teamId: string | null) => {
    if (!teamId) return 'TBD';
    const team = teams.find(t => t.id === teamId);
    return team?.team_name || 'TBD';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending': return <Badge variant="outline">Chờ</Badge>;
      case 'live': return <Badge variant="default" className="bg-red-500">Đang đấu</Badge>;
      case 'completed': return <Badge variant="secondary">Xong</Badge>;
      default: return null;
    }
  };

  // Group matches by round
  const matchesByRound = matches.reduce((acc, match) => {
    const key = `${match.round_number}_${match.round_type}`;
    if (!acc[key]) {
      acc[key] = {
        round_number: match.round_number,
        round_type: match.round_type,
        matches: []
      };
    }
    acc[key].matches.push(match);
    return acc;
  }, {} as Record<string, { round_number: number; round_type: string; matches: Match[] }>);

  const sortedRounds = Object.values(matchesByRound).sort((a, b) => {
    if (a.round_number !== b.round_number) return a.round_number - b.round_number;
    // Sort third_place after semifinal, before final
    const typeOrder = ['winner_r1', 'loser_r2', 'merge_r3', 'elimination', 'quarterfinal', 'semifinal', 'third_place', 'final'];
    return typeOrder.indexOf(a.round_type) - typeOrder.indexOf(b.round_type);
  });

  if (loading) {
    return (
      <MainLayout>
        <div className="container max-w-6xl mx-auto py-6 px-4">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-muted rounded w-1/3" />
            <div className="h-64 bg-muted rounded" />
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!tournament) {
    return (
      <MainLayout>
        <div className="container max-w-2xl mx-auto py-12 text-center">
          <h2 className="text-xl font-semibold mb-4">Không tìm thấy giải đấu</h2>
          <Button onClick={() => navigate('/tools/doubles-elimination')}>
            Quay lại danh sách
          </Button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <DynamicMeta 
        title={`${tournament.name} - Doubles Elimination`}
        description={`Giải đấu ${tournament.name} với ${tournament.team_count} đội`}
      />
      
      <div className="container max-w-6xl mx-auto py-6 px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => navigate('/tools/doubles-elimination')}
            >
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">{tournament.name}</h1>
                <Badge variant={tournament.status === 'ongoing' ? 'default' : 'secondary'}>
                  {tournament.status === 'setup' ? 'Cài đặt' : 
                   tournament.status === 'ongoing' ? 'Đang diễn ra' : 'Hoàn thành'}
                </Badge>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                <span className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  {tournament.team_count} đội
                </span>
                <span className="flex items-center gap-1">
                  <Trophy className="w-4 h-4" />
                  {tournament.early_rounds_format.toUpperCase()} / {tournament.finals_format.toUpperCase()}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {format(new Date(tournament.created_at), 'dd/MM/yyyy', { locale: vi })}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleShare}>
              {copied ? <Check className="w-4 h-4 mr-1" /> : <Share2 className="w-4 h-4 mr-1" />}
              {copied ? 'Đã sao chép' : 'Chia sẻ'}
            </Button>
            
            {isCreator && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Xóa giải đấu?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Hành động này không thể hoàn tác. Tất cả dữ liệu sẽ bị xóa vĩnh viễn.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Hủy</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDelete} className="bg-destructive">
                      Xóa
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="bracket" className="space-y-4">
          <TabsList>
            <TabsTrigger value="bracket">Bracket</TabsTrigger>
            <TabsTrigger value="teams">Đội ({teams.length})</TabsTrigger>
            {isCreator && <TabsTrigger value="settings">Cài đặt</TabsTrigger>}
          </TabsList>

          {/* Bracket Tab */}
          <TabsContent value="bracket" className="space-y-6">
            {sortedRounds.map((round) => (
              <Card key={`${round.round_number}_${round.round_type}`}>
                <CardHeader className="py-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    {getRoundTypeLabel(round.round_type)}
                    <Badge variant="outline" className="font-normal">
                      {round.matches.length} trận
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {round.matches.map((match) => (
                      <div 
                        key={match.id}
                        className={`p-3 rounded-lg border cursor-pointer hover:border-primary/50 transition-colors
                          ${match.status === 'live' ? 'border-red-500 bg-red-500/5' : ''}`}
                        onClick={() => navigate(`/tools/doubles-elimination/match/${match.id}/score`)}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs text-muted-foreground">
                            Trận {match.match_number}
                          </span>
                          {getStatusBadge(match.status)}
                        </div>
                        
                        <div className="space-y-2">
                          <div className={`flex items-center justify-between p-2 rounded
                            ${match.winner_id === match.team_a_id ? 'bg-primary/10 font-medium' : 'bg-muted/50'}`}>
                            <span className="truncate">{getTeamName(match.team_a_id)}</span>
                            <span className="font-mono">
                              {match.best_of > 1 ? match.games_won_a : match.score_a}
                            </span>
                          </div>
                          <div className={`flex items-center justify-between p-2 rounded
                            ${match.winner_id === match.team_b_id ? 'bg-primary/10 font-medium' : 'bg-muted/50'}`}>
                            <span className="truncate">{getTeamName(match.team_b_id)}</span>
                            <span className="font-mono">
                              {match.best_of > 1 ? match.games_won_b : match.score_b}
                            </span>
                          </div>
                        </div>

                        {match.best_of > 1 && match.games && Array.isArray(match.games) && match.games.length > 0 && (
                          <div className="mt-2 text-xs text-muted-foreground text-center">
                            {(match.games as any[]).map((g: any, i: number) => (
                              <span key={i}>
                                {i > 0 && ', '}
                                {g.score_a}-{g.score_b}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>

          {/* Teams Tab */}
          <TabsContent value="teams">
            <Card>
              <CardHeader>
                <CardTitle>Danh sách đội</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {teams.map((team) => (
                    <div 
                      key={team.id}
                      className={`flex items-center justify-between p-3 rounded-lg border
                        ${team.status === 'eliminated' ? 'opacity-50' : ''}`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                          #{team.seed}
                        </span>
                        <div>
                          <div className="font-medium">{team.team_name}</div>
                          <div className="text-sm text-muted-foreground">
                            {team.player1_name}
                            {team.player2_name && ` / ${team.player2_name}`}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right text-sm">
                          <div>+{team.total_points_for} / -{team.total_points_against}</div>
                          <div className={`font-medium ${team.point_diff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {team.point_diff >= 0 ? '+' : ''}{team.point_diff}
                          </div>
                        </div>
                        {team.status === 'eliminated' && (
                          <Badge variant="secondary">Loại R{team.eliminated_at_round}</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          {isCreator && (
            <TabsContent value="settings">
              <Card>
                <CardHeader>
                  <CardTitle>Cài đặt giải đấu</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm text-muted-foreground">Vòng ngoài</span>
                      <div className="font-medium">{tournament.early_rounds_format.toUpperCase()}</div>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">Bán kết+</span>
                      <div className="font-medium">{tournament.finals_format.toUpperCase()}</div>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">Tranh hạng 3</span>
                      <div className="font-medium">{tournament.has_third_place_match ? 'Có' : 'Không'}</div>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">Số sân</span>
                      <div className="font-medium">{tournament.court_count}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </div>
    </MainLayout>
  );
}
