import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "@/i18n";
import { MainLayout } from "@/components/layout";
import { useFlexTournament } from "@/hooks/useFlexTournament";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import { getLoginUrl } from "@/lib/auth-config";

const FlexTournamentSetup = () => {
  const { t } = useI18n();
  const { user } = useAuth();
  const { createTournament, isCreating } = useFlexTournament();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [name, setName] = useState("");
  const [playersText, setPlayersText] = useState("");
  const [isPublic, setIsPublic] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) {
      toast({ title: t.common.error, description: t.tools.flexTournament.tournamentName, variant: "destructive" });
      return;
    }

    const playerNames = playersText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0);

    try {
      const tournament = await createTournament({
        name: name.trim(),
        playerNames,
        isPublic,
      });

      toast({ title: t.tools.flexTournament.createSuccess });
      navigate(`/tools/flex-tournament/${tournament.share_id}`);
    } catch (error) {
      toast({ 
        title: t.common.error, 
        description: t.tools.flexTournament.createError, 
        variant: "destructive" 
      });
    }
  };

  if (!user) {
    return (
      <MainLayout>
        <div className="container-wide py-8">
          <div className="text-center py-12">
            <h1 className="text-2xl font-bold mb-4">{t.tools.flexTournament.title}</h1>
            <p className="text-muted-foreground mb-6">{t.auth.loginRequired}</p>
            <Button asChild>
              <Link to={getLoginUrl('/tools/flex-tournament/new')}>{t.auth.login}</Link>
            </Button>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container-wide py-8 max-w-2xl mx-auto">
        {/* Back button */}
        <Button variant="ghost" asChild className="mb-6">
          <Link to="/tools/flex-tournament">
            <ArrowLeft className="w-4 h-4 mr-2" />
            {t.tools.flexTournament.myTournaments}
          </Link>
        </Button>

        <Card>
          <CardHeader>
            <CardTitle>{t.tools.flexTournament.create}</CardTitle>
            <CardDescription>{t.tools.flexTournament.subtitleFull}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Tournament Name */}
              <div className="space-y-2">
                <Label htmlFor="name">{t.tools.flexTournament.tournamentName}</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t.tools.flexTournament.tournamentNamePlaceholder}
                  required
                />
              </div>

              {/* Visibility */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>{t.tools.flexTournament.visibility}</Label>
                  <p className="text-sm text-muted-foreground">
                    {t.tools.flexTournament.visibilityHint}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    {isPublic ? t.tools.flexTournament.public : t.tools.flexTournament.unlisted}
                  </span>
                  <Switch
                    checked={isPublic}
                    onCheckedChange={setIsPublic}
                  />
                </div>
              </div>

              {/* Players */}
              <div className="space-y-2">
                <Label htmlFor="players">{t.tools.flexTournament.addPlayers}</Label>
                <Textarea
                  id="players"
                  value={playersText}
                  onChange={(e) => setPlayersText(e.target.value)}
                  placeholder={t.tools.flexTournament.addPlayersPlaceholder}
                  rows={8}
                />
                <p className="text-sm text-muted-foreground">
                  {t.tools.flexTournament.addPlayersHint}
                </p>
              </div>

              {/* Submit */}
              <Button type="submit" className="w-full" disabled={isCreating}>
                {isCreating && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {t.tools.flexTournament.create}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
};

export default FlexTournamentSetup;
