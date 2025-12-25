import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRegistration, type RegistrationFormData, type Registration, type SkillRatingSystem } from '@/hooks/useRegistration';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { UserPlus, CheckCircle2, Clock, XCircle, AlertCircle, LogIn } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';

interface RegistrationFormProps {
  tableId: string;
  tableName: string;
  requiresSkillLevel?: boolean;
  registrationMessage?: string | null;
  existingRegistration?: Registration | null;
  onRegistrationComplete?: () => void;
}

const SKILL_DESCRIPTIONS = [
  'Mới chơi ~6 tháng',
  'Chơi phong trào',
  'Chơi thường xuyên ~1-2 năm',
  'Đã thi đấu nhiều giải',
];

export function RegistrationForm({
  tableId,
  tableName,
  requiresSkillLevel = true,
  registrationMessage,
  existingRegistration,
  onRegistrationComplete,
}: RegistrationFormProps) {
  const { user } = useAuth();
  const { submitRegistration, updateRegistration, cancelRegistration, loading } = useRegistration();
  const navigate = useNavigate();
  const location = useLocation();

  const [displayName, setDisplayName] = useState(existingRegistration?.display_name || '');
  const [team, setTeam] = useState(existingRegistration?.team || '');
  const [ratingSystem, setRatingSystem] = useState<SkillRatingSystem>(
    existingRegistration?.rating_system || 'none'
  );
  const [skillLevel, setSkillLevel] = useState(existingRegistration?.skill_level?.toString() || '');
  const [skillSystemName, setSkillSystemName] = useState(existingRegistration?.skill_system_name || '');
  const [skillDescription, setSkillDescription] = useState(existingRegistration?.skill_description || '');
  const [profileLink, setProfileLink] = useState(existingRegistration?.profile_link || '');

  // Handle login redirect with return URL
  const handleLoginClick = () => {
    // Save current URL to redirect back after login
    const returnUrl = location.pathname + location.search;
    navigate(`/login?redirect=${encodeURIComponent(returnUrl)}`);
  };

  if (!user) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <LogIn className="w-12 h-12 mx-auto mb-4 text-foreground-muted" />
          <p className="text-foreground-secondary mb-4">
            Vui lòng đăng nhập để đăng ký tham dự giải
          </p>
          <Button onClick={handleLoginClick}>Đăng nhập</Button>
        </CardContent>
      </Card>
    );
  }

  // Show approved status
  if (existingRegistration && existingRegistration.status === 'approved') {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="text-center">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-green-500" />
            <h3 className="font-semibold text-lg mb-1">Đã được phê duyệt!</h3>
            <p className="text-foreground-secondary">
              Bạn đã được phê duyệt tham dự giải <strong>{tableName}</strong>.
            </p>
            <p className="text-foreground-muted mt-2">
              Vui lòng chờ kết quả chia bảng từ BTC.
            </p>
          </div>
          
          <div className="border-t border-border pt-4 mt-4">
            <h4 className="font-medium mb-2">Thông tin đăng ký của bạn:</h4>
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-foreground-muted">Tên:</dt>
                <dd>{existingRegistration.display_name}</dd>
              </div>
              {existingRegistration.team && (
                <div className="flex justify-between">
                  <dt className="text-foreground-muted">Team:</dt>
                  <dd>{existingRegistration.team}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-foreground-muted">Trình độ:</dt>
                <dd>
                  {existingRegistration.rating_system === 'DUPR' && `DUPR ${existingRegistration.skill_level}`}
                  {existingRegistration.rating_system === 'other' && (
                    <>
                      {existingRegistration.skill_system_name || 'Hệ thống khác'}: {existingRegistration.skill_level}
                    </>
                  )}
                  {existingRegistration.rating_system === 'none' && (existingRegistration.skill_description || 'Chưa có rating')}
                </dd>
              </div>
            </dl>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show rejected status
  if (existingRegistration && existingRegistration.status === 'rejected') {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="text-center">
            <XCircle className="w-12 h-12 mx-auto mb-3 text-red-500" />
            <h3 className="font-semibold text-lg mb-1">Đăng ký bị từ chối</h3>
            <p className="text-foreground-secondary">
              Rất tiếc, đăng ký của bạn không được chấp nhận.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show pending registration
  if (existingRegistration && existingRegistration.status === 'pending') {
    return (
      <Card>
        <CardContent className="py-6 space-y-4">
          <div className="text-center">
            <Clock className="w-12 h-12 mx-auto mb-3 text-yellow-500" />
            <h3 className="font-semibold text-lg mb-1">Đăng ký thành công!</h3>
            <p className="text-foreground-secondary">
              Đăng ký của bạn đang chờ BTC xem xét và phê duyệt.
            </p>
          </div>

          <div className="border-t border-border pt-4">
            <h4 className="font-medium mb-2">Thông tin đăng ký của bạn:</h4>
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between">
                <dt className="text-foreground-muted">Tên:</dt>
                <dd>{existingRegistration.display_name}</dd>
              </div>
              {existingRegistration.team && (
                <div className="flex justify-between">
                  <dt className="text-foreground-muted">Team:</dt>
                  <dd>{existingRegistration.team}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-foreground-muted">Trình độ:</dt>
                <dd>
                  {existingRegistration.rating_system === 'DUPR' && `DUPR ${existingRegistration.skill_level}`}
                  {existingRegistration.rating_system === 'other' && (
                    <>
                      {existingRegistration.skill_system_name || 'Hệ thống khác'}: {existingRegistration.skill_level}
                    </>
                  )}
                  {existingRegistration.rating_system === 'none' && (existingRegistration.skill_description || 'Chưa có rating')}
                </dd>
              </div>
            </dl>
          </div>

          <Button
            variant="outline"
            className="w-full"
            onClick={async () => {
              if (confirm('Bạn có chắc muốn hủy đăng ký?')) {
                await cancelRegistration(existingRegistration.id);
                onRegistrationComplete?.();
              }
            }}
            disabled={loading}
          >
            Hủy đăng ký
          </Button>
        </CardContent>
      </Card>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!displayName.trim()) {
      return;
    }

    // Validate skill system name for 'other' rating system
    if (ratingSystem === 'other' && !skillSystemName.trim()) {
      return;
    }

    if (requiresSkillLevel && ratingSystem === 'none' && !skillDescription.trim()) {
      return;
    }

    const formData: RegistrationFormData = {
      display_name: displayName,
      team: team || undefined,
      rating_system: ratingSystem,
      skill_level: skillLevel ? parseFloat(skillLevel) : undefined,
      skill_description: ratingSystem === 'none' ? skillDescription : undefined,
      skill_system_name: ratingSystem === 'other' ? skillSystemName : undefined,
      profile_link: profileLink || undefined,
    };

    const result = await submitRegistration(tableId, formData);
    if (result) {
      onRegistrationComplete?.();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="w-5 h-5 text-primary" />
          Đăng ký tham dự
        </CardTitle>
        <CardDescription>
          Đăng ký tham gia giải <strong>{tableName}</strong>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {registrationMessage && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{registrationMessage}</AlertDescription>
            </Alert>
          )}

          {/* Basic Info */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="displayName">Tên hiển thị *</Label>
              <Input
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Nhập tên của bạn"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="team">Team / CLB (nếu có)</Label>
              <Input
                id="team"
                value={team}
                onChange={(e) => setTeam(e.target.value)}
                placeholder="VD: CLB Pickleball Quận 1"
              />
            </div>
          </div>

          {/* Skill Level */}
          <div className="space-y-4">
            <Label>Trình độ {requiresSkillLevel && '*'}</Label>
            
            <RadioGroup
              value={ratingSystem}
              onValueChange={(v) => setRatingSystem(v as SkillRatingSystem)}
              className="space-y-3"
            >
              <div className="flex items-start space-x-3">
                <RadioGroupItem value="DUPR" id="dupr" />
                <div className="flex-1">
                  <Label htmlFor="dupr" className="cursor-pointer font-medium">DUPR</Label>
                  <p className="text-sm text-foreground-muted">Hệ thống rating DUPR chính thức</p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <RadioGroupItem value="other" id="other" />
                <div className="flex-1">
                  <Label htmlFor="other" className="cursor-pointer font-medium">Hệ thống khác</Label>
                  <p className="text-sm text-foreground-muted">UTPR, APP, hoặc hệ thống khác</p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <RadioGroupItem value="none" id="none" />
                <div className="flex-1">
                  <Label htmlFor="none" className="cursor-pointer font-medium">Tôi chưa có rating chính thức</Label>
                  <p className="text-sm text-foreground-muted">Bạn sẽ mô tả trình độ của mình</p>
                </div>
              </div>
            </RadioGroup>

            {/* DUPR rating input */}
            {ratingSystem === 'DUPR' && (
              <div className="pl-6 space-y-3 border-l-2 border-primary/20">
                <div className="space-y-2">
                  <Label htmlFor="skillLevel">Điểm DUPR (VD: 3.25, 4.1)</Label>
                  <Input
                    id="skillLevel"
                    type="number"
                    step="0.01"
                    min="1"
                    max="8"
                    value={skillLevel}
                    onChange={(e) => setSkillLevel(e.target.value)}
                    placeholder="3.50"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="profileLink">Link hồ sơ DUPR (tùy chọn)</Label>
                  <Input
                    id="profileLink"
                    type="url"
                    value={profileLink}
                    onChange={(e) => setProfileLink(e.target.value)}
                    placeholder="https://mydupr.com/profile/..."
                  />
                </div>
              </div>
            )}

            {/* Other rating system input */}
            {ratingSystem === 'other' && (
              <div className="pl-6 space-y-3 border-l-2 border-primary/20">
                <div className="space-y-2">
                  <Label htmlFor="skillSystemName">Tên hệ thống *</Label>
                  <Input
                    id="skillSystemName"
                    value={skillSystemName}
                    onChange={(e) => setSkillSystemName(e.target.value)}
                    placeholder="VD: UTPR, APP, nội bộ CLB..."
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="skillLevelOther">Điểm trình độ</Label>
                  <Input
                    id="skillLevelOther"
                    type="number"
                    step="0.01"
                    min="0"
                    max="10"
                    value={skillLevel}
                    onChange={(e) => setSkillLevel(e.target.value)}
                    placeholder="Nhập điểm"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="profileLinkOther">Link hồ sơ (tùy chọn)</Label>
                  <Input
                    id="profileLinkOther"
                    type="url"
                    value={profileLink}
                    onChange={(e) => setProfileLink(e.target.value)}
                    placeholder="Link hồ sơ của bạn"
                  />
                </div>
              </div>
            )}

            {/* No rating - description required */}
            {ratingSystem === 'none' && (
              <div className="pl-6 space-y-3 border-l-2 border-primary/20">
                <div className="space-y-2">
                  <Label htmlFor="skillDescription">Mô tả trình độ của bạn *</Label>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {SKILL_DESCRIPTIONS.map((desc) => (
                      <Badge
                        key={desc}
                        variant={skillDescription === desc ? 'default' : 'outline'}
                        className="cursor-pointer"
                        onClick={() => setSkillDescription(desc)}
                      >
                        {desc}
                      </Badge>
                    ))}
                  </div>
                  <Textarea
                    id="skillDescription"
                    value={skillDescription}
                    onChange={(e) => setSkillDescription(e.target.value)}
                    placeholder="Hoặc mô tả theo cách của bạn..."
                    rows={2}
                  />
                </div>
              </div>
            )}
          </div>

          <Alert variant="default" className="bg-muted/50">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              BTC dựa vào điểm tự khai và sẽ đối chiếu với các hệ điểm để ra quyết định cuối cùng trong trường hợp có tranh chấp.
            </AlertDescription>
          </Alert>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Đang gửi...' : 'Gửi đăng ký'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export default RegistrationForm;
