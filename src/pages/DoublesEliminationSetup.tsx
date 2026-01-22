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

interface TeamInput {
  id: string;
  name: string;
  seed: number;
  team: string; // Club/team to avoid early matchups
}

type Step = 'info' | 'format' | 'teams';

const SUGGESTED_COUNTS = [32, 40, 48, 64, 80, 96, 128];

export default function DoublesEliminationSetup() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { createTournament, addTeams, generateBracket, loading } = useDoublesElimination();
  const { toast } = useToast();

  const [step, setStep] = useState<Step>('info');
  
  // Step 1: Info
  const [name, setName] = useState('');
  const [teamCount, setTeamCount] = useState(32);
  const [courtCount, setCourtCount] = useState(1);
  const [startTime, setStartTime] = useState('');
  
  // Step 2: Format
  const [earlyRoundsFormat, setEarlyRoundsFormat] = useState<BestOfFormat>('bo1');
  const [semifinalsFormat, setSemifinalsFormat] = useState<BestOfFormat>('bo3');
  const [finalsFormat, setFinalsFormat] = useState<BestOfFormat>('bo3');
  const [hasThirdPlace, setHasThirdPlace] = useState(false);
  
  // Step 3: Teams
  const [teams, setTeams] = useState<TeamInput[]>([]);

  // Initialize teams when moving to step 3
  const initializeTeams = () => {
    const newTeams: TeamInput[] = [];
    for (let i = 0; i < teamCount; i++) {
      newTeams.push({
        id: `team_${i}`,
        name: '',
        seed: i + 1,
        team: ''
      });
    }
    setTeams(newTeams);
  };

  const updateTeam = (index: number, field: keyof TeamInput, value: string | number) => {
    const updated = [...teams];
    updated[index] = { ...updated[index], [field]: value };
    setTeams(updated);
  };

  const shuffleTeams = () => {
    const filledTeams = teams.filter(t => t.name.trim());
    const shuffled = [...filledTeams].sort(() => Math.random() - 0.5);
    
    const newTeams = shuffled.map((t, i) => ({
      ...t,
      seed: i + 1
    }));
    
    // Fill remaining slots
    while (newTeams.length < teamCount) {
      newTeams.push({
        id: `team_${newTeams.length}`,
        name: '',
        seed: newTeams.length + 1,
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

    // Create tournament with all format settings
    const result = await createTournament(
      name,
      filledTeams.length,
      hasThirdPlace,
      earlyRoundsFormat,
      finalsFormat,
      courtCount,
      startTime || undefined,
      semifinalsFormat
    );

    if (!result.success || !result.tournament) {
      toast({ title: "Lỗi tạo giải đấu", description: result.error, variant: "destructive" });
      return;
    }

    // Add teams - now using name field and team as club
    const teamsResult = await addTeams(
      result.tournament.id,
      filledTeams.map(t => ({
        team_name: t.name,
        player1_name: t.name, // Use name as player1 for compatibility
        player2_name: undefined,
        seed: t.seed,
        club: t.team // Pass club/team info
      }))
    );

    if (!teamsResult.success) {
      toast({ title: "Lỗi thêm đội", description: teamsResult.error, variant: "destructive" });
      return;
    }

    // Generate bracket
    const bracketResult = await generateBracket(result.tournament.id);

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
                  value={teamCount}
                  onChange={(e) => setTeamCount(Math.max(32, parseInt(e.target.value) || 32))}
                />
                <p className="text-xs text-muted-foreground">
                  Gợi ý: 32, 40, 48, 64, 80, 96, 128 đội để bracket cân đối
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="courts">Số sân</Label>
                  <Input
                    id="courts"
                    type="number"
                    min={1}
                    value={courtCount}
                    onChange={(e) => setCourtCount(parseInt(e.target.value) || 1)}
                  />
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
                  onValueChange={(v) => {
                    setEarlyRoundsFormat(v as BestOfFormat);
                    // If BO3 or BO5, set finals to same format
                    if (v === 'bo3' || v === 'bo5') {
                      setFinalsFormat(v as BestOfFormat);
                      setSemifinalsFormat(v as BestOfFormat);
                    }
                  }}
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

              {/* Show semifinals and finals options only when BO1 is selected for early rounds */}
              {earlyRoundsFormat === 'bo1' && (
                <>
                  <div className="space-y-3">
                    <Label>Bán kết</Label>
                    <RadioGroup
                      value={semifinalsFormat}
                      onValueChange={(v) => setSemifinalsFormat(v as BestOfFormat)}
                      className="flex gap-4"
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
                  </div>

                  <div className="space-y-3">
                    <Label>Chung kết</Label>
                    <RadioGroup
                      value={finalsFormat}
                      onValueChange={(v) => setFinalsFormat(v as BestOfFormat)}
                      className="flex gap-4"
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
                  </div>
                </>
              )}

              {/* Show finals option when BO3/BO5 is selected for early rounds */}
              {(earlyRoundsFormat === 'bo3' || earlyRoundsFormat === 'bo5') && (
                <div className="space-y-3">
                  <Label>Chung kết</Label>
                  <RadioGroup
                    value={finalsFormat}
                    onValueChange={(v) => setFinalsFormat(v as BestOfFormat)}
                    className="flex gap-4"
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
                  <p className="text-xs text-muted-foreground">
                    Bán kết sẽ sử dụng format {earlyRoundsFormat.toUpperCase()} như vòng ngoài
                  </p>
                </div>
              )}

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
                  <CardTitle>Danh sách đội ({teams.filter(t => t.name.trim()).length}/{teamCount})</CardTitle>
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
                <div className="col-span-3">Team/CLB</div>
                <div className="col-span-3">Seed</div>
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
                        placeholder="Team/CLB"
                        value={team.team}
                        onChange={(e) => updateTeam(index, 'team', e.target.value)}
                      />
                    </div>
                    <div className="col-span-3">
                      <Input
                        type="number"
                        min={1}
                        placeholder="Seed"
                        value={team.seed}
                        onChange={(e) => updateTeam(index, 'seed', parseInt(e.target.value) || index + 1)}
                      />
                    </div>
                  </div>
                ))}
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
