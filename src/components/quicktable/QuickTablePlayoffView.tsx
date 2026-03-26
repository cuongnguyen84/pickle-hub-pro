import { useMemo } from 'react';
import PlayoffBracket from '@/components/tournament/PlayoffBracket';
import type { QuickTableMatch, QuickTablePlayer, QuickTableGroup } from '@/hooks/useQuickTable';

interface QuickTablePlayoffViewProps {
  matches: QuickTableMatch[];
  players: QuickTablePlayer[];
  groups: QuickTableGroup[];
  canEdit: boolean;
  onScoreUpdate: (matchId: string, score1: number, score2: number) => void;
}

export default function QuickTablePlayoffView({ matches, players, groups, canEdit, onScoreUpdate }: QuickTablePlayoffViewProps) {
  const groupNames = useMemo(() => {
    const map = new Map<string, string>();
    groups.forEach(g => map.set(g.id, g.name));
    return map;
  }, [groups]);

  const uniqueMatches = useMemo(() => {
    const seen = new Set<number>();
    return matches.filter(m => {
      const num = m.playoff_match_number || 0;
      if (seen.has(num)) return false;
      seen.add(num);
      return true;
    }).sort((a, b) => (a.playoff_match_number || 0) - (b.playoff_match_number || 0));
  }, [matches]);

  const playersWithSeed = useMemo(() => {
    return players.map(p => ({
      ...p,
      seed: p.seed ?? undefined,
    }));
  }, [players]);

  return (
    <PlayoffBracket
      matches={uniqueMatches}
      players={playersWithSeed}
      canEdit={canEdit}
      onScoreUpdate={onScoreUpdate}
      groupNames={groupNames}
    />
  );
}
