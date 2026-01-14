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

function TournamentCard({ 
  tournament, 
  isOwner, 
  onDelete,
  t
}: { 
  tournament: TeamMatchTournament; 
  isOwner: boolean;
  onDelete: () => void;
  t: any;
}) {
  const navigate = useNavigate();

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'setup': return t.teamMatch.statusSetup;
      case 'registration': return t.teamMatch.statusRegistration;
      case 'ongoing': return t.teamMatch.statusOngoing;
      case 'completed': return t.teamMatch.statusCompleted;
      default: return status;
    }
  };

  const getFormatLabel = (format: string) => {
    switch (format) {
      case 'round_robin': return t.teamMatch.formatRoundRobin;
      case 'single_elimination': return t.teamMatch.formatSingleElim;
      case 'rr_playoff': return t.teamMatch.formatRrPlayoff;
      default: return format;
    }
  };

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
            {getStatusLabel(tournament.status)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent onClick={() => navigate(`/tools/team-match/${tournament.share_id}`)}>
        <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Users className="h-4 w-4" />
            <span>{tournament.team_count} {t.teamMatch.teams} × {tournament.team_roster_size} {t.teamMatch.players}</span>
          </div>
          <div className="flex items-center gap-1">
            <Trophy className="h-4 w-4" />
            <span>{getFormatLabel(tournament.format)}</span>
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
            {t.teamMatch.viewDetails}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t.teamMatch.confirmDelete}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t.teamMatch.confirmDeleteDesc.replace('{name}', tournament.name)}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t.teamMatch.cancel}</AlertDialogCancel>
                <AlertDialogAction onClick={onDelete} className="bg-destructive text-destructive-foreground">
                  {t.teamMatch.delete}
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
              <h1 className="text-2xl font-bold">{t.teamMatch.pageTitle}</h1>
              <p className="text-muted-foreground">{t.teamMatch.pageSubtitle}</p>
            </div>
            {user && (
              <Button onClick={() => navigate('/tools/team-match/new')}>
                <Plus className="h-4 w-4 mr-2" />
                {t.teamMatch.createNew}
              </Button>
            )}
          </div>
        </header>

        {/* My Tournaments */}
        {user && (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">{t.teamMatch.myTournaments}</h2>
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
                  <p>{t.teamMatch.noTournaments}</p>
                  <Button 
                    variant="outline" 
                    className="mt-4"
                    onClick={() => navigate('/tools/team-match/new')}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    {t.teamMatch.createFirst}
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
                    t={t}
                  />
                ))}
              </div>
            )}
          </section>
        )}

        {/* Public Tournaments */}
        {publicTournaments.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">{t.teamMatch.publicTournaments}</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {publicTournaments
                .filter(tm => !myTournaments.some(my => my.id === tm.id))
                .map(tournament => (
                  <TournamentCard
                    key={tournament.id}
                    tournament={tournament}
                    isOwner={false}
                    onDelete={() => {}}
                    t={t}
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
                {t.teamMatch.loginPrompt}
              </p>
              <Button onClick={() => navigate('/login')}>
                {t.nav.login}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* SEO Content Section - at bottom */}
        <section className="p-6 rounded-xl bg-background border border-border mt-8">
          <h2 className="text-lg font-semibold mb-3">
            {t.teamMatch.seo.mlpTitle}
          </h2>
          <p className="text-muted-foreground mb-4">
            {t.teamMatch.seo.mlpDesc}{" "}
            <Link to="/tournaments" className="text-primary hover:underline">{t.tournament.title}</Link>
          </p>
          
          <h2 className="text-lg font-semibold mb-3">
            {t.teamMatch.seo.lineupTitle}
          </h2>
          <p className="text-muted-foreground mb-4">
            {t.teamMatch.seo.lineupDesc}
          </p>

          <h2 className="text-lg font-semibold mb-3">
            {t.teamMatch.seo.manageTitle}
          </h2>
          <p className="text-muted-foreground">
            {t.teamMatch.seo.manageDesc}{" "}
            <Link to="/tools/quick-tables" className="text-primary hover:underline">{t.quickTable.seo.pageTitle}</Link>
          </p>
        </section>
      </div>
    </MainLayout>
  );
}
