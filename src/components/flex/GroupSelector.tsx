import { useState } from 'react';
import { useI18n } from '@/i18n';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Grid3X3, User, Users, Trash2, X, RefreshCw } from 'lucide-react';
import { useDroppable } from '@dnd-kit/core';
import { MatchBlock } from './MatchBlock';
import type { FlexGroup, FlexGroupItem, FlexPlayer, FlexTeam, FlexPlayerStats, FlexPairStats, FlexTeamMember, FlexMatch } from '@/hooks/useFlexTournament';

interface GroupSelectorProps {
  groups: FlexGroup[];
  groupItems: FlexGroupItem[];
  players: FlexPlayer[];
  teams: FlexTeam[];
  teamMembers: FlexTeamMember[];
  playerStats: FlexPlayerStats[];
  pairStats: FlexPairStats[];
  matches: FlexMatch[];
  isCreator: boolean;
  selectedGroupId: string | null;
  onSelectGroup: (groupId: string | null) => void;
  onUpdateGroupName: (groupId: string, name: string) => void;
  onDeleteGroup: (groupId: string) => void;
  onRemoveItem: (itemId: string) => void;
  onGenerateRR: (groupId: string) => void;
  onToggleIncludeDoubles: (groupId: string, include: boolean) => void;
  onUpdateMatchName: (matchId: string, name: string) => void;
  onDeleteMatch: (matchId: string) => void;
  onUpdateMatchScore: (matchId: string, scoreA: number, scoreB: number) => void;
  onClearMatchSlot: (matchId: string, slot: 'a1' | 'a2' | 'b1' | 'b2' | 'a_team' | 'b_team') => void;
  onToggleMatchCountsForStandings: (matchId: string, counts: boolean) => void;
  onAddChildMatch?: (parentMatchId: string) => void;
  onUpdateChildMatchScore?: (matchId: string, scoreA: number, scoreB: number) => void;
  onClearChildMatchSlot?: (matchId: string, slot: 'a1' | 'a2' | 'b1' | 'b2') => void;
  onSelectChildMatchPlayer?: (matchId: string, slot: 'a1' | 'a2' | 'b1' | 'b2', playerId: string) => void;
  onDeleteChildMatch?: (matchId: string) => void;
  getChildMatches?: (parentMatchId: string) => FlexMatch[];
}

const surfaceCardStyle: React.CSSProperties = {
  background: 'var(--tl-bg-elev)',
  border: '1px solid var(--tl-border)',
  borderRadius: 'var(--tl-radius-lg)',
};

// shadcn TabsList override (! prefix to beat 'rounded-md bg-muted p-1' base)
const tlTabsListClass =
  'flex w-full !h-auto !p-0 !bg-transparent !border-b !border-[var(--tl-border)] !rounded-none gap-2';

// shadcn TabsTrigger override (! prefix to beat 'rounded-sm data-[state=active]:bg-background data-[state=active]:shadow-sm' base)
const tlTabsTriggerClass = [
  'flex-1 inline-flex items-center justify-center gap-1.5',
  '!px-3 !py-2',
  '!text-[11px] !font-medium tracking-[0.06em] uppercase',
  'font-[family-name:Geist_Mono,ui-monospace,monospace]',
  '!text-[var(--tl-fg-3)] !bg-transparent !rounded-none !shadow-none',
  'border-b-2 border-transparent',
  'data-[state=active]:!text-[var(--tl-fg)]',
  'data-[state=active]:!border-[var(--tl-green)]',
  'data-[state=active]:!bg-transparent data-[state=active]:!shadow-none',
  'transition-colors',
  'hover:!text-[var(--tl-fg-2)]',
].join(' ');

const tableHeadStyle: React.CSSProperties = {
  fontFamily: 'Geist Mono, ui-monospace, monospace',
  fontSize: 10.5,
  fontWeight: 500,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'var(--tl-fg-3)',
  padding: '8px 8px',
  textAlign: 'left',
  borderBottom: '1px solid var(--tl-border)',
  whiteSpace: 'nowrap',
};

