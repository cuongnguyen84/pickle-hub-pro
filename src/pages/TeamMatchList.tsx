import { useNavigate, Link } from 'react-router-dom';
import { MainLayout } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Users, Calendar, Trophy, Trash2, ExternalLink, ArrowLeft, Mail } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useTeamMatch, TeamMatchTournament } from '@/hooks/useTeamMatch';
import { useI18n } from '@/i18n';
import { getLoginUrl } from '@/lib/auth-config';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { DynamicMeta, HreflangTags, WebApplicationSchema, TeamMatchSeoContent, ToolsInternalLinks, FAQSchema } from '@/components/seo';
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
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Users className="h-4 w-4" />
            <span>{tournament.team_count} {t.teamMatch.teams} × {tournament.team_roster_size} {t.teamMatch.players}</span>
          </div>
          <div className="flex items-center gap-1">
            <Trophy className="h-4 w-4" />
            <span>{getFormatLabel(tournament.format)}</span>
          </div>
          {tournament.creator_display_name && !isOwner && (
            <div className="flex items-center gap-1 w-full">
              <Mail className="h-4 w-4 shrink-0" />
              <span className="truncate">{tournament.creator_display_name}</span>
            </div>
          )}
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

import { useLocation } from 'react-router-dom';

export default function TeamMatchList() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useI18n();
  const location = useLocation();
  const { myTournaments, publicTournaments, isLoading, deleteTournament } = useTeamMatch();

  return (
    <MainLayout>
      <DynamicMeta
        title="Pickleball Team Match Tool – MLP Style Tournament Format"
        description="Create MLP-style pickleball team competitions. Features lineup management, dreambreaker games, rally scoring, and team standings. Free tool for clubs, leagues, and tournament organizers."
        url="https://www.thepicklehub.net/tools/team-match"
      />
      <HreflangTags enPath="/tools/team-match" />
      <WebApplicationSchema
        name="Team Match - MLP Style Pickleball Tournament"
        description="Create team match competitions with MLP-style format. Features lineup management, dreambreaker games, rally scoring, and team tournament organization."
        url="https://www.thepicklehub.net/tools/team-match"
        applicationCategory="SportsApplication"
        featureList={[
          "MLP-style team format",
          "Lineup management",
          "Dreambreaker games",
          "Rally scoring support",
          "Team roster management",
          "Round robin and playoff formats"
        ]}
      />
      <FAQSchema items={[
        { question: "What is the dreambreaker in a pickleball team match?", answer: "The dreambreaker is a tiebreaker format used when a team match is tied after all doubles and mixed doubles games. Each team selects one player for a sudden-death singles rally-scoring match. The first player to reach 21 points (win by 2) wins the match for their team. It's the MLP's signature finish to close matches." },
        { question: "How many teams can compete in a Team Match tournament?", answer: "The Team Match tool supports 2 to 16 teams per event. You can run a simple head-to-head match between two clubs or a full league season with up to 16 teams across round robin and playoff stages." },
        { question: "Does Team Match support both round robin and playoff formats?", answer: "Yes. You can run a round robin league where every team plays each other, a single elimination playoff for rapid-fire competition, or a combined format with a round robin group stage that feeds into an elimination playoff. The system handles scheduling and standings automatically for all three options." },
        { question: "Can team captains manage their own lineups?", answer: "Yes. Captains can be assigned to their teams and given access to submit lineups before each match. This gives your competition strategic depth — captains decide which players compete in men's doubles, women's doubles, mixed doubles, and the dreambreaker based on the opposing team's lineup." },
        { question: "What scoring system does the Team Match tool use?", answer: "Rally scoring is the default (every rally scores a point, regardless of who served), matching the MLP format. Traditional side-out scoring is also supported if your league prefers it. Game scores, team match scores, and standings are all tracked and displayed automatically." },
      ]} />
      <div className="container max-w-4xl py-6 space-y-6">
        {/* SEO Header */}
        <header className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <Button variant="ghost" size="icon" onClick={() => navigate('/tools')} className="shrink-0">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-bold">{t.teamMatch.pageTitle}</h1>
          </div>
          <div className="flex items-center justify-between gap-4 pl-10">
            <p className="text-sm text-muted-foreground">{t.teamMatch.pageSubtitle}</p>
            {user && (
              <Button onClick={() => navigate('/tools/team-match/new')} className="shrink-0">
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

        {/* Login prompt */}
        {!user && (
          <Card className="border-dashed">
            <CardContent className="py-8 text-center">
              <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-muted-foreground mb-4">
                {t.teamMatch.loginPrompt}
              </p>
              <Button onClick={() => navigate(getLoginUrl(location.pathname))}>
                {t.nav.login}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Internal Links */}
        <ToolsInternalLinks currentTool="team-match" />

        {/* SEO Content Section */}
        <TeamMatchSeoContent />
      </div>
    </MainLayout>
  );
}
