import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useI18n } from '@/i18n';

interface CourtTimeSettingsProps {
  courts: string;
  onCourtsChange: (value: string) => void;
  startTime: string;
  onStartTimeChange: (value: string) => void;
}

const labelOptional = (s: string): React.CSSProperties => ({
  color: 'var(--tl-fg-3)',
  fontWeight: 400,
  fontFamily: 'Geist Mono, ui-monospace, monospace',
  fontSize: 11,
  letterSpacing: '0.02em',
  marginLeft: 6,
});

const helpStyle: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--tl-fg-3)',
  margin: '6px 0 0',
  lineHeight: 1.5,
};

export function CourtTimeSettings({
  courts,
  onCourtsChange,
  startTime,
  onStartTimeChange,
}: CourtTimeSettingsProps) {
  const { language } = useI18n();
  const optionalLabel = language === 'vi' ? '(tùy chọn)' : '(optional)';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        marginTop: 20,
        paddingTop: 20,
        borderTop: '1px solid var(--tl-border)',
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="courts" className="text-sm font-medium">
          {language === 'vi' ? 'Số sân' : 'Courts'}
          <span style={labelOptional(optionalLabel)}>{optionalLabel}</span>
        </Label>
        <Input
          id="courts"
          value={courts}
          onChange={(e) => onCourtsChange(e.target.value)}
          placeholder={language === 'vi' ? 'VD: 2, 3, 8' : 'E.g.: 2, 3, 8'}
          className="h-10"
        />
        <p style={helpStyle}>
          {language === 'vi'
            ? 'Nhập danh sách sân bằng dấu phẩy. Nếu không nhập, hệ thống giữ cách chia như cũ.'
            : 'Enter court numbers separated by comma. Leave empty to keep current assignment.'}
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="startTime" className="text-sm font-medium">
          {language === 'vi' ? 'Giờ bắt đầu' : 'Start time'}
          <span style={labelOptional(optionalLabel)}>{optionalLabel}</span>
        </Label>
        <Input
          id="startTime"
          type="time"
          value={startTime}
          onChange={(e) => onStartTimeChange(e.target.value)}
          className="h-10 w-32"
        />
        <p style={helpStyle}>
          {language === 'vi'
            ? 'Nhập giờ bắt đầu để tự tạo lịch. Mỗi trận mặc định 20 phút.'
            : 'Enter start time to auto-generate schedule. Each match defaults to 20 minutes.'}
        </p>
      </div>
    </div>
  );
}

export default CourtTimeSettings;
