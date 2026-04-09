import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MainLayout } from '@/components/layout';
import { useI18n } from '@/i18n';
import { useParentTournament, type ParentTournament } from '@/hooks/useParentTournament';
import type { QuickTable } from '@/hooks/useQuickTable';
import { ArrowRight, Calendar, MapPin, Plus, Trophy, Trash2, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { vi as viLocale } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface ParentTournamentViewProps {
  shareId: string;
}

export default function ParentTournamentView({ shareId }: ParentTournamentViewProps) {
  const { t, language } = useI18n();
  const navigate = useNavigate();
  const { getParentByShareId, isOwner, deleteParent } = useParentTournament();
  const [parent, setParent] = useState<ParentTournament | null>(null);
  const [subEvents, setSubEvents] = useState<QuickTable[]>([]);
  const [loading, setLoading] = useState(true);

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
    if (subEvents.length > 0) {
      return;
    }
    const confirmed = window.confirm(t.quickTable.parentTournament.deleteParentConfirm);
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

  const getStatusVariant = (status: string): 'default' | 'secondary' | 'outline' => {
    switch (status) {
      case 'completed': return 'default';
      case 'playoff':
      case 'group_stage': return 'secondary';
      default: return 'outline';
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="container-wide py-8">
          <div className="text-center text-foreground-muted">{t.common.loading}</div>
        </div>
      </MainLayout>
    );
  }

  if (!parent) {
    return (
      <MainLayout>
        <div className="container-wide py-8">
          <div className="text-center">
            <p className="text-foreground-muted mb-4">{t.quickTable.view.notFound}</p>
            <Link to="/tools/quick-tables">
              <Button variant="outline">{t.quickTable.view.goBack}</Button>
            </Link>
          </div>
        </div>
      </MainLayout>
    );
  }

  const canEdit = isOwner(parent);

  return (
    <MainLayout>
      <div className="container-wide py-8">
        <div className="max-w-2xl mx-auto space-y-6">
          <Link
            to="/tools/quick-tables"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors"
          >
            <ArrowRight className="w-4 h-4 rotate-180" />
            {language === 'vi' ? 'Tất cả giải đấu' : 'All tournaments'}
          </Link>

          {/* Header */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Trophy className="w-6 h-6 text-primary" />
              <h1 className="text-2xl font-bold">{parent.name}</h1>
            </div>
            <div className="flex flex-wrap gap-3 text-sm text-foreground-muted">
              {parent.event_date && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {format(new Date(parent.event_date), 'dd/MM/yyyy', { locale: viLocale })}
                </span>
              )}
              {parent.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  {parent.location}
                </span>
              )}
              <Badge variant="secondary">
                {t.quickTable.parentTournament.subEventCount.replace('{count}', String(subEvents.length))}
              </Badge>
            </div>
            {parent.description && (
              <p className="text-foreground-secondary">{parent.description}</p>
            )}
          </div>

          {/* Sub Events */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-base">{t.quickTable.parentTournament.subEvents}</CardTitle>
              {canEdit && (
                <Button size="sm" onClick={handleAddSubEvent} className="gap-1">
                  <Plus className="w-4 h-4" />
                  {t.quickTable.parentTournament.addSubEvent}
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-2">
              {subEvents.length === 0 ? (
                <div className="text-center py-8 text-foreground-muted">
                  <p>{t.quickTable.parentTournament.noSubEvents}</p>
                </div>
              ) : (
                subEvents.map((sub) => (
                  <Link
                    key={sub.id}
                    to={
                      sub.status === 'setup'
                        ? `/tools/quick-tables/${sub.share_id}/setup`
                        : `/tools/quick-tables/${sub.share_id}`
                    }
                    className="block p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{sub.name}</div>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-foreground-muted mt-1">
                          <span>{sub.player_count} {t.quickTable.players}</span>
                          <span>•</span>
                          <span>{sub.format === 'round_robin' ? t.quickTable.roundRobin : t.quickTable.largePlayoff}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant={getStatusVariant(sub.status)}>{getStatusLabel(sub.status)}</Badge>
                        <Eye className="w-4 h-4 text-foreground-muted" />
                      </div>
                    </div>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>

          {/* Delete */}
          {canEdit && subEvents.length === 0 && (
            <div className="text-center">
              <Button variant="destructive" size="sm" onClick={handleDeleteParent} className="gap-1">
                <Trash2 className="w-4 h-4" />
                {t.quickTable.view.deleteBtn}
              </Button>
            </div>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
