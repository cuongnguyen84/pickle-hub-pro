import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { RefereeManagement } from '@/components/quicktable/RefereeManagement';

interface TeamMatchSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tournamentName: string;
  referees: Array<{ id: string; email?: string; display_name?: string }>;
  refereesLoading: boolean;
  onAddReferee: (email: string) => Promise<boolean>;
  onRemoveReferee: (refereeId: string) => Promise<boolean>;
}

export function TeamMatchSettingsDialog({
  open,
  onOpenChange,
  tournamentName,
  referees,
  refereesLoading,
  onAddReferee,
  onRemoveReferee,
}: TeamMatchSettingsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cài đặt - {tournamentName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <RefereeManagement
            referees={referees}
            loading={refereesLoading}
            onAddReferee={onAddReferee}
            onRemoveReferee={onRemoveReferee}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
