import { useMyRefereeTournaments } from '@/hooks/useMyRefereeTournaments';
import { useAuth } from '@/hooks/useAuth';
import { useI18n } from '@/i18n';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'react-router-dom';
import { Shield, Calendar, Users, GitBranch, UsersRound, Mail } from 'lucide-react';
import { format } from 'date-fns';

export function MyRefereeTournaments() {
  const { user } = useAuth();
  const { t } = useI18n();
  const { tournaments, loading } = useMyRefereeTournaments();

  if (!user) return null;

  // Split by ongoing vs completed
  const ongoingTournaments = tournaments.filter(t => 
    t.status !== 'completed' && t.status !== 'finished'
  );
  const completedTournaments = tournaments.filter(t => 
    t.status === 'completed' || t.status === 'finished'
  );

  if (loading) {
    return (
      <Card className="border-primary/30">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            <CardTitle className="text-lg">{t.quickTable.refereeTournaments}</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (tournaments.length === 0) return null;

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'group_stage': return t.quickTable.status.groupStage;
      case 'playing': 
      case 'ongoing': return t.quickTable.ongoing;
      case 'playoff': return t.quickTable.status.playoff;
      case 'completed':
      case 'finished': return t.quickTable.status.completed;
      case 'draft':
      case 'setup': return t.quickTable.status.setup;
      default: return status;
    }
  };

  const TournamentItem = ({ tournament }: { tournament: typeof tournaments[0] }) => {
    const href = tournament.type === 'quick_table' 
      ? `/tools/quick-table/${tournament.share_id}`
      : tournament.type === 'doubles_elimination'
      ? `/tools/doubles-elimination/${tournament.share_id}`
      : `/tools/team-match/${tournament.share_id}`;

    const statusColor = 
      tournament.status === 'group_stage' || tournament.status === 'playing' ? 'bg-green-500/20 text-green-400' :
      tournament.status === 'playoff' ? 'bg-yellow-500/20 text-yellow-400' :
      tournament.status === 'draft' ? 'bg-muted text-muted-foreground' :
      'bg-muted text-muted-foreground';

    return (
      <Link to={href} className="block">
        <div className="p-4 rounded-lg border hover:border-primary/50 transition-colors bg-card">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h4 className="font-medium truncate">{tournament.name}</h4>
              
              {/* Row 1: Date, count, format */}
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground mt-1">
                {tournament.created_at && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    <span>{format(new Date(tournament.created_at), 'dd/MM/yyyy')}</span>
                  </span>
                )}
                <span className="hidden sm:inline">•</span>
                <span>
                  {tournament.player_count || tournament.team_count} {tournament.type === 'quick_table' ? t.quickTable.players : t.teamMatch.teams}
                </span>
                {tournament.format && (
                  <>
                    <span className="hidden sm:inline">•</span>
                    <span className="capitalize">{tournament.format.replace('_', ' ')}</span>
                  </>
                )}
              </div>
              
              {/* Row 2: Creator email */}
              {(tournament.creator_display_name || tournament.creator_email) && (
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1">
                  <Mail className="w-3 h-3" />
                  <span>{tournament.creator_display_name || tournament.creator_email?.split('@')[0]}</span>
                </div>
              )}
            </div>
            <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1 sm:gap-2 shrink-0">
              <Badge variant="outline" className="text-xs whitespace-nowrap">
                {tournament.type === 'quick_table' ? (
                  <Users className="w-3 h-3 mr-1" />
                ) : tournament.type === 'team_match' ? (
                  <UsersRound className="w-3 h-3 mr-1" />
                ) : (
                  <GitBranch className="w-3 h-3 mr-1" />
                )}
                {t.quickTable.referee}
              </Badge>
              <Badge className={`${statusColor} text-xs whitespace-nowrap`}>
                {getStatusLabel(tournament.status)}
              </Badge>
            </div>
          </div>
        </div>
      </Link>
    );
  };

  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" />
          <CardTitle className="text-lg">{t.quickTable.refereeTournaments}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="ongoing">
          <TabsList className="mb-4">
            <TabsTrigger value="ongoing">
              {t.quickTable.ongoing} ({ongoingTournaments.length})
            </TabsTrigger>
            <TabsTrigger value="completed">
              {t.quickTable.completed} ({completedTournaments.length})
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="ongoing" className="space-y-3 mt-0">
            {ongoingTournaments.length === 0 ? (
              <p className="text-muted-foreground text-sm py-4 text-center">
                {t.quickTable.noOngoing}
              </p>
            ) : (
              ongoingTournaments.map(t => (
                <TournamentItem key={t.id} tournament={t} />
              ))
            )}
          </TabsContent>
          
          <TabsContent value="completed" className="space-y-3 mt-0">
            {completedTournaments.length === 0 ? (
              <p className="text-muted-foreground text-sm py-4 text-center">
                {t.quickTable.noCompleted}
              </p>
            ) : (
              completedTournaments.map(t => (
                <TournamentItem key={t.id} tournament={t} />
              ))
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}