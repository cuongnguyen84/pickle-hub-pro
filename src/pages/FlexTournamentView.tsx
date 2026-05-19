import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useI18n } from '@/i18n';
import { TheLineLayout } from '@/components/layout';
import { useFlexTournament, type FlexTournamentData } from '@/hooks/useFlexTournament';
import { useFlexRealtime } from '@/hooks/useFlexRealtime';
import { useFlexTournamentReferees } from '@/hooks/useFlexTournamentReferees';
import { useAuth } from '@/hooks/useAuth';
import { useAdminAuth } from '@/hooks/useAdminAuth';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import { FlexWorkspace } from '@/components/flex/FlexWorkspace';
import { RefereeManagement } from '@/components/quicktable/RefereeManagement';
import { Share2, Globe, Lock, Loader2, Settings, Trash2, Layers } from 'lucide-react';
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

  const canManage = isCreator || isAdmin;

  const {
    referees,
    loading: refereesLoading,
    addRefereeByEmail,
    removeReferee,
  } = useFlexTournamentReferees(data?.tournament.id);

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
    const url = `https://www.thepicklehub.net/tools/flex-tournament/${shareId}`;
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
        tournament: { ...prev.tournament, is_public: isPublic },
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

  // ─── Loading + 404 states ────────────────────────────────────────────────
  if (isLoading) {
    return (
      <TheLineLayout title="Flex Tournament" noindex={true} active="lab">
        <div className="tl-shell">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 400,
            }}
          >
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--tl-fg-3)' }} />
          </div>
        </div>
      </TheLineLayout>
    );
  }

  if (!data) {
    return (
      <TheLineLayout title="Flex Tournament" noindex={true} active="lab">
        <div className="tl-shell">
          <div className="tl-empty" style={{ marginTop: 56 }}>
            <h3>{t.common.error}</h3>
            <p>{language === 'vi' ? 'Không tìm thấy giải đấu' : 'Tournament not found'}</p>
            <Link to="/tools/flex-tournament" className="tl-btn">
              ← {t.tools.flexTournament.myTournaments}
            </Link>
          </div>
        </div>
      </TheLineLayout>
    );
  }

  const seoTitle = `${data.tournament.name} | Flex Tournament`;
  const seoDescription = `${language === 'vi' ? 'Xem bracket và kết quả trực tiếp của giải đấu' : 'View bracket and live results for'} ${data.tournament.name}. ${data.players.length} ${language === 'vi' ? 'VĐV' : 'players'}, ${data.matches.length} ${language === 'vi' ? 'trận đấu' : 'matches'}.`;

  const visibilityBg = data.tournament.is_public ? 'var(--tl-green-glow)' : 'var(--tl-surface)';
  const visibilityFg = data.tournament.is_public ? 'var(--tl-green)' : 'var(--tl-fg-3)';

  return (
    <TheLineLayout title={seoTitle} description={seoDescription} noindex={true} active="lab">
      <div className="tl-shell">
        <nav className="tl-breadcrumb">
          <Link to="/tools">{language === 'vi' ? 'Bracket Lab' : 'Bracket Lab'}</Link>
          <span className="sep">/</span>
          <Link to="/tools/flex-tournament">Flex Tournament</Link>
          <span className="sep">/</span>
          <span className="current">{data.tournament.name}</span>
        </nav>

        <header className="tl-page-head">
          <div className="kicker">
            ◆ {language === 'vi' ? 'Format tự do' : 'Custom format'}
            <span style={{ color: 'var(--tl-fg-4)', margin: '0 8px' }}>·</span>
            {data.players.length} {language === 'vi' ? 'VĐV' : 'players'}
            <span style={{ color: 'var(--tl-fg-4)', margin: '0 8px' }}>·</span>
            {data.matches.length} {language === 'vi' ? 'trận' : 'matches'}
          </div>
          <h1 style={{ fontSize: 'clamp(28px, 4vw, 56px)' }}>
            <em className="tl-serif">{data.tournament.name}</em>
          </h1>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 8,
              alignItems: 'center',
              marginTop: 14,
            }}
          >
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                fontFamily: 'Geist Mono, ui-monospace, monospace',
                fontSize: 10.5,
                fontWeight: 500,
                padding: '4px 10px',
                borderRadius: 4,
                background: visibilityBg,
                color: visibilityFg,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
              }}
            >
              {data.tournament.is_public ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
              {data.tournament.is_public ? t.tools.flexTournament.public : t.tools.flexTournament.unlisted}
            </span>

            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button type="button" className="tl-btn" onClick={handleShare}>
                <Share2 className="w-4 h-4" />
                <span className="hidden sm:inline">{t.tools.flexTournament.share}</span>
              </button>

              {canManage && (
                <>
                  <Sheet>
                    <SheetTrigger asChild>
                      <button type="button" className="tl-btn">
                        <Settings className="w-4 h-4" />
                        <span className="hidden sm:inline">{t.tools.flexTournament.settings}</span>
                      </button>
                    </SheetTrigger>
                    <SheetContent>
                      <SheetHeader>
                        <SheetTitle>{t.tools.flexTournament.settings}</SheetTitle>
                        <SheetDescription>{t.tools.flexTournament.subtitleFull}</SheetDescription>
                      </SheetHeader>
                      <div style={{ padding: '24px 0', display: 'flex', flexDirection: 'column', gap: 24 }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 12,
                            padding: 14,
                            borderRadius: 'var(--tl-radius)',
                            background: 'var(--tl-bg)',
                            border: '1px solid var(--tl-border)',
                          }}
                        >
                          <div>
                            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--tl-fg)' }}>
                              {t.tools.flexTournament.visibility}
                            </div>
                            <div style={{ fontSize: 12.5, color: 'var(--tl-fg-3)', marginTop: 4, lineHeight: 1.5 }}>
                              {t.tools.flexTournament.visibilityHint}
                            </div>
                          </div>
                          <Switch
                            checked={data.tournament.is_public}
                            onCheckedChange={handleVisibilityChange}
                          />
                        </div>

                        {/* Referees — W3.4 unified referee model */}
                        <RefereeManagement
                          referees={referees.map((r) => ({
                            id: r.id,
                            email: r.email,
                            display_name: r.display_name,
                          }))}
                          loading={refereesLoading}
                          onAddReferee={addRefereeByEmail}
                          onRemoveReferee={removeReferee}
                        />
                      </div>
                    </SheetContent>
                  </Sheet>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <button
                        type="button"
                        className="tl-btn"
                        style={{ color: 'var(--tl-live)' }}
                        aria-label={t.common.delete}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>
                          {language === 'vi' ? 'Xoá giải đấu?' : 'Delete tournament?'}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          {language === 'vi'
                            ? 'Hành động này không thể hoàn tác. Tất cả dữ liệu sẽ bị xoá vĩnh viễn.'
                            : 'This action cannot be undone. All data will be permanently deleted.'}
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDeleteTournament}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          {t.common.delete}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Microcopy for non-creators */}
        {!canManage && (
          <section style={{ marginTop: 24 }}>
            <div
              style={{
                padding: '14px 18px',
                borderRadius: 'var(--tl-radius)',
                background: 'var(--tl-bg-elev)',
                border: '1px dashed var(--tl-border)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
              }}
            >
              <Layers
                className="w-4 h-4"
                style={{ color: 'var(--tl-green)', flexShrink: 0, marginTop: 2 }}
              />
              <p style={{ fontSize: 13.5, color: 'var(--tl-fg-2)', margin: 0, lineHeight: 1.5 }}>
                {t.tools.flexTournament.subtitleFull}
              </p>
            </div>
          </section>
        )}

        {/* Workspace — child component left untouched (PR C.2) */}
        <section style={{ marginTop: 24, marginBottom: 56 }}>
          <FlexWorkspace
            data={data}
            isCreator={canManage}
            onRefresh={loadData}
          />
        </section>
      </div>
    </TheLineLayout>
  );
};

export default FlexTournamentView;
