import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout";
import { DynamicMeta, HreflangTags, WebApplicationSchema, DoublesEliminationSeoContent, ToolsInternalLinks, FAQSchema } from "@/components/seo";
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
import { getLoginUrl } from "@/lib/auth-config";

import { useLocation } from "react-router-dom";

export default function DoublesEliminationList() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, language, setLanguageFromUrl } = useI18n();
  const location = useLocation();

  // EN route — force English regardless of persisted language state
  useEffect(() => {
    setLanguageFromUrl("en");
  }, [setLanguageFromUrl]);
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
        title="Pickleball Double Elimination Bracket Generator"
        description="Free double elimination bracket generator for pickleball tournaments. Create winners and losers brackets for 32-128+ teams. Automatic court scheduling, best-of-1/3/5 formats, referee assignment."
        url="https://www.thepicklehub.net/tools/doubles-elimination"
      />
      <HreflangTags enPath="/tools/doubles-elimination" />
      <WebApplicationSchema
        name="Doubles Elimination Bracket Generator"
        description="Create doubles elimination brackets for pickleball tournaments. Support for 4-32 teams with best-of-1, best-of-3, or best-of-5 match formats."
        url="https://www.thepicklehub.net/tools/doubles-elimination"
        applicationCategory="SportsApplication"
        featureList={[
          "4-32 teams support",
          "Best-of-1, 3, or 5 formats",
          "Automatic bracket generation",
          "Real-time scoring",
          "Third place match option"
        ]}
      />
      <FAQSchema items={[
        { question: "What is the minimum number of teams for a double elimination bracket?", answer: "Double elimination works best with 8 or more teams, though the tool supports as few as 4. Below 8 teams, the bracket has very few losers bracket rounds, reducing the format's advantage over single elimination. For larger competitive events, 16–64 teams is the ideal range." },
        { question: "Does the tool automatically move teams between winners and losers brackets?", answer: "Yes. All bracket progression is fully automatic. When you enter a match result, the winning team advances in the winners bracket and the losing team drops to the correct position in the losers bracket. No manual bracket management is needed — the system handles all seeding and advancement logic." },
        { question: "Can I use different match formats in different rounds?", answer: "Yes. You can configure best-of-1 for early rounds to save time, then switch to best-of-3 for quarterfinals and semifinals, and best-of-5 for the grand final. Each round can have an independently configured match format, giving you full control over how your event flows." },
        { question: "What happens if the losers bracket winner beats the winners bracket finalist in the grand final?", answer: "In true double elimination, a bracket reset (true final) is required because the winners bracket finalist has no losses yet. Our tool flags this scenario automatically and creates the bracket reset match. The team that wins the reset match is crowned champion with both teams having lost exactly once." },
        { question: "Is double elimination fair for all skill levels?", answer: "Double elimination is one of the fairest competitive formats available because every team is guaranteed at least two matches before elimination. This is especially important for events where teams have traveled significant distances or paid registration fees — a single bad game doesn't end their tournament." },
      ]} />
      
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
          <h1 className="text-2xl font-bold mb-1">Pickleball Double Elimination Bracket Generator</h1>
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
              <Button onClick={() => navigate(getLoginUrl(location.pathname))}>
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
                    {tournament.creator_display_name && (
                      <span className="flex items-center gap-1.5">
                        <Mail className="w-3.5 h-3.5" />
                        {tournament.creator_display_name}
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
        <DoublesEliminationSeoContent />

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

        {/* Internal Links */}
        <ToolsInternalLinks currentTool="doubles-elimination" />
      </div>
    </MainLayout>
  );
}

