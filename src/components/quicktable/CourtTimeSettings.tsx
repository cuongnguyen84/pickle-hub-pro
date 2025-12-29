import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface CourtTimeSettingsProps {
  courts: string;
  onCourtsChange: (value: string) => void;
  startTime: string;
  onStartTimeChange: (value: string) => void;
}

export function CourtTimeSettings({
  courts,
  onCourtsChange,
  startTime,
  onStartTimeChange,
}: CourtTimeSettingsProps) {
  return (
    <div className="space-y-4 pt-4 border-t border-border-subtle">
      <div className="space-y-2">
        <Label htmlFor="courts" className="text-sm font-medium">
          Số sân <span className="text-muted-foreground font-normal">(tùy chọn)</span>
        </Label>
        <Input
          id="courts"
          value={courts}
          onChange={(e) => onCourtsChange(e.target.value)}
          placeholder="VD: 2, 3, 8"
          className="h-10"
        />
        <p className="text-xs text-muted-foreground">
          Nhập danh sách sân bằng dấu phẩy. Nếu không nhập, hệ thống giữ cách chia như cũ.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="startTime" className="text-sm font-medium">
          Giờ bắt đầu <span className="text-muted-foreground font-normal">(tùy chọn)</span>
        </Label>
        <Input
          id="startTime"
          type="time"
          value={startTime}
          onChange={(e) => onStartTimeChange(e.target.value)}
          className="h-10 w-32"
        />
        <p className="text-xs text-muted-foreground">
          Nhập giờ bắt đầu để tự tạo lịch. Mỗi trận mặc định 20 phút.
        </p>
      </div>
    </div>
  );
}

export default CourtTimeSettings;
