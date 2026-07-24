import { useCallback, useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useI18n } from '@/i18n';
import {
  useParentTournament,
  type AttachableQuickTable,
} from '@/hooks/useParentTournament';
import ExistingEventPicker from './ExistingEventPicker';

interface AttachExistingEventsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  parentId: string;
  onAttached: () => void | Promise<void>;
}

export default function AttachExistingEventsDialog({
  open,
  onOpenChange,
  parentId,
  onAttached,
}: AttachExistingEventsDialogProps) {
  const { t } = useI18n();
  const {
    attaching,
    getAttachableEvents,
    attachEventsToParent,
  } = useParentTournament();
  const [events, setEvents] = useState<AttachableQuickTable[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const copy = t.quickTable.parentTournament;

  const loadEvents = useCallback(async () => {
    setLoadingEvents(true);
    setEvents(await getAttachableEvents());
    setLoadingEvents(false);
  }, [getAttachableEvents]);

  useEffect(() => {
    if (!open) return;
    setSelectedIds([]);
    void loadEvents();
  }, [open, loadEvents]);

  const handleAttach = async () => {
    if (selectedIds.length === 0) return;
    const attached = await attachEventsToParent(parentId, selectedIds);
    if (attached > 0) {
      onOpenChange(false);
      await onAttached();
    } else {
      await loadEvents();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{copy.existingEventsTitle}</DialogTitle>
          <DialogDescription>{copy.existingEventsDescription}</DialogDescription>
        </DialogHeader>

        <ExistingEventPicker
          events={events}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          loading={loadingEvents}
        />

        <DialogFooter>
          <button
            type="button"
            className="tl-btn"
            onClick={() => onOpenChange(false)}
            disabled={attaching}
          >
            {t.common.cancel}
          </button>
          <button
            type="button"
            className="tl-btn green"
            onClick={handleAttach}
            disabled={selectedIds.length === 0 || attaching}
          >
            {attaching
              ? t.common.loading
              : copy.attachSelected.replace('{count}', String(selectedIds.length))}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
