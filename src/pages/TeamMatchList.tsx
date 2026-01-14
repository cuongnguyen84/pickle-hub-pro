import { useNavigate, Link } from 'react-router-dom';
import { MainLayout } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Users, Calendar, Trophy, Trash2, ExternalLink, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useTeamMatch, TeamMatchTournament } from '@/hooks/useTeamMatch';
import { useI18n } from '@/i18n';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { DynamicMeta } from '@/components/seo';
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

function TournamentCard({ 
  tournament, 
  isOwner, 
  onDelete 
}: { 
  tournament: TeamMatchTournament; 
  isOwner: boolean;
  onDelete: () => void;
}) {
  const navigate = useNavigate();

  return (
    <Card className="hover:border-primary/50 transition-colors cursor-pointer group">
      <CardHeader className="pb-2" onClick={() => navigate(`/tools/team-match/${tournament.share_id}`)}>
        <div className="flex items-start justify-between">
          <div className="space-y-1 flex-1">
            <CardTitle className="text-lg group-hover:text-primary transition-colors">
              {tournament.name}
            </CardTitle>
            <CardDescription className="flex items-center gap-2">
              <Calendar className="h-3 w-3" />
              {format(new Date(tournament.created_at), 'dd/MM/yyyy', { locale: vi })}
            </CardDescription>
          </div>
          <Badge variant="outline" className={STATUS_COLORS[tournament.status]}>
            {STATUS_LABELS[tournament.status]}
          </Badge>
        </div>
      </CardHeader>
      <CardContent onClick={() => navigate(`/tools/team-match/${tournament.share_id}`)}>
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Users className="h-4 w-4" />
            <span>{tournament.team_count} đội × {tournament.team_roster_size} người</span>
          </div>
          <div className="flex items-center gap-1">
            <Trophy className="h-4 w-4" />
            <span>
              {tournament.format === 'round_robin' && 'Vòng tròn'}
              {tournament.format === 'single_elimination' && 'Loại trực tiếp'}
              {tournament.format === 'rr_playoff' && 'Vòng tròn + Playoff'}
            </span>
          </div>
        </div>
      </CardContent>
      {isOwner && (
        <div className="px-6 pb-4 flex gap-2" onClick={e => e.stopPropagation()}>
          <Button 
            variant="outline" 
            size="sm" 
            className="flex-1"
            onClick={() => navigate(`/tools/team-match/${tournament.share_id}`)}
          >
            <ExternalLink className="h-4 w-4 mr-1" />
            Xem chi tiết
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Xác nhận xóa?</AlertDialogTitle>
                <AlertDialogDescription>
                  Bạn có chắc muốn xóa "{tournament.name}"? Hành động này không thể hoàn tác.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Hủy</AlertDialogCancel>
                <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground">
                  Xóa
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}
    </Card>
  );
}

export default function TeamMatchList() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useI18n();
  const { myTournaments, publicTournaments, isLoading, deleteTournament } = useTeamMatch();

  return (
    <MainLayout>
      <DynamicMeta 
        title="Pickleball Team Match Format & MLP Style Scoring"
        description="Create and manage pickleball team match competitions with MLP-style format. Features lineup management, dreambreaker games, rally scoring, and complete team tournament organization."
        url="https://thepicklehub.net/tools/team-match"
      />
      <div className="container max-w-4xl py-6 space-y-6">
        {/* SEO Header */}
        <header>
          <div className="flex items-center gap-4 mb-6">
            <Button variant="ghost" size="icon" onClick={() => navigate('/tools')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1">
              <h1 className="text-2xl font-bold">Pickleball Team Match Format</h1>
              <p className="text-muted-foreground">Create and manage MLP-style team competitions</p>
            </div>
            {user && (
              <Button onClick={() => navigate('/tools/team-match/new')}>
                <Plus className="h-4 w-4 mr-2" />
                Tạo mới
              </Button>
            )}
          </div>
        </header>

        {/* SEO Content Section */}
        <section className="p-6 rounded-xl bg-background border border-border">
          <h2 className="text-lg font-semibold mb-3">
            MLP-Style Pickleball Team Competition
          </h2>
          <p className="text-muted-foreground mb-4">
            The pickleball team match format brings professional-style team competition to your club or tournament. 
            Inspired by Major League Pickleball (MLP), this format features teams competing across multiple game types 
            including men's doubles, women's doubles, and mixed doubles. Create exciting team rivalries with our 
            comprehensive team management tools as part of our <Link to="/tournaments" className="text-primary hover:underline">pickleball tournament software</Link>.
          </p>
          
          <h2 className="text-lg font-semibold mb-3">
            Lineup, Dreambreaker & Rally Scoring
          </h2>
          <p className="text-muted-foreground mb-4">
            Our team match system supports full lineup management, allowing captains to strategically assign 
            players to each game. When matches are tied, the dreambreaker format adds thrilling sudden-death 
            gameplay. Rally scoring keeps every point exciting and ensures matches maintain competitive pace 
            throughout the competition.
          </p>

          <h2 className="text-lg font-semibold mb-3">
            Manage Team Matches for Pickleball Tournaments
          </h2>
          <p className="text-muted-foreground">
            Whether organizing a casual inter-club match or a full league season, ThePickleHub's team match 
            format tool handles all the complexity. Track team standings, manage rosters, schedule matches, 
            and calculate results automatically. Combine with our <Link to="/tools/quick-tables" className="text-primary hover:underline">pickleball bracket generator</Link> for 
            complete tournament management and memorable pickleball team experiences.
          </p>
        </section>

        {/* My Tournaments */}
        {user && (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">Giải đấu của tôi</h2>
            {isLoading ? (
              <div className="grid gap-4 sm:grid-cols-2">
                {[1, 2].map(i => (
                  <Card key={i}>
                    <CardHeader>
                      <Skeleton className="h-5 w-3/4" />
                      <Skeleton className="h-4 w-1/2" />
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="h-4 w-full" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : myTournaments.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="py-8 text-center text-muted-foreground">
                  <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Bạn chưa tạo giải đấu đồng đội nào</p>
                  <Button 
                    variant="outline" 
                    className="mt-4"
                    onClick={() => navigate('/tools/team-match/new')}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Tạo giải đấu đầu tiên
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                {myTournaments.map(tournament => (
                  <TournamentCard
                    key={tournament.id}
                    tournament={tournament}
                    isOwner={true}
                    onDelete={() => deleteTournament(tournament.id)}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {/* Public Tournaments */}
        {publicTournaments.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">Giải đấu đang mở</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {publicTournaments
                .filter(t => !myTournaments.some(my => my.id === t.id))
                .map(tournament => (
                  <TournamentCard
                    key={tournament.id}
                    tournament={tournament}
                    isOwner={false}
                    onDelete={() => {}}
                  />
                ))}
            </div>
          </section>
        )}

        {/* Login prompt */}
        {!user && (
          <Card className="border-dashed">
            <CardContent className="py-8 text-center">
              <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground mb-4">
                Đăng nhập để tạo và quản lý giải đấu đồng đội
              </p>
              <Button onClick={() => navigate('/login')}>
                Đăng nhập
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
