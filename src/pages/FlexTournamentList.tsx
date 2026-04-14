import { useI18n } from "@/i18n";
import { MainLayout } from "@/components/layout";
import { DynamicMeta, HreflangTags, WebApplicationSchema, FlexTournamentSeoContent, ToolsInternalLinks, FAQSchema } from "@/components/seo";
import { useFlexTournament } from "@/hooks/useFlexTournament";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Eye, Trash2, Globe, Lock, Loader2, ArrowLeft } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useLocation } from "react-router-dom";
import { format } from "date-fns";
import { useState, useEffect } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { getLoginUrl } from "@/lib/auth-config";

const FlexTournamentList = () => {
  const { t, language, setLanguageFromUrl } = useI18n();
  const { user } = useAuth();
  const location = useLocation();

  // EN route — force English regardless of persisted language state
  useEffect(() => {
    setLanguageFromUrl("en");
  }, [setLanguageFromUrl]);
  const { myTournaments, isLoadingTournaments, publicTournaments, isLoadingPublic, deleteTournament, isDeleting } = useFlexTournament();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await deleteTournament(deleteId);
      toast({ title: t.common.delete, description: t.tools.flexTournament.updateSuccess });
    } catch (error) {
      toast({ title: t.common.error, description: t.tools.flexTournament.deleteError, variant: "destructive" });
    }
    setDeleteId(null);
  };

  // Allow viewing public tournaments even when not logged in
  // But show login prompt for creating

  return (
    <MainLayout>
      <DynamicMeta
        title="Pickleball Flex Tournament – Custom Bracket Maker"
        description="Create flexible pickleball tournament brackets with custom groups, team play, singles, doubles, and mixed formats. Free tool with real-time scoring and live standings for any tournament structure."
        url="https://www.thepicklehub.net/tools/flex-tournament"
      />
      <HreflangTags enPath="/tools/flex-tournament" />
      <WebApplicationSchema
        name="Flex Tournament - Custom Pickleball Bracket Maker"
        description="Create flexible pickleball tournament brackets with custom groups, team play, singles, doubles, and mixed formats. Real-time scoring and live standings."
        url="https://www.thepicklehub.net/tools/flex-tournament"
        applicationCategory="SportsApplication"
        featureList={[
          "Custom group creation",
          "Singles and doubles matches",
          "Team-based tournaments",
          "Real-time scoring",
          "Live standings",
          "Mobile-friendly interface"
        ]}
      />
      <FAQSchema items={[
        { question: "What types of tournaments can I run with Flex Tournament?", answer: "Flex Tournament supports any format you can design: singles, doubles, mixed doubles, team events, or combinations of all of these within a single tournament. You can create multiple groups with different player counts, define custom match formats per group, and structure your knockout rounds however you like. It's the only tool on The Pickle Hub with no restrictions on tournament structure." },
        { question: "Can Flex Tournament handle non-standard group sizes?", answer: "Yes. Unlike Quick Tables (which is optimized for standard group sizes), Flex Tournament lets you create groups with any number of players or teams — 3, 5, 7, 11, or any other count. You manually assign matches within each group, so there are no algorithmic restrictions on group composition." },
        { question: "How is Flex Tournament different from Quick Tables?", answer: "Quick Tables is optimized for standard round robin brackets — it auto-generates balanced schedules for 4–48 players in seconds. Flex Tournament gives you full manual control: you build every group, match, and scoring rule yourself. Quick Tables is faster for straightforward events; Flex Tournament is the right choice when your event structure doesn't fit standard round robin rules." },
        { question: "Can I share my Flex Tournament bracket publicly?", answer: "Yes. Each Flex Tournament has a public visibility toggle. When enabled, anyone with the link can view the bracket, group standings, and match scores in real-time — no account required. This is useful for sharing live updates with spectators, posting the link on social media, or embedding tournament results in a club newsletter." },
        { question: "Is Flex Tournament suitable for training sessions and clinic formats?", answer: "It's one of the best tools for structured training. You can design rotating partner rounds, skill-based groupings, or drill-style match formats that standard bracket generators can't handle. Many coaches use Flex Tournament to run round-robin skill sessions where players rotate through different partners and opponents, with scores tracked in real-time." },
      ]} />
      <div className="container-wide py-8">
        {/* Back to Tools */}
        <Link
          to="/tools"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          {language === "vi" ? "Tất cả công cụ" : "All tools"}
        </Link>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">
              Pickleball Flex Tournament Bracket Maker
            </h1>
            <p className="text-muted-foreground mt-1">
              {t.tools.flexTournament.subtitle}
            </p>
          </div>
          {user ? (
            <Button onClick={() => navigate('/tools/flex-tournament/new')}>
              <Plus className="w-4 h-4 mr-2" />
              {t.tools.flexTournament.createNew}
            </Button>
          ) : (
            <Button asChild>
              <Link to={getLoginUrl(location.pathname)}>{t.auth.login}</Link>
            </Button>
          )}
        </div>

        {/* Microcopy */}
        <Card className="mb-8 bg-muted/50 border-dashed">
          <CardContent className="py-4">
            <p className="text-sm text-muted-foreground">
              {t.tools.flexTournament.subtitleFull}
            </p>
          </CardContent>
        </Card>

        {/* My Tournaments - Only show when logged in */}
        {user && (
          <>
            <h2 className="text-lg font-semibold mb-4">{language === "vi" ? "Giải đấu của tôi" : "My Tournaments"}</h2>
            {isLoadingTournaments ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : myTournaments.length === 0 ? (
              <Card className="text-center py-8 mb-8">
                <CardContent>
                  <p className="text-muted-foreground mb-4">{t.tools.flexTournament.noTournaments}</p>
                  <Button onClick={() => navigate('/tools/flex-tournament/new')}>
                    <Plus className="w-4 h-4 mr-2" />
                    {t.tools.flexTournament.create}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                {myTournaments.map((tournament) => (
                  <Card key={tournament.id} className="hover:border-primary/50 transition-colors">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-lg line-clamp-1">{tournament.name}</CardTitle>
                        <Badge variant={tournament.is_public ? "default" : "secondary"}>
                          {tournament.is_public ? (
                            <><Globe className="w-3 h-3 mr-1" />{t.tools.flexTournament.public}</>
                          ) : (
                            <><Lock className="w-3 h-3 mr-1" />{t.tools.flexTournament.unlisted}</>
                          )}
                        </Badge>
                      </div>
                      <CardDescription>
                        {format(new Date(tournament.created_at), 'dd/MM/yyyy HH:mm')}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="flex-1"
                          onClick={() => navigate(`/tools/flex-tournament/${tournament.share_id}`)}
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          {t.tools.flexTournament.viewTournament}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setDeleteId(tournament.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </>
        )}

        {/* Public Tournaments - Always visible */}
        <h2 className="text-lg font-semibold mb-4">{language === "vi" ? "Giải đấu công khai" : "Public Tournaments"}</h2>
        {isLoadingPublic ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : publicTournaments.length === 0 ? (
          <Card className="text-center py-8">
            <CardContent>
              <p className="text-muted-foreground">{language === "vi" ? "Chưa có giải đấu công khai nào" : "No public tournaments yet"}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {publicTournaments.map((tournament) => (
              <Card key={tournament.id} className="hover:border-primary/50 transition-colors">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg line-clamp-1">{tournament.name}</CardTitle>
                    <Badge variant="default">
                      <Globe className="w-3 h-3 mr-1" />{t.tools.flexTournament.public}
                    </Badge>
                  </div>
                  <CardDescription>
                    {format(new Date(tournament.created_at), 'dd/MM/yyyy HH:mm')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full"
                    onClick={() => navigate(`/tools/flex-tournament/${tournament.share_id}`)}
                  >
                    <Eye className="w-4 h-4 mr-2" />
                    {t.tools.flexTournament.viewTournament}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Delete Dialog */}
        <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t.common.delete}</AlertDialogTitle>
              <AlertDialogDescription>
                {t.tools.flexTournament.deleteConfirm}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
              <AlertDialogAction onClick={handleDelete} disabled={isDeleting}>
                {isDeleting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                {t.common.delete}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Internal Links */}
        <ToolsInternalLinks currentTool="flex-tournament" />

        {/* SEO Content Section */}
        <FlexTournamentSeoContent />
      </div>
    </MainLayout>
  );
};

export default FlexTournamentList;
