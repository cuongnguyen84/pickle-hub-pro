import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { parseCourtsInput } from '@/lib/round-robin';

interface EditCourtsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentCourts: string[];
  currentStartTime: string | null;
  onSave: (courts: string[], startTime: string | null) => Promise<void>;
}

export function EditCourtsDialog({
  open,
  onOpenChange,
  currentCourts,
  currentStartTime,
  onSave,
}: EditCourtsDialogProps) {
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
          <DialogTitle>Chỉnh sửa sân & giờ</DialogTitle>
          <DialogDescription>
            Thay đổi danh sách sân và giờ bắt đầu. Lịch thi đấu sẽ được cập nhật tự động.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="edit-courts">Danh sách sân</Label>
            <Input
              id="edit-courts"
              value={courts}
              onChange={(e) => setCourts(e.target.value)}
              placeholder="VD: 2, 3, 8"
            />
            <p className="text-xs text-muted-foreground">
              Nhập các số sân cách nhau bằng dấu phẩy. Để trống để xóa tất cả sân.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-startTime">Giờ bắt đầu</Label>
            <Input
              id="edit-startTime"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="w-32"
            />
            <p className="text-xs text-muted-foreground">
              Mỗi trận mặc định 20 phút.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Hủy
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Đang lưu...' : 'Lưu thay đổi'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default EditCourtsDialog;
