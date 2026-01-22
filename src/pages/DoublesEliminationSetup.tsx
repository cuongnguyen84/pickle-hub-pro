import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout";
import { DynamicMeta } from "@/components/seo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useAuth } from "@/hooks/useAuth";
import { useDoublesElimination, BestOfFormat } from "@/hooks/useDoublesElimination";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, ArrowRight, Plus, Trash2, Shuffle, Trophy, Users } from "lucide-react";
import { parseCourtsInput } from "@/lib/round-robin";

interface TeamInput {
  id: string;
  name: string;
  seed: string; // Changed to string for empty input
  team: string; // Club/team to avoid early matchups
}

type Step = 'info' | 'format' | 'teams';

const SUGGESTED_COUNTS = [32, 40, 48, 64, 80, 96, 128];

// Calculate tournament structure hints using correct formula:
// T3 = teams entering Round 3
// R4 = 2^floor(log2(T3)) - target power of 2 for Round 4
// Teams with bye = 2×R4 − T3
function calculateTournamentHints(teamCount: number): { r1Matches: number; byesToR4: number; isEven: boolean; t3: number; r4Target: number } {
  const N = teamCount;
  
  // Round 1: All teams play
  const r1Matches = Math.floor(N / 2);
  const W1 = r1Matches; // Winners from Round 1
  const L1 = r1Matches; // Losers from Round 1 (go to Loser Bracket)
  
  // Round 2 (Loser Bracket): Losers from R1 play each other
  const r2Matches = Math.floor(L1 / 2);
  const byeInR2 = L1 % 2 === 1 ? 1 : 0;
  const W2 = r2Matches + byeInR2; // Winners from Round 2
  
  // Round 3 (Merge Round): W1 + W2 teams enter
  const T3 = W1 + W2;
  
  // R4 target = 2^floor(log2(T3)) - the power of 2 we're normalizing to
  const R4 = Math.pow(2, Math.floor(Math.log2(T3)));
  
  // Teams with bye to Round 4 = 2×R4 − T3
  const byesToR4 = 2 * R4 - T3;
  
  return {
    r1Matches,
    byesToR4,
    isEven: r1Matches % 2 === 0,
    t3: T3,
    r4Target: R4
  };
}

