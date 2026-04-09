import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useI18n } from '@/i18n';
import { useParentTournament } from '@/hooks/useParentTournament';

interface CreateParentTournamentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CreateParentTournamentDialog({ open, onOpenChange }: CreateParentTournamentDialogProps) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const { createParent, loading } = useParentTournament();
  const [name, setName] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');

  const handleSubmit = async () => {
    if (!name.trim()) return;
    const parent = await createParent({
      name: name.trim(),
      description: description.trim() || undefined,
      event_date: eventDate || undefined,
      location: location.trim() || undefined,
    });
    if (parent) {
      onOpenChange(false);
      navigate(`/tools/quick-tables/parent/${parent.share_id}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t.quickTable.parentTournament.createParent}</DialogTitle>
          <DialogDescription>{t.quickTable.parentTournament.multiDesc}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t.quickTable.parentTournament.parentName}</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t.quickTable.parentTournament.parentNamePlaceholder}
              maxLength={100}
            />
          </div>
          <div className="space-y-2">
            <Label>{t.quickTable.parentTournament.eventDate}</Label>
            <Input
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>{t.quickTable.parentTournament.location}</Label>
            <Input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder={t.quickTable.parentTournament.locationPlaceholder}
              maxLength={200}
            />
          </div>
          <div className="space-y-2">
            <Label>{t.quickTable.parentTournament.description}</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t.quickTable.parentTournament.descriptionPlaceholder}
              rows={3}
              maxLength={500}
            />
          </div>
          <Button
            className="w-full"
            onClick={handleSubmit}
            disabled={!name.trim() || loading}
          >
            {loading ? t.common.loading : t.quickTable.parentTournament.createParent}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
