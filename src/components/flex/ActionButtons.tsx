import { useState } from 'react';
import { useI18n } from '@/i18n';
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

        <div style={{ padding: '16px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
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

        <DialogFooter>
          <button type="button" className="tl-btn" onClick={() => setOpenDialog(null)}>
            {t.common.cancel}
          </button>
          <button
            type="button"
            className="tl-btn green"
            onClick={handleSubmit}
            disabled={!inputValue.trim()}
          >
            {t.common.create}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  // Compact mode for mobile — returns fragment with token buttons
  if (compact) {
    return (
      <>
        <button
          type="button"
          className="tl-btn"
          onClick={() => setOpenDialog('team')}
          style={{ justifyContent: 'center', padding: '8px 10px', fontSize: 12 }}
        >
          <Users className="w-3.5 h-3.5" />
          {t.tools.flexTournament.addTeam}
        </button>
        <button
          type="button"
          className="tl-btn"
          onClick={() => setOpenDialog('group')}
          style={{ justifyContent: 'center', padding: '8px 10px', fontSize: 12 }}
        >
          <Grid3X3 className="w-3.5 h-3.5" />
          {t.tools.flexTournament.addGroup}
        </button>
        <button
          type="button"
          className="tl-btn"
          onClick={onAddMatch}
          style={{ justifyContent: 'center', padding: '8px 10px', fontSize: 12 }}
        >
          <Swords className="w-3.5 h-3.5" />
          {t.tools.flexTournament.addMatch}
        </button>
        {dialogContent}
      </>
    );
  }

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button
          type="button"
          className="tl-btn"
          onClick={() => setOpenDialog('team')}
          style={{ justifyContent: 'flex-start', padding: '10px 14px' }}
        >
          <Users className="w-4 h-4" />
          {t.tools.flexTournament.addTeam}
        </button>
        <button
          type="button"
          className="tl-btn"
          onClick={() => setOpenDialog('group')}
          style={{ justifyContent: 'flex-start', padding: '10px 14px' }}
        >
          <Grid3X3 className="w-4 h-4" />
          {t.tools.flexTournament.addGroup}
        </button>
        <button
          type="button"
          className="tl-btn"
          onClick={onAddMatch}
          style={{ justifyContent: 'flex-start', padding: '10px 14px' }}
        >
          <Swords className="w-4 h-4" />
          {t.tools.flexTournament.addMatch}
        </button>
      </div>
      {dialogContent}
    </>
  );
}
