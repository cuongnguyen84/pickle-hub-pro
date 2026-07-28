import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { TheLineLayout } from '@/components/layout';
import { useI18n } from '@/i18n';
import { useConfirm } from '@/hooks/useConfirm';
import { useParentTournament, type ParentTournament } from '@/hooks/useParentTournament';
import type { QuickTable } from '@/hooks/useQuickTable';
import {
  Calendar,
  Eye,
  FolderPlus,
  MapPin,
  Monitor,
  Plus,
  Trash2,
  Trophy,
} from 'lucide-react';
import { format } from 'date-fns';
import { vi as viLocale } from 'date-fns/locale';
import AttachExistingEventsDialog from './AttachExistingEventsDialog';

interface ParentTournamentViewProps {
  shareId: string;
}

const surfaceCard: React.CSSProperties = {
  background: 'var(--tl-bg-elev)',
  border: '1px solid var(--tl-border)',
  borderRadius: 'var(--tl-radius-lg)',
  padding: 24,
};

const sectionTitle: React.CSSProperties = {
  fontFamily: 'Instrument Serif, serif',
  fontStyle: 'italic',
  fontWeight: 400,
  fontSize: 22,
  letterSpacing: '-0.015em',
  margin: 0,
  color: 'var(--tl-fg)',
};

