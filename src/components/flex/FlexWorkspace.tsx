import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, closestCenter } from '@dnd-kit/core';
import { useState, useCallback } from 'react';
import { useI18n } from '@/i18n';
import { PlayerPool } from './PlayerPool';
import { ActionButtons } from './ActionButtons';
import { TeamBlock } from './TeamBlock';
import { GroupBlock } from './GroupBlock';
import { MatchBlock } from './MatchBlock';
import { DraggablePlayer } from './DraggablePlayer';
import { useFlexTournament, type FlexTournamentData } from '@/hooks/useFlexTournament';
import { useFlexStats } from '@/hooks/useFlexStats';
import { useToast } from '@/hooks/use-toast';

interface FlexWorkspaceProps {
  data: FlexTournamentData;
  isCreator: boolean;
  onRefresh: () => void;
}

export function FlexWorkspace({ data, isCreator, onRefresh }: FlexWorkspaceProps) {
  const { t } = useI18n();
  const { toast } = useToast();
  const {
    addPlayer,
    addTeam,
    addPlayerToTeam,
    removePlayerFromTeam,
    addGroup,
    addItemToGroup,
    removeItemFromGroup,
    addMatch,
    updateMatchSlots,
    updateMatchScore,
    deleteEntity,
    updateEntityName,
    generateRoundRobinMatches,
  } = useFlexTournament();
  const { recomputeGroupStats } = useFlexStats();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeName, setActiveName] = useState<string>('');
  const [activeType, setActiveType] = useState<'player' | 'team'>('player');

  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    setActiveId(active.id as string);
    setActiveName(active.data.current?.name || '');
    setActiveType(active.data.current?.type || 'player');
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    if (!over || !active.data.current) return;

    const sourceData = active.data.current;
    const targetId = over.id as string;

    // Handle drop on team
    if (targetId.startsWith('team-drop-')) {
      const teamId = targetId.replace('team-drop-', '');
      if (sourceData.type === 'player') {
        await addPlayerToTeam(teamId, sourceData.id);
        onRefresh();
      }
      return;
    }

    // Handle drop on group
    if (targetId.startsWith('group-drop-')) {
      const groupId = targetId.replace('group-drop-', '');
      await addItemToGroup(groupId, sourceData.type, sourceData.id, data.groupItems.length);
      onRefresh();
      return;
    }

    // Handle drop on match slot
    if (targetId.startsWith('match-')) {
      const parts = targetId.split('-');
      const matchId = parts[1];
      const slot = parts[3]; // a1, a2, b1, b2

      const updates: any = {};
      
      if (sourceData.type === 'player') {
        if (slot === 'a1') updates.slot_a1_player_id = sourceData.id;
        else if (slot === 'a2') updates.slot_a2_player_id = sourceData.id;
        else if (slot === 'b1') updates.slot_b1_player_id = sourceData.id;
        else if (slot === 'b2') updates.slot_b2_player_id = sourceData.id;
      } else if (sourceData.type === 'team') {
        if (slot === 'a1') updates.slot_a_team_id = sourceData.id;
        else if (slot === 'b1') updates.slot_b_team_id = sourceData.id;
      }

      if (Object.keys(updates).length > 0) {
        await updateMatchSlots(matchId, updates);
        onRefresh();
      }
      return;
    }
  };

  // Action handlers
  const handleAddPlayer = useCallback(async (name: string) => {
    await addPlayer(data.tournament.id, name, data.players.length);
    onRefresh();
  }, [data.tournament.id, data.players.length, addPlayer, onRefresh]);

  const handleAddTeam = useCallback(async (name: string) => {
    await addTeam(data.tournament.id, name, data.teams.length);
    onRefresh();
  }, [data.tournament.id, data.teams.length, addTeam, onRefresh]);

  const handleAddGroup = useCallback(async (name: string) => {
    await addGroup(data.tournament.id, name, data.groups.length);
    onRefresh();
  }, [data.tournament.id, data.groups.length, addGroup, onRefresh]);

  const handleAddMatch = useCallback(async (name: string, matchType: 'singles' | 'doubles') => {
    await addMatch(data.tournament.id, name, matchType, null, data.matches.length);
    onRefresh();
  }, [data.tournament.id, data.matches.length, addMatch, onRefresh]);

  const handleDeleteTeam = useCallback(async (teamId: string) => {
    await deleteEntity('flex_teams', teamId);
    onRefresh();
  }, [deleteEntity, onRefresh]);

  const handleDeleteGroup = useCallback(async (groupId: string) => {
    await deleteEntity('flex_groups', groupId);
    onRefresh();
  }, [deleteEntity, onRefresh]);

  const handleDeleteMatch = useCallback(async (matchId: string) => {
    await deleteEntity('flex_matches', matchId);
    onRefresh();
  }, [deleteEntity, onRefresh]);

  const handleUpdateTeamName = useCallback(async (teamId: string, name: string) => {
    await updateEntityName('flex_teams', teamId, name);
    onRefresh();
  }, [updateEntityName, onRefresh]);

  const handleUpdateGroupName = useCallback(async (groupId: string, name: string) => {
    await updateEntityName('flex_groups', groupId, name);
    onRefresh();
  }, [updateEntityName, onRefresh]);

  const handleUpdateMatchName = useCallback(async (matchId: string, name: string) => {
    await updateEntityName('flex_matches', matchId, name);
    onRefresh();
  }, [updateEntityName, onRefresh]);

  const handleUpdateMatchScore = useCallback(async (matchId: string, scoreA: number, scoreB: number) => {
    await updateMatchScore(matchId, scoreA, scoreB);
    
    // Find match and recompute group stats if in a group
    const match = data.matches.find(m => m.id === matchId);
    if (match?.group_id) {
      await recomputeGroupStats(match.group_id);
    }
    
    onRefresh();
  }, [updateMatchScore, data.matches, recomputeGroupStats, onRefresh]);

  const handleClearSlot = useCallback(async (matchId: string, slot: 'a1' | 'a2' | 'b1' | 'b2' | 'a_team' | 'b_team') => {
    const updates: any = {};
    if (slot === 'a1') updates.slot_a1_player_id = null;
    else if (slot === 'a2') updates.slot_a2_player_id = null;
    else if (slot === 'b1') updates.slot_b1_player_id = null;
    else if (slot === 'b2') updates.slot_b2_player_id = null;
    else if (slot === 'a_team') updates.slot_a_team_id = null;
    else if (slot === 'b_team') updates.slot_b_team_id = null;

    await updateMatchSlots(matchId, updates);
    onRefresh();
  }, [updateMatchSlots, onRefresh]);

  const handleGenerateRR = useCallback(async (groupId: string) => {
    const group = data.groups.find(g => g.id === groupId);
    if (!group) return;

    const items = data.groupItems
      .filter(gi => gi.group_id === groupId)
      .map(gi => {
        if (gi.item_type === 'player') {
          const player = data.players.find(p => p.id === gi.player_id);
          return { id: gi.player_id!, name: player?.name || 'Unknown', type: 'player' as const };
        } else {
          const team = data.teams.find(t => t.id === gi.team_id);
          return { id: gi.team_id!, name: team?.name || 'Unknown', type: 'team' as const };
        }
      });

    if (items.length < 2) return;

    // Determine match type based on first item
    const matchType = items[0].type === 'team' ? 'doubles' : 'singles';
    
    await generateRoundRobinMatches(data.tournament.id, groupId, items, matchType as 'singles' | 'doubles');
    toast({ title: t.tools.flexTournament.rrGenerated });
    onRefresh();
  }, [data.tournament.id, data.groups, data.groupItems, data.players, data.teams, generateRoundRobinMatches, toast, t, onRefresh]);

  // Get teams that are not in Player Pool (for dragging)
  const draggableTeams = data.teams.map(team => ({
    id: team.id,
    name: team.name,
    type: 'team' as const,
  }));

  return (
    <DndContext
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4 min-h-[calc(100vh-200px)]">
        {/* Left sidebar */}
        <div className="w-64 flex-shrink-0 space-y-4">
          <PlayerPool
            players={data.players}
            onAddPlayer={handleAddPlayer}
            isCreator={isCreator}
          />
          
          {/* Team chips for dragging */}
          {draggableTeams.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-medium text-muted-foreground">
                {t.tools.flexTournament.noTeams.replace('Chưa có', '')}
              </div>
              {draggableTeams.map(team => (
                <DraggablePlayer
                  key={team.id}
                  id={team.id}
                  name={team.name}
                  type="team"
                  disabled={!isCreator}
                />
              ))}
            </div>
          )}

          {isCreator && (
            <ActionButtons
              onAddTeam={handleAddTeam}
              onAddGroup={handleAddGroup}
              onAddMatch={handleAddMatch}
            />
          )}
        </div>

        {/* Main workspace */}
        <div className="flex-1 space-y-4">
          {/* Teams row */}
          {data.teams.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.teams.map(team => (
                <TeamBlock
                  key={team.id}
                  team={team}
                  members={data.teamMembers.filter(m => m.team_id === team.id)}
                  players={data.players}
                  isCreator={isCreator}
                  onUpdateName={(name) => handleUpdateTeamName(team.id, name)}
                  onDelete={() => handleDeleteTeam(team.id)}
                  onRemoveMember={(memberId) => {
                    removePlayerFromTeam(memberId);
                    onRefresh();
                  }}
                />
              ))}
            </div>
          )}

          {/* Groups row */}
          {data.groups.length > 0 && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {data.groups.map(group => (
                <GroupBlock
                  key={group.id}
                  group={group}
                  items={data.groupItems.filter(gi => gi.group_id === group.id)}
                  players={data.players}
                  teams={data.teams}
                  playerStats={data.playerStats.filter(ps => ps.group_id === group.id)}
                  isCreator={isCreator}
                  onUpdateName={(name) => handleUpdateGroupName(group.id, name)}
                  onDelete={() => handleDeleteGroup(group.id)}
                  onRemoveItem={(itemId) => {
                    removeItemFromGroup(itemId);
                    onRefresh();
                  }}
                  onGenerateRR={() => handleGenerateRR(group.id)}
                />
              ))}
            </div>
          )}

          {/* Matches row */}
          {data.matches.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {data.matches.map(match => (
                <MatchBlock
                  key={match.id}
                  match={match}
                  players={data.players}
                  teams={data.teams}
                  isCreator={isCreator}
                  onUpdateName={(name) => handleUpdateMatchName(match.id, name)}
                  onDelete={() => handleDeleteMatch(match.id)}
                  onUpdateScore={(scoreA, scoreB) => handleUpdateMatchScore(match.id, scoreA, scoreB)}
                  onClearSlot={(slot) => handleClearSlot(match.id, slot)}
                />
              ))}
            </div>
          )}

          {/* Empty state */}
          {data.teams.length === 0 && data.groups.length === 0 && data.matches.length === 0 && (
            <div className="flex items-center justify-center h-64 border-2 border-dashed rounded-lg">
              <p className="text-muted-foreground text-center">
                {isCreator ? (
                  <>
                    {t.tools.flexTournament.noTeams}
                    <br />
                    <span className="text-sm">{t.tools.flexTournament.subtitle}</span>
                  </>
                ) : (
                  t.tools.flexTournament.noMatches
                )}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Drag overlay */}
      <DragOverlay>
        {activeId ? (
          <DraggablePlayer
            id={activeId}
            name={activeName}
            type={activeType}
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
