import { useI18n } from "@/i18n";
import { MainLayout } from "@/components/layout";
import { DynamicMeta, ToolsInternalLinks, WebApplicationSchema } from "@/components/seo";
import { useFlexTournament } from "@/hooks/useFlexTournament";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Eye, Trash2, Globe, Lock, Loader2, ArrowLeft } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { useState } from "react";
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

const FlexTournamentList = () => {
  const { t, language } = useI18n();
  const { user } = useAuth();
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
        title={t.tools.flexTournament.title}
        description={t.tools.flexTournament.description}
        url="https://thepicklehub.net/tools/flex-tournament"
        enableHreflang={true}
      />
      <WebApplicationSchema
        name="Flex Tournament - Custom Pickleball Bracket Maker"
        description="Create flexible pickleball tournament brackets with custom groups, team play, singles, doubles, and mixed formats. Real-time scoring and live standings."
        url="https://thepicklehub.net/tools/flex-tournament"
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
              {t.tools.flexTournament.title}
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
              <Link to="/login">{t.auth.login}</Link>
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

        {/* SEO Content Section */}
        <section className="mt-12 border-t border-border pt-10">
          <h2 className="text-xl font-bold mb-4">{t.seo.flexTournament.title}</h2>
          <p className="text-muted-foreground mb-6 max-w-2xl">
            {t.seo.flexTournament.description}
          </p>

          <h3 className="text-lg font-semibold mb-3">{t.seo.flexTournament.differenceTitle}</h3>
          <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground mb-6 max-w-2xl">
            {t.seo.flexTournament.differenceList.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>

          <h3 className="text-lg font-semibold mb-3">{t.seo.flexTournament.whoTitle}</h3>
          <p className="text-sm text-muted-foreground max-w-2xl">
            {t.seo.flexTournament.whoDesc}
          </p>

          {/* Internal Links to Other Tools */}
          <ToolsInternalLinks currentTool="flex-tournament" />
        </section>
      </div>
    </MainLayout>
  );
};

export default FlexTournamentList;
