import { Link } from 'react-router-dom';
import { useOpenRegistrationTables, type QuickTablePublic } from '@/hooks/useSupabaseData';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { SectionHeader, EmptyState } from '@/components/content';
import { ClipboardList, Users, ChevronRight, Trophy, Mail } from 'lucide-react';
import { useI18n } from '@/i18n';

interface OpenRegistrationCardProps {
  table: QuickTablePublic;
}

function OpenRegistrationCard({ table }: OpenRegistrationCardProps) {
  const { t } = useI18n();
  
  return (
    <Link
      to={`/quick-tables/${table.share_id}`}
      className="group block rounded-xl overflow-hidden card-interactive bg-background-surface border border-border-subtle hover:border-border"
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Trophy className="w-6 h-6 text-primary" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="default" className="text-xs bg-green-500/90 hover:bg-green-500">
                <ClipboardList className="w-3 h-3 mr-1" />
                {t.quickTable.registering}
              </Badge>
            </div>

            <h3 className="font-semibold text-foreground line-clamp-1 group-hover:text-primary transition-colors">
              {table.name}
            </h3>

            <div className="flex items-center gap-2 mt-1 text-sm text-foreground-muted">
              <Users className="w-4 h-4" />
              <span>
                {table.is_doubles 
                  ? t.quickTable.expectedPairs.replace('{count}', String(table.player_count))
                  : t.quickTable.expectedPlayers.replace('{count}', String(table.player_count))
                }
              </span>
            </div>
            
            {/* Creator */}
            {table.creator_display_name && (
              <div className="flex items-center gap-1 mt-1 text-xs text-foreground-muted">
                <Mail className="w-3 h-3" />
                <span className="truncate max-w-[200px]">
                  {table.creator_display_name}
                </span>
              </div>
            )}
          </div>

          {/* Arrow */}
          <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <ChevronRight className="w-5 h-5 text-foreground-muted" />
          </div>
        </div>
      </div>
    </Link>
  );
}

interface OpenRegistrationSectionProps {
  limit?: number;
  showViewAll?: boolean;
}

export function OpenRegistrationSection({ limit = 5, showViewAll = true }: OpenRegistrationSectionProps) {
  const { data: tables = [], isLoading } = useOpenRegistrationTables({ limit });
  const { t } = useI18n();

  if (isLoading) {
    return (
      <section className="container-wide section-spacing" style={{ minHeight: 200 }}>
        <SectionHeader title={t.quickTable.openRegistrationTitle} />
        <div className="grid gap-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      </section>
    );
  }

  if (tables.length === 0) {
    return null;
  }

  return (
    <section className="container-wide section-spacing">
      <SectionHeader 
        title={t.quickTable.openRegistrationTitle} 
        href={showViewAll ? "/quick-tables" : undefined}
      />
      <div className="grid gap-3">
        {tables.map((table) => (
          <OpenRegistrationCard key={table.id} table={table} />
        ))}
      </div>
      {showViewAll && tables.length >= limit && (
        <div className="mt-4 text-center">
          <Link to="/quick-tables">
            <Button variant="outline" size="sm">
              {t.common.viewAll}
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </div>
      )}
    </section>
  );
}

export default OpenRegistrationSection;
