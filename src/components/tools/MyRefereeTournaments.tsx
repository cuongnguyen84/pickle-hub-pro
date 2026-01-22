import { useMyRefereeTournaments } from '@/hooks/useMyRefereeTournaments';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Skeleton } from '@/components/ui/skeleton';
import { Link } from 'react-router-dom';
import { Shield, Calendar, Users, GitBranch } from 'lucide-react';
import { format } from 'date-fns';

export function MyRefereeTournaments() {
  const { user } = useAuth();
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
            <CardTitle className="text-lg">Giải đấu làm trọng tài</CardTitle>
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

  const TournamentItem = ({ tournament }: { tournament: typeof tournaments[0] }) => {
    const href = tournament.type === 'quick_table' 
      ? `/tools/quick-table/${tournament.share_id}`
      : `/tools/doubles-elimination/${tournament.share_id}`;

    const statusColor = 
      tournament.status === 'group_stage' || tournament.status === 'playing' ? 'bg-green-500/20 text-green-400' :
      tournament.status === 'playoff' ? 'bg-yellow-500/20 text-yellow-400' :
      tournament.status === 'draft' ? 'bg-muted text-muted-foreground' :
      'bg-muted text-muted-foreground';

    const statusLabel = 
      tournament.status === 'group_stage' ? 'Vòng bảng' :
      tournament.status === 'playing' ? 'Đang diễn ra' :
      tournament.status === 'playoff' ? 'Vòng loại trực tiếp' :
      tournament.status === 'completed' || tournament.status === 'finished' ? 'Hoàn thành' :
      tournament.status === 'draft' ? 'Chuẩn bị' :
      tournament.status;

    return (
      <Link to={href} className="block">
        <div className="p-4 rounded-lg border hover:border-primary/50 transition-colors bg-card">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h4 className="font-medium truncate">{tournament.name}</h4>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                {tournament.created_at && (
                  <>
                    <Calendar className="w-3 h-3" />
                    <span>{format(new Date(tournament.created_at), 'dd/MM/yyyy')}</span>
                    <span>•</span>
                  </>
                )}
                <span>
                  {tournament.player_count || tournament.team_count} {tournament.type === 'quick_table' ? 'players' : 'teams'}
                </span>
                {tournament.format && (
                  <>
                    <span>•</span>
                    <span className="capitalize">{tournament.format.replace('_', ' ')}</span>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="shrink-0">
                {tournament.type === 'quick_table' ? (
                  <Users className="w-3 h-3 mr-1" />
                ) : (
                  <GitBranch className="w-3 h-3 mr-1" />
                )}
                Referee
              </Badge>
              <Badge className={statusColor}>
                {statusLabel}
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
          <CardTitle className="text-lg">Giải đấu làm trọng tài</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="ongoing">
          <TabsList className="mb-4">
            <TabsTrigger value="ongoing">
              Đang diễn ra ({ongoingTournaments.length})
            </TabsTrigger>
            <TabsTrigger value="completed">
              Đã hoàn thành ({completedTournaments.length})
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="ongoing" className="space-y-3 mt-0">
            {ongoingTournaments.length === 0 ? (
              <p className="text-muted-foreground text-sm py-4 text-center">
                Không có giải đấu đang diễn ra
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
                Không có giải đấu đã hoàn thành
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
