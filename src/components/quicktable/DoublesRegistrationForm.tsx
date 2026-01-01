import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useTeamRegistration, type Team, type PartnerInvitation, type TeamFormData } from '@/hooks/useTeamRegistration';
import type { SkillRatingSystem } from '@/hooks/useRegistration';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { 
  UserPlus, CheckCircle2, Clock, XCircle, AlertCircle, LogIn, 
  Users, Link2, Copy, Trash2, UserMinus, Send
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import { vi } from 'date-fns/locale';

interface DoublesRegistrationFormProps {
  tableId: string;
  tableName: string;
  shareId?: string;
  requiresSkillLevel?: boolean;
  registrationMessage?: string | null;
  existingTeam?: Team | null;
  onRegistrationComplete?: () => void;
}

const SKILL_DESCRIPTIONS = [
  'Mới chơi ~6 tháng',
  'Chơi phong trào',
  'Chơi thường xuyên ~1-2 năm',
  'Đã thi đấu nhiều giải',
];

export function DoublesRegistrationForm({
  tableId,
  tableName,
  shareId,
  requiresSkillLevel = true,
  registrationMessage,
  existingTeam,
  onRegistrationComplete,
}: DoublesRegistrationFormProps) {
  const { user } = useAuth();
  const { 
    createTeam, 
    getTeamInvitations, 
    createInvitation, 
    cancelInvitation, 
    removePartner,
    loading 
  } = useTeamRegistration();
  const navigate = useNavigate();
  const location = useLocation();

  const [displayName, setDisplayName] = useState('');
  const [team, setTeam] = useState('');
  const [ratingSystem, setRatingSystem] = useState<SkillRatingSystem>('none');
  const [skillLevel, setSkillLevel] = useState('');
  const [skillDescription, setSkillDescription] = useState('');
  const [profileLink, setProfileLink] = useState('');
  
  const [invitations, setInvitations] = useState<PartnerInvitation[]>([]);
  const [loadingInvitations, setLoadingInvitations] = useState(false);

  // Load invitations when team exists
  useEffect(() => {
    if (existingTeam && existingTeam.player1_user_id === user?.id) {
      loadInvitations();
    }
  }, [existingTeam, user]);

  const loadInvitations = async () => {
    if (!existingTeam) return;
    setLoadingInvitations(true);
    const data = await getTeamInvitations(existingTeam.id);
    setInvitations(data);
    setLoadingInvitations(false);
  };

  const handleLoginClick = () => {
    const returnUrl = location.pathname + location.search;
    navigate(`/login?redirect=${encodeURIComponent(returnUrl)}`);
  };

  if (!user) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <LogIn className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground mb-4">
            Vui lòng đăng nhập để đăng ký tham dự giải
          </p>
          <Button onClick={handleLoginClick}>Đăng nhập</Button>
        </CardContent>
      </Card>
    );
  }

  // User is partner in a team
  if (existingTeam && existingTeam.player2_user_id === user.id) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="text-center mb-4">
            <Users className="w-12 h-12 mx-auto mb-3 text-primary" />
            <h3 className="font-semibold text-lg mb-1">Bạn đã tham gia đội</h3>
            <p className="text-muted-foreground">
              Bạn là partner của <strong>{existingTeam.player1_display_name}</strong>
            </p>
          </div>
          
          <div className="border-t pt-4 mt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Trạng thái:</span>
              <TeamStatusBadge status={existingTeam.team_status} btcApproved={existingTeam.btc_approved} />
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">VĐV 1:</span>
              <span>{existingTeam.player1_display_name}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">VĐV 2 (Bạn):</span>
              <span>{existingTeam.player2_display_name}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  // User is VDV1 - show team management
  if (existingTeam && existingTeam.player1_user_id === user.id) {
    const activeInvitations = invitations.filter(
      inv => inv.status === 'pending' && new Date(inv.expires_at) > new Date()
    );

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Đội của bạn
          </CardTitle>
          <CardDescription>
            Quản lý đội và mời partner tham gia
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Team Status */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-medium">Trạng thái:</span>
              <TeamStatusBadge status={existingTeam.team_status} btcApproved={existingTeam.btc_approved} />
            </div>
            
            <Separator />
            
            {/* VDV1 Info */}
            <div className="space-y-1">
              <p className="text-sm font-medium">VĐV 1 (Bạn):</p>
              <p className="text-sm text-muted-foreground">
                {existingTeam.player1_display_name}
                {existingTeam.player1_team && ` - ${existingTeam.player1_team}`}
              </p>
            </div>
            
            {/* Partner Info */}
            <div className="space-y-1">
              <p className="text-sm font-medium">Partner:</p>
              {existingTeam.player2_user_id ? (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    {existingTeam.player2_display_name}
                    {existingTeam.player2_team && ` - ${existingTeam.player2_team}`}
                  </p>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={async () => {
                      if (confirm('Bạn có chắc muốn xóa partner khỏi đội?')) {
                        const success = await removePartner(existingTeam.id);
                        if (success) onRegistrationComplete?.();
                      }
                    }}
                    disabled={loading}
                  >
                    <UserMinus className="w-4 h-4 mr-1" />
                    Xóa
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-amber-600">Chưa có partner</p>
              )}
            </div>
          </div>

          {/* Partner Invitations - only show if no partner yet */}
          {!existingTeam.player2_user_id && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium flex items-center gap-2">
                  <Link2 className="w-4 h-4" />
                  Lời mời partner ({activeInvitations.length}/3)
                </h4>
                <Button
                  size="sm"
                  onClick={async () => {
                    const inv = await createInvitation(existingTeam.id, tableId);
                    if (inv) loadInvitations();
                  }}
                  disabled={loading || activeInvitations.length >= 3}
                >
                  <Send className="w-4 h-4 mr-1" />
                  Tạo link mời
                </Button>
              </div>

              {activeInvitations.length > 0 ? (
                <div className="space-y-2">
                  {activeInvitations.map((inv) => (
                    <InvitationCard
                      key={inv.id}
                      invitation={inv}
                      shareId={shareId}
                      onCancel={async () => {
                        const success = await cancelInvitation(inv.id);
                        if (success) loadInvitations();
                      }}
                    />
                  ))}
                </div>
              ) : (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Tạo link mời và gửi cho partner của bạn. Mỗi link có hiệu lực 7 ngày.
                  </AlertDescription>
                </Alert>
              )}

              {/* Past invitations */}
              {invitations.filter(inv => inv.status !== 'pending').length > 0 && (
                <details className="text-sm">
                  <summary className="cursor-pointer text-muted-foreground">
                    Lịch sử lời mời ({invitations.filter(inv => inv.status !== 'pending').length})
                  </summary>
                  <div className="mt-2 space-y-1">
                    {invitations
                      .filter(inv => inv.status !== 'pending')
                      .map((inv) => (
                        <div key={inv.id} className="flex items-center justify-between text-xs p-2 bg-muted rounded">
                          <code className="font-mono">{inv.invite_code.slice(0, 8)}...</code>
                          <Badge variant="outline" className="text-xs">
                            {inv.status === 'accepted' && 'Đã sử dụng'}
                            {inv.status === 'rejected' && 'Bị từ chối'}
                            {inv.status === 'expired' && 'Hết hạn'}
                            {inv.status === 'cancelled' && 'Đã hủy'}
                          </Badge>
                        </div>
                      ))}
                  </div>
                </details>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  // New registration form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!displayName.trim()) return;

    const formData: TeamFormData = {
      display_name: displayName,
      team: team || undefined,
      rating_system: ratingSystem,
      skill_level: skillLevel ? parseFloat(skillLevel) : undefined,
      profile_link: profileLink || undefined,
    };

    const result = await createTeam(tableId, formData);
    if (result) {
      onRegistrationComplete?.();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="w-5 h-5 text-primary" />
          Đăng ký tham dự (Đội đôi)
        </CardTitle>
        <CardDescription>
          Đăng ký tham gia giải <strong>{tableName}</strong>. Sau khi đăng ký, bạn có thể mời partner.
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
                  <p className="text-sm text-muted-foreground">Hệ thống rating DUPR chính thức</p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <RadioGroupItem value="other" id="other" />
                <div className="flex-1">
                  <Label htmlFor="other" className="cursor-pointer font-medium">Hệ thống khác</Label>
                  <p className="text-sm text-muted-foreground">UTPR, APP, hoặc hệ thống khác</p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <RadioGroupItem value="none" id="none" />
                <div className="flex-1">
                  <Label htmlFor="none" className="cursor-pointer font-medium">Tôi chưa có rating</Label>
                  <p className="text-sm text-muted-foreground">Bạn sẽ mô tả trình độ của mình</p>
                </div>
              </div>
            </RadioGroup>

            {ratingSystem === 'DUPR' && (
              <div className="pl-6 space-y-3 border-l-2 border-primary/20">
                <div className="space-y-2">
                  <Label htmlFor="skillLevel">Điểm DUPR</Label>
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
                  <Label htmlFor="profileLink">Link hồ sơ DUPR</Label>
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

            {ratingSystem === 'other' && (
              <div className="pl-6 space-y-3 border-l-2 border-primary/20">
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
              </div>
            )}

            {ratingSystem === 'none' && (
              <div className="pl-6 space-y-3 border-l-2 border-primary/20">
                <div className="space-y-2">
                  <Label>Mô tả trình độ</Label>
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
            <Users className="h-4 w-4" />
            <AlertDescription className="text-sm">
              Sau khi đăng ký, bạn sẽ có thể tạo link mời partner. Partner có 7 ngày để xác nhận.
            </AlertDescription>
          </Alert>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Đang gửi...' : 'Đăng ký & Mời Partner'}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// Helper Components
function TeamStatusBadge({ status, btcApproved }: { status: string; btcApproved: boolean }) {
  if (status === 'approved' || btcApproved) {
    return <Badge className="gap-1 bg-green-600"><CheckCircle2 className="w-3 h-3" /> Đã duyệt</Badge>;
  }
  if (status === 'rejected') {
    return <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" /> Bị từ chối</Badge>;
  }
  if (status === 'removed') {
    return <Badge variant="destructive" className="gap-1"><XCircle className="w-3 h-3" /> Đã loại</Badge>;
  }
  return <Badge variant="outline" className="gap-1"><Clock className="w-3 h-3" /> Chờ duyệt</Badge>;
}

function InvitationCard({ 
  invitation, 
  shareId,
  onCancel 
}: { 
  invitation: PartnerInvitation; 
  shareId?: string;
  onCancel: () => void;
}) {
  const inviteUrl = `${window.location.origin}/join/${invitation.invite_code}`;
  
  const copyLink = () => {
    navigator.clipboard.writeText(inviteUrl);
    toast.success('Đã sao chép link');
  };

  const expiresIn = formatDistanceToNow(new Date(invitation.expires_at), { 
    addSuffix: true, 
    locale: vi 
  });

  return (
    <div className="border rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <code className="text-xs font-mono bg-muted px-2 py-1 rounded">
          {invitation.invite_code}
        </code>
        <span className="text-xs text-muted-foreground">
          Hết hạn {expiresIn}
        </span>
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" className="flex-1" onClick={copyLink}>
          <Copy className="w-3 h-3 mr-1" />
          Sao chép link
        </Button>
        <Button size="sm" variant="ghost" className="text-destructive" onClick={onCancel}>
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}

export default DoublesRegistrationForm;