export default function DoublesEliminationSetup() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { createTournament, addTeams, generateBracket, loading } = useDoublesElimination();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>('info');
  
  // Step 1: Info
  const [name, setName] = useState('');
  const [teamCount, setTeamCount] = useState(32);
  const [courts, setCourts] = useState(''); // Court numbers like "3,4,5,6,7,8"
  const [startTime, setStartTime] = useState('');
  
  // Step 2: Format
  const [earlyRoundsFormat, setEarlyRoundsFormat] = useState<BestOfFormat>('bo1');
  const [semifinalsFormat, setSemifinalsFormat] = useState<BestOfFormat>('bo3');
  const [finalsFormat, setFinalsFormat] = useState<BestOfFormat>('bo3');
  const [hasThirdPlace, setHasThirdPlace] = useState(false);
  const [customSemifinals, setCustomSemifinals] = useState(false);
  const [customFinals, setCustomFinals] = useState(false);
  
  // Step 3: Teams
  const [teams, setTeams] = useState<TeamInput[]>([]);

  // Initialize teams when moving to step 3 - with empty seeds
  const initializeTeams = () => {
    const newTeams: TeamInput[] = [];
    for (let i = 0; i < teamCount; i++) {
      newTeams.push({
        id: `team_${i}`,
        name: '',
        seed: '', // Empty seed by default
        team: ''
      });
    }
    setTeams(newTeams);
  };

  const updateTeam = (index: number, field: keyof TeamInput, value: string) => {
    const updated = [...teams];
    updated[index] = { ...updated[index], [field]: value };
    setTeams(updated);
  };

  const addTeamSlot = () => {
    setTeams(prev => [
      ...prev,
      { id: `team_${prev.length}`, name: '', seed: '', team: '' }
    ]);
  };

  const removeTeamSlot = (index: number) => {
    if (teams.length <= 32) return;
    setTeams(prev => prev.filter((_, i) => i !== index));
  };

  const shuffleTeams = () => {
    const filledTeams = teams.filter(t => t.name.trim());
    const shuffled = [...filledTeams].sort(() => Math.random() - 0.5);
    
    const newTeams = shuffled.map((t, i) => ({
      ...t,
      seed: String(i + 1)
    }));
    
    // Fill remaining slots
    while (newTeams.length < Math.max(teamCount, teams.length)) {
      newTeams.push({
        id: `team_${newTeams.length}`,
        name: '',
        seed: '',
        team: ''
      });
    }
    
    setTeams(newTeams);
    toast({ title: "Đã xáo trộn thứ tự đội" });
  };

  const handleNext = () => {
    if (step === 'info') {
      if (!name.trim()) {
        toast({ title: "Vui lòng nhập tên giải đấu", variant: "destructive" });
        return;
      }
      if (teamCount < 32) {
        toast({ title: "Số đội tối thiểu là 32", variant: "destructive" });
        return;
      }
      setStep('format');
    } else if (step === 'format') {
      initializeTeams();
      setStep('teams');
    }
  };

  const handleBack = () => {
    if (step === 'format') setStep('info');
    else if (step === 'teams') setStep('format');
  };

  // Get effective format for semifinals and finals based on checkbox state
  const getEffectiveSemifinalsFormat = (): BestOfFormat => {
    if (customSemifinals) return semifinalsFormat;
    return earlyRoundsFormat;
  };

  const getEffectiveFinalsFormat = (): BestOfFormat => {
    if (customFinals) return finalsFormat;
    return earlyRoundsFormat;
  };

  const handleCreate = async () => {
    // Validate teams
    const filledTeams = teams.filter(t => t.name.trim());
    
    if (filledTeams.length < 32) {
      toast({ 
        title: "Cần ít nhất 32 đội", 
        description: `Hiện có ${filledTeams.length} đội hợp lệ`,
        variant: "destructive" 
      });
      return;
    }

    // Parse courts input
    const parsedCourts = parseCourtsInput(courts);

    // Create tournament with all format settings
    const result = await createTournament(
      name,
      filledTeams.length,
      hasThirdPlace,
      earlyRoundsFormat,
      getEffectiveFinalsFormat(),
      parsedCourts,
      startTime || undefined,
      getEffectiveSemifinalsFormat()
    );

    if (!result.success || !result.tournament) {
      toast({ title: "Lỗi tạo giải đấu", description: result.error, variant: "destructive" });
      return;
    }

    // Add teams - now using name field and team as club
    // Only include seed if user explicitly entered it
    const teamsResult = await addTeams(
      result.tournament.id,
      filledTeams.map((t) => ({
        team_name: t.name,
        player1_name: t.name, // Use name as player1 for compatibility
        player2_name: undefined,
        seed: t.seed && t.seed.trim() ? parseInt(t.seed) : undefined, // Only set seed if user entered it
        club: t.team // Pass club/team info
      }))
    );

    if (!teamsResult.success) {
      toast({ title: "Lỗi thêm đội", description: teamsResult.error, variant: "destructive" });
      return;
    }

    // Generate bracket with courts
    const bracketResult = await generateBracket(result.tournament.id, parsedCourts);

    if (!bracketResult.success) {
      toast({ title: "Lỗi tạo bracket", description: bracketResult.error, variant: "destructive" });
      return;
    }

    toast({ title: "Tạo giải đấu thành công!" });
    navigate(`/tools/doubles-elimination/${result.tournament.share_id}`);
  };

  if (!user) {
    return (
      <MainLayout>
        <div className="container max-w-2xl mx-auto py-12 text-center">
          <h2 className="text-xl font-semibold mb-4">Đăng nhập để tạo giải đấu</h2>
          <Button onClick={() => navigate('/login')}>Đăng nhập</Button>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <DynamicMeta 
        title="Tạo giải Doubles Elimination"
        description="Tạo giải đấu Doubles Elimination mới"
      />
      
      <div className="container max-w-3xl mx-auto py-6 px-4">
        <Button 
          variant="ghost" 
          onClick={() => navigate('/tools/doubles-elimination')}
          className="mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Quay lại
        </Button>

        {/* Progress Steps */}
        <div className="flex items-center justify-center gap-4 mb-8">
          {['Thông tin', 'Format', 'Danh sách đội'].map((label, i) => {
            const stepKeys: Step[] = ['info', 'format', 'teams'];
            const isActive = step === stepKeys[i];
            const isPast = stepKeys.indexOf(step) > i;
            
            return (
              <div key={label} className="flex items-center gap-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium
                  ${isActive ? 'bg-primary text-primary-foreground' : 
                    isPast ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'}`}>
                  {i + 1}
                </div>
                <span className={isActive ? 'font-medium' : 'text-muted-foreground'}>{label}</span>
                {i < 2 && <ArrowRight className="w-4 h-4 text-muted-foreground mx-2" />}
              </div>
            );
          })}
        </div>

        {/* Step 1: Info */}
        {step === 'info' && (
          <Card>
            <CardHeader>
              <CardTitle>Thông tin giải đấu</CardTitle>
              <CardDescription>Nhập thông tin cơ bản của giải đấu</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="name">Tên giải đấu *</Label>
                <Input
                  id="name"
                  placeholder="VD: Giải Pickleball Mùa Hè 2025"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Số đội tham gia * (tối thiểu 32)</Label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {SUGGESTED_COUNTS.map((count) => (
                    <Button
                      key={count}
                      variant={teamCount === count ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setTeamCount(count)}
                    >
                      {count}
                    </Button>
                  ))}
                </div>
                <Input
                  type="number"
                  min={32}
                  value={teamCount || ''}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '') {
                      setTeamCount(0);
                    } else {
                      setTeamCount(parseInt(val) || 0);
                    }
                  }}
                  onBlur={(e) => {
                    const val = parseInt(e.target.value) || 0;
                    if (val < 32) setTeamCount(32);
                  }}
                />
                
                {/* Hints based on team count */}
                {(() => {
                  const hints = calculateTournamentHints(teamCount);
                  return (
                    <div className="mt-2 p-3 bg-muted/50 rounded-lg text-sm space-y-1">
                      <div className="flex items-center gap-2">
                        <span className={hints.isEven ? "text-green-600" : "text-yellow-600"}>
                          {hints.isEven ? "✓" : "⚠"}
                        </span>
                        <span>
                          Vòng 1: {hints.r1Matches} trận 
                          {!hints.isEven && (
                            <span className="text-yellow-600 ml-1">(lẻ - nên chọn số chẵn)</span>
                          )}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <span>📊</span>
                        <span>
                          Vào Vòng 3: <strong className="text-foreground">{hints.t3} VĐV</strong> (W1 + W2) → Vòng 4: {hints.r4Target} VĐV
                        </span>
                      </div>
                      {hints.byesToR4 > 0 && (
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <span>🎯</span>
                          <span>
                            Được vào thẳng Vòng 4: <strong className="text-foreground">{hints.byesToR4} VĐV</strong>
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })()}
                
                <p className="text-xs text-muted-foreground mt-2">
                  Gợi ý: 32, 40, 48, 64, 80, 96, 128 đội để bracket cân đối
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="courts">Số sân</Label>
                  <Input
                    id="courts"
                    value={courts}
                    onChange={(e) => setCourts(e.target.value)}
                    placeholder="VD: 3, 4, 5, 6"
                  />
                  <p className="text-xs text-muted-foreground">
                    Nhập số sân cách nhau bởi dấu phẩy. VD: 3,4,5,6 = 4 sân đánh số 3-6
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="startTime">Giờ bắt đầu</Label>
                  <Input
                    id="startTime"
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button onClick={handleNext}>
                  Tiếp theo
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Format */}
        {step === 'format' && (
          <Card>
            <CardHeader>
              <CardTitle>Format thi đấu</CardTitle>
              <CardDescription>Chọn số game cho mỗi trận đấu</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-3">
                <Label>Vòng ngoài (đến trước Bán kết)</Label>
                <RadioGroup
                  value={earlyRoundsFormat}
                  onValueChange={(v) => setEarlyRoundsFormat(v as BestOfFormat)}
                  className="flex gap-4"
                >
                  {(['bo1', 'bo3', 'bo5'] as const).map((format) => (
                    <div key={format} className="flex items-center space-x-2">
                      <RadioGroupItem value={format} id={`early-${format}`} />
                      <Label htmlFor={`early-${format}`} className="cursor-pointer">
                        {format.toUpperCase()}
                        <span className="text-muted-foreground ml-1">
                          ({format === 'bo1' ? '1 game' : format === 'bo3' ? 'Thắng 2/3' : 'Thắng 3/5'})
                        </span>
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              {/* Semifinals - checkbox to customize */}
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="customSemifinals"
                    checked={customSemifinals}
                    onCheckedChange={(checked) => setCustomSemifinals(checked as boolean)}
                  />
                  <Label htmlFor="customSemifinals" className="cursor-pointer">
                    Bán kết (tùy chỉnh format khác vòng ngoài)
                  </Label>
                </div>
                {customSemifinals && (
                  <RadioGroup
                    value={semifinalsFormat}
                    onValueChange={(v) => setSemifinalsFormat(v as BestOfFormat)}
                    className="flex gap-4 pl-6"
                  >
                    {(['bo3', 'bo5'] as const).map((format) => (
                      <div key={format} className="flex items-center space-x-2">
                        <RadioGroupItem value={format} id={`semi-${format}`} />
                        <Label htmlFor={`semi-${format}`} className="cursor-pointer">
                          {format.toUpperCase()}
                          <span className="text-muted-foreground ml-1">
                            ({format === 'bo3' ? 'Thắng 2/3' : 'Thắng 3/5'})
                          </span>
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                )}
              </div>

              {/* Finals - checkbox to customize */}
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="customFinals"
                    checked={customFinals}
                    onCheckedChange={(checked) => setCustomFinals(checked as boolean)}
                  />
                  <Label htmlFor="customFinals" className="cursor-pointer">
                    Chung kết (tùy chỉnh format khác vòng ngoài)
                  </Label>
                </div>
                {customFinals && (
                  <RadioGroup
                    value={finalsFormat}
                    onValueChange={(v) => setFinalsFormat(v as BestOfFormat)}
                    className="flex gap-4 pl-6"
                  >
                    {(['bo3', 'bo5'] as const).map((format) => (
                      <div key={format} className="flex items-center space-x-2">
                        <RadioGroupItem value={format} id={`finals-${format}`} />
                        <Label htmlFor={`finals-${format}`} className="cursor-pointer">
                          {format.toUpperCase()}
                          <span className="text-muted-foreground ml-1">
                            ({format === 'bo3' ? 'Thắng 2/3' : 'Thắng 3/5'})
                          </span>
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="thirdPlace"
                  checked={hasThirdPlace}
                  onCheckedChange={(checked) => setHasThirdPlace(checked as boolean)}
                />
                <Label htmlFor="thirdPlace" className="cursor-pointer">
                  Có trận tranh hạng 3
                </Label>
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={handleBack}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Quay lại
                </Button>
                <Button onClick={handleNext}>
                  Tiếp theo
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Teams */}
        {step === 'teams' && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Danh sách đội ({teams.filter(t => t.name.trim()).length}/{teams.length})</CardTitle>
                  <CardDescription>Nhập thông tin các đội tham gia</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={shuffleTeams}>
                  <Shuffle className="w-4 h-4 mr-2" />
                  Xáo trộn
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Header row */}
              <div className="grid grid-cols-12 gap-2 text-sm font-medium text-muted-foreground px-3">
                <div className="col-span-1 text-center">#</div>
                <div className="col-span-5">Tên</div>
                <div className="col-span-3">Team</div>
                <div className="col-span-2">Seed</div>
                <div className="col-span-1"></div>
              </div>
              
              <div className="max-h-[500px] overflow-y-auto space-y-3 pr-2">
                {teams.map((team, index) => (
                  <div 
                    key={team.id} 
                    className="grid grid-cols-12 gap-2 items-center p-3 bg-muted/30 rounded-lg"
                  >
                    <div className="col-span-1 text-center font-medium text-muted-foreground">
                      {index + 1}
                    </div>
                    <div className="col-span-5">
                      <Input
                        placeholder="Tên đội / VĐV"
                        value={team.name}
                        onChange={(e) => updateTeam(index, 'name', e.target.value)}
                      />
                    </div>
                    <div className="col-span-3">
                      <Input
                        placeholder="Team"
                        value={team.team}
                        onChange={(e) => updateTeam(index, 'team', e.target.value)}
                      />
                    </div>
                    <div className="col-span-2">
                      <Input
                        type="number"
                        min={1}
                        placeholder=""
                        value={team.seed}
                        onChange={(e) => updateTeam(index, 'seed', e.target.value)}
                      />
                    </div>
                    <div className="col-span-1 flex justify-center">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => removeTeamSlot(index)}
                        disabled={teams.length <= 32}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add team button */}
              <div className="pt-2 border-t">
                <Button variant="outline" onClick={addTeamSlot} className="w-full">
                  <Plus className="w-4 h-4 mr-2" />
                  Thêm đội/VĐV
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                💡 Tip: Đội cùng Team/CLB sẽ được ưu tiên tránh gặp nhau ở vòng đầu
              </p>

              <div className="flex justify-between pt-4 border-t">
                <Button variant="outline" onClick={handleBack}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Quay lại
                </Button>
                <Button onClick={handleCreate} disabled={loading}>
                  {loading ? 'Đang tạo...' : 'Tạo giải đấu'}
                  <Trophy className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}
