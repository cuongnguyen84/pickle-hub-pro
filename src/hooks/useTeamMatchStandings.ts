import { useMemo } from 'react';
import { useTeamMatchMatches, TeamMatchMatch } from './useTeamMatchMatches';
import { useTeamMatchTeams, TeamMatchTeam } from './useTeamMatchTeams';

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
}

export function useTeamMatchStandings(tournamentId: string | undefined) {
  const { data: matches, isLoading: isLoadingMatches } = useTeamMatchMatches(tournamentId);
  const { data: teams, isLoading: isLoadingTeams } = useTeamMatchTeams(tournamentId);

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

  return {
    standings,
    isLoading: isLoadingMatches || isLoadingTeams,
    roundRobinComplete,
    hasPlayoff,
  };
}