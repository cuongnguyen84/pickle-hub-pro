import { useMemo } from 'react';
import { useTeamMatchMatches, TeamMatchMatch } from './useTeamMatchMatches';
import { useTeamMatchTeams, TeamMatchTeam } from './useTeamMatchTeams';
import { useTeamMatchGroups } from './useTeamMatchGroups';

export interface TeamStanding {
  team: TeamMatchTeam;
  played: number;
  won: number;
  lost: number;
  gamesWon: number;
  gamesLost: number;
  pointsFor: number;
  pointsAgainst: number;
  pointsDiff: number;
  groupId?: string;
  groupRank?: number;
  isQualified?: boolean;
  isWildcard?: boolean;
}

export function useTeamMatchStandings(tournamentId: string | undefined, options?: {
  topPerGroup?: number;
  wildcardCount?: number;
}) {
  const { topPerGroup = 2, wildcardCount = 0 } = options || {};
  const { data: matches, isLoading: isLoadingMatches } = useTeamMatchMatches(tournamentId);
  const { data: teams, isLoading: isLoadingTeams } = useTeamMatchTeams(tournamentId);
  const { data: groups, isLoading: isLoadingGroups } = useTeamMatchGroups(tournamentId);

  const standings = useMemo(() => {
    if (!teams || !matches) return [];

    const approvedTeams = teams.filter(t => t.status === 'approved');
    const standingsMap = new Map<string, TeamStanding>();

    // Initialize all approved teams
    approvedTeams.forEach(team => {
      standingsMap.set(team.id, {
        team,
        played: 0,
        won: 0,
        lost: 0,
        gamesWon: 0,
        gamesLost: 0,
        pointsFor: 0,
        pointsAgainst: 0,
        pointsDiff: 0,
        groupId: (team as any).group_id || undefined,
      });
    });

    // Process completed round-robin matches (not playoff)
    matches.forEach(match => {
      if (match.status !== 'completed' || !match.winner_team_id) return;
      if (match.is_playoff) return; // Only count round-robin for standings
      if (!match.team_a_id || !match.team_b_id) return;

      const teamA = standingsMap.get(match.team_a_id);
      const teamB = standingsMap.get(match.team_b_id);

      if (teamA) {
        teamA.played++;
        teamA.gamesWon += match.games_won_a;
        teamA.gamesLost += match.games_won_b;
        teamA.pointsFor += match.total_points_a;
        teamA.pointsAgainst += match.total_points_b;
        teamA.pointsDiff = teamA.pointsFor - teamA.pointsAgainst;
        
        if (match.winner_team_id === match.team_a_id) {
          teamA.won++;
        } else {
          teamA.lost++;
        }
      }

      if (teamB) {
        teamB.played++;
        teamB.gamesWon += match.games_won_b;
        teamB.gamesLost += match.games_won_a;
        teamB.pointsFor += match.total_points_b;
        teamB.pointsAgainst += match.total_points_a;
        teamB.pointsDiff = teamB.pointsFor - teamB.pointsAgainst;
        
        if (match.winner_team_id === match.team_b_id) {
          teamB.won++;
        } else {
          teamB.lost++;
        }
      }
    });

    // Sort standings: by wins desc, then game diff, then points diff
    return Array.from(standingsMap.values()).sort((a, b) => {
      if (b.won !== a.won) return b.won - a.won;
      const gameDiffA = a.gamesWon - a.gamesLost;
      const gameDiffB = b.gamesWon - b.gamesLost;
      if (gameDiffB !== gameDiffA) return gameDiffB - gameDiffA;
      return b.pointsDiff - a.pointsDiff;
    });
  }, [teams, matches]);

  // Calculate standings per group with qualification
  const standingsByGroup = useMemo(() => {
    if (!groups || groups.length === 0) return new Map<string, TeamStanding[]>();
    
    const result = new Map<string, TeamStanding[]>();
    
    groups.forEach(group => {
      const groupStandings = standings
        .filter(s => s.groupId === group.id)
        .sort((a, b) => {
          if (b.won !== a.won) return b.won - a.won;
          const gameDiffA = a.gamesWon - a.gamesLost;
          const gameDiffB = b.gamesWon - b.gamesLost;
          if (gameDiffB !== gameDiffA) return gameDiffB - gameDiffA;
          return b.pointsDiff - a.pointsDiff;
        })
        .map((standing, index) => ({
          ...standing,
          groupRank: index + 1,
          isQualified: index < topPerGroup,
        }));
      
      result.set(group.id, groupStandings);
    });

    return result;
  }, [standings, groups, topPerGroup]);

  // Get all qualifying teams for playoff
  const qualifyingTeams = useMemo(() => {
    if (!groups || groups.length === 0) {
      // No groups - return top N from overall standings
      return standings.slice(0, topPerGroup);
    }

    const qualified: TeamStanding[] = [];
    const nonQualified: TeamStanding[] = [];

    standingsByGroup.forEach((groupStandings) => {
      groupStandings.forEach(standing => {
        if (standing.isQualified) {
          qualified.push(standing);
        } else {
          nonQualified.push(standing);
        }
      });
    });

    // Add wildcards
    if (wildcardCount > 0) {
      const sortedNonQualified = nonQualified.sort((a, b) => {
        if (b.won !== a.won) return b.won - a.won;
        const gameDiffA = a.gamesWon - a.gamesLost;
        const gameDiffB = b.gamesWon - b.gamesLost;
        if (gameDiffB !== gameDiffA) return gameDiffB - gameDiffA;
        return b.pointsDiff - a.pointsDiff;
      });

      sortedNonQualified.slice(0, wildcardCount).forEach(standing => {
        standing.isWildcard = true;
        qualified.push(standing);
      });
    }

    // Sort qualified teams by performance for seeding
    return qualified.sort((a, b) => {
      if (b.won !== a.won) return b.won - a.won;
      const gameDiffA = a.gamesWon - a.gamesLost;
      const gameDiffB = b.gamesWon - b.gamesLost;
      if (gameDiffB !== gameDiffA) return gameDiffB - gameDiffA;
      return b.pointsDiff - a.pointsDiff;
    });
  }, [standings, standingsByGroup, groups, topPerGroup, wildcardCount]);

  // Check if round-robin is complete
  const roundRobinComplete = useMemo(() => {
    if (!matches || !teams) return false;
    
    const approvedTeams = teams.filter(t => t.status === 'approved');
    const roundRobinMatches = matches.filter(m => !m.is_playoff);
    
    if (roundRobinMatches.length === 0) return false;
    
    // All round-robin matches should be completed
    return roundRobinMatches.every(m => m.status === 'completed');
  }, [matches, teams]);

  // Check if playoff already exists
  const hasPlayoff = useMemo(() => {
    if (!matches) return false;
    return matches.some(m => m.is_playoff);
  }, [matches]);

  // Check if groups exist
  const hasGroups = useMemo(() => {
    return groups && groups.length > 0;
  }, [groups]);

  return {
    standings,
    standingsByGroup,
    qualifyingTeams,
    isLoading: isLoadingMatches || isLoadingTeams || isLoadingGroups,
    roundRobinComplete,
    hasPlayoff,
    hasGroups,
  };
}