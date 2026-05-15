import { useDroppable } from '@dnd-kit/core';
import { useI18n } from '@/i18n';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Grid3X3, Trash2, X, RefreshCw, User, Users } from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
import type { FlexGroup, FlexGroupItem, FlexPlayer, FlexTeam, FlexPlayerStats, FlexPairStats, FlexTeamMember, FlexMatch } from '@/hooks/useFlexTournament';

interface GroupBlockProps {
  group: FlexGroup;
  items: FlexGroupItem[];
  players: FlexPlayer[];
  teams: FlexTeam[];
  teamMembers: FlexTeamMember[];
  playerStats: FlexPlayerStats[];
  pairStats: FlexPairStats[];
  matches: FlexMatch[]; // All matches in tournament
  isCreator: boolean;
  onUpdateName: (name: string) => void;
  onDelete: () => void;
  onRemoveItem: (itemId: string) => void;
  onGenerateRR: () => void;
  onToggleIncludeDoubles: (include: boolean) => void;
}

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
  background: 'transparent',
};

const tableCellStyle: React.CSSProperties = {
  padding: '10px 8px',
  fontSize: 12.5,
  color: 'var(--tl-fg)',
  borderBottom: '1px solid var(--tl-border)',
  fontVariantNumeric: 'tabular-nums',
};

// shadcn TabsList: flatten the rounded pill bg, replace with token border-bottom + flex.
const tlTabsListClass =
  'flex w-full h-auto p-0 bg-transparent border-b border-[var(--tl-border)] rounded-none gap-2';

// shadcn TabsTrigger: kill rounded shadow pill, add green underline on active state.
// Uses data-[state=active] which shadcn TabsTrigger exposes via Radix.
const tlTabsTriggerClass = [
  'flex-1 inline-flex items-center justify-center gap-1.5',
  'px-3 pt-2 pb-2.5',
  'text-[11px] font-medium tracking-[0.06em] uppercase',
  'font-[family-name:Geist_Mono,ui-monospace,monospace]',
  'text-[var(--tl-fg-3)] bg-transparent rounded-none shadow-none border-0',
  'border-b-2 border-transparent',
  'data-[state=active]:text-[var(--tl-fg)]',
  'data-[state=active]:border-[var(--tl-green)]',
  'data-[state=active]:bg-transparent data-[state=active]:shadow-none',
  'transition-colors',
  // subtle hover for inactive
  'hover:text-[var(--tl-fg-2)]',
].join(' ');

// Body row hover — applied via inline event handlers since native <tr> + token bg.
const onRowEnter = (e: React.MouseEvent<HTMLTableRowElement>) => {
  (e.currentTarget as HTMLElement).style.background = 'var(--tl-bg)';
};
const onRowLeave = (e: React.MouseEvent<HTMLTableRowElement>) => {
  (e.currentTarget as HTMLElement).style.background = 'transparent';
};

// X delete button hover — token red on hover.
const onXEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
  (e.currentTarget as HTMLElement).style.background = 'rgba(255, 65, 54, 0.10)';
  (e.currentTarget as HTMLElement).style.color = 'var(--tl-live)';
};
const onXLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
  (e.currentTarget as HTMLElement).style.background = 'transparent';
  (e.currentTarget as HTMLElement).style.color = 'var(--tl-fg-3)';
};

