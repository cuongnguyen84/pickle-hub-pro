import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout';
import { DynamicMeta } from '@/components/seo';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, ArrowRight, Check, Info, Users, Gamepad2, Zap, Trophy } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useTeamMatch, CreateTournamentInput } from '@/hooks/useTeamMatch';
import { GameTemplateEditor, GameTemplateItem, getDefaultTemplates } from '@/components/teamMatch/GameTemplateEditor';
import { cn } from '@/lib/utils';
import { useI18n } from '@/i18n';
import { getLoginUrl } from '@/lib/auth-config';

type Step = 1 | 2 | 3 | 4;

const isPowerOfTwo = (n: number): boolean => n > 0 && (n & (n - 1)) === 0;

const ROSTER_SIZE_OPTIONS = [
  { value: 4, label: '4' },
  { value: 6, label: '6' },
  { value: 8, label: '8' },
];

export default function TeamMatchSetup() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, language } = useI18n();
  const { createTournament, isCreating } = useTeamMatch();

  const STEPS = [
    { id: 1, title: t.teamMatch.setup.stepBasicInfo, icon: Users },
    { id: 2, title: t.teamMatch.setup.stepGameTemplates, icon: Gamepad2 },
    { id: 3, title: t.teamMatch.setup.stepDreambreaker, icon: Zap },
    { id: 4, title: t.teamMatch.setup.stepFormat, icon: Trophy },
  ];

  const [step, setStep] = useState<Step>(1);
  
  const [name, setName] = useState('');
  const [rosterSize, setRosterSize] = useState<4 | 6 | 8>(4);
  const [teamCount, setTeamCount] = useState(4);
  const [requireRegistration, setRequireRegistration] = useState(false);
  const [requireMinGames, setRequireMinGames] = useState(false);

  const [templates, setTemplates] = useState<GameTemplateItem[]>(() => getDefaultTemplates(4));

  const [hasDreambreaker, setHasDreambreaker] = useState(false);

  const [format, setFormat] = useState<'round_robin' | 'single_elimination' | 'rr_playoff'>('round_robin');
  const [playoffTeamCount, setPlayoffTeamCount] = useState(4);
  const [hasThirdPlaceMatch, setHasThirdPlaceMatch] = useState(false);

  const isSingleElimination = format === 'single_elimination';
  const isValidTeamCountForSE = isPowerOfTwo(teamCount) && teamCount >= 4;
  const teamCountWarning = isSingleElimination && !isValidTeamCountForSE 
    ? t.teamMatch.setup.invalidTeamCount
    : null;

  const handleRosterSizeChange = (size: 4 | 6 | 8) => {
    setRosterSize(size);
    setTemplates(getDefaultTemplates(size));
  };

  const isEvenGames = templates.length % 2 === 0;
  const effectiveDreambreaker = isEvenGames && hasDreambreaker;

  const canProceed = () => {
    switch (step) {
      case 1:
        return name.trim().length >= 3 && teamCount >= 2;
      case 2:
        return templates.length >= 1;
      case 3:
        return true;
      case 4:
        if (format === 'single_elimination') {
          return isValidTeamCountForSE;
        }
        return true;
      default:
        return false;
    }
  };

  const handleSubmit = async () => {
    if (!user) {
      navigate(getLoginUrl('/tools/team-match/new'));
      return;
    }

    const input: CreateTournamentInput = {
      name: name.trim(),
      team_roster_size: rosterSize,
      team_count: teamCount,
      format,
      playoff_team_count: format === 'rr_playoff' ? playoffTeamCount : undefined,
      require_registration: requireRegistration,
      has_dreambreaker: effectiveDreambreaker,
      require_min_games_per_player: requireMinGames,
      has_third_place_match: format === 'single_elimination' ? hasThirdPlaceMatch : false,
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
          <h1 className="text-2xl font-bold mb-2">{t.teamMatch.setup.loginRequired}</h1>
          <p className="text-muted-foreground mb-6">
            {t.teamMatch.setup.loginRequiredDesc}
          </p>
          <Button onClick={() => navigate(getLoginUrl('/tools/team-match/new'))}>
            {t.auth.login}
          </Button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <DynamicMeta title={t.teamMatch.setup.title} noindex={true} />
      <div className="container max-w-3xl py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/tools/team-match')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold">{t.teamMatch.setup.title}</h1>
            <p className="text-muted-foreground">{t.teamMatch.setup.subtitle}</p>
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
              {language === 'vi' ? `Bước ${step}/${STEPS.length}` : `Step ${step}/${STEPS.length}`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Step 1: Basic Info */}
            {step === 1 && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="name">{t.teamMatch.setup.tournamentName} *</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t.teamMatch.setup.tournamentNamePlaceholder}
                  />
                </div>

                <div className="space-y-3">
                  <Label>{t.teamMatch.setup.playersPerTeam} *</Label>
                  <RadioGroup
                    value={rosterSize.toString()}
                    onValueChange={(v) => handleRosterSizeChange(Number(v) as 4 | 6 | 8)}
                    className="grid grid-cols-3 gap-3"
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
                          className="flex flex-col items-center justify-center rounded-xl border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 [&:has([data-state=checked])]:border-primary cursor-pointer transition-all"
                        >
                          <span className="text-3xl font-bold">{opt.label}</span>
                          <span className="text-xs text-muted-foreground mt-1">{language === 'vi' ? 'VĐV' : 'players'}</span>
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                  <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                    <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <span>
                      {language === 'vi' 
                        ? 'Số nam/nữ tham khảo theo kiểu MLP. BTC có thể tự quyết định tỷ lệ phù hợp.'
                        : 'MLP-style player count. Organizers decide the actual male/female ratio.'
                      }
                    </span>
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="teamCount">{t.teamMatch.setup.teamCount} *</Label>
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
                    <Label>{t.teamMatch.setup.requireRegistration}</Label>
                    <p className="text-sm text-muted-foreground">
                      {t.teamMatch.setup.requireRegistrationDesc}
                    </p>
                  </div>
                  <Switch
                    checked={requireRegistration}
                    onCheckedChange={setRequireRegistration}
                  />
                </div>

                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <Label>{t.teamMatch.setup.requireMinGames}</Label>
                    <p className="text-sm text-muted-foreground">
                      {t.teamMatch.setup.requireMinGamesDesc}
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
                {!isEvenGames ? (
                  <div className="flex items-start gap-3 p-4 bg-muted/50 border rounded-lg">
                    <Info className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="font-medium">
                        {language === 'vi' 
                          ? `Số game là số lẻ (${templates.length} games)`
                          : `Odd number of games (${templates.length} games)`
                        }
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {language === 'vi'
                          ? 'Không cần DreamBreaker vì đã có ván quyết định (ván cuối cùng).'
                          : 'No DreamBreaker needed as the last game serves as tiebreaker.'
                        }
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                      <Info className="h-5 w-5 text-amber-500 mt-0.5" />
                      <div>
                        <p className="font-medium text-amber-600 dark:text-amber-400">
                          {language === 'vi'
                            ? `Số game là số chẵn (${templates.length} games)`
                            : `Even number of games (${templates.length} games)`
                          }
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {language === 'vi'
                            ? 'Khi 2 đội thắng số game bằng nhau, cần DreamBreaker để phân định. Khi bật, ván lẻ cuối cùng sẽ là ván Dreambreaker.'
                            : 'When teams tie on game wins, DreamBreaker determines the winner.'
                          }
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <Label>{language === 'vi' ? 'Bật DreamBreaker' : 'Enable DreamBreaker'}</Label>
                        <p className="text-sm text-muted-foreground">
                          {language === 'vi'
                            ? 'Thêm ván quyết định khi 2 đội hòa về số game thắng'
                            : 'Add tiebreaker when teams are tied on games won'
                          }
                        </p>
                      </div>
                      <Switch
                        checked={hasDreambreaker}
                        onCheckedChange={setHasDreambreaker}
                      />
                    </div>

                    {hasDreambreaker && (
                      <div className="space-y-4 pl-4 border-l-2 border-primary">
                        <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                          <div className="flex items-center gap-2">
                            <Zap className="h-5 w-5 text-primary" />
                            <span className="font-semibold">
                              {language === 'vi' ? 'Ván Dreambreaker (Ván cuối cùng)' : 'Dreambreaker Game (Final Game)'}
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-1 gap-2 text-sm">
                            <div className="flex items-center justify-between py-2 border-b">
                              <span className="text-muted-foreground">{language === 'vi' ? 'Hình thức:' : 'Format:'}</span>
                              <span className="font-medium">{language === 'vi' ? 'Đánh Đơn (Singles)' : 'Singles'}</span>
                            </div>
                            <div className="flex items-center justify-between py-2 border-b">
                              <span className="text-muted-foreground">{language === 'vi' ? 'Số VĐV mỗi đội:' : 'Players per team:'}</span>
                              <span className="font-medium">{language === 'vi' ? '4 VĐV (Tự do chọn nam/nữ)' : '4 players (any gender)'}</span>
                            </div>
                            <div className="flex items-center justify-between py-2">
                              <span className="text-muted-foreground">{language === 'vi' ? 'Cách tính điểm:' : 'Scoring:'}</span>
                              <span className="font-medium">Rally Scoring</span>
                            </div>
                          </div>

                          <p className="text-xs text-muted-foreground mt-2">
                            {language === 'vi'
                              ? 'Dreambreaker theo chuẩn MLP: 4 VĐV thi đấu đơn, mỗi pha bóng đều tính điểm. Đội trưởng sẽ chọn 4 VĐV bất kỳ (không phân biệt giới tính) khi line up.'
                              : 'MLP-standard Dreambreaker: 4 singles players, rally scoring. Captain chooses 4 players (any gender) during lineup.'
                            }
                          </p>
                        </div>
                      </div>
                    )}
                  </>
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
                        {t.teamMatch.setup.formatRoundRobin}
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        {t.teamMatch.setup.formatRoundRobinDesc}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3 rounded-lg border p-4 cursor-pointer hover:bg-accent">
                    <RadioGroupItem value="single_elimination" id="format-se" className="mt-1" />
                    <div className="flex-1">
                      <Label htmlFor="format-se" className="font-semibold cursor-pointer">
                        {t.teamMatch.setup.formatSingleElimination}
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        {t.teamMatch.setup.formatSingleEliminationDesc}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3 rounded-lg border p-4 cursor-pointer hover:bg-accent">
                    <RadioGroupItem value="rr_playoff" id="format-rrp" className="mt-1" />
                    <div className="flex-1">
                      <Label htmlFor="format-rrp" className="font-semibold cursor-pointer">
                        {t.teamMatch.setup.formatRrPlayoff}
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        {t.teamMatch.setup.formatRrPlayoffDesc}
                      </p>
                    </div>
                  </div>
                </RadioGroup>

                {format === 'rr_playoff' && (
                  <div className="space-y-2 pl-4 border-l-2 border-primary">
                    <Label htmlFor="playoffCount">{t.teamMatch.setup.playoffTeams}</Label>
                    <Select
                      value={playoffTeamCount.toString()}
                      onValueChange={(v) => setPlayoffTeamCount(Number(v))}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="2">{language === 'vi' ? '2 đội (Chung kết)' : '2 teams (Finals)'}</SelectItem>
                        <SelectItem value="4">{language === 'vi' ? '4 đội (Bán kết)' : '4 teams (Semifinals)'}</SelectItem>
                        <SelectItem value="8">{language === 'vi' ? '8 đội (Tứ kết)' : '8 teams (Quarterfinals)'}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {format === 'single_elimination' && (
                  <div className="space-y-4 pl-4 border-l-2 border-primary">
                    {teamCountWarning && (
                      <div className="flex items-start gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                        <Info className="h-4 w-4 text-destructive mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-destructive">{teamCountWarning}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {language === 'vi' 
                              ? `Hiện tại: ${teamCount} đội. Quay lại bước 1 để điều chỉnh.`
                              : `Current: ${teamCount} teams. Go back to step 1 to adjust.`
                            }
                          </p>
                        </div>
                      </div>
                    )}

                    {isValidTeamCountForSE && (
                      <div className="flex items-start gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                        <Check className="h-4 w-4 text-green-600 mt-0.5" />
                        <p className="text-sm text-green-700 dark:text-green-400">
                          {language === 'vi'
                            ? `${teamCount} đội - Hợp lệ cho Single Elimination`
                            : `${teamCount} teams - Valid for Single Elimination`
                          }
                        </p>
                      </div>
                    )}

                    <div className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <Label>{t.teamMatch.setup.thirdPlaceMatch}</Label>
                        <p className="text-sm text-muted-foreground">
                          {t.teamMatch.setup.thirdPlaceMatchDesc}
                        </p>
                      </div>
                      <Switch
                        checked={hasThirdPlaceMatch}
                        onCheckedChange={setHasThirdPlaceMatch}
                      />
                    </div>

                    <div className="flex items-start gap-2 p-3 bg-muted rounded-lg">
                      <Info className="h-4 w-4 text-muted-foreground mt-0.5" />
                      <p className="text-sm text-muted-foreground">
                        {language === 'vi'
                          ? 'Sau khi tạo giải, BTC sẽ chọn cách ghép đội: Bốc thăm ngẫu nhiên hoặc Xếp thủ công.'
                          : 'After creation, organizers can choose: Random draw or Manual pairing.'
                        }
                      </p>
                    </div>
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
            {t.quickTable.back}
          </Button>

          {step < 4 ? (
            <Button
              onClick={() => setStep((s) => (s + 1) as Step)}
              disabled={!canProceed()}
            >
              {t.quickTable.continue}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={isCreating}>
              {isCreating ? t.teamMatch.setup.creating : t.teamMatch.setup.createBtn}
              <Check className="h-4 w-4 ml-2" />
            </Button>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
