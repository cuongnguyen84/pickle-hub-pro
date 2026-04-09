import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout";
import { DynamicMeta } from "@/components/seo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  ArrowLeft, Share2, Check, Trophy, Users, 
  Calendar, Trash2, RefreshCw 
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

  // Manual refresh handler
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    await softReload();
    setTimeout(() => setIsRefreshing(false), 600);
  }, [softReload]);

  // Layer 1 & 2: Visibility-change auto-refresh + polling fallback
  useVisibilityRefresh(softReload, { minInterval: 5000, pollingInterval: 20000 });

  const skipNextRealtimeRef = useRef(false);

  const handleMatchUpdated = (matchId: string, updates: Partial<Match>) => {
    skipNextRealtimeRef.current = true;
    setMatches(prevMatches => 
      prevMatches.map(m => m.id === matchId ? { ...m, ...updates } : m)
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
        duration: 8000
      });
    } else {
      toast({
        title: t.doublesElimination.view.r3AssignedTitle,
        description: t.doublesElimination.view.r3NormalDesc
      });
    }
  };

  const setupRealtimeSubscription = () => {
    if (!shareId) return;
    const channel = supabase
      .channel(`doubles_elimination_${shareId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'doubles_elimination_matches' }, () => {
        if (skipNextRealtimeRef.current) return;
        softReload();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  };

  const handleShare = async () => {
    const url = `https://share.thepicklehub.net/doubles-elimination/${shareId}`;
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
          <h2 className="text-xl font-semibold mb-4">{t.doublesElimination.view.notFound}</h2>
          <Button onClick={() => navigate('/tools/doubles-elimination')}>
            {t.doublesElimination.view.backToList}
          </Button>
        </div>
      </MainLayout>
    );
  }

  const dateLocale = language === 'vi' ? viLocale : enUS;

  const statusLabel = tournament.status === 'setup' ? t.doublesElimination.status.setup : 
    tournament.status === 'ongoing' ? t.doublesElimination.status.ongoing : t.doublesElimination.status.completed;

  return (
    <MainLayout>
      <DynamicMeta 
        title={`${tournament.name} - Doubles Elimination`}
        description={`${tournament.name} - ${tournament.team_count} ${t.doublesElimination.teams}`}
        noindex={true}
      />
      
      <div className="container max-w-6xl mx-auto py-6 px-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/tools/doubles-elimination')}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">{tournament.name}</h1>
                <Badge variant={tournament.status === 'ongoing' ? 'default' : 'secondary'}>
                  {statusLabel}
                </Badge>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground mt-1">
                <span className="flex items-center gap-1">
                  <Users className="w-4 h-4" />
                  {tournament.team_count} {t.doublesElimination.teams}
                </span>
                <span className="flex items-center gap-1">
                  <Trophy className="w-4 h-4" />
                  {tournament.early_rounds_format.toUpperCase()} / {tournament.finals_format.toUpperCase()}
                </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {format(new Date(tournament.created_at), 'dd/MM/yyyy', { locale: dateLocale })}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            </Button>
            <Button variant="outline" size="sm" onClick={handleShare}>
              {copied ? <Check className="w-4 h-4 mr-1" /> : <Share2 className="w-4 h-4 mr-1" />}
              {copied ? t.doublesElimination.view.copied : t.doublesElimination.view.share}
            </Button>
            
            {canManage && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </Button>
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
                    <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      {t.common.delete}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList>
            <TabsTrigger value="preliminary">{t.doublesElimination.view.preliminary}</TabsTrigger>
            <TabsTrigger 
              value="playoff"
              className={preliminaryComplete ? "bg-primary/20 text-primary font-semibold animate-pulse" : ""}
            >
              {preliminaryComplete && <Trophy className="w-3.5 h-3.5 mr-1.5" />}
              {t.doublesElimination.view.playoff}
            </TabsTrigger>
            <TabsTrigger value="teams">{t.doublesElimination.view.teams} ({teams.length})</TabsTrigger>
            {canManage && <TabsTrigger value="settings">{t.doublesElimination.view.settings}</TabsTrigger>}
          </TabsList>

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
            <Card>
              <CardHeader>
                <CardTitle>{t.doublesElimination.view.teamList}</CardTitle>
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
                          <Badge variant="secondary">{t.doublesElimination.view.eliminatedRound}{team.eliminated_at_round}</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {canManage && (
            <TabsContent value="settings" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>{t.doublesElimination.view.tournamentSettings}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-sm text-muted-foreground">{t.doublesElimination.earlyRounds}</span>
                      <div className="font-medium">{tournament.early_rounds_format.toUpperCase()}</div>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">{t.doublesElimination.semifinalPlus}</span>
                      <div className="font-medium">{tournament.finals_format.toUpperCase()}</div>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">{t.doublesElimination.view.thirdPlaceMatch}</span>
                      <div className="font-medium">{tournament.has_third_place_match ? t.doublesElimination.view.yes : t.doublesElimination.view.no}</div>
                    </div>
                    <div>
                      <span className="text-sm text-muted-foreground">{t.doublesElimination.view.courts}</span>
                      <div className="font-medium">{tournament.court_count}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <RefereeManagement
                referees={referees.map(r => ({ id: r.id, email: r.email, display_name: r.display_name }))}
                loading={refereesLoading}
                onAddReferee={addRefereeByEmail}
                onRemoveReferee={removeReferee}
              />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </MainLayout>
  );
}