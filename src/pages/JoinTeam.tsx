import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
import { 
  Users, CheckCircle2, XCircle, Clock, AlertCircle, LogIn, Loader2
} from 'lucide-react';
import { MainLayout } from '@/components/layout';

const SKILL_DESCRIPTIONS = [
  'Mới chơi ~6 tháng',
  'Chơi phong trào',
  'Chơi thường xuyên ~1-2 năm',
  'Đã thi đấu nhiều giải',
];

export default function JoinTeam() {
  const { inviteCode } = useParams<{ inviteCode: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { getInvitationByCode, acceptInvitation, loading } = useTeamRegistration();

  const [pageLoading, setPageLoading] = useState(true);
  const [invitation, setInvitation] = useState<PartnerInvitation | null>(null);
  const [team, setTeam] = useState<Team | null>(null);
  const [tableName, setTableName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [displayName, setDisplayName] = useState('');
  const [teamName, setTeamName] = useState('');
  const [ratingSystem, setRatingSystem] = useState<SkillRatingSystem>('none');
  const [skillLevel, setSkillLevel] = useState('');
  const [skillDescription, setSkillDescription] = useState('');
  const [profileLink, setProfileLink] = useState('');

  useEffect(() => {
    if (!inviteCode) {
      setError('Link mời không hợp lệ');
      setPageLoading(false);
      return;
    }

    loadInvitationData();
  }, [inviteCode]);

  const loadInvitationData = async () => {
    if (!inviteCode) return;
    
    setPageLoading(true);
    const data = await getInvitationByCode(inviteCode);
    
    if (!data.invitation) {
      setError('Link mời không tồn tại hoặc đã hết hạn');
    } else if (data.invitation.status !== 'pending') {
      if (data.invitation.status === 'accepted') {
        setError('Link mời này đã được sử dụng');
      } else if (data.invitation.status === 'expired') {
        setError('Link mời đã hết hạn');
      } else if (data.invitation.status === 'cancelled') {
        setError('Link mời đã bị hủy');
      } else {
        setError('Link mời không còn hiệu lực');
      }
    } else if (new Date(data.invitation.expires_at) < new Date()) {
      setError('Link mời đã hết hạn');
    } else if (data.team?.player2_user_id) {
      setError('Đội đã đủ 2 người');
    } else {
      setInvitation(data.invitation);
      setTeam(data.team);
      setTableName(data.tableName);
    }
    
    setPageLoading(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteCode || !displayName.trim()) return;

    const formData: TeamFormData = {
      display_name: displayName.trim(),
      team: teamName.trim() || undefined,
      rating_system: ratingSystem,
      skill_level: skillLevel ? parseFloat(skillLevel) : undefined,
      profile_link: profileLink.trim() || undefined,
    };

    const result = await acceptInvitation(inviteCode, formData);
    
    if (result.success && team) {
      // Navigate to the table view
      const { data: tableData } = await import('@/integrations/supabase/client').then(m => 
        m.supabase.from('quick_tables').select('share_id').eq('id', team.table_id).single()
      );
      
      if (tableData?.share_id) {
        navigate(`/quick/${tableData.share_id}`);
      } else {
        navigate('/quick');
      }
    }
  };

  const handleLoginClick = () => {
    const returnUrl = `/join/${inviteCode}`;
    navigate(`/login?redirect=${encodeURIComponent(returnUrl)}`);
  };

  if (pageLoading) {
    return (
      <MainLayout>
        <div className="container max-w-lg py-12">
          <Card>
            <CardContent className="py-12 text-center">
              <Loader2 className="w-8 h-8 mx-auto mb-4 animate-spin text-primary" />
              <p className="text-muted-foreground">Đang tải...</p>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  if (error) {
    return (
      <MainLayout>
        <div className="container max-w-lg py-12">
          <Card>
            <CardContent className="py-12 text-center">
              <XCircle className="w-12 h-12 mx-auto mb-4 text-destructive" />
              <h2 className="text-xl font-semibold mb-2">Không thể tham gia</h2>
              <p className="text-muted-foreground mb-6">{error}</p>
              <Button variant="outline" onClick={() => navigate('/')}>
                Về trang chủ
              </Button>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  if (!user) {
    return (
      <MainLayout>
        <div className="container max-w-lg py-12">
          <Card>
            <CardHeader className="text-center">
              <Users className="w-12 h-12 mx-auto mb-2 text-primary" />
              <CardTitle>Lời mời tham gia đội</CardTitle>
              <CardDescription>
                Bạn được mời tham gia đội của <strong>{team?.player1_display_name}</strong>
                {tableName && <> trong giải <strong>{tableName}</strong></>}
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-muted-foreground mb-6">
                Vui lòng đăng nhập để tiếp tục
              </p>
              <Button onClick={handleLoginClick}>
                <LogIn className="w-4 h-4 mr-2" />
                Đăng nhập
              </Button>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  // Check if user is already VDV1
  if (team?.player1_user_id === user.id) {
    return (
      <MainLayout>
        <div className="container max-w-lg py-12">
          <Card>
            <CardContent className="py-12 text-center">
              <AlertCircle className="w-12 h-12 mx-auto mb-4 text-amber-500" />
              <h2 className="text-xl font-semibold mb-2">Không thể tham gia</h2>
              <p className="text-muted-foreground mb-6">
                Bạn không thể tham gia đội của chính mình
              </p>
              <Button variant="outline" onClick={() => navigate('/')}>
                Về trang chủ
              </Button>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container max-w-lg py-8">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <CardTitle>Tham gia đội</CardTitle>
                {tableName && (
                  <CardDescription>Giải: {tableName}</CardDescription>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Team info */}
            <Alert>
              <Users className="h-4 w-4" />
              <AlertDescription>
                Bạn được mời làm partner của <strong>{team?.player1_display_name}</strong>
                {team?.player1_team && <> ({team.player1_team})</>}
              </AlertDescription>
            </Alert>

            {/* Registration form */}
            <form onSubmit={handleSubmit} className="space-y-6">
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
                  <Label htmlFor="teamName">Team / CLB</Label>
                  <Input
                    id="teamName"
                    value={teamName}
                    onChange={(e) => setTeamName(e.target.value)}
                    placeholder="VD: CLB Pickleball Quận 1"
                  />
                </div>
              </div>

              {/* Skill Level */}
              <div className="space-y-4">
                <Label>Trình độ</Label>
                
                <RadioGroup
                  value={ratingSystem}
                  onValueChange={(v) => setRatingSystem(v as SkillRatingSystem)}
                  className="space-y-3"
                >
                  <div className="flex items-start space-x-3">
                    <RadioGroupItem value="DUPR" id="dupr" />
                    <div className="flex-1">
                      <Label htmlFor="dupr" className="cursor-pointer font-medium">DUPR</Label>
                      <p className="text-sm text-muted-foreground">Hệ thống rating DUPR</p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <RadioGroupItem value="other" id="other" />
                    <div className="flex-1">
                      <Label htmlFor="other" className="cursor-pointer font-medium">Hệ thống khác</Label>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <RadioGroupItem value="none" id="none" />
                    <div className="flex-1">
                      <Label htmlFor="none" className="cursor-pointer font-medium">Chưa có rating</Label>
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

              <Button type="submit" className="w-full" disabled={loading || !displayName.trim()}>
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Đang xử lý...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 mr-2" />
                    Xác nhận tham gia đội
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
