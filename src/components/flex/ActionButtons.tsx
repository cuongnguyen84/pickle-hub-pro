import { useState } from 'react';
import { useI18n } from '@/i18n';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Users, Grid3X3, Swords } from 'lucide-react';

interface ActionButtonsProps {
  onAddTeam: (name: string) => void;
  onAddGroup: (name: string) => void;
  onAddMatch: () => void; // Directly creates match without dialog
  compact?: boolean;
}

type DialogType = 'team' | 'group' | null;

export function ActionButtons({ onAddTeam, onAddGroup, onAddMatch, compact }: ActionButtonsProps) {
  const { t } = useI18n();
  const [openDialog, setOpenDialog] = useState<DialogType>(null);
  const [inputValue, setInputValue] = useState('');

  const handleSubmit = () => {
    if (!inputValue.trim()) return;

    switch (openDialog) {
      case 'team':
        onAddTeam(inputValue.trim());
        break;
      case 'group':
        onAddGroup(inputValue.trim());
        break;
    }

    setInputValue('');
    setOpenDialog(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  const getDialogTitle = () => {
    switch (openDialog) {
      case 'team':
        return t.tools.flexTournament.teamName;
      case 'group':
        return t.tools.flexTournament.groupName;
      default:
        return '';
    }
  };

  const dialogContent = (
    <Dialog open={openDialog !== null} onOpenChange={(open) => !open && setOpenDialog(null)}>
      <DialogContent className="max-w-[90vw] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{getDialogTitle()}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>{getDialogTitle()}</Label>
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={getDialogTitle()}
              autoFocus
              className="text-base"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpenDialog(null)}>
            {t.common.cancel}
          </Button>
          <Button onClick={handleSubmit} disabled={!inputValue.trim()}>
            {t.common.create}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  // Compact mode for mobile - returns fragment with buttons
  if (compact) {
    return (
      <>
        <Button
          variant="outline"
          size="sm"
          className="justify-center text-xs h-9"
          onClick={() => setOpenDialog('team')}
        >
          <Users className="w-3.5 h-3.5 mr-1" />
          {t.tools.flexTournament.addTeam}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="justify-center text-xs h-9"
          onClick={() => setOpenDialog('group')}
        >
          <Grid3X3 className="w-3.5 h-3.5 mr-1" />
          {t.tools.flexTournament.addGroup}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="justify-center text-xs h-9"
          onClick={onAddMatch}
        >
          <Swords className="w-3.5 h-3.5 mr-1" />
          {t.tools.flexTournament.addMatch}
        </Button>
        {dialogContent}
      </>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        <Button
          variant="outline"
          className="justify-start"
          onClick={() => setOpenDialog('team')}
        >
          <Users className="w-4 h-4 mr-2" />
          {t.tools.flexTournament.addTeam}
        </Button>
        <Button
          variant="outline"
          className="justify-start"
          onClick={() => setOpenDialog('group')}
        >
          <Grid3X3 className="w-4 h-4 mr-2" />
          {t.tools.flexTournament.addGroup}
        </Button>
        <Button
          variant="outline"
          className="justify-start"
          onClick={onAddMatch}
        >
          <Swords className="w-4 h-4 mr-2" />
          {t.tools.flexTournament.addMatch}
        </Button>
      </div>
      {dialogContent}
    </>
  );
}
