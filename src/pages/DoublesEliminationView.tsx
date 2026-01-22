import { useState, useEffect, useRef } from "react";
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
  ArrowLeft, Share2, Check, Trophy, Users, 
  Calendar, Trash2 
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
import DoublesEliminationBracket from "@/components/tournament/DoublesEliminationBracket";

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
  const [canEdit, setCanEdit] = useState(false);

  const isCreator = user?.id === tournament?.creator_user_id;

  useEffect(() => {
    if (shareId) {
      loadData();
      setupRealtimeSubscription();
    }
  }, [shareId]);

  // Check edit permissions when user and tournament change
  useEffect(() => {
    const checkPermissions = async () => {
      if (!user || !tournament) {
        setCanEdit(false);
        return;
      }

      const isCreator = user.id === tournament.creator_user_id;
      if (isCreator) {
        setCanEdit(true);
        return;
      }

      // Check if user is a referee
      const { data: refereeData } = await supabase
        .from('doubles_elimination_referees')
        .select('id')
        .eq('tournament_id', tournament.id)
        .eq('user_id', user.id)
        .single();

      setCanEdit(!!refereeData);
    };

    checkPermissions();
  }, [user, tournament]);

  const loadData = async () => {
    if (!shareId) return;
    setLoading(true);
    const data = await getTournamentByShareId(shareId);
    setTournament(data.tournament);
    setTeams(data.teams);
    setMatches(data.matches);
    setLoading(false);
  };

  // Track if we just made an optimistic update to skip realtime reload
  const skipNextRealtimeRef = useRef(false);

  // Optimistic update handler - updates local state without reload
  const handleMatchUpdated = (matchId: string, updates: Partial<Match>) => {
    // Set flag to skip next realtime event (caused by our own update)
    skipNextRealtimeRef.current = true;
    
    setMatches(prevMatches => 
      prevMatches.map(m => 
        m.id === matchId ? { ...m, ...updates } : m
      )
    );

    // Reset flag after a short delay
    setTimeout(() => {
      skipNextRealtimeRef.current = false;
    }, 2000);
  };

  // Handler for R3 assignment notifications
  const handleR3Assigned = (tiedTeamsInfo?: { count: number; names: string[] }) => {
    if (tiedTeamsInfo) {
      toast({
        title: "Đã phân vòng 3",
        description: `Có ${tiedTeamsInfo.count} VĐV trùng hiệu số (${tiedTeamsInfo.names.join(', ')}). Chương trình đã ghép ngẫu nhiên 2 VĐV thi đấu trận sơ loại.`,
        duration: 8000
      });
    } else {
      toast({
        title: "Đã phân vòng 3 & vòng 4",
        description: "Các VĐV đã được phân vào vòng tiếp theo dựa trên hiệu số."
      });
    }
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
          // Skip reload if we just made an optimistic update
          if (skipNextRealtimeRef.current) {
            return;
          }
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

  // Removed handleMatchClick - card click behavior removed, only buttons work

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
        <Tabs defaultValue="preliminary" className="space-y-4">
          <TabsList>
            <TabsTrigger value="preliminary">Sơ loại</TabsTrigger>
            <TabsTrigger value="playoff">Playoff</TabsTrigger>
            <TabsTrigger value="teams">Đội ({teams.length})</TabsTrigger>
            {isCreator && <TabsTrigger value="settings">Cài đặt</TabsTrigger>}
          </TabsList>

          {/* Preliminary Tab - Round 1, 2, 3 */}
          <TabsContent value="preliminary" className="space-y-6">
            <DoublesEliminationBracket 
              matches={matches}
              teams={teams}
              tournamentId={tournament?.id}
              showPreliminaryOnly={true}
              canEdit={canEdit}
              onScoreUpdated={loadData}
              onMatchUpdated={handleMatchUpdated}
              onR3Assigned={handleR3Assigned}
            />
          </TabsContent>

          {/* Playoff Tab - Round 4+ */}
          <TabsContent value="playoff" className="space-y-6">
            <DoublesEliminationBracket 
              matches={matches}
              teams={teams}
              tournamentId={tournament?.id}
              showPlayoffOnly={true}
              canEdit={canEdit}
              onScoreUpdated={loadData}
              onMatchUpdated={handleMatchUpdated}
              onR3Assigned={handleR3Assigned}
            />
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
