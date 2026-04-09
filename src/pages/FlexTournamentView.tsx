import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useI18n } from '@/i18n';
import { MainLayout } from '@/components/layout';
import { DynamicMeta } from '@/components/seo';
import { useFlexTournament, type FlexTournamentData } from '@/hooks/useFlexTournament';
import { useFlexRealtime } from '@/hooks/useFlexRealtime';
import { useAuth } from '@/hooks/useAuth';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { FlexWorkspace } from '@/components/flex/FlexWorkspace';
import { ArrowLeft, Share2, Globe, Lock, Loader2, Settings, Trash2 } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
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
} from '@/components/ui/alert-dialog';

const FlexTournamentView = () => {
  const { shareId } = useParams<{ shareId: string }>();
  const { t, language } = useI18n();
  const { user } = useAuth();
  const { isAdmin } = useAdminAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { getTournamentByShareId, updateTournamentVisibility, deleteTournament } = useFlexTournament();

  const [data, setData] = useState<FlexTournamentData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreator, setIsCreator] = useState(false);

  const canManage = isCreator || isAdmin; // Admin or creator can manage

  const loadData = useCallback(async () => {
    if (!shareId) return;
    
    const result = await getTournamentByShareId(shareId);
    if (result) {
      setData(result);
      setIsCreator(user?.id === result.tournament.creator_user_id);
    }
    setIsLoading(false);
  }, [shareId, getTournamentByShareId, user?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Set up realtime subscription
  useFlexRealtime({
    tournamentId: data?.tournament.id || '',
    onPlayersChange: loadData,
    onTeamsChange: loadData,
    onGroupsChange: loadData,
    onMatchesChange: loadData,
    onTeamMembersChange: loadData,
    onGroupItemsChange: loadData,
    onPlayerStatsChange: loadData,
    onPairStatsChange: loadData,
  });

  const handleShare = async () => {
    const url = `https://share.thepicklehub.net/flex-tournament/${shareId}`;
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: t.common.copied });
    } catch (error) {
      toast({ title: t.common.error, variant: 'destructive' });
    }
  };

  const handleVisibilityChange = async (isPublic: boolean) => {
    if (!data) return;
    const success = await updateTournamentVisibility(data.tournament.id, isPublic);
    if (success) {
      setData(prev => prev ? {
        ...prev,
        tournament: { ...prev.tournament, is_public: isPublic }
      } : null);
      toast({ title: t.tools.flexTournament.updateSuccess });
    }
  };

  const handleDeleteTournament = async () => {
    if (!data) return;
    try {
      await deleteTournament(data.tournament.id);
      toast({ title: t.common.delete });
      navigate('/tools/flex-tournament');
    } catch (error) {
      toast({ title: t.common.error, variant: 'destructive' });
    }
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      </MainLayout>
    );
  }

  if (!data) {
    return (
      <MainLayout>
        <div className="container-wide py-8 text-center">
          <h1 className="text-2xl font-bold mb-4">{t.common.error}</h1>
          <p className="text-muted-foreground mb-6">Tournament not found</p>
          <Button asChild>
            <Link to="/tools/flex-tournament">{t.tools.flexTournament.myTournaments}</Link>
          </Button>
        </div>
      </MainLayout>
    );
  }

  // SEO meta for individual tournament
  const seoTitle = `${data.tournament.name} | Flex Tournament`;
  const seoDescription = `${language === 'vi' ? 'Xem bracket và kết quả trực tiếp của giải đấu' : 'View bracket and live results for'} ${data.tournament.name}. ${data.players.length} ${language === 'vi' ? 'VĐV' : 'players'}, ${data.matches.length} ${language === 'vi' ? 'trận đấu' : 'matches'}.`;

  return (
    <MainLayout>
      <DynamicMeta 
        title={seoTitle}
        description={seoDescription}
        url={`https://www.thepicklehub.net/tools/flex-tournament/${shareId}`}
        noindex={true}
      />
      <div className="container-wide py-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild>
              <Link to="/tools/flex-tournament">
                <ArrowLeft className="w-4 h-4" />
              </Link>
            </Button>
            <div>
              <h1 className="text-xl font-bold">{data.tournament.name}</h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant={data.tournament.is_public ? 'default' : 'secondary'}>
                  {data.tournament.is_public ? (
                    <><Globe className="w-3 h-3 mr-1" />{t.tools.flexTournament.public}</>
                  ) : (
                    <><Lock className="w-3 h-3 mr-1" />{t.tools.flexTournament.unlisted}</>
                  )}
                </Badge>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleShare}>
              <Share2 className="w-4 h-4 mr-2" />
              {t.tools.flexTournament.share}
            </Button>

            {canManage && (
              <>
                <Sheet>
                  <SheetTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Settings className="w-4 h-4 mr-2" />
                      {t.tools.flexTournament.settings}
                    </Button>
                  </SheetTrigger>
                  <SheetContent>
                    <SheetHeader>
                      <SheetTitle>{t.tools.flexTournament.settings}</SheetTitle>
                      <SheetDescription>{t.tools.flexTournament.subtitleFull}</SheetDescription>
                    </SheetHeader>
                    <div className="py-6 space-y-6">
                      <div className="flex items-center justify-between">
                        <div className="space-y-0.5">
                          <div className="font-medium">{t.tools.flexTournament.visibility}</div>
                          <div className="text-sm text-muted-foreground">
                            {t.tools.flexTournament.visibilityHint}
                          </div>
                        </div>
                        <Switch
                          checked={data.tournament.is_public}
                          onCheckedChange={handleVisibilityChange}
                        />
                      </div>
                    </div>
                  </SheetContent>
                </Sheet>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" className="text-destructive hover:bg-destructive/10">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Xoá giải đấu?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Hành động này không thể hoàn tác. Tất cả dữ liệu sẽ bị xoá vĩnh viễn.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Huỷ</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDeleteTournament} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        Xoá
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
          </div>
        </div>

        {/* Microcopy for non-creators */}
        {!canManage && (
          <div className="mb-6 p-3 bg-muted/50 rounded-lg border border-dashed">
            <p className="text-sm text-muted-foreground">
              {t.tools.flexTournament.subtitleFull}
            </p>
          </div>
        )}

        {/* Workspace */}
        <FlexWorkspace
          data={data}
          isCreator={canManage}
          onRefresh={loadData}
        />
      </div>
    </MainLayout>
  );
};

export default FlexTournamentView;
