import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { parseCourtsInput } from '@/lib/round-robin';
import { useI18n } from '@/i18n';

interface EditCourtsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentCourts: string[];
  currentStartTime: string | null;
  onSave: (courts: string[], startTime: string | null) => Promise<void>;
}

const helpStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--tl-fg-3)',
  margin: '6px 0 0',
  lineHeight: 1.5,
};

export function EditCourtsDialog({
  open,
  onOpenChange,
  currentCourts,
  currentStartTime,
  onSave,
}: EditCourtsDialogProps) {
  const { t, language } = useI18n();
  const [courts, setCourts] = useState(currentCourts.join(', '));
  const [startTime, setStartTime] = useState(currentStartTime || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const parsedCourts = parseCourtsInput(courts).map(String);
      await onSave(parsedCourts, startTime || null);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {language === 'vi' ? 'Chỉnh sửa sân & giờ' : 'Edit courts & start time'}
          </DialogTitle>
          <DialogDescription>
            {language === 'vi'
              ? 'Thay đổi danh sách sân và giờ bắt đầu. Lịch thi đấu sẽ được cập nhật tự động.'
              : 'Update court numbers and start time. Match schedule will be regenerated automatically.'}
          </DialogDescription>
        </DialogHeader>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '16px 0' }}>
          <div className="space-y-2">
            <Label htmlFor="edit-courts">
              {language === 'vi' ? 'Danh sách sân' : 'Courts'}
            </Label>
            <Input
              id="edit-courts"
              value={courts}
              onChange={(e) => setCourts(e.target.value)}
              placeholder={language === 'vi' ? 'VD: 2, 3, 8' : 'E.g.: 2, 3, 8'}
            />
            <p style={helpStyle}>
              {language === 'vi'
                ? 'Nhập các số sân cách nhau bằng dấu phẩy. Để trống để xóa tất cả sân.'
                : 'Enter court numbers separated by comma. Leave empty to clear all courts.'}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-startTime">
              {language === 'vi' ? 'Giờ bắt đầu' : 'Start time'}
            </Label>
            <Input
              id="edit-startTime"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-32"
            />
            <p style={helpStyle}>
              {language === 'vi'
                ? 'Mỗi trận mặc định 20 phút.'
                : 'Each match defaults to 20 minutes.'}
            </p>
          </div>
        </div>

        <DialogFooter>
          <button
            type="button"
            className="tl-btn"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            {t.quickTable.view.cancel}
          </button>
          <button
            type="button"
            className="tl-btn green"
            onClick={handleSave}
            disabled={saving}
          >
            {saving
              ? (language === 'vi' ? 'Đang lưu…' : 'Saving…')
              : (language === 'vi' ? 'Lưu thay đổi' : 'Save changes')}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default EditCourtsDialog;
