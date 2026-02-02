import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout";
import { DynamicMeta, ToolsInternalLinks } from "@/components/seo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useDoublesElimination, Tournament } from "@/hooks/useDoublesElimination";
import { useI18n } from "@/i18n";
import { Plus, Trophy, Calendar, Users, ChevronRight, Mail, ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { vi, enUS } from "date-fns/locale";
import { Link } from "react-router-dom";

export default function DoublesEliminationList() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, language } = useI18n();
  const { getUserTournaments } = useDoublesElimination();
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);

  const dateLocale = language === 'vi' ? vi : enUS;

  useEffect(() => {
    if (user) {
      loadTournaments();
    } else {
      setLoading(false);
    }
  }, [user]);

  const loadTournaments = async () => {
    setLoading(true);
    const data = await getUserTournaments();
    setTournaments(data);
    setLoading(false);
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'setup': return t.doublesElimination.status.setup;
      case 'ongoing': return t.doublesElimination.status.ongoing;
      case 'completed': return t.doublesElimination.status.completed;
      default: return status;
    }
  };

  const getStatusVariant = (status: string): "default" | "secondary" | "outline" => {
    switch (status) {
      case 'ongoing': return 'default';
      case 'completed': return 'secondary';
      default: return 'outline';
    }
  };

  const getFormatLabel = (format: string) => {
    switch (format) {
      case 'bo1': return t.doublesElimination.format.bo1;
      case 'bo3': return t.doublesElimination.format.bo3;
      case 'bo5': return t.doublesElimination.format.bo5;
      default: return format;
    }
  };

  return (
    <MainLayout>
      <DynamicMeta 
        title={`${t.doublesElimination.title} - ${t.common.appName}`}
        description={t.doublesElimination.description}
        url="https://thepicklehub.net/tools/doubles-elimination"
        enableHreflang={true}
      />
      
      <div className="container max-w-4xl mx-auto py-6 px-4">
        {/* Back to Tools */}
        <Link
          to="/tools"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          {language === "vi" ? "Tất cả công cụ" : "All tools"}
        </Link>

        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-1">{t.doublesElimination.title}</h1>
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              {t.doublesElimination.description}
            </p>
            {user && (
              <Button onClick={() => navigate('/tools/doubles-elimination/new')} className="shrink-0">
                <Plus className="w-4 h-4 mr-2" />
                {t.doublesElimination.createNew}
              </Button>
            )}
          </div>
        </div>

        {!user ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Trophy className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">{t.doublesElimination.loginRequired}</h3>
              <p className="text-muted-foreground mb-4">
                {t.doublesElimination.loginRequiredDesc}
              </p>
              <Button onClick={() => navigate('/login')}>
                {t.nav.login}
              </Button>
            </CardContent>
          </Card>
        ) : loading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="py-6">
                  <div className="h-6 bg-muted rounded w-1/3 mb-2" />
                  <div className="h-4 bg-muted rounded w-1/4" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : tournaments.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Trophy className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">{t.doublesElimination.noTournaments}</h3>
              <p className="text-muted-foreground mb-4">
                {t.doublesElimination.noTournamentsDesc}
              </p>
              <Button onClick={() => navigate('/tools/doubles-elimination/new')}>
                <Plus className="w-4 h-4 mr-2" />
                {t.doublesElimination.createNew}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {tournaments.map((tournament) => (
              <Card 
                key={tournament.id} 
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => navigate(`/tools/doubles-elimination/${tournament.share_id}`)}
              >
                <CardContent className="p-4">
                  {/* Header: Name + Status */}
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <h3 className="font-semibold leading-tight flex-1 min-w-0 truncate">
                      {tournament.name}
                    </h3>
                    <Badge 
                      variant={getStatusVariant(tournament.status)}
                      className="shrink-0 whitespace-nowrap"
                    >
                      {getStatusLabel(tournament.status)}
                    </Badge>
                  </div>
                  
                  {/* Info Row 1 - Stats */}
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Users className="w-3.5 h-3.5" />
                      <span className="font-medium">{tournament.team_count}</span>
                    </span>
                    <span className="text-muted-foreground/50">•</span>
                    <span>
                      {getFormatLabel(tournament.early_rounds_format)}
                      {tournament.finals_format !== tournament.early_rounds_format && (
                        <span className="text-muted-foreground/70">
                          {' → '}{getFormatLabel(tournament.finals_format)}
                        </span>
                      )}
                    </span>
                    <span className="text-muted-foreground/50">•</span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      {format(new Date(tournament.created_at), 'dd/MM/yyyy', { locale: dateLocale })}
                    </span>
                  </div>
                  
                  {/* Info Row 2 - Creator */}
                  <div className="flex items-center justify-between text-sm text-muted-foreground mt-1">
                    {(tournament.creator_display_name || tournament.creator_email) && (
                      <span className="flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5" />
                        {tournament.creator_display_name || tournament.creator_email?.split('@')[0]}
                      </span>
                    )}
                    <ChevronRight className="w-4 h-4 ml-auto text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* SEO Content Section */}
        <section className="mt-12 border-t border-border pt-10">
          <h2 className="text-xl font-bold mb-4">{t.seo.doublesElimination.title}</h2>
          <p className="text-muted-foreground mb-6 max-w-2xl">
            {t.seo.doublesElimination.description}
          </p>

          <h3 className="text-lg font-semibold mb-3">{t.seo.doublesElimination.whenToUseTitle}</h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-2xl">
            {t.seo.doublesElimination.whenToUseDesc}
          </p>

          <h3 className="text-lg font-semibold mb-3">{t.seo.doublesElimination.sizeTitle}</h3>
          <p className="text-sm text-muted-foreground max-w-2xl">
            {t.seo.doublesElimination.sizeDesc}
          </p>

          {/* Internal Links to Other Tools */}
          <ToolsInternalLinks currentTool="doubles-elimination" />
        </section>

        {/* Info Section */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="text-lg">{t.doublesElimination.about.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              <strong>{t.doublesElimination.title}</strong> {t.doublesElimination.about.description}
            </p>
            <ul className="list-disc list-inside space-y-1">
              <li><strong>Round 1:</strong> {t.doublesElimination.about.round1}</li>
              <li><strong>Round 2:</strong> {t.doublesElimination.about.round2}</li>
              <li><strong>Round 3:</strong> {t.doublesElimination.about.round3}</li>
              <li><strong>Round 4+:</strong> {t.doublesElimination.about.round4Plus}</li>
            </ul>
            <p>
              {t.doublesElimination.about.minTeams}{" "}
              {t.doublesElimination.about.suggestion}
            </p>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}

