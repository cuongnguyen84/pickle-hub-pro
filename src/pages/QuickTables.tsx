import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useSearchParams } from "react-router-dom";
import { MainLayout } from "@/components/layout";
import { useI18n } from "@/i18n";
import { useAuth } from "@/hooks/useAuth";
import { useQuickTable, suggestGroupConfigs, type GroupSuggestion, type QuickTable } from "@/hooks/useQuickTable";
import { useRefereeTables } from "@/hooks/useRefereeManagement";
import { useParentTournament, type ParentTournamentWithPreview } from "@/hooks/useParentTournament";
import ParentTournamentCard from "@/components/quicktable/ParentTournamentCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Users, Trophy, Zap, Check, ArrowRight, Info, LogIn, Calendar, Eye, Plus, ListTodo, Shield, ClipboardList, ChevronDown, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { DynamicMeta, ToolsInternalLinks, WebApplicationSchema, QuickTablesSeoContent } from "@/components/seo";
import { getLoginUrl } from "@/lib/auth-config";
import CreateParentTournamentDialog from "@/components/quicktable/CreateParentTournamentDialog";

type Step = "count" | "format" | "groups" | "players";

const QuickTables = () => {
  const { t, language } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { createTable, getUserTables, getUserQuotaInfo, loading } = useQuickTable();
  const { tables: refereeTables, loading: refereeTablesLoading } = useRefereeTables();
  const { getUserParentTournamentsWithPreview, isOwner: isParentOwner } = useParentTournament();
  const [quotaInfo, setQuotaInfo] = useState<{ current_count: number; quota: number }>({ current_count: 0, quota: 3 });
  const [showTypeSelection, setShowTypeSelection] = useState(false);
  const [showCreateParent, setShowCreateParent] = useState(false);
  const [parentTournaments, setParentTournaments] = useState<ParentTournamentWithPreview[]>([]);
  const parentIdFromUrl = searchParams.get('parentId');

  const [step, setStep] = useState<Step>("count");
  const [playerCount, setPlayerCount] = useState<number>(0);
  const [tableName, setTableName] = useState("");
  const [suggestedFormat, setSuggestedFormat] = useState<"round_robin" | "large_playoff" | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<"round_robin" | "large_playoff" | null>(null);
  const [groupSuggestions, setGroupSuggestions] = useState<GroupSuggestion[]>([]);
  const [selectedGroupCount, setSelectedGroupCount] = useState<number | null>(null);

  // Registration settings
  const [requiresRegistration, setRequiresRegistration] = useState(false);
  const [requiresSkillLevel, setRequiresSkillLevel] = useState(true);
  const [autoApprove, setAutoApprove] = useState(false);
  const [registrationMessage, setRegistrationMessage] = useState("");
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const [isDoubles, setIsDoubles] = useState(true); // Default to doubles
  const [defaultSets, setDefaultSets] = useState<number>(1);

  // User's tables
  const [userTables, setUserTables] = useState<QuickTable[]>([]);
  const [tablesLoading, setTablesLoading] = useState(true);
  const [showAllTables, setShowAllTables] = useState(false);
  const [showAllRefereeTables, setShowAllRefereeTables] = useState(false);
  const [showMyCompleted, setShowMyCompleted] = useState(false);
  const [showRefereeCompleted, setShowRefereeCompleted] = useState(false);

  // Filtered tables
  const myOngoingTables = userTables.filter(t => t.status !== 'completed');
  const myCompletedTables = userTables.filter(t => t.status === 'completed');
  const refereeOngoingTables = refereeTables.filter(t => t.status !== 'completed');
  const refereeCompletedTables = refereeTables.filter(t => t.status === 'completed');

  useEffect(() => {
    const loadUserData = async () => {
      if (!user) {
        setTablesLoading(false);
        return;
      }
      setTablesLoading(true);
      const [tables, quota, parents] = await Promise.all([
        getUserTables(),
        getUserQuotaInfo(),
        getUserParentTournamentsWithPreview(),
      ]);
      setUserTables(tables);
      if (quota) {
        setQuotaInfo(quota);
      }
      setParentTournaments(parents);
      setTablesLoading(false);
    };
    loadUserData();
  }, [user, getUserTables, getUserQuotaInfo, getUserParentTournamentsWithPreview]);

  const handlePlayerCountSubmit = () => {
    if (playerCount < 2) return;

    // Determine suggested format
    if (playerCount > 48) {
      setSuggestedFormat("large_playoff");
    } else if (playerCount > 32) {
      setSuggestedFormat(null); // Let user choose
    } else {
      setSuggestedFormat("round_robin");
    }

    setStep("format");
  };

  const handleFormatSelect = (format: "round_robin" | "large_playoff") => {
    setSelectedFormat(format);

    if (format === "round_robin") {
      const suggestions = suggestGroupConfigs(playerCount);
      setGroupSuggestions(suggestions);
      setStep("groups");
    } else {
      // Large playoff - go directly to players
      handleCreateTable(format);
    }
  };

  const handleGroupSelect = (groupCount: number) => {
    setSelectedGroupCount(groupCount);
  };

  const handleCreateTable = async (format?: "round_robin" | "large_playoff") => {
    const finalFormat = format || selectedFormat;
    if (!finalFormat) return;

    const registrationOptions = requiresRegistration ? {
      requires_registration: true,
      requires_skill_level: requiresSkillLevel,
      auto_approve_registrations: autoApprove,
      registration_message: registrationMessage || undefined,
      is_doubles: isDoubles,
    } : { is_doubles: isDoubles };

    const table = await createTable(
      tableName,
      playerCount,
      finalFormat,
      finalFormat === "round_robin" ? selectedGroupCount || undefined : undefined,
      registrationOptions,
    );

    if (table) {
      // Update default_sets if not 1
      if (defaultSets > 1) {
        await supabase.from('quick_tables').update({ default_sets: defaultSets } as any).eq('id', table.id);
      }
      // Link to parent tournament if creating from parent context
      if (parentIdFromUrl) {
        await supabase.from('quick_tables').update({ parent_tournament_id: parentIdFromUrl }).eq('id', table.id);
      }
      // If registration required, go to view page directly; otherwise setup page
      if (requiresRegistration) {
        navigate(`/tools/quick-tables/${table.share_id}`);
      } else {
        navigate(`/tools/quick-tables/${table.share_id}/setup`);
      }
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "setup":
        return t.quickTable.status.setup;
      case "group_stage":
        return t.quickTable.status.groupStage;
      case "playoff":
        return t.quickTable.status.playoff;
      case "completed":
        return t.quickTable.status.completed;
      default:
        return status;
    }
  };

  const getStatusVariant = (status: string): "default" | "secondary" | "outline" => {
    switch (status) {
      case "completed":
        return "default";
      case "playoff":
      case "group_stage":
        return "secondary";
      default:
        return "outline";
    }
  };

  // Login required message
  if (!user) {
    return (
      <MainLayout>
        <div className="container-wide py-8">
          <div className="max-w-lg mx-auto text-center">
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-6">
              <Users className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold mb-2">{t.quickTable.title}</h1>
            <p className="text-foreground-secondary mb-6">
              {t.quickTable.description}
            </p>
            <p className="text-foreground-muted mb-6">{t.quickTable.loginRequired}</p>
            <Link to={getLoginUrl('/tools/quick-tables')}>
              <Button className="gap-2">
                <LogIn className="w-4 h-4" />
                {t.nav.login}
              </Button>
            </Link>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <DynamicMeta 
        title="Pickleball Bracket Generator & Round Robin Tool"
        description="Free pickleball bracket generator for clubs and tournaments. Create round robin groups, playoff brackets, and elimination formats in seconds. Automatic group balancing, real-time scoring, mobile-friendly."
        url="https://www.thepicklehub.net/tools/quick-tables"
        enableHreflang={true}
      />
      <WebApplicationSchema
        name="Quick Tables - Pickleball Bracket Generator"
        description="Free pickleball bracket generator. Create round robin brackets with automatic group balancing, playoff brackets, and elimination formats in seconds."
        url="https://www.thepicklehub.net/tools/quick-tables"
        applicationCategory="SportsApplication"
        featureList={[
          "Round robin bracket generation",
          "Automatic group balancing",
          "Playoff bracket support",
          "Player registration",
          "Skill level tracking",
          "Real-time scoring"
        ]}
      />
      <div className="container-wide py-8">
        <div className="max-w-2xl mx-auto space-y-8">
          {/* Back to Tools + Header */}
          <header className="text-center">
            <Link
              to="/tools"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors mb-4"
            >
              <ArrowRight className="w-4 h-4 rotate-180" />
              {language === "vi" ? "Tất cả công cụ" : "All tools"}
            </Link>
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold mb-2">{t.quickTable.seo.pageTitle}</h1>
            <p className="text-foreground-secondary mb-4">
              {t.quickTable.seo.pageSubtitle}
            </p>
            {step === "count" && (
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => setShowTypeSelection(true)}
              >
                <Layers className="w-4 h-4" />
                {language === 'vi' ? 'Tạo giải tổng (nhiều nội dung)' : 'Create multi-event tournament'}
              </Button>
            )}
          </header>

          {/* Step 1: Player Count */}
          {step === "count" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  {t.quickTable.step1Title}
                </CardTitle>
                <CardDescription>{t.quickTable.step1Desc}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>{t.quickTable.tournamentName}</Label>
                  <Input
                    value={tableName}
                    onChange={(e) => setTableName(e.target.value)}
                    placeholder={t.quickTable.tournamentNamePlaceholder}
                    maxLength={100}
                  />
                </div>

                <div className="space-y-2">
                  <Label>{t.quickTable.playerCount}</Label>
                  <Input
                    type="number"
                    min={2}
                    max={200}
                    value={playerCount || ""}
                    onChange={(e) => setPlayerCount(parseInt(e.target.value) || 0)}
                    placeholder={t.quickTable.playerCountPlaceholder}
                  />
                </div>

                {/* Registration Settings */}
                <div className="border-t border-border pt-4 mt-4">
                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id="requires-registration"
                      checked={requiresRegistration}
                      onCheckedChange={(checked) => setRequiresRegistration(!!checked)}
                    />
                    <div className="flex-1">
                      <Label htmlFor="requires-registration" className="cursor-pointer font-medium flex items-center gap-2">
                        <ClipboardList className="w-4 h-4 text-primary" />
                        {t.quickTable.requireRegistration}
                      </Label>
                      <p className="text-sm text-foreground-muted mt-1">
                        {t.quickTable.requireRegistrationDesc}
                      </p>
                    </div>
                  </div>

                  {requiresRegistration && (
                    <div className="ml-6 mt-4 space-y-4 p-4 rounded-lg bg-muted/50 border border-border">
                      {/* Doubles checkbox - only show when registration is required */}
                      <div className="flex items-start space-x-3">
                        <Checkbox
                          id="is-doubles"
                          checked={isDoubles}
                          onCheckedChange={(checked) => setIsDoubles(!!checked)}
                        />
                        <div>
                          <Label htmlFor="is-doubles" className="cursor-pointer font-medium flex items-center gap-2">
                            <Users className="w-4 h-4 text-primary" />
                            {t.quickTable.doublesMode || 'Doubles'}
                          </Label>
                          <p className="text-xs text-foreground-muted">
                            {t.quickTable.doublesModeDesc || 'Players register as pairs and can invite partners via link'}
                          </p>
                        </div>
                      </div>

                      {/* Default sets selection */}
                      <div className="space-y-1">
                        <Label className="text-sm">{t.quickTable.matchScoring.defaultSets}</Label>
                        <Select value={String(defaultSets)} onValueChange={(v) => setDefaultSets(Number(v))}>
                          <SelectTrigger className="h-9">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1">Best of 1</SelectItem>
                            <SelectItem value="3">Best of 3</SelectItem>
                            <SelectItem value="5">Best of 5</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex items-start space-x-3">
                        <Checkbox
                          id="requires-skill"
                          checked={requiresSkillLevel}
                          onCheckedChange={(checked) => setRequiresSkillLevel(!!checked)}
                        />
                        <div>
                          <Label htmlFor="requires-skill" className="cursor-pointer">
                            {t.quickTable.requireSkillLevel}
                          </Label>
                          <p className="text-xs text-foreground-muted">
                            {t.quickTable.requireSkillLevelDesc}
                          </p>
                        </div>
                      </div>

                      <Collapsible open={showAdvancedSettings} onOpenChange={setShowAdvancedSettings}>
                        <CollapsibleTrigger asChild>
                          <Button variant="ghost" size="sm" className="w-full justify-between">
                            {t.quickTable.advancedSettings}
                            <ChevronDown className={cn("w-4 h-4 transition-transform", showAdvancedSettings && "rotate-180")} />
                          </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="space-y-4 pt-4">
                          <div className="flex items-start space-x-3">
                            <Checkbox
                              id="auto-approve"
                              checked={autoApprove}
                              onCheckedChange={(checked) => setAutoApprove(!!checked)}
                            />
                            <div>
                              <Label htmlFor="auto-approve" className="cursor-pointer">
                                {t.quickTable.autoApprove}
                              </Label>
                              <p className="text-xs text-foreground-muted">
                                {t.quickTable.autoApproveDesc}
                              </p>
                            </div>
                          </div>

                          <div className="space-y-2">
                            <Label>{t.quickTable.registrationMessage}</Label>
                            <Textarea
                              value={registrationMessage}
                              onChange={(e) => setRegistrationMessage(e.target.value)}
                              placeholder={t.quickTable.registrationMessagePlaceholder}
                              rows={2}
                              maxLength={500}
                            />
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    </div>
                  )}
                </div>

                <Button className="w-full" onClick={handlePlayerCountSubmit} disabled={playerCount < 2 || quotaInfo.current_count >= quotaInfo.quota}>
                  {quotaInfo.current_count >= quotaInfo.quota ? (
                    <span className="text-destructive">{t.quickTable.quota.limitReached}</span>
                  ) : (
                    <>
                      {t.quickTable.continue}
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </>
                  )}
                </Button>
                {quotaInfo.current_count > 0 && (
                  <p className={cn("text-sm text-center mt-2", quotaInfo.current_count >= quotaInfo.quota ? "text-destructive" : "text-foreground-muted")}>
                    {t.quickTable.groups.quotaUsed.replace('{count}', String(quotaInfo.current_count)).replace('{total}', String(quotaInfo.quota))}
                  </p>
                )}
                {quotaInfo.current_count >= quotaInfo.quota && (
                  <p className="text-xs text-center text-foreground-muted mt-1">
                    {t.quickTable.quota.limitReachedDesc}{" "}
                    <a href="mailto:tapickleballvn@gmail.com" className="text-primary hover:underline">
                      {t.quickTable.quota.contactUs}
                    </a>
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Step 2: Format Selection */}
          {step === "format" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t.quickTable.step2Title}</CardTitle>
                <CardDescription>
                  {playerCount} {t.quickTable.players} -{" "}
                  {suggestedFormat === "round_robin"
                    ? t.quickTable.roundRobinDesc
                    : suggestedFormat === "large_playoff"
                      ? t.quickTable.largePlayoffDesc
                      : t.quickTable.roundRobinDesc}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4">
                  {/* Round Robin Option */}
                  <button
                    onClick={() => handleFormatSelect("round_robin")}
                    disabled={playerCount > 48}
                    className={cn(
                      "p-4 rounded-xl border-2 text-left transition-all",
                      playerCount > 48
                        ? "opacity-50 cursor-not-allowed border-border"
                        : "border-border hover:border-primary cursor-pointer",
                      suggestedFormat === "round_robin" && "border-primary bg-primary/5",
                    )}
                  >
                      <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                        <Trophy className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold">{t.quickTable.roundRobin}</span>
                          {suggestedFormat === "round_robin" && (
                            <Badge variant="default" className="text-xs">
                              {t.quickTable.recommended}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-foreground-secondary">
                          {t.quickTable.roundRobinDesc}
                        </p>
                        {playerCount > 48 && (
                          <p className="text-sm text-destructive mt-1">{t.quickTable.notAvailableOver48}</p>
                        )}
                      </div>
                    </div>
                  </button>

                  {/* Large Playoff Option */}
                  <button
                    onClick={() => handleFormatSelect("large_playoff")}
                    disabled={playerCount < 32}
                    className={cn(
                      "p-4 rounded-xl border-2 text-left transition-all",
                      playerCount < 32
                        ? "opacity-50 cursor-not-allowed border-border"
                        : "border-border hover:border-primary cursor-pointer",
                      suggestedFormat === "large_playoff" && "border-primary bg-primary/5",
                    )}
                  >
                      <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                        <Zap className="w-5 h-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold">{t.quickTable.largePlayoff}</span>
                          {suggestedFormat === "large_playoff" && (
                            <Badge variant="default" className="text-xs">
                              {t.quickTable.recommended}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-foreground-secondary">
                          {t.quickTable.largePlayoffDesc}
                        </p>
                        {playerCount < 32 && (
                          <p className="text-sm text-destructive mt-1">{t.quickTable.onlyAvailableOver32}</p>
                        )}
                      </div>
                    </div>
                  </button>
                </div>

                <Button variant="ghost" onClick={() => setStep("count")}>
                  ← {t.quickTable.back}
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Step 3: Group Selection (Round Robin only) */}
          {step === "groups" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t.quickTable.step3Title}</CardTitle>
                <CardDescription>{playerCount} {t.quickTable.players}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3">
                  {groupSuggestions.map((suggestion) => (
                    <button
                      key={suggestion.groupCount}
                      onClick={() => handleGroupSelect(suggestion.groupCount)}
                      className={cn(
                        "p-4 rounded-xl border-2 text-left transition-all",
                        selectedGroupCount === suggestion.groupCount
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50",
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold">{suggestion.groupCount} {t.quickTable.groups.groups}</span>
                          {suggestion.isRecommended && (
                            <Badge variant="default" className="text-xs">
                              {t.quickTable.recommended}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-foreground-secondary">
                            {suggestion.playersPerGroup.join(", ")} {t.quickTable.groups.playersPerGroup}
                          </p>
                          <p className="text-sm text-foreground-muted mt-1">
                            {suggestion.reason} → {suggestion.totalPlayoffSpots} {t.quickTable.groups.advanceToPlayoff}
                          </p>
                        </div>
                        {selectedGroupCount === suggestion.groupCount && <Check className="w-5 h-5 text-primary" />}
                      </div>
                    </button>
                  ))}
                </div>

                {groupSuggestions.length === 0 && (
                  <div className="text-center py-8 text-foreground-muted">
                    <Info className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>{t.quickTable.groups.noConfig.replace('{count}', String(playerCount))}</p>
                    <p className="text-sm">{t.quickTable.groups.tryOther}</p>
                  </div>
                )}

                <div className="flex gap-3">
                  <Button variant="ghost" onClick={() => setStep("format")}>
                    ← {t.quickTable.back}
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={() => handleCreateTable()}
                    disabled={!selectedGroupCount || loading}
                  >
                    {loading ? t.common.loading : t.common.create}
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* User's Tables Section - displayed at bottom */}
          {step === "count" && (
            <>
              {userTables.length > 0 ? (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <ListTodo className="w-4 h-4 text-primary" />
                      {t.quickTable.myTournaments}
                    </CardTitle>
                  </CardHeader>
                  <div className="px-6 pb-2">
                    <div className="flex gap-1 border-b border-border">
                      <button
                        onClick={() => setShowMyCompleted(false)}
                        className={cn(
                          "px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                          !showMyCompleted
                            ? "border-primary text-primary"
                            : "border-transparent text-foreground-muted hover:text-foreground"
                        )}
                      >
                        {t.quickTable.ongoing} ({myOngoingTables.length})
                      </button>
                      <button
                        onClick={() => setShowMyCompleted(true)}
                        className={cn(
                          "px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                          showMyCompleted
                            ? "border-primary text-primary"
                            : "border-transparent text-foreground-muted hover:text-foreground"
                        )}
                      >
                        {t.quickTable.completed} ({myCompletedTables.length})
                      </button>
                    </div>
                  </div>
                  <CardContent className="space-y-2 pt-2">
                    {(() => {
                      const displayTables = showMyCompleted ? myCompletedTables : myOngoingTables;
                      
                      if (displayTables.length === 0) {
                        return (
                          <div className="text-center py-4 text-foreground-muted">
                            {showMyCompleted ? t.quickTable.noCompleted : t.quickTable.noOngoing}
                          </div>
                        );
                      }
                      
                      return (
                        <>
                          {(showAllTables ? displayTables : displayTables.slice(0, 5)).map((table) => (
                            <Link
                              key={table.id}
                              to={
                                table.status === "setup"
                                  ? `/tools/quick-tables/${table.share_id}/setup`
                                  : `/tools/quick-tables/${table.share_id}`
                              }
                              className="block p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium truncate">{table.name}</div>
                                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-foreground-muted mt-1">
                                    <span className="flex items-center gap-1">
                                      <Calendar className="w-3 h-3" />
                                      {format(new Date(table.created_at), "dd/MM/yyyy", { locale: vi })}
                                    </span>
                                    <span>•</span>
                                    <span>{table.player_count} {t.quickTable.players}</span>
                                    <span>•</span>
                                    <span>{table.format === "round_robin" ? t.quickTable.roundRobin : t.quickTable.largePlayoff}</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <Badge variant={getStatusVariant(table.status)}>{getStatusLabel(table.status)}</Badge>
                                  <Eye className="w-4 h-4 text-foreground-muted" />
                                </div>
                              </div>
                            </Link>
                          ))}
                          {!showAllTables && displayTables.length > 5 && (
                            <div className="text-center pt-3 border-t border-border/50">
                              <p className="text-sm text-foreground-muted mb-2">
                                {t.quickTable.moreRemaining.replace('{count}', String(displayTables.length - 5))}
                              </p>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => setShowAllTables(true)}
                              >
                                {t.quickTable.showMore}
                              </Button>
                            </div>
                          )}
                          {showAllTables && displayTables.length > 5 && (
                            <div className="text-center pt-2">
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => setShowAllTables(false)}
                              >
                                {t.quickTable.showLess}
                              </Button>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </CardContent>
                </Card>
              ) : !tablesLoading ? (
                <Card className="border-dashed">
                  <CardContent className="py-6 text-center">
                    <ListTodo className="w-8 h-8 mx-auto mb-2 text-foreground-muted opacity-50" />
                    <p className="text-foreground-muted">{t.quickTable.noTournaments}</p>
                  </CardContent>
                </Card>
              ) : null}

              {/* Referee Tables Section */}
              {refereeTables.length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Shield className="w-4 h-4 text-primary" />
                      {t.quickTable.refereeTournaments}
                    </CardTitle>
                  </CardHeader>
                  <div className="px-6 pb-2">
                    <div className="flex gap-1 border-b border-border">
                      <button
                        onClick={() => setShowRefereeCompleted(false)}
                        className={cn(
                          "px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                          !showRefereeCompleted
                            ? "border-primary text-primary"
                            : "border-transparent text-foreground-muted hover:text-foreground"
                        )}
                      >
                        {t.quickTable.ongoing} ({refereeOngoingTables.length})
                      </button>
                      <button
                        onClick={() => setShowRefereeCompleted(true)}
                        className={cn(
                          "px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors",
                          showRefereeCompleted
                            ? "border-primary text-primary"
                            : "border-transparent text-foreground-muted hover:text-foreground"
                        )}
                      >
                        {t.quickTable.completed} ({refereeCompletedTables.length})
                      </button>
                    </div>
                  </div>
                  <CardContent className="space-y-2 pt-2">
                    {(() => {
                      const displayTables = showRefereeCompleted ? refereeCompletedTables : refereeOngoingTables;
                      
                      if (displayTables.length === 0) {
                        return (
                          <div className="text-center py-4 text-foreground-muted">
                            {showRefereeCompleted ? t.quickTable.noCompleted : t.quickTable.noOngoing}
                          </div>
                        );
                      }
                      
                      return (
                        <>
                          {(showAllRefereeTables ? displayTables : displayTables.slice(0, 5)).map((table) => (
                            <Link
                              key={table.id}
                              to={
                                table.status === "setup"
                                  ? `/tools/quick-tables/${table.share_id}/setup`
                                  : `/tools/quick-tables/${table.share_id}`
                              }
                              className="block p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium truncate">{table.name}</div>
                                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-foreground-muted mt-1">
                                    <span className="flex items-center gap-1">
                                      <Calendar className="w-3 h-3" />
                                      {format(new Date(table.created_at), "dd/MM/yyyy", { locale: vi })}
                                    </span>
                                    <span>•</span>
                                    <span>{table.player_count} {t.quickTable.players}</span>
                                    <span>•</span>
                                    <span>{table.format === "round_robin" ? t.quickTable.roundRobin : t.quickTable.largePlayoff}</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <Badge variant="outline" className="gap-1">
                                    <Shield className="w-3 h-3" />
                                    {t.quickTable.referee || 'Referee'}
                                  </Badge>
                                  <Badge variant={getStatusVariant(table.status)}>{getStatusLabel(table.status)}</Badge>
                                </div>
                              </div>
                            </Link>
                          ))}
                          {!showAllRefereeTables && displayTables.length > 5 && (
                            <div className="text-center pt-3 border-t border-border/50">
                              <p className="text-sm text-foreground-muted mb-2">
                                {t.quickTable.moreRemaining.replace('{count}', String(displayTables.length - 5))}
                              </p>
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => setShowAllRefereeTables(true)}
                              >
                                {t.quickTable.showMore}
                              </Button>
                            </div>
                          )}
                          {showAllRefereeTables && displayTables.length > 5 && (
                            <div className="text-center pt-2">
                              <Button 
                                variant="ghost" 
                                size="sm"
                                onClick={() => setShowAllRefereeTables(false)}
                              >
                                {t.quickTable.showLess}
                              </Button>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </CardContent>
                </Card>
              )}
              {/* Parent Tournaments */}
              {parentTournaments.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-base font-semibold flex items-center gap-2">
                    <Layers className="w-4 h-4 text-primary" />
                    {language === 'vi' ? 'Giải tổng' : 'Multi-event tournaments'}
                  </h3>
                  {parentTournaments.map((pt) => (
                    <ParentTournamentCard
                      key={pt.id}
                      parent={pt}
                      isOwner={isParentOwner(pt)}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>

          {/* Internal Links */}
          <ToolsInternalLinks currentTool="quick-tables" />

          {/* SEO Content Section */}
          <QuickTablesSeoContent />
      </div>

      {/* Type Selection Dialog */}
      <Dialog open={showTypeSelection} onOpenChange={setShowTypeSelection}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t.quickTable.parentTournament.selectType}</DialogTitle>
            <DialogDescription>
              {language === 'vi' ? 'Chọn loại giải phù hợp với nhu cầu của bạn' : 'Choose the tournament type that fits your needs'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <button
              className="w-full p-4 rounded-xl border-2 border-primary bg-primary/5 text-left transition-all hover:shadow-md"
              onClick={() => {
                setShowTypeSelection(false);
                setStep("count");
              }}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                  <Trophy className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold">{t.quickTable.parentTournament.singleTitle}</span>
                    <Badge variant="default" className="text-xs">{t.quickTable.recommended}</Badge>
                  </div>
                  <p className="text-sm text-foreground-secondary">{t.quickTable.parentTournament.singleDesc}</p>
                </div>
              </div>
            </button>
            <button
              className="w-full p-4 rounded-xl border-2 border-border text-left transition-all hover:border-primary/50 hover:shadow-md"
              onClick={() => {
                setShowTypeSelection(false);
                setShowCreateParent(true);
              }}
            >
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
                  <Layers className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <span className="font-semibold">{t.quickTable.parentTournament.multiTitle}</span>
                  <p className="text-sm text-foreground-secondary mt-1">{t.quickTable.parentTournament.multiDesc}</p>
                </div>
              </div>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <CreateParentTournamentDialog open={showCreateParent} onOpenChange={setShowCreateParent} />
    </MainLayout>
  );
};

export default QuickTables;
