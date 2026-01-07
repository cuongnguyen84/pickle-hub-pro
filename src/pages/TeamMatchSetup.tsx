import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, ArrowRight, Check, Info, Users, Gamepad2, Zap, Trophy } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useTeamMatch, CreateTournamentInput } from '@/hooks/useTeamMatch';
import { GameTemplateEditor, GameTemplateItem, getDefaultTemplates } from '@/components/teamMatch/GameTemplateEditor';
import { cn } from '@/lib/utils';

type Step = 1 | 2 | 3 | 4;

const STEPS = [
  { id: 1, title: 'Thông tin cơ bản', icon: Users },
  { id: 2, title: 'Game Templates', icon: Gamepad2 },
  { id: 3, title: 'DreamBreaker', icon: Zap },
  { id: 4, title: 'Thể thức', icon: Trophy },
];

const ROSTER_SIZE_OPTIONS = [
  { value: 4, label: '4 người/đội' },
  { value: 6, label: '6 người/đội' },
  { value: 8, label: '8 người/đội' },
];

const GAME_TYPE_LABELS: Record<string, string> = {
  WD: 'Đôi Nữ (WD)',
  MD: 'Đôi Nam (MD)',
  MX: 'Đôi Nam Nữ (MX)',
  WS: 'Đơn Nữ (WS)',
  MS: 'Đơn Nam (MS)',
};