export function GroupBlock({
  group,
  items,
  players,
  teams,
  teamMembers,
  playerStats,
  pairStats,
  matches,
  isCreator,
  onUpdateName,
  onDelete,
  onRemoveItem,
  onGenerateRR,
  onToggleIncludeDoubles,
}: GroupBlockProps) {
  const { t } = useI18n();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(group.name);
  const [activeTab, setActiveTab] = useState<'singles' | 'doubles' | 'teams' | 'individuals'>('singles');
  const [selectedTeamIds, setSelectedTeamIds] = useState<string[]>([]);

  const { isOver, setNodeRef } = useDroppable({
    id: `group-drop-${group.id}`,
    data: { type: 'group', groupId: group.id },
  });

  const groupType = useMemo(() => {
    if (items.length === 0) return null;
    return items[0].item_type === 'team' ? 'team' : 'player';
  }, [items]);

  const teamsInGroup = useMemo(() => {
    return items
      .filter(item => item.item_type === 'team')
      .map(item => teams.find(t => t.id === item.team_id))
      .filter(Boolean) as FlexTeam[];
  }, [items, teams]);

  useEffect(() => {
    if (teamsInGroup.length > 0 && selectedTeamIds.length === 0) {
      setSelectedTeamIds(teamsInGroup.map(t => t.id));
    }
  }, [teamsInGroup]);

  const handleSaveName = () => {
    if (editName.trim() && editName !== group.name) {
      onUpdateName(editName.trim());
    }
    setIsEditing(false);
  };

  const getItemName = (item: FlexGroupItem) => {
    if (item.item_type === 'player') {
      return players.find(p => p.id === item.player_id)?.name || 'Unknown';
    }
    return teams.find(t => t.id === item.team_id)?.name || 'Unknown';
  };

  const getSinglesStats = (playerId: string) => {
    const stats = playerStats.find(s => s.player_id === playerId && s.group_id === group.id);
    return stats || { wins: 0, losses: 0, point_diff: 0 };
  };

  const sortedSinglesItems = [...items]
    .filter(item => item.item_type === 'player')
    .sort((a, b) => {
      const statsA = getSinglesStats(a.player_id!);
      const statsB = getSinglesStats(b.player_id!);
      if (statsB.wins !== statsA.wins) return statsB.wins - statsA.wins;
      return statsB.point_diff - statsA.point_diff;
    });

  const sortedPairStats = [...pairStats]
    .filter(ps => ps.group_id === group.id)
    .sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      return b.point_diff - a.point_diff;
    });

  const getPairName = (player1Id: string, player2Id: string) => {
    const p1 = players.find(p => p.id === player1Id)?.name || 'Unknown';
    const p2 = players.find(p => p.id === player2Id)?.name || 'Unknown';
    return `${p1} / ${p2}`;
  };

  const includeDoubles = group.include_doubles_in_singles ?? true;

  const getTeamStats = (teamId: string) => {
    let wins = 0;
    let losses = 0;
    let pointDiff = 0;

    for (const match of matches) {
      if (match.group_id !== group.id) continue;
      if (!match.slot_a_team_id && !match.slot_b_team_id) continue;
      if (!match.counts_for_standings) continue;
      if (!match.winner_side) continue;

      const scoreDiff = Math.abs(match.score_a - match.score_b);

      if (match.slot_a_team_id === teamId) {
        if (match.winner_side === 'a') {
          wins += 1;
          pointDiff += scoreDiff;
        } else {
          losses += 1;
          pointDiff -= scoreDiff;
        }
      } else if (match.slot_b_team_id === teamId) {
        if (match.winner_side === 'b') {
          wins += 1;
          pointDiff += scoreDiff;
        } else {
          losses += 1;
          pointDiff -= scoreDiff;
        }
      }
    }

    return { wins, losses, point_diff: pointDiff };
  };

  const sortedTeams = useMemo(() => {
    return [...teamsInGroup].sort((a, b) => {
      const statsA = getTeamStats(a.id);
      const statsB = getTeamStats(b.id);
      if (statsB.wins !== statsA.wins) return statsB.wins - statsA.wins;
      return statsB.point_diff - statsA.point_diff;
    });
  }, [teamsInGroup, matches, group.id]);

  const playersFromSelectedTeams = useMemo(() => {
    if (selectedTeamIds.length === 0) return [];

    const playerIds = new Set<string>();
    selectedTeamIds.forEach(teamId => {
      const members = teamMembers.filter(m => m.team_id === teamId);
      members.forEach(m => playerIds.add(m.player_id));
    });

    return players.filter(p => playerIds.has(p.id));
  }, [selectedTeamIds, teamMembers, players]);

  const sortedPlayersFromTeams = useMemo(() => {
    return [...playersFromSelectedTeams].sort((a, b) => {
      const statsA = getSinglesStats(a.id);
      const statsB = getSinglesStats(b.id);
      if (statsB.wins !== statsA.wins) return statsB.wins - statsA.wins;
      return statsB.point_diff - statsA.point_diff;
    });
  }, [playersFromSelectedTeams, playerStats]);

  const getPlayerTeamName = (playerId: string) => {
    const member = teamMembers.find(m => m.player_id === playerId);
    if (!member) return '';
    const team = teams.find(t => t.id === member.team_id);
    return team?.name || '';
  };

  const handleTeamToggle = (teamId: string) => {
    setSelectedTeamIds(prev => {
      if (prev.includes(teamId)) {
        return prev.filter(id => id !== teamId);
      } else {
        return [...prev, teamId];
      }
    });
  };

  const handleSelectAllTeams = () => {
    if (selectedTeamIds.length === teamsInGroup.length) {
      setSelectedTeamIds([]);
    } else {
      setSelectedTeamIds(teamsInGroup.map(t => t.id));
    }
  };

  const pointDiffColor = (diff: number) =>
    diff > 0 ? 'var(--tl-green)' : diff < 0 ? 'var(--tl-live)' : 'var(--tl-fg-2)';

  return (
    <div
      ref={setNodeRef}
      style={{
        background: 'var(--tl-bg-elev)',
        border: `1px solid ${isOver ? 'var(--tl-green)' : 'var(--tl-border)'}`,
        borderRadius: 'var(--tl-radius-lg)',
        boxShadow: isOver ? '0 0 0 4px var(--tl-green-glow)' : 'none',
        transition: 'border-color 0.15s, box-shadow 0.15s, background 0.15s',
        ...(isOver ? { background: 'var(--tl-green-glow)' } : {}),
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
          {isEditing ? (
            <Input
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={handleSaveName}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
              className="h-7 text-sm font-semibold"
              autoFocus
            />
          ) : (
            <h4
              style={{
                fontFamily: 'Instrument Serif, serif',
                fontStyle: 'italic',
                fontWeight: 400,
                fontSize: 17,
                letterSpacing: '-0.015em',
                color: 'var(--tl-fg)',
                margin: 0,
                cursor: isCreator ? 'pointer' : 'default',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              onClick={() => isCreator && setIsEditing(true)}
            >
              {group.name}
            </h4>
          )}
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
            {items.length}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {isCreator && items.length >= 2 && groupType === 'player' && (
            <button
              type="button"
              className="tl-btn"
              onClick={onGenerateRR}
              style={{ padding: '5px 10px', fontSize: 11.5, fontFamily: 'Geist Mono, ui-monospace, monospace', letterSpacing: '0.04em' }}
            >
              <RefreshCw className="w-3 h-3" />
              RR
            </button>
          )}
          {isCreator && (
            <button
              type="button"
              onClick={onDelete}
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
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(255, 65, 54, 0.10)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'transparent';
              }}
              aria-label="Delete group"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: 12 }}>
        {items.length === 0 ? (
          <p
            style={{
              fontFamily: 'Geist Mono, ui-monospace, monospace',
              fontSize: 11,
              color: 'var(--tl-fg-3)',
              textAlign: 'center',
              padding: '10px 0',
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
          // Team-based group: Teams / Individuals tabs
          <Tabs value={activeTab === 'singles' || activeTab === 'doubles' ? 'teams' : activeTab} onValueChange={(v) => setActiveTab(v as 'teams' | 'individuals')}>
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
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ ...tableHeadStyle, width: 28, textAlign: 'center' }}>#</th>
                      <th style={tableHeadStyle}>{t.tools.flexTournament.stats.name}</th>
                      <th style={{ ...tableHeadStyle, width: 36, textAlign: 'center' }}>{t.tools.flexTournament.stats.wins}</th>
                      <th style={{ ...tableHeadStyle, width: 36, textAlign: 'center' }}>{t.tools.flexTournament.stats.losses}</th>
                      <th style={{ ...tableHeadStyle, width: 44, textAlign: 'center' }}>{t.tools.flexTournament.stats.pointDiff}</th>
                      {isCreator && <th style={{ ...tableHeadStyle, width: 28 }}></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedTeams.map((team, index) => {
                      const stats = getTeamStats(team.id);
                      const item = items.find(i => i.team_id === team.id);
                      return (
                        <tr key={team.id} onMouseEnter={onRowEnter} onMouseLeave={onRowLeave}>
                          <td style={{ ...tableCellStyle, textAlign: 'center', fontWeight: 600, color: 'var(--tl-fg-2)' }}>{index + 1}</td>
                          <td style={{ ...tableCellStyle, fontWeight: 500, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{team.name}</td>
                          <td style={{ ...tableCellStyle, textAlign: 'center' }}>{stats.wins}</td>
                          <td style={{ ...tableCellStyle, textAlign: 'center' }}>{stats.losses}</td>
                          <td style={{ ...tableCellStyle, textAlign: 'center', color: pointDiffColor(stats.point_diff), fontWeight: 600 }}>
                            {stats.point_diff > 0 ? `+${stats.point_diff}` : stats.point_diff}
                          </td>
                          {isCreator && item && (
                            <td style={{ ...tableCellStyle, textAlign: 'center' }}>
                              <button
                                type="button"
                                onClick={() => onRemoveItem(item.id)}
                                onMouseEnter={onXEnter}
                                onMouseLeave={onXLeave}
                                style={{ background: 'transparent', border: 0, color: 'var(--tl-fg-3)', cursor: 'pointer', padding: 4, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4, transition: 'background 0.15s, color 0.15s' }}
                                aria-label="Remove item"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            <TabsContent value="individuals" className="mt-3">
              {/* Team filter checkboxes */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Checkbox
                    id={`all-teams-${group.id}`}
                    checked={selectedTeamIds.length === teamsInGroup.length}
                    onCheckedChange={handleSelectAllTeams}
                  />
                  <label
                    htmlFor={`all-teams-${group.id}`}
                    style={{ fontSize: 12, cursor: 'pointer', fontWeight: 500, color: 'var(--tl-fg)' }}
                  >
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
                    <label
                      htmlFor={`team-filter-${team.id}`}
                      style={{ fontSize: 12, cursor: 'pointer', color: 'var(--tl-fg-2)' }}
                    >
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
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={{ ...tableHeadStyle, width: 28, textAlign: 'center' }}>#</th>
                        <th style={tableHeadStyle}>{t.tools.flexTournament.stats.name}</th>
                        <th style={{ ...tableHeadStyle, width: 36, textAlign: 'center' }}>{t.tools.flexTournament.stats.wins}</th>
                        <th style={{ ...tableHeadStyle, width: 36, textAlign: 'center' }}>{t.tools.flexTournament.stats.losses}</th>
                        <th style={{ ...tableHeadStyle, width: 44, textAlign: 'center' }}>{t.tools.flexTournament.stats.pointDiff}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedPlayersFromTeams.map((player, index) => {
                        const stats = getSinglesStats(player.id);
                        return (
                          <tr key={player.id} onMouseEnter={onRowEnter} onMouseLeave={onRowLeave}>
                            <td style={{ ...tableCellStyle, textAlign: 'center', fontWeight: 600, color: 'var(--tl-fg-2)' }}>{index + 1}</td>
                            <td style={tableCellStyle}>
                              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 120, fontWeight: 500 }}>{player.name}</div>
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
                                  maxWidth: 120,
                                }}
                              >
                                {getPlayerTeamName(player.id)}
                              </div>
                            </td>
                            <td style={{ ...tableCellStyle, textAlign: 'center' }}>{stats.wins}</td>
                            <td style={{ ...tableCellStyle, textAlign: 'center' }}>{stats.losses}</td>
                            <td style={{ ...tableCellStyle, textAlign: 'center', color: pointDiffColor(stats.point_diff), fontWeight: 600 }}>
                              {stats.point_diff > 0 ? `+${stats.point_diff}` : stats.point_diff}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        ) : (
          // Player-based group: Singles / Doubles tabs
          <Tabs value={activeTab === 'teams' || activeTab === 'individuals' ? 'singles' : activeTab} onValueChange={(v) => setActiveTab(v as 'singles' | 'doubles')}>
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
              {/* Include doubles checkbox */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Checkbox
                  id={`include-doubles-${group.id}`}
                  checked={includeDoubles}
                  onCheckedChange={(checked) => onToggleIncludeDoubles(!!checked)}
                  disabled={!isCreator}
                />
                <label
                  htmlFor={`include-doubles-${group.id}`}
                  style={{ fontSize: 12, color: 'var(--tl-fg-3)', cursor: 'pointer' }}
                >
                  {t.tools.flexTournament.includeDoublesInSingles}
                </label>
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      <th style={{ ...tableHeadStyle, width: 28, textAlign: 'center' }}>#</th>
                      <th style={tableHeadStyle}>{t.tools.flexTournament.stats.name}</th>
                      <th style={{ ...tableHeadStyle, width: 36, textAlign: 'center' }}>{t.tools.flexTournament.stats.wins}</th>
                      <th style={{ ...tableHeadStyle, width: 36, textAlign: 'center' }}>{t.tools.flexTournament.stats.losses}</th>
                      <th style={{ ...tableHeadStyle, width: 44, textAlign: 'center' }}>{t.tools.flexTournament.stats.pointDiff}</th>
                      {isCreator && <th style={{ ...tableHeadStyle, width: 28 }}></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedSinglesItems.map((item, index) => {
                      const stats = getSinglesStats(item.player_id!);
                      return (
                        <tr key={item.id} onMouseEnter={onRowEnter} onMouseLeave={onRowLeave}>
                          <td style={{ ...tableCellStyle, textAlign: 'center', fontWeight: 600, color: 'var(--tl-fg-2)' }}>{index + 1}</td>
                          <td style={{ ...tableCellStyle, fontWeight: 500, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{getItemName(item)}</td>
                          <td style={{ ...tableCellStyle, textAlign: 'center' }}>{stats.wins}</td>
                          <td style={{ ...tableCellStyle, textAlign: 'center' }}>{stats.losses}</td>
                          <td style={{ ...tableCellStyle, textAlign: 'center', color: pointDiffColor(stats.point_diff), fontWeight: 600 }}>
                            {stats.point_diff > 0 ? `+${stats.point_diff}` : stats.point_diff}
                          </td>
                          {isCreator && (
                            <td style={{ ...tableCellStyle, textAlign: 'center' }}>
                              <button
                                type="button"
                                onClick={() => onRemoveItem(item.id)}
                                onMouseEnter={onXEnter}
                                onMouseLeave={onXLeave}
                                style={{ background: 'transparent', border: 0, color: 'var(--tl-fg-3)', cursor: 'pointer', padding: 4, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 4, transition: 'background 0.15s, color 0.15s' }}
                                aria-label="Remove item"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
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
                  {t.tools.flexTournament.noDoublesStats}
                </p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th style={{ ...tableHeadStyle, width: 28, textAlign: 'center' }}>#</th>
                        <th style={tableHeadStyle}>{t.tools.flexTournament.stats.pair}</th>
                        <th style={{ ...tableHeadStyle, width: 36, textAlign: 'center' }}>{t.tools.flexTournament.stats.wins}</th>
                        <th style={{ ...tableHeadStyle, width: 36, textAlign: 'center' }}>{t.tools.flexTournament.stats.losses}</th>
                        <th style={{ ...tableHeadStyle, width: 44, textAlign: 'center' }}>{t.tools.flexTournament.stats.pointDiff}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedPairStats.map((pair, index) => (
                        <tr key={`${pair.player1_id}-${pair.player2_id}`} onMouseEnter={onRowEnter} onMouseLeave={onRowLeave}>
                          <td style={{ ...tableCellStyle, textAlign: 'center', fontWeight: 600, color: 'var(--tl-fg-2)' }}>{index + 1}</td>
                          <td style={{ ...tableCellStyle, fontWeight: 500, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {getPairName(pair.player1_id, pair.player2_id)}
                          </td>
                          <td style={{ ...tableCellStyle, textAlign: 'center' }}>{pair.wins}</td>
                          <td style={{ ...tableCellStyle, textAlign: 'center' }}>{pair.losses}</td>
                          <td style={{ ...tableCellStyle, textAlign: 'center', color: pointDiffColor(pair.point_diff), fontWeight: 600 }}>
                            {pair.point_diff > 0 ? `+${pair.point_diff}` : pair.point_diff}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}
