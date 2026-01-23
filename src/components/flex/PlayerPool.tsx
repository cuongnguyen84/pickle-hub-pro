import { useState } from 'react';
import { useI18n } from '@/i18n';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DraggablePlayer } from './DraggablePlayer';
import { Plus, Users } from 'lucide-react';
import type { FlexPlayer } from '@/hooks/useFlexTournament';

interface PlayerPoolProps {
  players: FlexPlayer[];
  onAddPlayer: (name: string) => void;
  isCreator: boolean;
}

export function PlayerPool({ players, onAddPlayer, isCreator }: PlayerPoolProps) {
  const { t } = useI18n();
  const [newPlayerName, setNewPlayerName] = useState('');

  const handleAddPlayer = () => {
    if (newPlayerName.trim()) {
      onAddPlayer(newPlayerName.trim());
      setNewPlayerName('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddPlayer();
    }
  };

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Users className="w-4 h-4" />
          {t.tools.flexTournament.playerPool}
          <span className="text-muted-foreground font-normal">({players.length})</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Add player input */}
        {isCreator && (
          <div className="flex gap-2">
            <Input
              value={newPlayerName}
              onChange={(e) => setNewPlayerName(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t.tools.flexTournament.addPlayers}
              className="flex-1"
            />
            <Button size="icon" onClick={handleAddPlayer} disabled={!newPlayerName.trim()}>
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        )}

        {/* Player list */}
        <div className="space-y-2 max-h-[50vh] overflow-y-auto">
          {players.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              {t.tools.flexTournament.noPlayers}
            </p>
          ) : (
            players.map((player) => (
              <DraggablePlayer
                key={player.id}
                id={player.id}
                name={player.name}
                type="player"
                disabled={!isCreator}
              />
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}
