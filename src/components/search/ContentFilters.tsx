import { useI18n } from "@/i18n";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Tables } from "@/integrations/supabase/types";

export type ContentType = "all" | "live" | "replay" | "video";
export type SortOption = "newest" | "upcoming";

interface ContentFiltersProps {
  contentType: ContentType;
  onContentTypeChange: (type: ContentType) => void;
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
  tournaments?: Tables<"tournaments">[];
  selectedTournament?: string;
  onTournamentChange?: (tournamentId: string) => void;
  showTournamentFilter?: boolean;
  showSortFilter?: boolean;
}

export const ContentFilters = ({
  contentType,
  onContentTypeChange,
  sortBy,
  onSortChange,
  tournaments = [],
  selectedTournament,
  onTournamentChange,
  showTournamentFilter = false,
  showSortFilter = true,
}: ContentFiltersProps) => {
  const { t } = useI18n();

  return (
    <div className="flex flex-wrap gap-2">
      {/* Content Type Filter */}
      <Select value={contentType} onValueChange={(v) => onContentTypeChange(v as ContentType)}>
        <SelectTrigger className="w-[140px] bg-background-surface border-border-subtle">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t.search.filterAll}</SelectItem>
          <SelectItem value="live">{t.live.live}</SelectItem>
          <SelectItem value="replay">{t.live.replay}</SelectItem>
          <SelectItem value="video">{t.nav.videos}</SelectItem>
        </SelectContent>
      </Select>

      {/* Tournament Filter */}
      {showTournamentFilter && tournaments.length > 0 && (
        <Select
          value={selectedTournament ?? "all"}
          onValueChange={(v) => onTournamentChange?.(v)}
        >
          <SelectTrigger className="w-[180px] bg-background-surface border-border-subtle">
            <SelectValue placeholder={t.nav.tournaments} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t.search.allTournaments}</SelectItem>
            {tournaments.map((tournament) => (
              <SelectItem key={tournament.id} value={tournament.id}>
                {tournament.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Sort Filter */}
      {showSortFilter && (
        <Select value={sortBy} onValueChange={(v) => onSortChange(v as SortOption)}>
          <SelectTrigger className="w-[140px] bg-background-surface border-border-subtle">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">{t.search.sortNewest}</SelectItem>
            <SelectItem value="upcoming">{t.search.sortUpcoming}</SelectItem>
          </SelectContent>
        </Select>
      )}
    </div>
  );
};

export default ContentFilters;
