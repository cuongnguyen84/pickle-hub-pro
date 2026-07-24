import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useI18n } from '@/i18n';
import {
  useParentTournament,
  type AttachableQuickTable,
} from '@/hooks/useParentTournament';
import ExistingEventPicker from './ExistingEventPicker';

interface CreateParentTournamentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const fieldLabel: React.CSSProperties = {
  fontFamily: 'Geist Mono, ui-monospace, monospace',
  fontSize: 11,
  fontWeight: 500,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'var(--tl-fg-2)',
};

export default function CreateParentTournamentDialog({
  open,
  onOpenChange,
}: CreateParentTournamentDialogProps) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const {
    createParent,
    loading,
    attaching,
    getAttachableEvents,
    attachEventsToParent,
  } = useParentTournament();
  const [name, setName] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [events, setEvents] = useState<AttachableQuickTable[]>([]);
  const [selectedEventIds, setSelectedEventIds] = useState<string[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);

  const loadEvents = useCallback(async () => {
    setLoadingEvents(true);
    setEvents(await getAttachableEvents());
    setLoadingEvents(false);
  }, [getAttachableEvents]);

  useEffect(() => {
    if (!open) return;
    setSelectedEventIds([]);
    void loadEvents();
  }, [open, loadEvents]);

  const handleSubmit = async () => {
    if (!name.trim()) return;
    const parent = await createParent({
      name: name.trim(),
      description: description.trim() || undefined,
      event_date: eventDate || undefined,
      location: location.trim() || undefined,
    });
    if (parent) {
      if (selectedEventIds.length > 0) {
        await attachEventsToParent(parent.id, selectedEventIds);
      }
      onOpenChange(false);
      navigate(`/tools/quick-tables/parent/${parent.share_id}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t.quickTable.parentTournament.createParent}</DialogTitle>
          <DialogDescription>{t.quickTable.parentTournament.multiDesc}</DialogDescription>
        </DialogHeader>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '8px 0 4px' }}>
          <div className="space-y-2">
            <Label htmlFor="parentName" style={fieldLabel}>
              {t.quickTable.parentTournament.parentName}
            </Label>
            <Input
              id="parentName"
              name="parentName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.quickTable.parentTournament.parentNamePlaceholder}
              maxLength={100}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="parentEventDate" style={fieldLabel}>
              {t.quickTable.parentTournament.eventDate}
            </Label>
            <Input
              id="parentEventDate"
              name="parentEventDate"
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="parentLocation" style={fieldLabel}>
              {t.quickTable.parentTournament.location}
            </Label>
            <Input
              id="parentLocation"
              name="parentLocation"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder={t.quickTable.parentTournament.locationPlaceholder}
              maxLength={200}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="parentDescription" style={fieldLabel}>
              {t.quickTable.parentTournament.description}
            </Label>
            <Textarea
              id="parentDescription"
              name="parentDescription"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t.quickTable.parentTournament.descriptionPlaceholder}
              rows={3}
              maxLength={500}
            />
          </div>

          <div className="space-y-2 border-t border-border pt-4">
            <div>
              <Label style={fieldLabel}>
                {t.quickTable.parentTournament.existingEventsOptional}
              </Label>
              <p className="mt-1 text-xs text-muted-foreground">
                {t.quickTable.parentTournament.existingEventsOptionalDescription}
              </p>
            </div>
            <ExistingEventPicker
              events={events}
              selectedIds={selectedEventIds}
              onSelectionChange={setSelectedEventIds}
              loading={loadingEvents}
            />
          </div>
        </div>

        <DialogFooter>
          <button
            type="button"
            className="tl-btn"
            onClick={() => onOpenChange(false)}
            disabled={loading || attaching}
          >
            {t.common.cancel}
          </button>
          <button
            type="button"
            className="tl-btn green"
            onClick={handleSubmit}
            disabled={!name.trim() || loading || attaching}
          >
            {loading || attaching
              ? t.common.loading
              : t.quickTable.parentTournament.createParent}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