export default function ParentTournamentView({ shareId }: ParentTournamentViewProps) {
  const { t, language } = useI18n();
  const confirm = useConfirm();
  const navigate = useNavigate();
  const { getParentByShareId, isOwner, deleteParent } = useParentTournament();
  const [parent, setParent] = useState<ParentTournament | null>(null);
  const [subEvents, setSubEvents] = useState<QuickTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAttachEvents, setShowAttachEvents] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const parentData = await getParentByShareId(shareId);
    if (!parentData) {
      setLoading(false);
      return;
    }
    setParent(parentData);

    const { data: subs } = await supabase
      .from('quick_tables')
      .select('*')
      .eq('parent_tournament_id', parentData.id)
      .order('created_at', { ascending: true });

    setSubEvents((subs || []) as unknown as QuickTable[]);
    setLoading(false);
  }, [shareId, getParentByShareId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleAddSubEvent = () => {
    if (!parent) return;
    navigate(`/tools/quick-tables?parentId=${parent.id}&parentName=${encodeURIComponent(parent.name)}`);
  };

  const handleDeleteParent = async () => {
    if (!parent) return;
    const confirmed = await confirm({
      description: subEvents.length > 0
        ? t.quickTable.parentTournament.deleteParentConfirmWithEvents
            .replace('{count}', String(subEvents.length))
        : t.quickTable.parentTournament.deleteParentConfirm,
      destructive: true,
    });
    if (!confirmed) return;
    const success = await deleteParent(parent.id);
    if (success) {
      navigate('/tools/quick-tables');
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'setup': return t.quickTable.status.setup;
      case 'group_stage': return t.quickTable.status.groupStage;
      case 'playoff': return t.quickTable.status.playoff;
      case 'completed': return t.quickTable.status.completed;
      default: return status;
    }
  };

  const statusPillClass = (status: string): string => {
    if (status === 'completed') return 'tl-br-status completed';
    if (status === 'playoff' || status === 'group_stage') return 'tl-br-status active';
    if (status === 'registration') return 'tl-br-status registration';
    return 'tl-br-status setup';
  };

  // ─── Loading + 404 ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <TheLineLayout title="Tournament" active="lab">
        <div className="tl-shell">
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 400,
              color: 'var(--tl-fg-3)',
              fontFamily: 'Geist Mono, ui-monospace, monospace',
              fontSize: 12,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}
          >
            {t.common.loading}
          </div>
        </div>
      </TheLineLayout>
    );
  }

  if (!parent) {
    return (
      <TheLineLayout title="Tournament" active="lab">
        <div className="tl-shell">
          <div className="tl-empty" style={{ marginTop: 56 }}>
            <h3>{t.quickTable.view.notFound}</h3>
            <Link to="/tools/quick-tables" className="tl-btn">
              ← {t.quickTable.view.goBack}
            </Link>
          </div>
        </div>
      </TheLineLayout>
    );
  }

  const canEdit = isOwner(parent);

  return (
    <TheLineLayout title={parent.name} active="lab">
      <div className="tl-shell">
        <nav className="tl-breadcrumb">
          <Link to="/tools">{language === 'vi' ? 'Bracket Lab' : 'Bracket Lab'}</Link>
          <span className="sep">/</span>
          <Link to="/tools/quick-tables">Quick Tables</Link>
          <span className="sep">/</span>
          <span className="current">{parent.name}</span>
        </nav>

        <header className="tl-page-head">
          <div className="kicker">
            <Trophy
              className="inline w-3 h-3"
              style={{ verticalAlign: 'middle', marginRight: 4, color: 'var(--tl-green)' }}
            />
            {language === 'vi' ? 'Giải tổng' : 'Multi-event tournament'}
            <span style={{ color: 'var(--tl-fg-4)', margin: '0 8px' }}>·</span>
            {t.quickTable.parentTournament.subEventCount.replace('{count}', String(subEvents.length))}
          </div>
          <h1 style={{ fontSize: 'clamp(28px, 4vw, 56px)' }}>
            <em className="tl-serif">{parent.name}</em>
          </h1>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 16,
              marginTop: 14,
              fontFamily: 'Geist Mono, ui-monospace, monospace',
              fontSize: 11,
              color: 'var(--tl-fg-3)',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}
          >
            {parent.event_date && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Calendar className="w-3 h-3" />
                {format(new Date(parent.event_date), 'dd/MM/yyyy', { locale: viLocale })}
              </span>
            )}
            {parent.location && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <MapPin className="w-3 h-3" />
                {parent.location}
              </span>
            )}
          </div>
          {parent.description && (
            <p style={{ marginTop: 16, color: 'var(--tl-fg-2)', maxWidth: '60ch' }}>
              {parent.description}
            </p>
          )}
        </header>

        <section style={{ marginTop: 32, marginBottom: 56 }}>
          <div style={surfaceCard}>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
                paddingBottom: 14,
                borderBottom: '1px solid var(--tl-border)',
                marginBottom: 16,
              }}
            >
              <h2 style={{ ...sectionTitle, fontSize: 18 }}>
                {t.quickTable.parentTournament.subEvents}
              </h2>
              {canEdit && (
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    className="tl-btn"
                    onClick={() => setShowAttachEvents(true)}
                  >
                    <FolderPlus className="w-4 h-4" />
                    {t.quickTable.parentTournament.addExistingEvents}
                  </button>
                  <button
                    type="button"
                    className="tl-btn green"
                    onClick={handleAddSubEvent}
                  >
                    <Plus className="w-4 h-4" />
                    {t.quickTable.parentTournament.createNewEvent}
                  </button>
                </div>
              )}
            </div>

            {subEvents.length === 0 ? (
              <div className="tl-empty-card" style={{ marginTop: 8, marginBottom: 8 }}>
                <span className="tl-empty-card-mark">◌</span>
                <span className="tl-empty-card-label">
                  {language === 'vi' ? 'Chưa có nội dung' : 'No events yet'}
                </span>
                <p className="tl-empty-card-hint">
                  {t.quickTable.parentTournament.noSubEvents}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {subEvents.map((sub) => (
                  <div
                    key={sub.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 10px 8px 14px',
                      borderRadius: 'var(--tl-radius)',
                      border: '1px solid var(--tl-border)',
                      background: 'var(--tl-bg)',
                    }}
                  >
                    <Link
                      to={
                        sub.status === 'setup'
                          ? `/tools/quick-tables/${sub.share_id}/setup`
                          : `/tools/quick-tables/${sub.share_id}`
                      }
                      className="min-w-0 flex-1 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--tl-green)]"
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'space-between',
                        gap: 12,
                        padding: '4px 0',
                        color: 'inherit',
                        textDecoration: 'none',
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontWeight: 500,
                            fontSize: 14.5,
                            color: 'var(--tl-fg)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {sub.name}
                        </div>
                        <div
                          style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            alignItems: 'center',
                            gap: 6,
                            marginTop: 4,
                            fontFamily: 'Geist Mono, ui-monospace, monospace',
                            fontSize: 11,
                            color: 'var(--tl-fg-3)',
                            letterSpacing: '0.02em',
                          }}
                        >
                          <span>{sub.player_count} {t.quickTable.players}</span>
                          <span style={{ color: 'var(--tl-fg-4)' }}>·</span>
                          <span>
                            {sub.format === 'round_robin' ? t.quickTable.roundRobin : t.quickTable.largePlayoff}
                          </span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        <span className={statusPillClass(sub.status)}>
                          {getStatusLabel(sub.status)}
                        </span>
                        <Eye className="w-4 h-4" style={{ color: 'var(--tl-fg-3)' }} />
                      </div>
                    </Link>
                    {(sub.status === 'group_stage' || sub.status === 'playoff') && (
                      <Link
                        to={`/tools/dashboard/quick-table/${sub.share_id}`}
                        className="tl-btn green min-h-11 shrink-0"
                        aria-label={`${t.dashboard.openDashboard}: ${sub.name}`}
                      >
                        <Monitor className="w-4 h-4" />
                        <span className="hidden sm:inline">{t.dashboard.openDashboard}</span>
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {canEdit && (
            <div style={{ textAlign: 'center', marginTop: 24 }}>
              <Button variant="destructive" size="sm" onClick={handleDeleteParent} className="gap-1">
                <Trash2 className="w-4 h-4" />
                {t.quickTable.view.deleteBtn}
              </Button>
            </div>
          )}
        </section>

        {canEdit && (
          <AttachExistingEventsDialog
            open={showAttachEvents}
            onOpenChange={setShowAttachEvents}
            parentId={parent.id}
            onAttached={loadData}
          />
        )}
      </div>
    </TheLineLayout>
  );
}
