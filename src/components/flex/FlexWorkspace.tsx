import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, pointerWithin } from '@dnd-kit/core';
import { useState, useCallback } from 'react';
import { useI18n } from '@/i18n';
import { PlayerPool } from './PlayerPool';
import { FloatingPlayerPanel } from './FloatingPlayerPanel';
import { ActionButtons } from './ActionButtons';
import { TeamBlock } from './TeamBlock';
import { GroupBlock } from './GroupBlock';
import { MatchBlock } from './MatchBlock';
import { DraggablePlayer } from './DraggablePlayer';
import { useFlexTournament, type FlexTournamentData } from '@/hooks/useFlexTournament';
import { useFlexStats } from '@/hooks/useFlexStats';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

interface FlexWorkspaceProps {
  data: FlexTournamentData;
  isCreator: boolean;
  onRefresh: () => void;
}

export function FlexWorkspace({ data, isCreator, onRefresh }: FlexWorkspaceProps) {
  const { t } = useI18n();
  const { toast } = useToast();
  const isMobile = useIsMobile();
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
    updateMatchCountsForStandings,
    deleteEntity,
    updateEntityName,
    generateRoundRobinMatches,
  } = useFlexTournament();
  const { recomputeGroupStats, recomputeAllGroupStats, updateGroupIncludeDoubles } = useFlexStats();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeName, setActiveName] = useState<string>('');
  const [activeType, setActiveType] = useState<'player' | 'team'>('player');
  const [activeTab, setActiveTab] = useState<string>('matches');

  // Check if player already exists in a team
  const isPlayerInTeam = (playerId: string, teamId: string) => {
    return data.teamMembers.some(m => m.team_id === teamId && m.player_id === playerId);
  };

  // Check if player/team already exists in a group
  const isItemInGroup = (itemType: 'player' | 'team', itemId: string, groupId: string) => {
    return data.groupItems.some(gi => 
      gi.group_id === groupId && 
      ((itemType === 'player' && gi.player_id === itemId) || (itemType === 'team' && gi.team_id === itemId))
    );
  };

  // Check if player already exists in a match
  const isPlayerInMatch = (playerId: string, match: typeof data.matches[0]) => {
    return [
      match.slot_a1_player_id,
      match.slot_a2_player_id,
      match.slot_b1_player_id,
      match.slot_b2_player_id
    ].includes(playerId);
  };

  // Auto-add player/team to the single group when dropped on a match
  const autoAddToSingleGroup = async (itemType: 'player' | 'team', itemId: string) => {
    if (data.groups.length === 1) {
      const group = data.groups[0];
      if (!isItemInGroup(itemType, itemId, group.id)) {
        await addItemToGroup(group.id, itemType, itemId, data.groupItems.length);
      }
    }
  };

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
        // Check for duplicate
        if (isPlayerInTeam(sourceData.id, teamId)) {
          toast({ 
            title: "VĐV đã có trong đội này",
            variant: "destructive" 
          });
          return;
        }
        await addPlayerToTeam(teamId, sourceData.id);
        onRefresh();
      }
      return;
    }

    // Handle drop on group
    if (targetId.startsWith('group-drop-')) {
      const groupId = targetId.replace('group-drop-', '');
      // Check for duplicate
      if (isItemInGroup(sourceData.type, sourceData.id, groupId)) {
        toast({ 
          title: "VĐV đã có trong bảng này",
          variant: "destructive" 
        });
        return;
      }
      await addItemToGroup(groupId, sourceData.type, sourceData.id, data.groupItems.length);
      onRefresh();
      return;
    }

    // Handle drop on match slot
    // Format: match-{uuid}-slot-{a1|a2|b1|b2}
    if (targetId.startsWith('match-') && targetId.includes('-slot-')) {
      const slotMatch = targetId.match(/^match-(.+)-slot-(a1|a2|b1|b2)$/);
      if (!slotMatch) return;
      
      const matchId = slotMatch[1];
      const slot = slotMatch[2];

      const match = data.matches.find(m => m.id === matchId);
      if (!match) return;

      const updates: any = {};
      
      if (sourceData.type === 'player') {
        // Check for duplicate player in same match
        if (isPlayerInMatch(sourceData.id, match)) {
          toast({ 
            title: "VĐV đã có trong trận này",
            variant: "destructive" 
          });
          return;
        }

        if (slot === 'a1') updates.slot_a1_player_id = sourceData.id;
        else if (slot === 'a2') updates.slot_a2_player_id = sourceData.id;
        else if (slot === 'b1') updates.slot_b1_player_id = sourceData.id;
        else if (slot === 'b2') updates.slot_b2_player_id = sourceData.id;

        // Auto-add player to single group
        await autoAddToSingleGroup('player', sourceData.id);
      } else if (sourceData.type === 'team') {
        if (slot === 'a1') updates.slot_a_team_id = sourceData.id;
        else if (slot === 'b1') updates.slot_b_team_id = sourceData.id;

        // Auto-add team to single group
        await autoAddToSingleGroup('team', sourceData.id);
      }

      if (Object.keys(updates).length > 0) {
        await updateMatchSlots(matchId, updates);
        onRefresh();
      }
      return;
    }
  };

  // Check for duplicate player name (case-insensitive)
  const isDuplicatePlayerName = (name: string) => {
    const normalizedName = name.trim().toLowerCase();
    return data.players.some(p => p.name.toLowerCase() === normalizedName);
  };

  // Action handlers
  const handleAddPlayer = useCallback(async (name: string) => {
    // Validate duplicate
    if (isDuplicatePlayerName(name)) {
      toast({ 
        title: "Tên VĐV đã tồn tại",
        variant: "destructive" 
      });
      return;
    }
    await addPlayer(data.tournament.id, name, data.players.length);
    onRefresh();
  }, [data.tournament.id, data.players, addPlayer, onRefresh, toast, t]);

  const handleAddTeam = useCallback(async (name: string) => {
    // New items at top: display_order = -1 (or use timestamp for uniqueness)
    await addTeam(data.tournament.id, name, -Date.now());
    onRefresh();
  }, [data.tournament.id, addTeam, onRefresh]);

  const handleAddGroup = useCallback(async (name: string) => {
    await addGroup(data.tournament.id, name, -Date.now());
    onRefresh();
  }, [data.tournament.id, addGroup, onRefresh]);

  const handleAddMatch = useCallback(async (name: string, matchType: 'singles' | 'doubles') => {
    await addMatch(data.tournament.id, name, matchType, null, -Date.now());
    onRefresh();
  }, [data.tournament.id, addMatch, onRefresh]);

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
    
    // If there's only one group, recompute its stats (since players auto-added)
    if (data.groups.length === 1) {
      await recomputeGroupStats(data.groups[0].id);
    }
    
    onRefresh();
  }, [updateMatchScore, data.matches, data.groups, recomputeGroupStats, onRefresh]);

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

  const handleToggleCountsForStandings = useCallback(async (matchId: string, counts: boolean) => {
    await updateMatchCountsForStandings(matchId, counts);
    await recomputeAllGroupStats(data.tournament.id);
    onRefresh();
  }, [updateMatchCountsForStandings, recomputeAllGroupStats, data.tournament.id, onRefresh]);

  const handleToggleIncludeDoubles = useCallback(async (groupId: string, include: boolean) => {
    await updateGroupIncludeDoubles(groupId, include);
    onRefresh();
  }, [updateGroupIncludeDoubles, onRefresh]);

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

  // Sort items by display_order (negative = newer = first)
  const sortedTeams = [...data.teams].sort((a, b) => a.display_order - b.display_order);
  const sortedGroups = [...data.groups].sort((a, b) => a.display_order - b.display_order);
  const sortedMatches = [...data.matches].sort((a, b) => a.display_order - b.display_order);

  const hasContent = data.teams.length > 0 || data.groups.length > 0 || data.matches.length > 0;

  // Mobile layout: tabs for Teams/Groups/Matches
  if (isMobile) {
    return (
      <DndContext
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="space-y-4 pb-20">
          {/* Action buttons */}
          {isCreator && (
            <div className="grid grid-cols-3 gap-2">
              <ActionButtons
                onAddTeam={handleAddTeam}
                onAddGroup={handleAddGroup}
                onAddMatch={handleAddMatch}
                compact
              />
            </div>
          )}

          {/* Tabbed content */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="teams" className="text-xs">
                {t.tools.flexTournament.tabTeams} ({sortedTeams.length})
              </TabsTrigger>
              <TabsTrigger value="groups" className="text-xs">
                {t.tools.flexTournament.tabGroups} ({sortedGroups.length})
              </TabsTrigger>
              <TabsTrigger value="matches" className="text-xs">
                {t.tools.flexTournament.tabMatches} ({sortedMatches.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="teams" className="mt-3 space-y-3">
              {sortedTeams.length > 0 ? (
                sortedTeams.map(team => (
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
                ))
              ) : (
                <div className="flex items-center justify-center py-8 border-2 border-dashed rounded-lg">
                  <p className="text-muted-foreground text-center text-sm">
                    {t.tools.flexTournament.noTeams}
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="groups" className="mt-3 space-y-3">
              {sortedGroups.length > 0 ? (
                sortedGroups.map(group => (
                  <GroupBlock
                    key={group.id}
                    group={group}
                    items={data.groupItems.filter(gi => gi.group_id === group.id)}
                    players={data.players}
                    teams={data.teams}
                    playerStats={data.playerStats.filter(ps => ps.group_id === group.id)}
                    pairStats={data.pairStats.filter(ps => ps.group_id === group.id)}
                    isCreator={isCreator}
                    onUpdateName={(name) => handleUpdateGroupName(group.id, name)}
                    onDelete={() => handleDeleteGroup(group.id)}
                    onRemoveItem={(itemId) => {
                      removeItemFromGroup(itemId);
                      onRefresh();
                    }}
                    onGenerateRR={() => handleGenerateRR(group.id)}
                    onToggleIncludeDoubles={(include) => handleToggleIncludeDoubles(group.id, include)}
                  />
                ))
              ) : (
                <div className="flex items-center justify-center py-8 border-2 border-dashed rounded-lg">
                  <p className="text-muted-foreground text-center text-sm">
                    {t.tools.flexTournament.noGroups}
                  </p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="matches" className="mt-3 space-y-3">
              {sortedMatches.length > 0 ? (
                sortedMatches.map(match => (
                  <MatchBlock
                    key={match.id}
                    match={match}
                    players={data.players}
                    teams={data.teams}
                    isCreator={isCreator}
                    hasGroups={data.groups.length > 0}
                    onUpdateName={(name) => handleUpdateMatchName(match.id, name)}
                    onDelete={() => handleDeleteMatch(match.id)}
                    onUpdateScore={(scoreA, scoreB) => handleUpdateMatchScore(match.id, scoreA, scoreB)}
                    onClearSlot={(slot) => handleClearSlot(match.id, slot)}
                    onToggleCountsForStandings={(counts) => handleToggleCountsForStandings(match.id, counts)}
                  />
                ))
              ) : (
                <div className="flex items-center justify-center py-8 border-2 border-dashed rounded-lg">
                  <p className="text-muted-foreground text-center text-sm">
                    {t.tools.flexTournament.noMatches}
                  </p>
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* Empty state - only show if no content at all */}
          {!hasContent && (
            <div className="flex items-center justify-center py-8 border-2 border-dashed rounded-lg">
              <p className="text-muted-foreground text-center text-sm">
                {isCreator ? t.tools.flexTournament.subtitle : t.tools.flexTournament.noMatches}
              </p>
            </div>
          )}
        </div>

        {/* Floating Player Panel for mobile */}
        <FloatingPlayerPanel
          players={data.players}
          teams={data.teams}
          onAddPlayer={handleAddPlayer}
          isCreator={isCreator}
          isDragging={!!activeId}
        />

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

  // Desktop layout: sidebar + main
  return (
    <DndContext
      collisionDetection={pointerWithin}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="flex gap-4">
        {/* Left sidebar */}
        <div className="w-56 flex-shrink-0 space-y-4">
          <PlayerPool
            players={data.players}
            onAddPlayer={handleAddPlayer}
            isCreator={isCreator}
          />
          
          {/* Team chips for dragging */}
          {draggableTeams.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-muted-foreground px-1">
                Teams
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
          {sortedTeams.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {sortedTeams.map(team => (
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
          {sortedGroups.length > 0 && (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
              {sortedGroups.map(group => (
                <GroupBlock
                  key={group.id}
                  group={group}
                  items={data.groupItems.filter(gi => gi.group_id === group.id)}
                  players={data.players}
                  teams={data.teams}
                  playerStats={data.playerStats.filter(ps => ps.group_id === group.id)}
                  pairStats={data.pairStats.filter(ps => ps.group_id === group.id)}
                  isCreator={isCreator}
                  onUpdateName={(name) => handleUpdateGroupName(group.id, name)}
                  onDelete={() => handleDeleteGroup(group.id)}
                  onRemoveItem={(itemId) => {
                    removeItemFromGroup(itemId);
                    onRefresh();
                  }}
                  onGenerateRR={() => handleGenerateRR(group.id)}
                  onToggleIncludeDoubles={(include) => handleToggleIncludeDoubles(group.id, include)}
                />
              ))}
            </div>
          )}

          {/* Matches row */}
          {sortedMatches.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {sortedMatches.map(match => (
                <MatchBlock
                  key={match.id}
                  match={match}
                  players={data.players}
                  teams={data.teams}
                  isCreator={isCreator}
                  hasGroups={data.groups.length > 0}
                  onUpdateName={(name) => handleUpdateMatchName(match.id, name)}
                  onDelete={() => handleDeleteMatch(match.id)}
                  onUpdateScore={(scoreA, scoreB) => handleUpdateMatchScore(match.id, scoreA, scoreB)}
                  onClearSlot={(slot) => handleClearSlot(match.id, slot)}
                  onToggleCountsForStandings={(counts) => handleToggleCountsForStandings(match.id, counts)}
                />
              ))}
            </div>
          )}

          {/* Empty state */}
          {!hasContent && (
            <div className="flex items-center justify-center h-48 border-2 border-dashed rounded-lg">
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
