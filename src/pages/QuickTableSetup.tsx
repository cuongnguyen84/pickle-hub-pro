import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout';
import { DynamicMeta } from '@/components/seo';
import { useQuickTable, type QuickTable, distributePlayersToGroups } from '@/hooks/useQuickTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { AIAssistantButton } from '@/components/ai';
import { Trash2, Plus, ArrowRight, Shuffle, Users, Wand2, Hand } from 'lucide-react';
import { toast } from 'sonner';
import { ManualGroupAssignment } from '@/components/quicktable/ManualGroupAssignment';
import CourtTimeSettings from '@/components/quicktable/CourtTimeSettings';
import { useI18n } from '@/i18n';
import { parseCourtsInput, assignCourtsToMatches, calculateMatchTimes } from '@/lib/round-robin';

interface PlayerInput {
  id: string;
  name: string;
  team: string;
  seed: string;
}

type AssignmentMode = 'auto' | 'manual';
type Step = 'input' | 'assignment';

const QuickTableSetup = () => {
  const { shareId } = useParams<{ shareId: string }>();
  const navigate = useNavigate();
  const { t } = useI18n();
  const { getTableByShareId, addPlayers, createGroups, assignPlayersToGroups, createGroupMatches, updateTableStatus, updateTableCourtSettings, reassignCourtsAndTimes } = useQuickTable();

  const [table, setTable] = useState<QuickTable | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [players, setPlayers] = useState<PlayerInput[]>([]);
  const [assignmentMode, setAssignmentMode] = useState<AssignmentMode>('auto');
  const [step, setStep] = useState<Step>('input');
  
  // Court and time settings
  const [courts, setCourts] = useState('');
  const [startTime, setStartTime] = useState('');

  useEffect(() => {
    const loadTable = async () => {
      if (!shareId) return;
      
      setLoading(true);
      const data = await getTableByShareId(shareId);
      
      if (data) {
        setTable(data.table);
        
        // If requires registration, redirect to view page for registration management
        if (data.table.requires_registration) {
          navigate(`/quick-tables/${shareId}`);
          return;
        }
        
        // If already has players, redirect to view
        if (data.players.length > 0) {
          navigate(`/quick-tables/${shareId}`);
          return;
        }
        
        // Initialize empty player slots
        const initialPlayers: PlayerInput[] = Array.from(
          { length: data.table.player_count },
          (_, i) => ({
            id: `new-${i}`,
            name: '',
            team: '',
            seed: '',
          })
        );
        setPlayers(initialPlayers);
      }
      
      setLoading(false);
    };

    loadTable();
  }, [shareId, getTableByShareId, navigate]);

  const updatePlayer = (index: number, field: keyof PlayerInput, value: string) => {
    setPlayers(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const addPlayerSlot = () => {
    setPlayers(prev => [
      ...prev,
      { id: `new-${prev.length}`, name: '', team: '', seed: '' }
    ]);
  };

  const removePlayerSlot = (index: number) => {
    if (players.length <= 2) return;
    setPlayers(prev => prev.filter((_, i) => i !== index));
  };

  const shufflePlayers = () => {
    setPlayers(prev => {
      const shuffled = [...prev];
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
      }
      return shuffled;
    });
  };

  const filledPlayers = players.filter(p => p.name.trim());

  // Handle proceeding to assignment step
  const handleProceedToAssignment = () => {
    if (filledPlayers.length < 2) {
      toast.error(t.quickTable.setup.minPlayersError);
      return;
    }

    // For manual mode with round robin, go to assignment step
    if (assignmentMode === 'manual' && table?.format === 'round_robin' && table.group_count) {
      setStep('assignment');
    } else {
      // Auto mode - submit directly
      handleAutoSubmit();
    }
  };

  // Auto assignment submit (original logic)
  const handleAutoSubmit = async () => {
    if (!table) return;

    setSaving(true);

    try {
      // Add players to database
      const playerData = filledPlayers.map(p => ({
        name: p.name.trim(),
        team: p.team.trim() || undefined,
        seed: p.seed ? parseInt(p.seed) : undefined,
      }));

      const createdPlayers = await addPlayers(table.id, playerData);
      if (createdPlayers.length === 0) throw new Error('Failed to add players');

      // Parse courts
      const parsedCourts = parseCourtsInput(courts);
      const hasCourtSettings = parsedCourts.length > 0;

      // Save court settings to table
      if (hasCourtSettings || startTime) {
        await updateTableCourtSettings(
          table.id, 
          parsedCourts.map(String), 
          startTime || null
        );
      }

      // If round robin, create groups and assign players automatically
      if (table.format === 'round_robin' && table.group_count) {
        const groups = await createGroups(table.id, table.group_count);
        if (groups.length === 0) throw new Error('Failed to create groups');

        await assignPlayersToGroups(createdPlayers, groups);

        // Refresh players with group assignments
        const refreshed = await getTableByShareId(shareId!);
        if (!refreshed) throw new Error('Failed to refresh data');

        // Create matches for each group (using Circle Method)
        for (let i = 0; i < groups.length; i++) {
          const group = groups[i];
          const groupPlayers = refreshed.players.filter(p => p.group_id === group.id);
          if (groupPlayers.length >= 2) {
            await createGroupMatches(table.id, group.id, groupPlayers.map(p => p.id), i);
          }
        }

        // Assign courts and times if configured
        if (hasCourtSettings) {
          const refreshedAgain = await getTableByShareId(shareId!);
          if (refreshedAgain) {
            await reassignCourtsAndTimes(
              table.id,
              parsedCourts,
              startTime || null,
              groups,
              refreshedAgain.matches
            );
          }
        }

        // Update table status
        await updateTableStatus(table.id, 'group_stage');
      } else {
        // Large playoff - will be handled differently
        await updateTableStatus(table.id, 'group_stage'); // First round
      }

      toast.success(t.quickTable.setup.createdSuccess);
      navigate(`/tools/quick-tables/${shareId}`);
    } catch (error) {
      console.error('Error setting up table:', error);
      toast.error(t.quickTable.setup.errorOccurred);
    } finally {
      setSaving(false);
    }
  };

  // Manual assignment complete handler
  const handleManualAssignmentComplete = async (groupAssignments: Map<number, PlayerInput[]>) => {
    if (!table || !table.group_count) return;

    setSaving(true);

    try {
      // Add all players to database first
      const playerData = filledPlayers.map(p => ({
        name: p.name.trim(),
        team: p.team.trim() || undefined,
        seed: p.seed ? parseInt(p.seed) : undefined,
      }));

      const createdPlayers = await addPlayers(table.id, playerData);
      if (createdPlayers.length === 0) throw new Error('Failed to add players');

      // Create a map from input player id to created player
      const playerMap = new Map<string, typeof createdPlayers[0]>();
      filledPlayers.forEach((inputPlayer, index) => {
        playerMap.set(inputPlayer.id, createdPlayers[index]);
      });

      // Create groups
      const groups = await createGroups(table.id, table.group_count);
      if (groups.length === 0) throw new Error('Failed to create groups');

      // Manually assign players to groups based on user selection
      for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
        const group = groups[groupIndex];
        const assignedInputPlayers = groupAssignments.get(groupIndex) || [];
        
        // Get the created player IDs for this group
        const playersToAssign = assignedInputPlayers
          .map(ip => playerMap.get(ip.id))
          .filter(Boolean) as typeof createdPlayers;

        if (playersToAssign.length > 0) {
          // Assign these specific players to this group
          await assignPlayersToGroups(playersToAssign, [group]);
        }
      }

      // Refresh players with group assignments
      const refreshed = await getTableByShareId(shareId!);
      if (!refreshed) throw new Error('Failed to refresh data');

      // Create matches for each group
      for (const group of groups) {
        const groupPlayers = refreshed.players.filter(p => p.group_id === group.id);
        if (groupPlayers.length >= 2) {
          await createGroupMatches(table.id, group.id, groupPlayers.map(p => p.id));
        }
      }

      // Update table status
      await updateTableStatus(table.id, 'group_stage');

      toast.success(t.quickTable.setup.manualSuccess);
      navigate(`/tools/quick-tables/${shareId}`);
    } catch (error) {
      console.error('Error setting up table with manual assignment:', error);
      toast.error(t.quickTable.setup.errorOccurred);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <MainLayout>
        <div className="container-wide py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-foreground-muted">{t.common.loading}</div>
          </div>
        </div>
      </MainLayout>
    );
  }

  if (!table) {
    return (
      <MainLayout>
        <div className="container-wide py-8">
          <div className="text-center">
            <h1 className="text-xl font-bold mb-2">{t.quickTable.setup.notFound}</h1>
            <p className="text-foreground-secondary">{t.quickTable.setup.notFoundDesc}</p>
          </div>
        </div>
      </MainLayout>
    );
  }

  // Show manual assignment UI
  if (step === 'assignment' && table.group_count) {
    return (
      <MainLayout>
        <DynamicMeta title={`Chia bảng - ${table.name}`} noindex={true} />
        <div className="container-wide py-8">
          <div className="max-w-4xl mx-auto">
            {/* Header */}
            <div className="mb-6">
              <h1 className="text-2xl font-bold mb-1">{table.name}</h1>
              <div className="flex items-center gap-2 text-foreground-secondary">
              <Badge variant="outline">
                {table.format === 'round_robin' ? 'Round Robin' : t.quickTable.largePlayoff}
              </Badge>
              <Badge variant="outline">{table.group_count} {t.quickTable.groups.groups}</Badge>
              <span>•</span>
              <span>{filledPlayers.length} {t.quickTable.players}</span>
              <span>•</span>
              <Badge variant="secondary">{t.quickTable.manualAssignment.title}</Badge>
            </div>
          </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Hand className="w-5 h-5" />
                  {t.quickTable.manualAssignment.title}
                </CardTitle>
                <CardDescription>
                  {t.quickTable.manualAssignment.description}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ManualGroupAssignment
                  players={filledPlayers}
                  groupCount={table.group_count}
                  onComplete={handleManualAssignmentComplete}
                  onCancel={() => setStep('input')}
                />
                {saving && (
                  <div className="mt-4 text-center text-muted-foreground">
                    {t.quickTable.setup.processing}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <DynamicMeta title={`Nhập VĐV - ${table.name}`} noindex={true} />
      <div className="container-wide py-8">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold mb-1">{table.name}</h1>
            <div className="flex items-center gap-2 text-foreground-secondary">
              <Badge variant="outline">
                {table.format === 'round_robin' ? 'Round Robin' : t.quickTable.largePlayoff}
              </Badge>
              {table.group_count && (
                <Badge variant="outline">{table.group_count} {t.quickTable.groups.groups}</Badge>
              )}
              <span>•</span>
              <span>{table.player_count} {t.quickTable.players}</span>
            </div>
          </div>

          {/* Player Input */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    {t.quickTable.setup.inputPlayers}
                    <AIAssistantButton 
                      screenName="quick-table-setup" 
                      stepName="players"
                      contextData={{ 
                        playerCount: filledPlayers.length,
                        format: table.format,
                        groupCount: table.group_count,
                      }}
                    />
                  </CardTitle>
                  <CardDescription>
                    {t.quickTable.setup.inputPlayersDesc}
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={shufflePlayers}>
                  <Shuffle className="w-4 h-4 mr-2" />
                  {t.quickTable.setup.shuffle}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {players.map((player, index) => (
                  <div key={player.id} className="flex items-center gap-2">
                    <span className="w-6 sm:w-8 text-sm text-foreground-muted text-center flex-shrink-0">
                      {index + 1}
                    </span>
                    <Input
                      value={player.name}
                      onChange={(e) => updatePlayer(index, 'name', e.target.value)}
                      placeholder={t.quickTable.setup.playerNamePlaceholder}
                      className="flex-1 min-w-0 h-10 sm:h-9"
                    />
                    <Input
                      value={player.team}
                      onChange={(e) => updatePlayer(index, 'team', e.target.value)}
                      placeholder={t.quickTable.setup.teamPlaceholder}
                      className="w-16 sm:w-24 h-10 sm:h-9 flex-shrink-0"
                    />
                    <Input
                      type="number"
                      value={player.seed}
                      onChange={(e) => updatePlayer(index, 'seed', e.target.value)}
                      placeholder={t.quickTable.setup.seedPlaceholder}
                      className="w-14 sm:w-16 h-10 sm:h-9 flex-shrink-0"
                      min={1}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removePlayerSlot(index)}
                      disabled={players.length <= 2}
                      className="text-foreground-muted hover:text-destructive flex-shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="mt-4 pt-4 border-t border-border-subtle">
                <Button variant="outline" onClick={addPlayerSlot} className="w-full">
                  <Plus className="w-4 h-4 mr-2" />
                  {t.quickTable.setup.addPlayer}
                </Button>
              </div>

              {/* Assignment Mode Selection - Only for round robin */}
              {table.format === 'round_robin' && table.group_count && (
                <div className="mt-4 pt-4 border-t border-border-subtle">
                  <Label className="text-sm font-medium mb-3 block">{t.quickTable.setup.assignmentMethod}</Label>
                  <RadioGroup
                    value={assignmentMode}
                    onValueChange={(value) => setAssignmentMode(value as AssignmentMode)}
                    className="grid grid-cols-1 sm:grid-cols-2 gap-3"
                  >
                    <div className="relative">
                      <RadioGroupItem
                        value="auto"
                        id="mode-auto"
                        className="peer sr-only"
                      />
                      <Label
                        htmlFor="mode-auto"
                        className="flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 hover:bg-muted/50"
                      >
                        <Wand2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium text-sm">{t.quickTable.setup.autoMode}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {t.quickTable.setup.autoModeDesc}
                          </p>
                        </div>
                      </Label>
                    </div>
                    <div className="relative">
                      <RadioGroupItem
                        value="manual"
                        id="mode-manual"
                        className="peer sr-only"
                      />
                      <Label
                        htmlFor="mode-manual"
                        className="flex items-start gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/5 hover:bg-muted/50"
                      >
                        <Hand className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium text-sm">{t.quickTable.setup.manualMode}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {t.quickTable.setup.manualModeDesc}
                          </p>
                        </div>
                      </Label>
                    </div>
                  </RadioGroup>
                </div>
              )}

              {/* Court and Time Settings */}
              {table.format === 'round_robin' && (
                <CourtTimeSettings
                  courts={courts}
                  onCourtsChange={setCourts}
                  startTime={startTime}
                  onStartTimeChange={setStartTime}
                />
              )}

              <div className="mt-4 p-3 rounded-lg bg-muted/50 text-sm">
                <div className="flex items-start gap-2">
                  <Users className="w-4 h-4 mt-0.5 text-primary flex-shrink-0" />
                  <div>
                    <p className="font-medium">{t.quickTable.setup.tips}</p>
                    <ul className="text-foreground-secondary mt-1 space-y-1">
                      <li>• {t.quickTable.setup.tipTeam}</li>
                      <li>• {t.quickTable.setup.tipSeed}</li>
                      {assignmentMode === 'auto' && (
                        <li>• {t.quickTable.setup.tipAuto}</li>
                      )}
                      {assignmentMode === 'manual' && (
                        <li>• {t.quickTable.setup.tipManual}</li>
                      )}
                    </ul>
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <Button
                  className="w-full"
                  onClick={handleProceedToAssignment}
                  disabled={saving || filledPlayers.length < 2}
                >
                  {saving ? t.quickTable.setup.processing : assignmentMode === 'manual' && table.format === 'round_robin' && table.group_count ? t.quickTable.setup.continueManual : t.quickTable.setup.createBracketBtn}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </MainLayout>
  );
};

export default QuickTableSetup;
