import { DndContext, DragEndEvent, DragOverlay, DragStartEvent, pointerWithin } from '@dnd-kit/core';
import { useState, useCallback } from 'react';
import { useI18n } from '@/i18n';
import { PlayerPool } from './PlayerPool';
import { FloatingPlayerPanel } from './FloatingPlayerPanel';
import { FloatingAddMatchButton } from './FloatingAddMatchButton';
import { ActionButtons } from './ActionButtons';
import { TeamBlock } from './TeamBlock';
import { TeamSelector } from './TeamSelector';
import { GroupBlock } from './GroupBlock';
import { GroupSelector } from './GroupSelector';
import { MatchBlock } from './MatchBlock';
import { DraggablePlayer } from './DraggablePlayer';
import { useFlexTournament, type FlexTournamentData, type FlexMatch } from '@/hooks/useFlexTournament';
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
    updateMatchGroupId,
    updateParentMatchScore,
    deleteEntity,
    updateEntityName,
    generateRoundRobinMatches,
  } = useFlexTournament();
  const { recomputeGroupStats, recomputeAllGroupStats, updateGroupIncludeDoubles } = useFlexStats();

  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeName, setActiveName] = useState<string>('');
  const [activeType, setActiveType] = useState<'player' | 'team'>('player');
  const [activeTab, setActiveTab] = useState<string>('matches');
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(data.groups[0]?.id || null);

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

  // Detect group item type based on existing items
  const getGroupItemType = (groupId: string): 'player' | 'team' | null => {
    const groupItemsList = data.groupItems.filter(gi => gi.group_id === groupId);
    if (groupItemsList.length === 0) return null; // Empty, any type allowed
    return groupItemsList[0].item_type as 'player' | 'team';
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
    const activeIdStr = String(active.id);
    
    // Parse item type and id from active.id (format: "player-{uuid}" or "team-{uuid}")
    let itemType: 'player' | 'team' = 'player';
    let itemId: string = sourceData.id;
    
    if (activeIdStr.startsWith('team-')) {
      itemType = 'team';
      itemId = activeIdStr.substring(5); // Remove "team-" prefix
    } else if (activeIdStr.startsWith('player-')) {
      itemType = 'player';
      itemId = activeIdStr.substring(7); // Remove "player-" prefix
    }

    // Handle drop on team
    if (targetId.startsWith('team-drop-')) {
      const teamId = targetId.replace('team-drop-', '');
      if (itemType === 'player') {
        // Check for duplicate
        if (isPlayerInTeam(itemId, teamId)) {
          toast({ 
            title: t.tools.flexTournament.duplicateInTeam,
            variant: "destructive" 
          });
          return;
        }
        await addPlayerToTeam(teamId, itemId);
        onRefresh();
      }
      return;
    }

    // Handle drop on group
    if (targetId.startsWith('group-drop-')) {
      const groupId = targetId.replace('group-drop-', '');
      
      // Check group type - first item determines type
      const existingType = getGroupItemType(groupId);
      if (existingType && existingType !== itemType) {
        toast({ 
          title: t.tools.flexTournament.groupTypeMismatch,
          variant: "destructive" 
        });
        return;
      }
      
      // Check for duplicate
      if (isItemInGroup(itemType, itemId, groupId)) {
        toast({ 
          title: t.tools.flexTournament.duplicateInGroup,
          variant: "destructive" 
        });
        return;
      }
      await addItemToGroup(groupId, itemType, itemId, data.groupItems.length);
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
      
      if (itemType === 'player') {
        // Check for duplicate player in same match
        if (isPlayerInMatch(itemId, match)) {
          toast({ 
            title: t.tools.flexTournament.duplicateInMatch,
            variant: "destructive" 
          });
          return;
        }

        if (slot === 'a1') updates.slot_a1_player_id = itemId;
        else if (slot === 'a2') updates.slot_a2_player_id = itemId;
        else if (slot === 'b1') updates.slot_b1_player_id = itemId;
        else if (slot === 'b2') updates.slot_b2_player_id = itemId;

        // Auto-add player to single group
        await autoAddToSingleGroup('player', itemId);
      } else if (itemType === 'team') {
        if (slot === 'a1') updates.slot_a_team_id = itemId;
        else if (slot === 'b1') updates.slot_b_team_id = itemId;

        // Auto-add team to single group
        await autoAddToSingleGroup('team', itemId);
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
        title: t.tools.flexTournament.duplicatePlayer,
        variant: "destructive" 
      });
      return;
    }
    await addPlayer(data.tournament.id, name, data.players.length);
    onRefresh();
  }, [data.tournament.id, data.players, addPlayer, onRefresh, toast, t]);

  // Get next negative display order for new items (appear at top)
  const getNextDisplayOrder = (existingItems: { display_order: number }[]) => {
    const minOrder = existingItems.length > 0 
      ? Math.min(...existingItems.map(i => i.display_order)) 
      : 0;
    return minOrder - 1;
  };

  const handleAddTeam = useCallback(async (name: string) => {
    await addTeam(data.tournament.id, name, getNextDisplayOrder(data.teams), data.teams.length);
    onRefresh();
  }, [data.tournament.id, data.teams, addTeam, onRefresh]);

  const handleAddGroup = useCallback(async (name: string) => {
    await addGroup(data.tournament.id, name, getNextDisplayOrder(data.groups), data.groups.length);
    onRefresh();
  }, [data.tournament.id, data.groups, addGroup, onRefresh]);

  // Create a new match - context-aware based on active tab
  const handleAddMatch = useCallback(async () => {
    const matchNumber = data.matches.length + 1;
    
    // If on "matches" tab, create standalone match without group
    // If on "groups" tab with a selected group, link match to that group
    const groupId = activeTab === 'groups' && selectedGroupId ? selectedGroupId : null;
    const group = groupId ? data.groups.find(g => g.id === groupId) : null;
    const groupType = groupId ? getGroupItemType(groupId) : null;
    
    // Determine match name
    let matchName: string;
    if (group) {
      matchName = `${group.name} - Trận ${data.matches.filter(m => m.group_id === groupId).length + 1}`;
    } else {
      // For standalone matches in "Trận đấu" tab, count only standalone matches
      const standaloneCount = data.matches.filter(m => !m.group_id && !m.parent_match_id).length;
      matchName = `Trận ${standaloneCount + 1}`;
    }
    
    // If group is team-based, create 'singles' type (2 team slots)
    const matchType = groupType === 'team' ? 'singles' : 'doubles';
    
    await addMatch(data.tournament.id, matchName, matchType, groupId, getNextDisplayOrder(data.matches), null, data.matches.length);
    onRefresh();
  }, [data.tournament.id, data.matches, data.groups, activeTab, selectedGroupId, addMatch, onRefresh, getGroupItemType]);

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
    
    // Recompute ALL group stats since match players may be in any group
    await recomputeAllGroupStats(data.tournament.id);
    
    onRefresh();
  }, [updateMatchScore, data.tournament.id, recomputeAllGroupStats, onRefresh]);

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

  const handleUpdateMatchGroupId = useCallback(async (matchId: string, groupId: string | null) => {
    await updateMatchGroupId(matchId, groupId);
    await recomputeAllGroupStats(data.tournament.id);
    onRefresh();
  }, [updateMatchGroupId, recomputeAllGroupStats, data.tournament.id, onRefresh]);

  const handleToggleIncludeDoubles = useCallback(async (groupId: string, include: boolean) => {
    await updateGroupIncludeDoubles(groupId, include);
    onRefresh();
  }, [updateGroupIncludeDoubles, onRefresh]);

  // Child match handlers for team matches
  const handleAddChildMatch = useCallback(async (parentMatchId: string) => {
    const parentMatch = data.matches.find(m => m.id === parentMatchId);
    if (!parentMatch) return;
    
    const childCount = data.matches.filter(m => m.parent_match_id === parentMatchId).length;
    const matchName = `Trận ${childCount + 1}`;
    
    await addMatch(data.tournament.id, matchName, 'doubles', parentMatch.group_id, childCount, parentMatchId, data.matches.length);
    onRefresh();
  }, [data.tournament.id, data.matches, addMatch, onRefresh]);

  const handleUpdateChildMatchScore = useCallback(async (matchId: string, scoreA: number, scoreB: number) => {
    await updateMatchScore(matchId, scoreA, scoreB);
    
    // Find child match and update parent score
    const childMatch = data.matches.find(m => m.id === matchId);
    if (childMatch?.parent_match_id) {
      const siblingMatches = data.matches.filter(m => m.parent_match_id === childMatch.parent_match_id);
      // Update the sibling's score in memory before recalculating
      const updatedSiblings = siblingMatches.map(m => 
        m.id === matchId 
          ? { ...m, score_a: scoreA, score_b: scoreB, winner_side: scoreA > scoreB ? 'a' as const : scoreB > scoreA ? 'b' as const : null }
          : m
      );
      await updateParentMatchScore(childMatch.parent_match_id, updatedSiblings);
    }
    
    // Recompute ALL group stats since child matches can affect any player's standings
    await recomputeAllGroupStats(data.tournament.id);
    
    onRefresh();
  }, [updateMatchScore, updateParentMatchScore, data.matches, data.tournament.id, recomputeAllGroupStats, onRefresh]);

  const handleClearChildMatchSlot = useCallback(async (matchId: string, slot: 'a1' | 'a2' | 'b1' | 'b2') => {
    const updates: any = {};
    if (slot === 'a1') updates.slot_a1_player_id = null;
    else if (slot === 'a2') updates.slot_a2_player_id = null;
    else if (slot === 'b1') updates.slot_b1_player_id = null;
    else if (slot === 'b2') updates.slot_b2_player_id = null;

    await updateMatchSlots(matchId, updates);
    onRefresh();
  }, [updateMatchSlots, onRefresh]);

  const handleDeleteChildMatch = useCallback(async (matchId: string) => {
    const childMatch = data.matches.find(m => m.id === matchId);
    await deleteEntity('flex_matches', matchId);
    
    // Recalculate parent score after deletion
    if (childMatch?.parent_match_id) {
      const remainingSiblings = data.matches.filter(m => m.parent_match_id === childMatch.parent_match_id && m.id !== matchId);
      await updateParentMatchScore(childMatch.parent_match_id, remainingSiblings);
    }
    
    onRefresh();
  }, [deleteEntity, updateParentMatchScore, data.matches, onRefresh]);

  // Handle selecting a player for a child match slot via dropdown
  const handleSelectChildMatchPlayer = useCallback(async (matchId: string, slot: 'a1' | 'a2' | 'b1' | 'b2', playerId: string) => {
    const updates: any = {};
    if (slot === 'a1') updates.slot_a1_player_id = playerId;
    else if (slot === 'a2') updates.slot_a2_player_id = playerId;
    else if (slot === 'b1') updates.slot_b1_player_id = playerId;
    else if (slot === 'b2') updates.slot_b2_player_id = playerId;

    await updateMatchSlots(matchId, updates);
    onRefresh();
  }, [updateMatchSlots, onRefresh]);

  // Get child matches for a parent match
  const getChildMatches = useCallback((parentMatchId: string): FlexMatch[] => {
    return data.matches.filter(m => m.parent_match_id === parentMatchId).sort((a, b) => a.display_order - b.display_order);
  }, [data.matches]);

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
  // Filter out child matches (they're displayed inside their parent)
  // Also filter out matches that belong to a group (they show in group view)
  const standaloneMatches = [...data.matches]
    .filter(m => !m.parent_match_id && !m.group_id)
    .sort((a, b) => a.display_order - b.display_order);

  const sortedMatches = [...data.matches]
    .filter(m => !m.parent_match_id)
    .sort((a, b) => a.display_order - b.display_order);

  const hasContent = data.teams.length > 0 || data.groups.length > 0 || data.matches.length > 0;

  // Check if a match is a team match (has teams assigned)
  const isTeamMatch = (match: FlexMatch): boolean => {
    return !!(match.slot_a_team_id || match.slot_b_team_id);
  };

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
                {t.tools.flexTournament.tabMatches} ({standaloneMatches.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="teams" className="mt-3">
              <TeamSelector
                teams={sortedTeams}
                teamMembers={data.teamMembers}
                players={data.players}
                isCreator={isCreator}
                onUpdateTeamName={handleUpdateTeamName}
                onDeleteTeam={handleDeleteTeam}
                onRemoveMember={(memberId) => {
                  removePlayerFromTeam(memberId);
                  onRefresh();
                }}
              />
            </TabsContent>

            <TabsContent value="groups" className="mt-3">
              <GroupSelector
                groups={sortedGroups}
                groupItems={data.groupItems}
                players={data.players}
                teams={data.teams}
                teamMembers={data.teamMembers}
                playerStats={data.playerStats}
                pairStats={data.pairStats}
                matches={data.matches}
                isCreator={isCreator}
                selectedGroupId={selectedGroupId}
                onSelectGroup={setSelectedGroupId}
                onUpdateGroupName={handleUpdateGroupName}
                onDeleteGroup={handleDeleteGroup}
                onRemoveItem={(itemId) => {
                  removeItemFromGroup(itemId);
                  onRefresh();
                }}
                onGenerateRR={handleGenerateRR}
                onToggleIncludeDoubles={handleToggleIncludeDoubles}
                onUpdateMatchName={handleUpdateMatchName}
                onDeleteMatch={handleDeleteMatch}
                onUpdateMatchScore={handleUpdateMatchScore}
                onClearMatchSlot={handleClearSlot}
                onToggleMatchCountsForStandings={handleToggleCountsForStandings}
                onAddChildMatch={handleAddChildMatch}
                onUpdateChildMatchScore={handleUpdateChildMatchScore}
                onClearChildMatchSlot={handleClearChildMatchSlot}
                onSelectChildMatchPlayer={handleSelectChildMatchPlayer}
                onDeleteChildMatch={handleDeleteChildMatch}
                getChildMatches={getChildMatches}
              />
            </TabsContent>

            <TabsContent value="matches" className="mt-3 space-y-3">
              {standaloneMatches.length > 0 ? (
                standaloneMatches.map(match => (
                  <MatchBlock
                    key={match.id}
                    match={match}
                    players={data.players}
                    teams={data.teams}
                    teamMembers={data.teamMembers}
                    groups={data.groups}
                    isCreator={isCreator}
                    hasGroups={data.groups.length > 0}
                    isTeamMatch={isTeamMatch(match)}
                    childMatches={getChildMatches(match.id)}
                    onUpdateName={(name) => handleUpdateMatchName(match.id, name)}
                    onDelete={() => handleDeleteMatch(match.id)}
                    onUpdateScore={(scoreA, scoreB) => handleUpdateMatchScore(match.id, scoreA, scoreB)}
                    onClearSlot={(slot) => handleClearSlot(match.id, slot)}
                    onToggleCountsForStandings={(counts) => handleToggleCountsForStandings(match.id, counts)}
                    onUpdateGroupId={(groupId) => handleUpdateMatchGroupId(match.id, groupId)}
                    onAddChildMatch={() => handleAddChildMatch(match.id)}
                    onUpdateChildMatchScore={handleUpdateChildMatchScore}
                    onClearChildMatchSlot={handleClearChildMatchSlot}
                    onSelectChildMatchPlayer={handleSelectChildMatchPlayer}
                    onDeleteChildMatch={handleDeleteChildMatch}
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

        {/* Floating Add Match Button */}
        {/* Floating Add Match Button */}
        <FloatingAddMatchButton
          onClick={handleAddMatch}
          isCreator={isCreator}
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
          {/* Teams row - using tab-based selector */}
          {sortedTeams.length > 0 && (
            <TeamSelector
              teams={sortedTeams}
              teamMembers={data.teamMembers}
              players={data.players}
              isCreator={isCreator}
              onUpdateTeamName={handleUpdateTeamName}
              onDeleteTeam={handleDeleteTeam}
              onRemoveMember={(memberId) => {
                removePlayerFromTeam(memberId);
                onRefresh();
              }}
            />
          )}

          {/* Groups row - using tab-based selector */}
          {sortedGroups.length > 0 && (
            <GroupSelector
              groups={sortedGroups}
              groupItems={data.groupItems}
              players={data.players}
              teams={data.teams}
              teamMembers={data.teamMembers}
              playerStats={data.playerStats}
              pairStats={data.pairStats}
              matches={data.matches}
              isCreator={isCreator}
              selectedGroupId={selectedGroupId}
              onSelectGroup={setSelectedGroupId}
              onUpdateGroupName={handleUpdateGroupName}
              onDeleteGroup={handleDeleteGroup}
              onRemoveItem={(itemId) => {
                removeItemFromGroup(itemId);
                onRefresh();
              }}
              onGenerateRR={handleGenerateRR}
              onToggleIncludeDoubles={handleToggleIncludeDoubles}
              onUpdateMatchName={handleUpdateMatchName}
              onDeleteMatch={handleDeleteMatch}
              onUpdateMatchScore={handleUpdateMatchScore}
              onClearMatchSlot={handleClearSlot}
              onToggleMatchCountsForStandings={handleToggleCountsForStandings}
              onAddChildMatch={handleAddChildMatch}
              onUpdateChildMatchScore={handleUpdateChildMatchScore}
              onClearChildMatchSlot={handleClearChildMatchSlot}
              onSelectChildMatchPlayer={handleSelectChildMatchPlayer}
              onDeleteChildMatch={handleDeleteChildMatch}
              getChildMatches={getChildMatches}
            />
          )}

          {/* Matches row - standalone matches only (not in groups) */}
          {standaloneMatches.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {standaloneMatches.map(match => (
                <MatchBlock
                  key={match.id}
                  match={match}
                  players={data.players}
                  teams={data.teams}
                  teamMembers={data.teamMembers}
                  groups={data.groups}
                  isCreator={isCreator}
                  hasGroups={data.groups.length > 0}
                  isTeamMatch={isTeamMatch(match)}
                  childMatches={getChildMatches(match.id)}
                  onUpdateName={(name) => handleUpdateMatchName(match.id, name)}
                  onDelete={() => handleDeleteMatch(match.id)}
                  onUpdateScore={(scoreA, scoreB) => handleUpdateMatchScore(match.id, scoreA, scoreB)}
                  onClearSlot={(slot) => handleClearSlot(match.id, slot)}
                  onToggleCountsForStandings={(counts) => handleToggleCountsForStandings(match.id, counts)}
                  onUpdateGroupId={(groupId) => handleUpdateMatchGroupId(match.id, groupId)}
                  onAddChildMatch={() => handleAddChildMatch(match.id)}
                  onUpdateChildMatchScore={handleUpdateChildMatchScore}
                  onClearChildMatchSlot={handleClearChildMatchSlot}
                  onSelectChildMatchPlayer={handleSelectChildMatchPlayer}
                  onDeleteChildMatch={handleDeleteChildMatch}
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
