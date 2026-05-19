import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { RefereeManagement } from '@/components/quicktable/RefereeManagement';
import { useI18n } from '@/i18n';

interface TeamMatchSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tournamentName: string;
  referees: Array<{ id: string; email?: string; display_name?: string }>;
  refereesLoading: boolean;
  onAddReferee: (email: string) => Promise<boolean>;
  onRemoveReferee: (refereeId: string) => Promise<boolean>;
}

// ─── W2.4d shared tokens ─────────────────────────────────────────────────
const sectionTitle: React.CSSProperties = {
  fontFamily: 'Instrument Serif, serif',
  fontStyle: 'italic',
  fontWeight: 400,
  fontSize: 20,
  letterSpacing: '-0.015em',
  color: 'var(--tl-fg)',
  margin: 0,
};

const fieldLabel: React.CSSProperties = {
  fontFamily: 'Geist Mono, ui-monospace, monospace',
  fontSize: 11,
  fontWeight: 500,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'var(--tl-fg-2)',
};

export function TeamMatchSettingsDialog({
  open,
  onOpenChange,
  tournamentName,
  referees,
  refereesLoading,
  onAddReferee,
  onRemoveReferee,
}: TeamMatchSettingsDialogProps) {
  const { language } = useI18n();
  const txt = {
    title: language === 'vi' ? 'Cài đặt' : 'Settings',
    desc: language === 'vi'
      ? 'Quản lý trọng tài và thiết lập cho giải đấu.'
      : 'Manage referees and settings for this tournament.',
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle style={sectionTitle}>
            {txt.title} — {tournamentName}
          </DialogTitle>
          <DialogDescription style={{ ...fieldLabel, marginTop: 4, textTransform: 'none', letterSpacing: '0.01em', fontFamily: 'inherit', fontSize: 13, color: 'var(--tl-fg-3)' }}>
            {txt.desc}
          </DialogDescription>
        </DialogHeader>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '8px 0' }}>
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
