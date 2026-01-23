import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useI18n } from '@/i18n';

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
  const { t, language } = useI18n();
  
  return (
    <div className="space-y-4 pt-4 border-t border-border-subtle">
      <div className="space-y-2">
        <Label htmlFor="courts" className="text-sm font-medium">
          {language === 'vi' ? 'Số sân' : 'Courts'} <span className="text-muted-foreground font-normal">({language === 'vi' ? 'tùy chọn' : 'optional'})</span>
        </Label>
        <Input
          id="courts"
          value={courts}
          onChange={(e) => onCourtsChange(e.target.value)}
          placeholder={language === 'vi' ? 'VD: 2, 3, 8' : 'E.g.: 2, 3, 8'}
          className="h-10"
        />
        <p className="text-xs text-muted-foreground">
          {language === 'vi' 
            ? 'Nhập danh sách sân bằng dấu phẩy. Nếu không nhập, hệ thống giữ cách chia như cũ.'
            : 'Enter court numbers separated by comma. Leave empty to keep current assignment.'
          }
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="startTime" className="text-sm font-medium">
          {language === 'vi' ? 'Giờ bắt đầu' : 'Start time'} <span className="text-muted-foreground font-normal">({language === 'vi' ? 'tùy chọn' : 'optional'})</span>
        </Label>
        <Input
          id="startTime"
          type="time"
          value={startTime}
          onChange={(e) => onStartTimeChange(e.target.value)}
          className="h-10 w-32"
        />
        <p className="text-xs text-muted-foreground">
          {language === 'vi' 
            ? 'Nhập giờ bắt đầu để tự tạo lịch. Mỗi trận mặc định 20 phút.'
            : 'Enter start time to auto-generate schedule. Each match defaults to 20 minutes.'
          }
        </p>
      </div>
    </div>
  );
}

export default CourtTimeSettings;