const tableCellStyle: React.CSSProperties = {
  padding: '10px 8px',
  fontSize: 12.5,
  color: 'var(--tl-fg)',
  borderBottom: '1px solid var(--tl-border)',
  fontVariantNumeric: 'tabular-nums',
};

const onRowEnter = (e: React.MouseEvent<HTMLTableRowElement>) => {
  (e.currentTarget as HTMLElement).style.background = 'var(--tl-bg)';
};
const onRowLeave = (e: React.MouseEvent<HTMLTableRowElement>) => {
  (e.currentTarget as HTMLElement).style.background = 'transparent';
};

const onXEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
  (e.currentTarget as HTMLElement).style.background = 'rgba(255, 65, 54, 0.10)';
  (e.currentTarget as HTMLElement).style.color = 'var(--tl-live)';
};
const onXLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
  (e.currentTarget as HTMLElement).style.background = 'transparent';
  (e.currentTarget as HTMLElement).style.color = 'var(--tl-fg-3)';
};

const pointDiffColor = (diff: number) =>
  diff > 0 ? 'var(--tl-green)' : diff < 0 ? 'var(--tl-live)' : 'var(--tl-fg-2)';

export function GroupSelector({
  groups,
  groupItems,
  players,
  teams,
  teamMembers,
  playerStats,
  pairStats,
  matches,
  isCreator,
  selectedGroupId,
  onSelectGroup,
  onDeleteGroup,
  onRemoveItem,
  onGenerateRR,
  onToggleIncludeDoubles,
  onUpdateMatchName,
  onDeleteMatch,
  onUpdateMatchScore,
  onClearMatchSlot,
  onToggleMatchCountsForStandings,
  onAddChildMatch,
  onUpdateChildMatchScore,
  onClearChildMatchSlot,
  onSelectChildMatchPlayer,
  onDeleteChildMatch,
  getChildMatches,
}: GroupSelectorProps) {
  const { t } = useI18n();
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'singles' | 'doubles' | 'teams' | 'individuals'>('singles');

  const selectedGroup = groups.find(g => g.id === selectedGroupId);
  const selectedGroupItems = groupItems.filter(gi => gi.group_id === selectedGroupId);
  const selectedGroupMatches = matches.filter(m => m.group_id === selectedGroupId);

  const groupType = selectedGroupItems.length > 0
    ? selectedGroupItems[0].item_type === 'team' ? 'team' : 'player'
    : null;

  const teamsInGroup = selectedGroupItems
    .filter(item => item.item_type === 'team')
    .map(item => teams.find(t => t.id === item.team_id))
    .filter(Boolean) as FlexTeam[];

  if (teamsInGroup.length > 0 && selectedTeamIds.length === 0) {
    setSelectedTeamIds(teamsInGroup.map(t => t.id));
  }

  const { isOver, setNodeRef } = useDroppable({
    id: selectedGroupId ? `group-drop-${selectedGroupId}` : 'no-group',
    data: { type: 'group', groupId: selectedGroupId },
    disabled: !selectedGroupId,
  });

  const getSinglesStats = (playerId: string) => {
    const stats = playerStats.find(s => s.player_id === playerId && s.group_id === selectedGroupId);
    return stats || { wins: 0, losses: 0, point_diff: 0 };
  };

  const sortedSinglesItems = [...selectedGroupItems]
    .filter(item => item.item_type === 'player')
    .sort((a, b) => {
      const statsA = getSinglesStats(a.player_id!);
      const statsB = getSinglesStats(b.player_id!);
      if (statsB.wins !== statsA.wins) return statsB.wins - statsA.wins;
      return statsB.point_diff - statsA.point_diff;
    });

  const sortedPairStats = [...pairStats]
    .filter(ps => ps.group_id === selectedGroupId)
    .sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      return b.point_diff - a.point_diff;
    });

  const getPairName = (player1Id: string, player2Id: string) => {
    const p1 = players.find(p => p.id === player1Id)?.name || 'Unknown';
    const p2 = players.find(p => p.id === player2Id)?.name || 'Unknown';
    return `${p1} / ${p2}`;
  };

  const getTeamStats = (teamId: string) => {
    let wins = 0, losses = 0, pointDiff = 0;
    for (const match of matches) {
      if (!match.slot_a_team_id && !match.slot_b_team_id) continue;
      if (!match.counts_for_standings) continue;
      if (!match.winner_side) continue;
      const scoreDiff = Math.abs(match.score_a - match.score_b);
      if (match.slot_a_team_id === teamId) {
        if (match.winner_side === 'a') { wins += 1; pointDiff += scoreDiff; }
        else { losses += 1; pointDiff -= scoreDiff; }
      } else if (match.slot_b_team_id === teamId) {
        if (match.winner_side === 'b') { wins += 1; pointDiff += scoreDiff; }
        else { losses += 1; pointDiff -= scoreDiff; }
      }
    }
    return { wins, losses, point_diff: pointDiff };
  };

  const sortedTeams = [...teamsInGroup].sort((a, b) => {
    const statsA = getTeamStats(a.id);
    const statsB = getTeamStats(b.id);
    if (statsB.wins !== statsA.wins) return statsB.wins - statsA.wins;
    return statsB.point_diff - statsA.point_diff;
  });

  const playersFromSelectedTeams = (() => {
    if (selectedTeamIds.length === 0) return [];
    const playerIds = new Set<string>();
    selectedTeamIds.forEach(teamId => {
      teamMembers.filter(m => m.team_id === teamId).forEach(m => playerIds.add(m.player_id));
    });
    return players.filter(p => playerIds.has(p.id));
  })();

  const sortedPlayersFromTeams = [...playersFromSelectedTeams].sort((a, b) => {
    const statsA = getSinglesStats(a.id);
    const statsB = getSinglesStats(b.id);
    if (statsB.wins !== statsA.wins) return statsB.wins - statsA.wins;
    return statsB.point_diff - statsA.point_diff;
  });

  const getPlayerTeamName = (playerId: string) => {
    const member = teamMembers.find(m => m.player_id === playerId);
    if (!member) return '';
    return teams.find(t => t.id === member.team_id)?.name || '';
  };

  const handleTeamToggle = (teamId: string) => {
    setSelectedTeamIds(prev =>
      prev.includes(teamId) ? prev.filter(id => id !== teamId) : [...prev, teamId],
    );
  };

  const handleSelectAllTeams = () => {
    setSelectedTeamIds(prev =>
      prev.length === teamsInGroup.length ? [] : teamsInGroup.map(t => t.id),
    );
  };

  const getItemName = (item: FlexGroupItem) => {
    if (item.item_type === 'player') {
      return players.find(p => p.id === item.player_id)?.name || 'Unknown';
    }
    return teams.find(t => t.id === item.team_id)?.name || 'Unknown';
  };

  if (groups.length === 0) {
    return (
      <div className="tl-empty-card">
        <span className="tl-empty-card-mark">◌</span>
        <span className="tl-empty-card-label">{t.tools.flexTournament.noGroups}</span>
      </div>
    );
  }

  const getGroupType = (groupId: string): 'team' | 'player' | null => {
    const items = groupItems.filter(gi => gi.group_id === groupId);
    if (items.length === 0) return null;
    return items[0].item_type === 'team' ? 'team' : 'player';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* Group selector pills — token-styled, NOT shadcn Button */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {groups.map(group => {
          const itemCount = groupItems.filter(gi => gi.group_id === group.id).length;
          const matchCount = matches.filter(m => m.group_id === group.id).length;
          const type = getGroupType(group.id);
          const GroupIcon = type === 'team' ? Users : User;
          const isSelected = selectedGroupId === group.id;
          return (
            <button
              key={group.id}
              type="button"
              onClick={() => {
                onSelectGroup(group.id);
                setSelectedTeamIds([]);
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 12px',
                borderRadius: 999,
                background: isSelected ? 'var(--tl-green)' : 'transparent',
                border: `1px solid ${isSelected ? 'var(--tl-green)' : 'var(--tl-border)'}`,
                color: isSelected ? 'var(--tl-bg)' : 'var(--tl-fg-2)',
                font: 'inherit',
                fontSize: 12.5,
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'background 0.15s, border-color 0.15s, color 0.15s',
              }}
              onMouseEnter={(e) => {
                if (!isSelected) {
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--tl-border-2)';
                  (e.currentTarget as HTMLElement).style.color = 'var(--tl-fg)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected) {
                  (e.currentTarget as HTMLElement).style.borderColor = 'var(--tl-border)';
                  (e.currentTarget as HTMLElement).style.color = 'var(--tl-fg-2)';
                }
              }}
            >
              {type ? <GroupIcon className="w-3.5 h-3.5" /> : <Grid3X3 className="w-3.5 h-3.5" />}
              {group.name}
              <span
                style={{
                  fontFamily: 'Geist Mono, ui-monospace, monospace',
                  fontSize: 10.5,
                  fontWeight: 500,
                  padding: '1px 6px',
                  borderRadius: 4,
                  background: isSelected ? 'rgba(0,0,0,0.20)' : 'var(--tl-surface)',
                  color: isSelected ? 'var(--tl-bg)' : 'var(--tl-fg-3)',
                  letterSpacing: '0.04em',
                  fontVariantNumeric: 'tabular-nums',
                  marginLeft: 2,
                }}
              >
                {itemCount}/{matchCount}
              </span>
            </button>
          );
        })}
      </div>

      {/* Selected group content */}
      {selectedGroup && (
        <div
          ref={setNodeRef}
          style={{
            ...surfaceCardStyle,
            borderColor: isOver ? 'var(--tl-green)' : 'var(--tl-border)',
            boxShadow: isOver ? '0 0 0 4px var(--tl-green-glow)' : 'none',
            background: isOver ? 'var(--tl-green-glow)' : 'var(--tl-bg-elev)',
            transition: 'border-color 0.15s, box-shadow 0.15s, background 0.15s',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              padding: '10px 12px',
              borderBottom: '1px solid var(--tl-border)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
              <Grid3X3 className="w-4 h-4" style={{ color: 'var(--tl-fg-3)', flexShrink: 0 }} />
              <h4
                style={{
                  fontFamily: 'Instrument Serif, serif',
                  fontStyle: 'italic',
                  fontWeight: 400,
                  fontSize: 18,
                  letterSpacing: '-0.015em',
                  color: 'var(--tl-fg)',
                  margin: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {selectedGroup.name}
              </h4>
              <span
                style={{
                  fontFamily: 'Geist Mono, ui-monospace, monospace',
                  fontSize: 10.5,
                  fontWeight: 500,
                  padding: '2px 7px',
                  borderRadius: 999,
                  background: 'var(--tl-surface)',
                  border: '1px solid var(--tl-border)',
                  color: 'var(--tl-fg-3)',
                  flexShrink: 0,
                  letterSpacing: '0.04em',
                }}
              >
                {selectedGroupItems.length} {groupType === 'team' ? t.tools.flexTournament.tabTeams.toLowerCase() : 'VĐV'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              {isCreator && (
                <>
                  {selectedGroupItems.length >= 2 && groupType === 'player' && (
                    <button
                      type="button"
                      className="tl-btn"
                      onClick={() => onGenerateRR(selectedGroup.id)}
                      style={{ padding: '5px 10px', fontSize: 11.5, fontFamily: 'Geist Mono, ui-monospace, monospace', letterSpacing: '0.04em' }}
                    >
                      <RefreshCw className="w-3 h-3" />
                      RR
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onDeleteGroup(selectedGroup.id)}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255, 65, 54, 0.10)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                    style={{
                      background: 'transparent',
                      border: 0,
                      color: 'var(--tl-live)',
                      cursor: 'pointer',
                      padding: 4,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 4,
                      transition: 'background 0.15s',
                    }}
                    aria-label="Delete group"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Body */}
          <div style={{ padding: 12 }}>
            {selectedGroupItems.length === 0 ? (
              <p
                style={{
                  fontFamily: 'Geist Mono, ui-monospace, monospace',
                  fontSize: 11,
                  color: 'var(--tl-fg-3)',
                  textAlign: 'center',
                  padding: '14px 0',
                  border: '1px dashed var(--tl-border)',
                  borderRadius: 'var(--tl-radius)',
                  margin: 0,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                }}
              >
                {t.tools.flexTournament.dropPlayerHere}
              </p>
            ) : groupType === 'team' ? (
              // Team-based group
              <Tabs
                value={activeTab === 'singles' || activeTab === 'doubles' ? 'teams' : activeTab}
                onValueChange={(v) => setActiveTab(v as 'teams' | 'individuals')}
              >
                <TabsList className={tlTabsListClass}>
                  <TabsTrigger value="teams" className={tlTabsTriggerClass}>
                    <Users className="w-3 h-3" />
                    {t.tools.flexTournament.groupTabTeams}
                  </TabsTrigger>
                  <TabsTrigger value="individuals" className={tlTabsTriggerClass}>
                    <User className="w-3 h-3" />
                    {t.tools.flexTournament.groupTabIndividuals}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="teams" className="mt-3">
                  <StandingsTable
                    items={sortedTeams.map((team, idx) => {
                      const stats = getTeamStats(team.id);
                      const item = selectedGroupItems.find(i => i.team_id === team.id);
                      return {
                        rank: idx + 1,
                        name: team.name,
                        wins: stats.wins,
                        losses: stats.losses,
                        pointDiff: stats.point_diff,
                        itemId: item?.id,
                      };
                    })}
                    isCreator={isCreator}
                    onRemoveItem={onRemoveItem}
                  />
                </TabsContent>

                <TabsContent value="individuals" className="mt-3">
                  {/* Team filter */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Checkbox
                        id="all-teams-selector"
                        checked={selectedTeamIds.length === teamsInGroup.length}
                        onCheckedChange={handleSelectAllTeams}
                      />
                      <label htmlFor="all-teams-selector" style={{ fontSize: 12, cursor: 'pointer', fontWeight: 500, color: 'var(--tl-fg)' }}>
                        {t.tools.flexTournament.allTeams}
                      </label>
                    </div>
                    <span style={{ color: 'var(--tl-fg-4)' }}>|</span>
                    {teamsInGroup.map(team => (
                      <div key={team.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <Checkbox
                          id={`team-filter-${team.id}`}
                          checked={selectedTeamIds.includes(team.id)}
                          onCheckedChange={() => handleTeamToggle(team.id)}
                        />
                        <label htmlFor={`team-filter-${team.id}`} style={{ fontSize: 12, cursor: 'pointer', color: 'var(--tl-fg-2)' }}>
                          {team.name}
                        </label>
                      </div>
                    ))}
                  </div>

                  {sortedPlayersFromTeams.length === 0 ? (
                    <p
                      style={{
                        fontFamily: 'Geist Mono, ui-monospace, monospace',
                        fontSize: 11,
                        color: 'var(--tl-fg-3)',
                        textAlign: 'center',
                        padding: '16px 0',
                        margin: 0,
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase',
                      }}
                    >
                      {t.tools.flexTournament.selectTeamsToShow}
                    </p>
                  ) : (
                    <StandingsTable
                      items={sortedPlayersFromTeams.map((player, idx) => {
                        const stats = getSinglesStats(player.id);
                        return {
                          rank: idx + 1,
                          name: player.name,
                          subtitle: getPlayerTeamName(player.id),
                          wins: stats.wins,
                          losses: stats.losses,
                          pointDiff: stats.point_diff,
                        };
                      })}
                      isCreator={false}
                    />
                  )}
                </TabsContent>
              </Tabs>
            ) : (
              // Player-based group
              <Tabs
                value={activeTab === 'teams' || activeTab === 'individuals' ? 'singles' : activeTab}
                onValueChange={(v) => setActiveTab(v as 'singles' | 'doubles')}
              >
                <TabsList className={tlTabsListClass}>
                  <TabsTrigger value="singles" className={tlTabsTriggerClass}>
                    <User className="w-3 h-3" />
                    {t.tools.flexTournament.matchType.singles}
                  </TabsTrigger>
                  <TabsTrigger value="doubles" className={tlTabsTriggerClass}>
                    <Users className="w-3 h-3" />
                    {t.tools.flexTournament.matchType.doubles}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="singles" className="mt-3">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <Checkbox
                      id={`include-doubles-${selectedGroup.id}`}
                      checked={selectedGroup.include_doubles_in_singles ?? true}
                      onCheckedChange={(checked) => onToggleIncludeDoubles(selectedGroup.id, !!checked)}
                      disabled={!isCreator}
                    />
                    <label
                      htmlFor={`include-doubles-${selectedGroup.id}`}
                      style={{ fontSize: 12, color: 'var(--tl-fg-3)', cursor: 'pointer' }}
                    >
                      {t.tools.flexTournament.includeDoublesInSingles}
                    </label>
                  </div>

                  <StandingsTable
                    items={sortedSinglesItems.map((item, idx) => {
                      const stats = getSinglesStats(item.player_id!);
                      return {
                        rank: idx + 1,
                        name: getItemName(item),
                        wins: stats.wins,
                        losses: stats.losses,
                        pointDiff: stats.point_diff,
                        itemId: item.id,
                      };
                    })}
                    isCreator={isCreator}
                    onRemoveItem={onRemoveItem}
                  />
                </TabsContent>

                <TabsContent value="doubles" className="mt-3">
                  {sortedPairStats.length === 0 ? (
                    <p
                      style={{
                        fontFamily: 'Geist Mono, ui-monospace, monospace',
                        fontSize: 11,
                        color: 'var(--tl-fg-3)',
                        textAlign: 'center',
                        padding: '16px 0',
                        margin: 0,
                        letterSpacing: '0.04em',
                        textTransform: 'uppercase',
                      }}
                    >
                      {t.tools.flexTournament.noPairStats}
                    </p>
                  ) : (
                    <StandingsTable
                      items={sortedPairStats.map((ps, idx) => ({
                        rank: idx + 1,
                        name: getPairName(ps.player1_id, ps.player2_id),
                        wins: ps.wins,
                        losses: ps.losses,
                        pointDiff: ps.point_diff,
                      }))}
                      isCreator={false}
                    />
                  )}
                </TabsContent>
              </Tabs>
            )}

            {/* Group matches inline */}
            {selectedGroupMatches.length > 0 && (
              <div
                style={{
                  marginTop: 14,
                  paddingTop: 14,
                  borderTop: '1px solid var(--tl-border)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                {selectedGroupMatches.filter(m => !m.parent_match_id).map(match => (
                  <MatchBlock
                    key={match.id}
                    match={match}
                    players={players}
                    teams={teams}
                    teamMembers={teamMembers}
                    groups={groups}
                    isCreator={isCreator}
                    hasGroups={groups.length > 0}
                    isTeamMatch={groupType === 'team'}
                    childMatches={getChildMatches?.(match.id) || []}
                    onUpdateName={(name) => onUpdateMatchName(match.id, name)}
                    onDelete={() => onDeleteMatch(match.id)}
                    onUpdateScore={(scoreA, scoreB) => onUpdateMatchScore(match.id, scoreA, scoreB)}
                    onClearSlot={(slot) => onClearMatchSlot(match.id, slot)}
                    onToggleCountsForStandings={(counts) => onToggleMatchCountsForStandings(match.id, counts)}
                    onAddChildMatch={onAddChildMatch ? () => onAddChildMatch(match.id) : undefined}
                    onUpdateChildMatchScore={onUpdateChildMatchScore}
                    onClearChildMatchSlot={onClearChildMatchSlot}
                    onSelectChildMatchPlayer={onSelectChildMatchPlayer}
                    onDeleteChildMatch={onDeleteChildMatch}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Reusable token-driven standings table (native HTML <table>)
interface StandingsTableProps {
  items: {
    rank: number;
    name: string;
    subtitle?: string;
    wins: number;
    losses: number;
    pointDiff: number;
    itemId?: string;
  }[];
  isCreator: boolean;
  onRemoveItem?: (itemId: string) => void;
}

function StandingsTable({ items, isCreator, onRemoveItem }: StandingsTableProps) {
  const { t } = useI18n();

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={{ ...tableHeadStyle, width: 28, textAlign: 'center' }}>#</th>
            <th style={tableHeadStyle}>{t.tools.flexTournament.stats.name}</th>
            <th style={{ ...tableHeadStyle, width: 36, textAlign: 'center' }}>{t.tools.flexTournament.stats.wins}</th>
            <th style={{ ...tableHeadStyle, width: 36, textAlign: 'center' }}>{t.tools.flexTournament.stats.losses}</th>
            <th style={{ ...tableHeadStyle, width: 44, textAlign: 'center' }}>{t.tools.flexTournament.stats.pointDiff}</th>
            {isCreator && onRemoveItem && <th style={{ ...tableHeadStyle, width: 28 }}></th>}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.name + item.rank} onMouseEnter={onRowEnter} onMouseLeave={onRowLeave}>
              <td style={{ ...tableCellStyle, textAlign: 'center', fontWeight: 600, color: 'var(--tl-fg-2)' }}>{item.rank}</td>
              <td style={tableCellStyle}>
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140, fontWeight: 500 }}>
                  {item.name}
                </div>
                {item.subtitle && (
                  <div
                    style={{
                      fontSize: 10,
                      color: 'var(--tl-fg-3)',
                      fontFamily: 'Geist Mono, ui-monospace, monospace',
                      letterSpacing: '0.02em',
                      marginTop: 2,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      maxWidth: 140,
                    }}
                  >
                    {item.subtitle}
                  </div>
                )}
              </td>
              <td style={{ ...tableCellStyle, textAlign: 'center' }}>{item.wins}</td>
              <td style={{ ...tableCellStyle, textAlign: 'center' }}>{item.losses}</td>
              <td style={{ ...tableCellStyle, textAlign: 'center', color: pointDiffColor(item.pointDiff), fontWeight: 600 }}>
                {item.pointDiff > 0 ? `+${item.pointDiff}` : item.pointDiff}
              </td>
              {isCreator && onRemoveItem && item.itemId && (
                <td style={{ ...tableCellStyle, textAlign: 'center' }}>
                  <button
                    type="button"
                    onClick={() => onRemoveItem(item.itemId!)}
                    onMouseEnter={onXEnter}
                    onMouseLeave={onXLeave}
                    style={{
                      background: 'transparent',
                      border: 0,
                      color: 'var(--tl-fg-3)',
                      cursor: 'pointer',
                      padding: 4,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 4,
                      transition: 'background 0.15s, color 0.15s',
                    }}
                    aria-label="Remove item"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
