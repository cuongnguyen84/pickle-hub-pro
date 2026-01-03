import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useTeamRegistration, type Team, type TeamFormData } from '@/hooks/useTeamRegistration';
import { usePairRequest, type PairRequest } from '@/hooks/usePairRequest';
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { 
  UserPlus, CheckCircle2, Clock, XCircle, AlertCircle, LogIn, 
  Users, UserMinus, Handshake, Loader2, Bell
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'sonner';

interface DoublesRegistrationFormProps {
  tableId: string;
  tableName: string;
  shareId?: string;
  requiresSkillLevel?: boolean;
  registrationMessage?: string | null;
  existingTeam?: Team | null;
  allTeams?: Team[];
  tableStatus?: string;
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
  allTeams = [],
  tableStatus = 'setup',
  onRegistrationComplete,
}: DoublesRegistrationFormProps) {
  const { user } = useAuth();
  const { createTeam, removePartner, loading: teamLoading } = useTeamRegistration();
  const { 
    getIncomingRequests, 
    getOutgoingRequests, 
    createPairRequest, 
    respondToPairRequest,
    cancelPairRequest,
    loading: pairLoading 
  } = usePairRequest();
  const navigate = useNavigate();
  const location = useLocation();

  const [displayName, setDisplayName] = useState('');
  const [team, setTeam] = useState('');
  const [ratingSystem, setRatingSystem] = useState<SkillRatingSystem>('none');
  const [skillLevel, setSkillLevel] = useState('');
  const [skillDescription, setSkillDescription] = useState('');
  const [profileLink, setProfileLink] = useState('');
  
  // Pair request state
  const [incomingRequests, setIncomingRequests] = useState<PairRequest[]>([]);
  const [outgoingRequests, setOutgoingRequests] = useState<PairRequest[]>([]);
  
  // Confirm dialog
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false);
  const [selectedTeamForPairing, setSelectedTeamForPairing] = useState<Team | null>(null);

  const loading = teamLoading || pairLoading;
  const isTableLocked = tableStatus !== 'setup';

  // Load pair requests when team exists
  useEffect(() => {
    if (existingTeam && user) {
      loadPairRequests();
    }
  }, [existingTeam, user]);

  const loadPairRequests = async () => {
    const [incoming, outgoing] = await Promise.all([
      getIncomingRequests(tableId),
      getOutgoingRequests(tableId),
    ]);
    setIncomingRequests(incoming);
    setOutgoingRequests(outgoing);
  };

  const handleLoginClick = () => {
    const returnUrl = location.pathname + location.search;
    navigate(`/login?redirect=${encodeURIComponent(returnUrl)}`);
  };

  // Filter available teams for pairing
  const availableTeamsForPairing = allTeams.filter(t => 
    t.id !== existingTeam?.id && // Not self
    t.player2_user_id === null && // No partner yet
    t.team_status !== 'rejected' && 
    t.team_status !== 'removed' &&
    t.player1_user_id !== user?.id // Not current user's team
  );

  // Handle pair request
  const handlePairRequest = (targetTeam: Team) => {
    setSelectedTeamForPairing(targetTeam);
    setConfirmDialogOpen(true);
  };

  const confirmPairRequest = async () => {
    if (!selectedTeamForPairing) return;
    
    const result = await createPairRequest(tableId, selectedTeamForPairing.id);
    if (result.success) {
      setConfirmDialogOpen(false);
      setSelectedTeamForPairing(null);
      loadPairRequests();
      onRegistrationComplete?.();
    }
  };

  // Check if user has a pending request to a specific team
  const hasPendingRequestTo = (teamId: string) => {
    return outgoingRequests.some(r => r.to_team_id === teamId);
  };

  // Check if user has incoming request from a specific team
  const hasIncomingRequestFrom = (teamId: string) => {
    return incomingRequests.some(r => r.from_team_id === teamId);
  };

  // Not logged in
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

  // User is partner in a team (player2)
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

  // User has registered and their team is REJECTED
  if (existingTeam && (existingTeam.team_status === 'rejected' || existingTeam.team_status === 'removed')) {
    return (
      <Card>
        <CardContent className="py-6">
          <div className="text-center">
            <XCircle className="w-12 h-12 mx-auto mb-3 text-destructive" />
            <h3 className="font-semibold text-lg mb-1">Bạn đã bị từ chối tham gia giải</h3>
            {existingTeam.btc_notes && (
              <p className="text-muted-foreground mt-2">
                Lý do: {existingTeam.btc_notes}
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // User is VDV1 (team owner) - show team management + pairing
  if (existingTeam && existingTeam.player1_user_id === user.id) {
    const hasPartner = existingTeam.player2_user_id !== null;

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Đội của bạn
          </CardTitle>
          <CardDescription>
            Quản lý đội và ghép đôi với VĐV khác
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Status Alert */}
          {existingTeam.btc_approved || existingTeam.team_status === 'approved' ? (
            <Alert className="bg-green-50 border-green-200">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800 font-medium">
                Bạn đã được BTC duyệt
              </AlertDescription>
            </Alert>
          ) : (
            <Alert className="bg-amber-50 border-amber-200">
              <Clock className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800 font-medium">
                Bạn đang chờ BTC duyệt
              </AlertDescription>
            </Alert>
          )}

          {/* Incoming Pair Requests Banner */}
          {incomingRequests.length > 0 && !hasPartner && (
            <Alert className="bg-blue-50 border-blue-200">
              <Bell className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800">
                <div className="font-medium mb-2">
                  Có {incomingRequests.length} người đang chờ ghép đôi với bạn:
                </div>
                <div className="space-y-2">
                  {incomingRequests.map((req) => (
                    <div key={req.id} className="flex items-center justify-between bg-white rounded-lg p-2 border">
                      <span className="font-medium">
                        {req.from_team?.player1_display_name || 'VĐV'}
                        {req.from_team?.player1_team && (
                          <span className="text-muted-foreground ml-1">
                            ({req.from_team.player1_team})
                          </span>
                        )}
                      </span>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="default"
                          onClick={async () => {
                            const result = await respondToPairRequest(req.id, true);
                            if (result.success) {
                              onRegistrationComplete?.();
                            }
                          }}
                          disabled={loading || isTableLocked}
                        >
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                          Chấp nhận
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={async () => {
                            const result = await respondToPairRequest(req.id, false);
                            if (result.success) {
                              loadPairRequests();
                            }
                          }}
                          disabled={loading || isTableLocked}
                        >
                          <XCircle className="w-3 h-3 mr-1" />
                          Từ chối
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </AlertDescription>
            </Alert>
          )}

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
              {hasPartner ? (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    {existingTeam.player2_display_name}
                    {existingTeam.player2_team && ` - ${existingTeam.player2_team}`}
                  </p>
                  {!isTableLocked && (
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
                  )}
                </div>
              ) : (
                <p className="text-sm text-amber-600">Chưa có partner</p>
              )}
            </div>
          </div>

          {/* Outgoing requests */}
          {outgoingRequests.length > 0 && !hasPartner && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Yêu cầu ghép đôi đã gửi:</p>
              {outgoingRequests.map((req) => (
                <div key={req.id} className="flex items-center justify-between bg-muted/30 rounded-lg p-2 text-sm">
                  <span>
                    Đang chờ <strong>{req.to_team?.player1_display_name}</strong> xác nhận
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    onClick={async () => {
                      const success = await cancelPairRequest(req.id);
                      if (success) loadPairRequests();
                    }}
                    disabled={loading}
                  >
                    Hủy
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Available players for pairing */}
          {!hasPartner && !isTableLocked && availableTeamsForPairing.length > 0 && (
            <div className="space-y-3">
              <Separator />
              <h4 className="font-medium flex items-center gap-2">
                <Handshake className="w-4 h-4" />
                VĐV chưa có partner ({availableTeamsForPairing.length})
              </h4>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {availableTeamsForPairing.map((t) => {
                  const hasSentRequest = hasPendingRequestTo(t.id);
                  const hasReceivedRequest = hasIncomingRequestFrom(t.id);
                  
                  return (
                    <div key={t.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{t.player1_display_name}</p>
                        {t.player1_team && (
                          <p className="text-sm text-muted-foreground">{t.player1_team}</p>
                        )}
                        <div className="flex gap-1 mt-1">
                          {(t.btc_approved || t.team_status === 'approved') && (
                            <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                              Đã duyệt
                            </Badge>
                          )}
                          {t.player1_skill_level && (
                            <Badge variant="outline" className="text-xs">
                              {t.player1_rating_system}: {t.player1_skill_level}
                            </Badge>
                          )}
                        </div>
                      </div>
                      {hasSentRequest ? (
                        <Badge variant="secondary">Đang chờ xác nhận</Badge>
                      ) : hasReceivedRequest ? (
                        <Badge variant="default" className="bg-blue-600">Đang chờ bạn xác nhận</Badge>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handlePairRequest(t)}
                          disabled={loading}
                        >
                          <Handshake className="w-4 h-4 mr-1" />
                          Ghép đôi
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Table locked message */}
          {isTableLocked && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Giải đấu đã diễn ra. Không thể thay đổi đội.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>

        {/* Confirm Pair Dialog */}
        <Dialog open={confirmDialogOpen} onOpenChange={setConfirmDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Xác nhận ghép đôi</DialogTitle>
              <DialogDescription>
                Gửi yêu cầu ghép đôi với <strong>{selectedTeamForPairing?.player1_display_name}</strong>?
                {selectedTeamForPairing?.player1_team && (
                  <span> ({selectedTeamForPairing.player1_team})</span>
                )}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setConfirmDialogOpen(false)}>
                Hủy
              </Button>
              <Button onClick={confirmPairRequest} disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Đang gửi...
                  </>
                ) : (
                  'Xác nhận'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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
          Đăng ký tham gia giải <strong>{tableName}</strong>. Sau khi đăng ký, bạn có thể ghép đôi với VĐV khác.
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
              Sau khi đăng ký, bạn sẽ thấy danh sách VĐV chưa có partner và có thể gửi yêu cầu ghép đôi.
            </AlertDescription>
          </Alert>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? 'Đang gửi...' : 'Đăng ký tham dự'}
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

export default DoublesRegistrationForm;
