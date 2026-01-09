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
  groupName?: string;
  groupRank?: number;
  isQualified?: boolean;
  isWildcard?: boolean;
}

export interface PlayoffSeed {
  teamId: string;
  seed: number;
  groupId?: string;
  groupRank?: number;
  standing: TeamStanding;
}

export interface PlayoffPairing {
  matchIndex: number;
  bracketSide: 'left' | 'right'; // For 8+ teams, to separate branches
  team1: PlayoffSeed;
  team2: PlayoffSeed;
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
      const group = groups?.find(g => g.id === (team as any).group_id);
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
        groupName: group?.name || undefined,
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
  }, [teams, matches, groups]);

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

  // Get all qualifying teams for playoff with proper cross-group seeding
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

  /**
   * Generate playoff pairings with cross-group seeding logic:
   * - 1st of Group A vs 2nd of Group B
   * - 1st of Group B vs 2nd of Group A
   * - For 8+ teams, separate into left/right branches so teams from same
   *   cross-group pairing only meet in finals
   */
  const generatePlayoffSeeding = useMemo(() => {
    return (teamCount: number): { seeds: PlayoffSeed[]; pairings: PlayoffPairing[] } => {
      const hasMultipleGroups = groups && groups.length >= 2;
      
      if (!hasMultipleGroups || groups!.length !== 2) {
        // Standard seeding: 1 vs N, 2 vs N-1, etc.
        const seeds: PlayoffSeed[] = qualifyingTeams.slice(0, teamCount).map((standing, index) => ({
          teamId: standing.team.id,
          seed: index + 1,
          groupId: standing.groupId,
          groupRank: standing.groupRank,
          standing,
        }));

        const pairings: PlayoffPairing[] = [];
        for (let i = 0; i < teamCount / 2; i++) {
          const seed1 = i + 1;
          const seed2 = teamCount - i;
          pairings.push({
            matchIndex: i,
            bracketSide: i < teamCount / 4 ? 'left' : 'right',
            team1: seeds[seed1 - 1],
            team2: seeds[seed2 - 1],
          });
        }

        return { seeds, pairings };
      }

      // Two groups: Cross-group seeding
      const [groupAId, groupBId] = Array.from(standingsByGroup.keys());
      const groupAStandings = standingsByGroup.get(groupAId) || [];
      const groupBStandings = standingsByGroup.get(groupBId) || [];
      
      const teamsPerGroup = teamCount / 2;
      const groupATeams = groupAStandings.filter(s => s.isQualified).slice(0, teamsPerGroup);
      const groupBTeams = groupBStandings.filter(s => s.isQualified).slice(0, teamsPerGroup);

      const seeds: PlayoffSeed[] = [];
      const pairings: PlayoffPairing[] = [];

      if (teamCount === 2) {
        // Finals only: 1st A vs 1st B
        if (groupATeams[0] && groupBTeams[0]) {
          seeds.push(
            { teamId: groupATeams[0].team.id, seed: 1, groupId: groupAId, groupRank: 1, standing: groupATeams[0] },
            { teamId: groupBTeams[0].team.id, seed: 2, groupId: groupBId, groupRank: 1, standing: groupBTeams[0] }
          );
          pairings.push({
            matchIndex: 0,
            bracketSide: 'left',
            team1: seeds[0],
            team2: seeds[1],
          });
        }
      } else if (teamCount === 4) {
        // Semi-finals: 1A vs 2B, 1B vs 2A
        seeds.push(
          { teamId: groupATeams[0]?.team.id || '', seed: 1, groupId: groupAId, groupRank: 1, standing: groupATeams[0] },
          { teamId: groupBTeams[1]?.team.id || '', seed: 4, groupId: groupBId, groupRank: 2, standing: groupBTeams[1] },
          { teamId: groupBTeams[0]?.team.id || '', seed: 2, groupId: groupBId, groupRank: 1, standing: groupBTeams[0] },
          { teamId: groupATeams[1]?.team.id || '', seed: 3, groupId: groupAId, groupRank: 2, standing: groupATeams[1] },
        );

        // SF1: 1A vs 2B (left branch)
        pairings.push({
          matchIndex: 0,
          bracketSide: 'left',
          team1: seeds[0],  // 1A
          team2: seeds[1],  // 2B
        });
        // SF2: 1B vs 2A (right branch)
        pairings.push({
          matchIndex: 1,
          bracketSide: 'right',
          team1: seeds[2],  // 1B
          team2: seeds[3],  // 2A
        });
      } else {
        // 8+ teams: Cross-group with bracket separation
        // Left branch: 1A vs 2B at bottom, meeting semifinal
        // Right branch: 1B vs 2A at bottom, meeting semifinal
        // Winners of left/right branches meet in finals
        
        let seedIndex = 0;
        
        // Left branch pairings (1A side)
        for (let i = 0; i < teamsPerGroup / 2; i++) {
          const rankA = i + 1; // 1, 2, 3... from Group A
          const rankB = teamsPerGroup - i; // 2, 1 from Group B (reversed for seeding)
          
          const teamA = groupATeams[rankA - 1];
          const teamB = groupBTeams[rankB - 1];
          
          if (teamA && teamB) {
            const seed1: PlayoffSeed = { 
              teamId: teamA.team.id, 
              seed: seedIndex + 1, 
              groupId: groupAId, 
              groupRank: rankA, 
              standing: teamA 
            };
            const seed2: PlayoffSeed = { 
              teamId: teamB.team.id, 
              seed: seedIndex + 2, 
              groupId: groupBId, 
              groupRank: rankB, 
              standing: teamB 
            };
            seeds.push(seed1, seed2);
            
            pairings.push({
              matchIndex: pairings.length,
              bracketSide: 'left',
              team1: seed1,
              team2: seed2,
            });
            seedIndex += 2;
          }
        }
        
        // Right branch pairings (1B side)
        for (let i = 0; i < teamsPerGroup / 2; i++) {
          const rankB = i + 1; // 1, 2, 3... from Group B
          const rankA = teamsPerGroup - i; // 2, 1 from Group A (reversed for seeding)
          
          const teamB = groupBTeams[rankB - 1];
          const teamA = groupATeams[rankA - 1];
          
          if (teamA && teamB) {
            const seed1: PlayoffSeed = { 
              teamId: teamB.team.id, 
              seed: seedIndex + 1, 
              groupId: groupBId, 
              groupRank: rankB, 
              standing: teamB 
            };
            const seed2: PlayoffSeed = { 
              teamId: teamA.team.id, 
              seed: seedIndex + 2, 
              groupId: groupAId, 
              groupRank: rankA, 
              standing: teamA 
            };
            seeds.push(seed1, seed2);
            
            pairings.push({
              matchIndex: pairings.length,
              bracketSide: 'right',
              team1: seed1,
              team2: seed2,
            });
            seedIndex += 2;
          }
        }
      }

      return { seeds, pairings };
    };
  }, [qualifyingTeams, groups, standingsByGroup]);

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
    generatePlayoffSeeding,
    isLoading: isLoadingMatches || isLoadingTeams || isLoadingGroups,
    roundRobinComplete,
    hasPlayoff,
    hasGroups,
    groups,
  };
}