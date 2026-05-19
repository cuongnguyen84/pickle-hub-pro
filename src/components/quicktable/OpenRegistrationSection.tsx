import { Link } from 'react-router-dom';
import { useOpenRegistrationTables, type QuickTablePublic } from '@/hooks/useSupabaseData';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { SectionHeader } from '@/components/content';
import { Users, ChevronRight, Trophy, User } from 'lucide-react';
import { useI18n } from '@/i18n';

interface OpenRegistrationCardProps {
  table: QuickTablePublic;
}

function OpenRegistrationCard({ table }: OpenRegistrationCardProps) {
  const { t, language } = useI18n();

  return (
    <Link
      to={`/tools/quick-tables/${table.share_id}`}
      className="group block glass-card overflow-hidden"
    >
      <div className="p-5 flex flex-col h-full">
        {/* Status badge */}
        <div className="flex items-center justify-between mb-3">
          <Badge className="text-xs bg-green-500/90 hover:bg-green-500 border-0 gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
            {language === 'vi' ? 'ĐANG MỞ' : 'OPEN'}
          </Badge>
        </div>

        {/* Tournament name */}
        <h3 className="font-semibold text-foreground line-clamp-2 mb-3 group-hover:text-primary transition-colors">
          {table.name}
        </h3>

        {/* Player count */}
        <div className="flex items-center gap-1.5 text-sm text-foreground-muted mb-4">
          {table.is_doubles ? (
            <Users className="w-4 h-4" />
          ) : (
            <User className="w-4 h-4" />
          )}
          <span>
            {table.is_doubles
              ? `${table.player_count} ${t.tournament.pairs}`
              : `${table.player_count} ${t.tournament.players}`
            }
          </span>
        </div>

        {/* Slots progress bar (visual) */}
        <div className="mb-4 mt-auto">
          <div className="flex items-center justify-between text-xs text-foreground-muted mb-1.5">
            <span>{language === 'vi' ? 'Đã đăng ký' : 'Slots filled'}</span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-brand transition-all duration-500"
              style={{ width: '25%' }}
            />
          </div>
        </div>

        {/* Register button */}
        <Button size="sm" className="w-full btn-gradient border-0 rounded-lg gap-1.5">
          <Trophy className="w-3.5 h-3.5" />
          {language === 'vi' ? 'Đăng ký ngay' : 'Register Now'}
        </Button>
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
        <SectionHeader title={t.home.sections.upcomingTournaments} />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-52 rounded-2xl" />
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
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-foreground">{t.home.sections.upcomingTournaments}</h2>
            <p className="text-sm text-foreground-muted mt-1">{t.home.sections.upcomingSubtitle}</p>
          </div>
          {showViewAll && (
            <Link
              to="/tournaments"
              className="flex items-center gap-1 text-sm font-medium text-primary hover:text-primary-hover transition-colors duration-200"
            >
              <span>{t.common.viewAll}</span>
              <ChevronRight className="w-4 h-4" />
            </Link>
          )}
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {tables.slice(0, 3).map((table) => (
          <OpenRegistrationCard key={table.id} table={table} />
        ))}
      </div>
      {tables.length > 3 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
          {tables.slice(3).map((table) => (
            <OpenRegistrationCard key={table.id} table={table} />
          ))}
        </div>
      )}
    </section>
  );
}

export default OpenRegistrationSection;