export default function TeamMatchSetup() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { createTournament, isCreating } = useTeamMatch();

  const [step, setStep] = useState<Step>(1);
  
  // Step 1: Basic info
  const [name, setName] = useState('');
  const [rosterSize, setRosterSize] = useState<4 | 6 | 8>(4);
  const [teamCount, setTeamCount] = useState(4);
  const [requireRegistration, setRequireRegistration] = useState(false);
  const [requireMinGames, setRequireMinGames] = useState(false);

  // Step 2: Game templates
  const [templates, setTemplates] = useState<GameTemplateItem[]>(() => getDefaultTemplates(4));

  // Step 3: DreamBreaker
  const [hasDreambreaker, setHasDreambreaker] = useState(false);
  const [dreambreakerGameType, setDreambreakerGameType] = useState<'WD' | 'MD' | 'MX' | 'WS' | 'MS'>('MX');
  const [dreambreakerScoringType, setDreambreakerScoringType] = useState<'rally21' | 'sideout11'>('rally21');

  // Step 4: Format
  const [format, setFormat] = useState<'round_robin' | 'single_elimination' | 'rr_playoff'>('round_robin');
  const [playoffTeamCount, setPlayoffTeamCount] = useState(4);

  // When roster size changes, reset templates
  const handleRosterSizeChange = (size: 4 | 6 | 8) => {
    setRosterSize(size);
    setTemplates(getDefaultTemplates(size));
  };

  const isEvenGames = templates.length % 2 === 0;

  const canProceed = () => {
    switch (step) {
      case 1:
        return name.trim().length >= 3 && teamCount >= 2;
      case 2:
        return templates.length >= 1;
      case 3:
        return true;
      case 4:
        return true;
      default:
        return false;
    }
  };

  const handleSubmit = async () => {
    if (!user) {
      navigate('/login');
      return;
    }

    const input: CreateTournamentInput = {
      name: name.trim(),
      team_roster_size: rosterSize,
      team_count: teamCount,
      format,
      playoff_team_count: format === 'rr_playoff' ? playoffTeamCount : undefined,
      require_registration: requireRegistration,
      has_dreambreaker: hasDreambreaker,
      dreambreaker_game_type: hasDreambreaker ? dreambreakerGameType : undefined,
      dreambreaker_scoring_type: hasDreambreaker ? dreambreakerScoringType : undefined,
      require_min_games_per_player: requireMinGames,
      game_templates: templates.map(t => ({
        order_index: t.order_index,
        game_type: t.game_type,
        display_name: t.display_name,
        scoring_type: t.scoring_type,
      })),
    };

    try {
      const result = await createTournament(input);
      navigate(`/tools/team-match/${result.share_id}`);
    } catch (error) {
      // Error handled in hook
    }
  };

  if (!user) {
    return (
      <MainLayout>
        <div className="container max-w-2xl py-12 text-center">
          <Users className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h1 className="text-2xl font-bold mb-2">Đăng nhập để tiếp tục</h1>
          <p className="text-muted-foreground mb-6">
            Bạn cần đăng nhập để tạo giải đấu đồng đội
          </p>
          <Button onClick={() => navigate('/login')}>
            Đăng nhập
          </Button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container max-w-3xl py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/tools/team-match')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">Tạo giải đấu đồng đội</h1>
            <p className="text-muted-foreground">Kiểu MLP - Major League Pickleball</p>
          </div>
        </div>

        {/* Step indicators */}
        <div className="flex items-center justify-between px-4">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center">
              <div
                className={cn(
                  "flex items-center justify-center w-10 h-10 rounded-full border-2 transition-colors",
                  step >= s.id
                    ? "bg-primary border-primary text-primary-foreground"
                    : "border-muted-foreground/30 text-muted-foreground"
                )}
              >
                {step > s.id ? (
                  <Check className="h-5 w-5" />
                ) : (
                  <s.icon className="h-5 w-5" />
                )}
              </div>
              {i < STEPS.length - 1 && (
                <div 
                  className={cn(
                    "hidden sm:block w-16 lg:w-24 h-0.5 mx-2",
                    step > s.id ? "bg-primary" : "bg-muted-foreground/30"
                  )}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step content */}
        <Card>
          <CardHeader>
            <CardTitle>{STEPS[step - 1].title}</CardTitle>
            <CardDescription>
              Bước {step}/{STEPS.length}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Step 1: Basic Info */}
            {step === 1 && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="name">Tên giải đấu *</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="VD: MLP Mùa Xuân 2026"
                  />
                </div>

                <div className="space-y-3">
                  <Label>Số người mỗi đội *</Label>
                  <RadioGroup
                    value={rosterSize.toString()}
                    onValueChange={(v) => handleRosterSizeChange(Number(v) as 4 | 6 | 8)}
                    className="grid grid-cols-3 gap-4"
                  >
                    {ROSTER_SIZE_OPTIONS.map(opt => (
                      <div key={opt.value}>
                        <RadioGroupItem
                          value={opt.value.toString()}
                          id={`roster-${opt.value}`}
                          className="peer sr-only"
                        />
                        <Label
                          htmlFor={`roster-${opt.value}`}
                          className="flex items-center justify-center rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
                        >
                          <span className="font-semibold">{opt.label}</span>
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                  <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                    <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <span>
                      Số nam/nữ tham khảo theo kiểu MLP. BTC có thể tự quyết định tỷ lệ phù hợp.
                    </span>
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="teamCount">Số đội *</Label>
                  <Input
                    id="teamCount"
                    type="number"
                    min={2}
                    max={32}
                    value={teamCount}
                    onChange={(e) => setTeamCount(Number(e.target.value))}
                  />
                </div>

                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <Label>Yêu cầu đăng ký trước</Label>
                    <p className="text-sm text-muted-foreground">
                      Đội trưởng tạo đội và mời thành viên
                    </p>
                  </div>
                  <Switch
                    checked={requireRegistration}
                    onCheckedChange={setRequireRegistration}
                  />
                </div>

                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <Label>Mỗi VĐV ít nhất 1 game</Label>
                    <p className="text-sm text-muted-foreground">
                      Bắt buộc lineup sử dụng tất cả thành viên
                    </p>
                  </div>
                  <Switch
                    checked={requireMinGames}
                    onCheckedChange={setRequireMinGames}
                  />
                </div>
              </>
            )}

            {/* Step 2: Game Templates */}
            {step === 2 && (
              <GameTemplateEditor
                templates={templates}
                onChange={setTemplates}
                rosterSize={rosterSize}
              />
            )}

            {/* Step 3: DreamBreaker */}
            {step === 3 && (
              <>
                {isEvenGames && (
                  <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                    <Info className="h-5 w-5 text-amber-500 mt-0.5" />
                    <div>
                      <p className="font-medium text-amber-600 dark:text-amber-400">
                        Số game là số chẵn ({templates.length} games)
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Khi 2 đội thắng số game bằng nhau, có thể cần DreamBreaker để phân định.
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <Label>Bật DreamBreaker</Label>
                    <p className="text-sm text-muted-foreground">
                      Game phụ khi 2 đội hòa về số game thắng
                    </p>
                  </div>
                  <Switch
                    checked={hasDreambreaker}
                    onCheckedChange={setHasDreambreaker}
                  />
                </div>

                {hasDreambreaker && (
                  <div className="space-y-4 pl-4 border-l-2 border-primary">
                    <div className="space-y-2">
                      <Label>Loại game</Label>
                      <Select
                        value={dreambreakerGameType}
                        onValueChange={(v) => setDreambreakerGameType(v as any)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(GAME_TYPE_LABELS).map(([value, label]) => (
                            <SelectItem key={value} value={value}>
                              {label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Cách tính điểm</Label>
                      <RadioGroup
                        value={dreambreakerScoringType}
                        onValueChange={(v) => setDreambreakerScoringType(v as any)}
                        className="flex gap-4"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="rally21" id="db-rally21" />
                          <Label htmlFor="db-rally21">Rally 21</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="sideout11" id="db-sideout11" />
                          <Label htmlFor="db-sideout11">Sideout 11</Label>
                        </div>
                      </RadioGroup>
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Step 4: Format */}
            {step === 4 && (
              <>
                <RadioGroup
                  value={format}
                  onValueChange={(v) => setFormat(v as any)}
                  className="space-y-4"
                >
                  <div className="flex items-start space-x-3 rounded-lg border p-4 cursor-pointer hover:bg-accent">
                    <RadioGroupItem value="round_robin" id="format-rr" className="mt-1" />
                    <div>
                      <Label htmlFor="format-rr" className="font-semibold cursor-pointer">
                        Vòng tròn (Round Robin)
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Tất cả các đội đấu với nhau
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3 rounded-lg border p-4 cursor-pointer hover:bg-accent">
                    <RadioGroupItem value="single_elimination" id="format-se" className="mt-1" />
                    <div>
                      <Label htmlFor="format-se" className="font-semibold cursor-pointer">
                        Loại trực tiếp (Single Elimination)
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Thua 1 trận là bị loại
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3 rounded-lg border p-4 cursor-pointer hover:bg-accent">
                    <RadioGroupItem value="rr_playoff" id="format-rrp" className="mt-1" />
                    <div className="flex-1">
                      <Label htmlFor="format-rrp" className="font-semibold cursor-pointer">
                        Vòng tròn + Playoff
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Vòng bảng rồi các đội đầu bảng vào playoff
                      </p>
                    </div>
                  </div>
                </RadioGroup>

                {format === 'rr_playoff' && (
                  <div className="space-y-2 pl-4 border-l-2 border-primary">
                    <Label htmlFor="playoffCount">Số đội vào playoff</Label>
                    <Select
                      value={playoffTeamCount.toString()}
                      onValueChange={(v) => setPlayoffTeamCount(Number(v))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="2">2 đội (Chung kết)</SelectItem>
                        <SelectItem value="4">4 đội (Bán kết)</SelectItem>
                        <SelectItem value="8">8 đội (Tứ kết)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Navigation buttons */}
        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={() => setStep((s) => (s - 1) as Step)}
            disabled={step === 1}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Quay lại
          </Button>

          {step < 4 ? (
            <Button
              onClick={() => setStep((s) => (s + 1) as Step)}
              disabled={!canProceed()}
            >
              Tiếp tục
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={isCreating}>
              {isCreating ? 'Đang tạo...' : 'Tạo giải đấu'}
              <Check className="h-4 w-4 ml-2" />
            </Button>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
