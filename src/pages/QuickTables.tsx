import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useSearchParams } from "react-router-dom";
import { TheLineLayout } from "@/components/layout";
import { useI18n } from "@/i18n";
import { useAuth } from "@/hooks/useAuth";
import { useQuickTable, suggestGroupConfigs, type GroupSuggestion, type QuickTable } from "@/hooks/useQuickTable";
import { useRefereeTables } from "@/hooks/useRefereeManagement";
import { useParentTournament, type ParentTournamentWithPreview } from "@/hooks/useParentTournament";
import ParentTournamentCard from "@/components/quicktable/ParentTournamentCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Users, Trophy, Zap, Check, ArrowRight, LogIn, Calendar, Eye, Shield, ClipboardList, ChevronDown, Layers } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { HreflangTags, ToolsInternalLinks, WebApplicationSchema, QuickTablesSeoContent, FAQSchema } from "@/components/seo";
import { getLoginUrl } from "@/lib/auth-config";
import CreateParentTournamentDialog from "@/components/quicktable/CreateParentTournamentDialog";

type Step = "count" | "format" | "groups" | "players";

// Reusable styled container that mirrors the-line surface card pattern.
const surfaceCard: React.CSSProperties = {
  background: "var(--tl-bg-elev)",
  border: "1px solid var(--tl-border)",
  borderRadius: "var(--tl-radius-lg)",
  padding: 28,
};

const stepKickerStyle: React.CSSProperties = {
  fontFamily: "Geist Mono, ui-monospace, monospace",
  fontSize: 11,
  fontWeight: 500,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--tl-green)",
  marginBottom: 8,
};

const stepHeadingStyle: React.CSSProperties = {
  fontFamily: "Instrument Serif, serif",
  fontStyle: "italic",
  fontWeight: 400,
  fontSize: 28,
  letterSpacing: "-0.015em",
  lineHeight: 1.05,
  margin: 0,
  color: "var(--tl-fg)",
};

const stepDescStyle: React.CSSProperties = {
  fontSize: 14.5,
  color: "var(--tl-fg-3)",
  marginTop: 6,
  lineHeight: 1.5,
};

const QuickTables = () => {
  const { t, language } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { createTable, getUserTables, getUserQuotaInfo, loading } = useQuickTable();
  const { tables: refereeTables } = useRefereeTables();
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

    if (playerCount > 48) {
      setSuggestedFormat("large_playoff");
    } else if (playerCount > 32) {
      setSuggestedFormat(null);
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
      if (defaultSets > 1) {
        await supabase.from('quick_tables').update({ default_sets: defaultSets } as any).eq('id', table.id);
      }
      if (parentIdFromUrl) {
        await supabase.from('quick_tables').update({ parent_tournament_id: parentIdFromUrl }).eq('id', table.id);
      }
      if (requiresRegistration) {
        navigate(`/tools/quick-tables/${table.share_id}`);
      } else {
        navigate(`/tools/quick-tables/${table.share_id}/setup`);
      }
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "setup": return t.quickTable.status.setup;
      case "group_stage": return t.quickTable.status.groupStage;
      case "playoff": return t.quickTable.status.playoff;
      case "completed": return t.quickTable.status.completed;
      default: return status;
    }
  };

  const statusPillClass = (status: string): string => {
    if (status === "completed") return "tl-br-status completed";
    if (status === "playoff" || status === "group_stage") return "tl-br-status active";
    if (status === "registration") return "tl-br-status registration";
    return "tl-br-status setup";
  };

  // ─── Login gate ───────────────────────────────────────────────────────────
  if (!user) {
    return (
      <TheLineLayout
        title="Pickleball Bracket Generator & Round Robin Tool"
        description="Free pickleball bracket generator for clubs and tournaments. Create round robin groups, playoff brackets, and elimination formats in seconds."
        active="lab"
      >
        <HreflangTags enPath="/tools/quick-tables" />
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
            "Real-time scoring",
          ]}
        />
        <FAQSchema items={faqItems} />
        <div className="tl-shell">
          <nav className="tl-breadcrumb">
            <Link to="/tools">{language === "vi" ? "Bracket Lab" : "Bracket Lab"}</Link>
            <span className="sep">/</span>
            <span className="current">Quick Tables</span>
          </nav>

          <header className="tl-page-head">
            <div className="kicker">
              {language === "vi"
                ? "◆ Vòng tròn · Đơn & đôi · Miễn phí"
                : "◆ Round robin · Singles & doubles · Free"}
            </div>
            <h1>
              <em className="tl-serif">Quick</em> <span className="sans">Tables.</span>
            </h1>
            <p>{t.quickTable.seo.pageSubtitle}</p>
          </header>

          <section style={{ padding: "48px 0 80px" }}>
            <div
              style={{
                ...surfaceCard,
                maxWidth: 480,
                margin: "0 auto",
                textAlign: "center",
                padding: "40px 28px",
              }}
            >
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: "50%",
                  background: "var(--tl-green-glow)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 20,
                }}
              >
                <Users className="w-7 h-7" style={{ color: "var(--tl-green)" }} />
              </div>
              <h2 style={{ ...stepHeadingStyle, fontSize: 24, marginBottom: 10 }}>
                {language === "vi" ? "Đăng nhập để bắt đầu" : "Sign in to get started"}
              </h2>
              <p style={{ ...stepDescStyle, marginTop: 0, marginBottom: 24, fontSize: 14 }}>
                {t.quickTable.loginRequired}
              </p>
              <Link to={getLoginUrl('/tools/quick-tables')} className="tl-btn green">
                <LogIn className="w-4 h-4" />
                {t.nav.login}
              </Link>
            </div>

            <div style={{ marginTop: 56 }}>
              <ToolsInternalLinks currentTool="quick-tables" />
            </div>
            <div style={{ marginTop: 32 }}>
              <QuickTablesSeoContent />
            </div>
          </section>
        </div>
      </TheLineLayout>
    );
  }

  // ─── Main authenticated view ──────────────────────────────────────────────
  const quotaPct = Math.min(100, Math.round((quotaInfo.current_count / quotaInfo.quota) * 100));
  const quotaLow = quotaInfo.current_count >= quotaInfo.quota;

  return (
    <TheLineLayout
      title="Pickleball Bracket Generator & Round Robin Tool"
      description="Free pickleball bracket generator for clubs and tournaments."
      active="lab"
    >
      <HreflangTags enPath="/tools/quick-tables" />
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
          "Real-time scoring",
        ]}
      />
      <FAQSchema items={faqItems} />

      <div className="tl-shell">
        <nav className="tl-breadcrumb">
          <Link to="/tools">{language === "vi" ? "Bracket Lab" : "Bracket Lab"}</Link>
          <span className="sep">/</span>
          <span className="current">Quick Tables</span>
        </nav>

        <header className="tl-page-head">
          <div className="kicker">
            {language === "vi"
              ? "◆ Vòng tròn · Đơn & đôi · Miễn phí"
              : "◆ Round robin · Singles & doubles · Free"}
          </div>
          <h1>
            <em className="tl-serif">Quick</em> <span className="sans">Tables.</span>
          </h1>
          <p>{t.quickTable.seo.pageSubtitle}</p>

          {step === "count" && (
            <div style={{ display: "flex", gap: 10, marginTop: 28, flexWrap: "wrap" }}>
              <button
                type="button"
                className="tl-btn"
                onClick={() => setShowTypeSelection(true)}
              >
                <Layers className="w-4 h-4" />
                {language === "vi" ? "Tạo giải tổng (nhiều nội dung)" : "Multi-event tournament"}
              </button>
            </div>
          )}
        </header>

        {/* Quota strip */}
        {step === "count" && (
          <section className="tl-stats-row" style={{ marginTop: 40 }}>
            <div className="tl-stat-box">
              <div className="lbl">{language === "vi" ? "Đang chạy" : "Ongoing"}</div>
              <div className="val">
                <span className={myOngoingTables.length > 0 ? "green" : ""}>{myOngoingTables.length}</span>
              </div>
              <div className="sub">{language === "vi" ? "Giải đang diễn ra" : "In progress"}</div>
            </div>
            <div className="tl-stat-box">
              <div className="lbl">{language === "vi" ? "Đã hoàn tất" : "Completed"}</div>
              <div className="val">{myCompletedTables.length}</div>
              <div className="sub">{language === "vi" ? "Tổng cộng" : "All time"}</div>
            </div>
            <div className="tl-stat-box">
              <div className="lbl">{language === "vi" ? "Trọng tài" : "Refereeing"}</div>
              <div className="val">{refereeTables.length}</div>
              <div className="sub">{language === "vi" ? "Bạn đang chấm" : "You officiate"}</div>
            </div>
            <div className="tl-stat-box">
              <div className="lbl">{language === "vi" ? "Hạn mức" : "Quota"}</div>
              <div className="val">
                <span className={quotaLow ? "" : "green"}>
                  {quotaInfo.current_count}
                </span>
                <span style={{ color: "var(--tl-fg-4)", fontSize: "0.6em" }}>/{quotaInfo.quota}</span>
              </div>
              <div className="sub">{quotaPct}% {language === "vi" ? "đã dùng" : "used"}</div>
            </div>
          </section>
        )}

        {/* Wizard */}
        <section style={{ marginTop: step === "count" ? 48 : 32, marginBottom: 56 }}>
          {/* Step 1: Player Count */}
          {step === "count" && (
            <div style={surfaceCard}>
              <div style={{ marginBottom: 24 }}>
                <div style={stepKickerStyle}>
                  ◆ {language === "vi" ? "Bước 1 / 3" : "Step 1 of 3"}
                </div>
                <h2 style={stepHeadingStyle}>{t.quickTable.step1Title}</h2>
                <p style={stepDescStyle}>{t.quickTable.step1Desc}</p>
              </div>

              <div className="space-y-5">
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
                <div style={{ borderTop: "1px solid var(--tl-border)", paddingTop: 20, marginTop: 20 }}>
                  <div className="flex items-start space-x-3">
                    <Checkbox
                      id="requires-registration"
                      checked={requiresRegistration}
                      onCheckedChange={(checked) => setRequiresRegistration(!!checked)}
                    />
                    <div className="flex-1">
                      <Label
                        htmlFor="requires-registration"
                        className="cursor-pointer font-medium flex items-center gap-2"
                      >
                        <ClipboardList className="w-4 h-4" style={{ color: "var(--tl-green)" }} />
                        {t.quickTable.requireRegistration}
                      </Label>
                      <p
                        style={{
                          fontSize: 13,
                          color: "var(--tl-fg-3)",
                          marginTop: 4,
                          lineHeight: 1.5,
                        }}
                      >
                        {t.quickTable.requireRegistrationDesc}
                      </p>
                    </div>
                  </div>

                  {requiresRegistration && (
                    <div
                      style={{
                        marginLeft: 28,
                        marginTop: 16,
                        padding: 16,
                        borderRadius: "var(--tl-radius)",
                        background: "var(--tl-bg)",
                        border: "1px solid var(--tl-border)",
                      }}
                      className="space-y-4"
                    >
                      <div className="flex items-start space-x-3">
                        <Checkbox
                          id="is-doubles"
                          checked={isDoubles}
                          onCheckedChange={(checked) => setIsDoubles(!!checked)}
                        />
                        <div>
                          <Label htmlFor="is-doubles" className="cursor-pointer font-medium flex items-center gap-2">
                            <Users className="w-4 h-4" style={{ color: "var(--tl-green)" }} />
                            {t.quickTable.doublesMode || 'Doubles'}
                          </Label>
                          <p style={{ fontSize: 12, color: "var(--tl-fg-3)", marginTop: 2 }}>
                            {t.quickTable.doublesModeDesc || 'Players register as pairs and can invite partners via link'}
                          </p>
                        </div>
                      </div>

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
                          <p style={{ fontSize: 12, color: "var(--tl-fg-3)" }}>
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
                              <p style={{ fontSize: 12, color: "var(--tl-fg-3)" }}>
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

                <div style={{ paddingTop: 8 }}>
                  <button
                    type="button"
                    className="tl-btn green"
                    style={{ width: "100%", justifyContent: "center" }}
                    onClick={handlePlayerCountSubmit}
                    disabled={playerCount < 2 || quotaInfo.current_count >= quotaInfo.quota}
                  >
                    {quotaInfo.current_count >= quotaInfo.quota ? (
                      <span>{t.quickTable.quota.limitReached}</span>
                    ) : (
                      <>
                        {t.quickTable.continue}
                        <ArrowRight className="w-4 h-4" />
                      </>
                    )}
                  </button>

                  {quotaInfo.current_count > 0 && (
                    <p
                      style={{
                        fontSize: 12,
                        textAlign: "center",
                        marginTop: 12,
                        color: quotaLow ? "var(--tl-live)" : "var(--tl-fg-3)",
                        fontFamily: "Geist Mono, ui-monospace, monospace",
                        letterSpacing: "0.04em",
                      }}
                    >
                      {t.quickTable.groups.quotaUsed
                        .replace('{count}', String(quotaInfo.current_count))
                        .replace('{total}', String(quotaInfo.quota))}
                    </p>
                  )}
                  {quotaLow && (
                    <p
                      style={{
                        fontSize: 12,
                        textAlign: "center",
                        marginTop: 4,
                        color: "var(--tl-fg-3)",
                      }}
                    >
                      {t.quickTable.quota.limitReachedDesc}{" "}
                      <a
                        href="mailto:tapickleballvn@gmail.com"
                        style={{ color: "var(--tl-green)", textDecoration: "underline" }}
                      >
                        {t.quickTable.quota.contactUs}
                      </a>
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Format Selection */}
          {step === "format" && (
            <div style={surfaceCard}>
              <div style={{ marginBottom: 24 }}>
                <div style={stepKickerStyle}>
                  ◆ {language === "vi" ? "Bước 2 / 3" : "Step 2 of 3"}
                </div>
                <h2 style={stepHeadingStyle}>{t.quickTable.step2Title}</h2>
                <p style={stepDescStyle}>
                  {playerCount} {t.quickTable.players} —{" "}
                  {suggestedFormat === "round_robin"
                    ? t.quickTable.roundRobinDesc
                    : suggestedFormat === "large_playoff"
                      ? t.quickTable.largePlayoffDesc
                      : t.quickTable.roundRobinDesc}
                </p>
              </div>

              <div className="space-y-3">
                <FormatOption
                  icon={<Trophy className="w-5 h-5" />}
                  title={t.quickTable.roundRobin}
                  desc={t.quickTable.roundRobinDesc}
                  recommended={suggestedFormat === "round_robin"}
                  recommendedLabel={t.quickTable.recommended}
                  disabled={playerCount > 48}
                  disabledMsg={t.quickTable.notAvailableOver48}
                  onClick={() => handleFormatSelect("round_robin")}
                />
                <FormatOption
                  icon={<Zap className="w-5 h-5" />}
                  title={t.quickTable.largePlayoff}
                  desc={t.quickTable.largePlayoffDesc}
                  recommended={suggestedFormat === "large_playoff"}
                  recommendedLabel={t.quickTable.recommended}
                  disabled={playerCount < 32}
                  disabledMsg={t.quickTable.onlyAvailableOver32}
                  onClick={() => handleFormatSelect("large_playoff")}
                />
              </div>

              <div style={{ marginTop: 20 }}>
                <button type="button" className="tl-btn" onClick={() => setStep("count")}>
                  ← {t.quickTable.back}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Group Selection */}
          {step === "groups" && (
            <div style={surfaceCard}>
              <div style={{ marginBottom: 24 }}>
                <div style={stepKickerStyle}>
                  ◆ {language === "vi" ? "Bước 3 / 3" : "Step 3 of 3"}
                </div>
                <h2 style={stepHeadingStyle}>{t.quickTable.step3Title}</h2>
                <p style={stepDescStyle}>{playerCount} {t.quickTable.players}</p>
              </div>

              <div className="space-y-3">
                {groupSuggestions.map((suggestion) => {
                  const selected = selectedGroupCount === suggestion.groupCount;
                  return (
                    <button
                      key={suggestion.groupCount}
                      onClick={() => handleGroupSelect(suggestion.groupCount)}
                      style={{
                        width: "100%",
                        padding: 16,
                        borderRadius: "var(--tl-radius)",
                        border: `1px solid ${selected ? "var(--tl-green)" : "var(--tl-border)"}`,
                        background: selected ? "var(--tl-green-glow)" : "var(--tl-bg)",
                        color: "var(--tl-fg)",
                        textAlign: "left",
                        cursor: "pointer",
                        font: "inherit",
                        transition: "border-color 0.15s, background 0.15s",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                            <span style={{ fontWeight: 600, fontSize: 15 }}>
                              {suggestion.groupCount} {t.quickTable.groups.groups}
                            </span>
                            {suggestion.isRecommended && (
                              <span
                                style={{
                                  fontFamily: "Geist Mono, ui-monospace, monospace",
                                  fontSize: 10,
                                  letterSpacing: "0.06em",
                                  textTransform: "uppercase",
                                  padding: "2px 7px",
                                  borderRadius: 999,
                                  background: "var(--tl-green-glow)",
                                  color: "var(--tl-green)",
                                  border: "1px solid rgba(0,185,107,0.25)",
                                }}
                              >
                                {t.quickTable.recommended}
                              </span>
                            )}
                          </div>
                          <p style={{ fontSize: 13.5, color: "var(--tl-fg-2)", margin: 0 }}>
                            {suggestion.playersPerGroup.join(", ")} {t.quickTable.groups.playersPerGroup}
                          </p>
                          <p style={{ fontSize: 12.5, color: "var(--tl-fg-3)", margin: "4px 0 0" }}>
                            {suggestion.reason} → {suggestion.totalPlayoffSpots} {t.quickTable.groups.advanceToPlayoff}
                          </p>
                        </div>
                        {selected && <Check className="w-5 h-5" style={{ color: "var(--tl-green)", flexShrink: 0 }} />}
                      </div>
                    </button>
                  );
                })}

                {groupSuggestions.length === 0 && (
                  <div className="tl-empty-card" style={{ marginTop: 16 }}>
                    <span className="tl-empty-card-mark">◌</span>
                    <span className="tl-empty-card-label">
                      {t.quickTable.groups.noConfig.replace('{count}', String(playerCount))}
                    </span>
                    <p className="tl-empty-card-hint">{t.quickTable.groups.tryOther}</p>
                  </div>
                )}
              </div>

              <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
                <button type="button" className="tl-btn" onClick={() => setStep("format")}>
                  ← {t.quickTable.back}
                </button>
                <button
                  type="button"
                  className="tl-btn green"
                  style={{ flex: 1, justifyContent: "center" }}
                  onClick={() => handleCreateTable()}
                  disabled={!selectedGroupCount || loading}
                >
                  {loading ? t.common.loading : t.common.create}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </section>

        {/* My / Referee / Parent Tournaments — only on step 1 */}
        {step === "count" && (
          <>
            {/* My tournaments */}
            <section style={{ marginBottom: 48 }}>
              <div className="tl-sec-head">
                <h2>
                  {language === "vi" ? "Của" : "My"}{" "}
                  <em className="tl-serif">
                    {language === "vi" ? "tôi." : "tournaments."}
                  </em>{" "}
                  <span className="sans">{userTables.length}</span>
                </h2>
              </div>

              {userTables.length > 0 ? (
                <div style={surfaceCard}>
                  <div className="tl-tabs" style={{ marginBottom: 20 }}>
                    <button
                      type="button"
                      className={cn("tl-tab", !showMyCompleted && "active")}
                      onClick={() => setShowMyCompleted(false)}
                    >
                      {t.quickTable.ongoing}
                      <span className="count">{myOngoingTables.length}</span>
                    </button>
                    <button
                      type="button"
                      className={cn("tl-tab", showMyCompleted && "active")}
                      onClick={() => setShowMyCompleted(true)}
                    >
                      {t.quickTable.completed}
                      <span className="count">{myCompletedTables.length}</span>
                    </button>
                  </div>
                  {(() => {
                    const displayTables = showMyCompleted ? myCompletedTables : myOngoingTables;
                    if (displayTables.length === 0) {
                      return (
                        <p
                          style={{
                            textAlign: "center",
                            padding: "24px 0",
                            color: "var(--tl-fg-3)",
                            fontSize: 14,
                          }}
                        >
                          {showMyCompleted ? t.quickTable.noCompleted : t.quickTable.noOngoing}
                        </p>
                      );
                    }
                    const visible = showAllTables ? displayTables : displayTables.slice(0, 5);
                    return (
                      <div className="space-y-2">
                        {visible.map((tbl) => (
                          <TournamentRow
                            key={tbl.id}
                            href={
                              tbl.status === "setup"
                                ? `/tools/quick-tables/${tbl.share_id}/setup`
                                : `/tools/quick-tables/${tbl.share_id}`
                            }
                            name={tbl.name}
                            createdAt={tbl.created_at}
                            playerCount={tbl.player_count}
                            playersLabel={t.quickTable.players}
                            format={tbl.format === "round_robin" ? t.quickTable.roundRobin : t.quickTable.largePlayoff}
                            statusLabel={getStatusLabel(tbl.status)}
                            statusClass={statusPillClass(tbl.status)}
                          />
                        ))}
                        {!showAllTables && displayTables.length > 5 && (
                          <div
                            style={{
                              textAlign: "center",
                              paddingTop: 14,
                              borderTop: "1px solid var(--tl-border)",
                            }}
                          >
                            <p
                              style={{
                                fontSize: 12,
                                color: "var(--tl-fg-3)",
                                marginBottom: 10,
                                fontFamily: "Geist Mono, ui-monospace, monospace",
                                letterSpacing: "0.04em",
                                textTransform: "uppercase",
                              }}
                            >
                              {t.quickTable.moreRemaining.replace('{count}', String(displayTables.length - 5))}
                            </p>
                            <button type="button" className="tl-btn" onClick={() => setShowAllTables(true)}>
                              {t.quickTable.showMore}
                            </button>
                          </div>
                        )}
                        {showAllTables && displayTables.length > 5 && (
                          <div style={{ textAlign: "center", paddingTop: 8 }}>
                            <button type="button" className="tl-btn" onClick={() => setShowAllTables(false)}>
                              {t.quickTable.showLess}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              ) : !tablesLoading ? (
                <div className="tl-empty-card">
                  <span className="tl-empty-card-mark">◌</span>
                  <span className="tl-empty-card-label">
                    {language === "vi" ? "Chưa có giải nào" : "No tournaments yet"}
                  </span>
                  <p className="tl-empty-card-hint">{t.quickTable.noTournaments}</p>
                  <span className="tl-empty-card-cta">
                    {language === "vi" ? "Tạo giải đầu tiên ↑" : "Create your first ↑"}
                  </span>
                </div>
              ) : null}
            </section>

            {/* Referee section */}
            {refereeTables.length > 0 && (
              <section style={{ marginBottom: 48 }}>
                <div className="tl-sec-head">
                  <h2>
                    {language === "vi" ? "Bạn đang" : "You're"}{" "}
                    <em className="tl-serif">
                      {language === "vi" ? "trọng tài." : "officiating."}
                    </em>{" "}
                    <span className="sans">{refereeTables.length}</span>
                  </h2>
                </div>
                <div style={surfaceCard}>
                  <div className="tl-tabs" style={{ marginBottom: 20 }}>
                    <button
                      type="button"
                      className={cn("tl-tab", !showRefereeCompleted && "active")}
                      onClick={() => setShowRefereeCompleted(false)}
                    >
                      {t.quickTable.ongoing}
                      <span className="count">{refereeOngoingTables.length}</span>
                    </button>
                    <button
                      type="button"
                      className={cn("tl-tab", showRefereeCompleted && "active")}
                      onClick={() => setShowRefereeCompleted(true)}
                    >
                      {t.quickTable.completed}
                      <span className="count">{refereeCompletedTables.length}</span>
                    </button>
                  </div>
                  {(() => {
                    const displayTables = showRefereeCompleted ? refereeCompletedTables : refereeOngoingTables;
                    if (displayTables.length === 0) {
                      return (
                        <p
                          style={{
                            textAlign: "center",
                            padding: "24px 0",
                            color: "var(--tl-fg-3)",
                            fontSize: 14,
                          }}
                        >
                          {showRefereeCompleted ? t.quickTable.noCompleted : t.quickTable.noOngoing}
                        </p>
                      );
                    }
                    const visible = showAllRefereeTables ? displayTables : displayTables.slice(0, 5);
                    return (
                      <div className="space-y-2">
                        {visible.map((tbl) => (
                          <TournamentRow
                            key={tbl.id}
                            href={
                              tbl.status === "setup"
                                ? `/tools/quick-tables/${tbl.share_id}/setup`
                                : `/tools/quick-tables/${tbl.share_id}`
                            }
                            name={tbl.name}
                            createdAt={tbl.created_at}
                            playerCount={tbl.player_count}
                            playersLabel={t.quickTable.players}
                            format={tbl.format === "round_robin" ? t.quickTable.roundRobin : t.quickTable.largePlayoff}
                            statusLabel={getStatusLabel(tbl.status)}
                            statusClass={statusPillClass(tbl.status)}
                            extraBadge={
                              <span
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 4,
                                  fontFamily: "Geist Mono, ui-monospace, monospace",
                                  fontSize: 10,
                                  textTransform: "uppercase",
                                  letterSpacing: "0.06em",
                                  padding: "3px 7px",
                                  borderRadius: 4,
                                  border: "1px solid var(--tl-border)",
                                  color: "var(--tl-fg-3)",
                                }}
                              >
                                <Shield className="w-3 h-3" />
                                {t.quickTable.referee || "Referee"}
                              </span>
                            }
                          />
                        ))}
                        {!showAllRefereeTables && displayTables.length > 5 && (
                          <div
                            style={{
                              textAlign: "center",
                              paddingTop: 14,
                              borderTop: "1px solid var(--tl-border)",
                            }}
                          >
                            <p
                              style={{
                                fontSize: 12,
                                color: "var(--tl-fg-3)",
                                marginBottom: 10,
                                fontFamily: "Geist Mono, ui-monospace, monospace",
                                letterSpacing: "0.04em",
                                textTransform: "uppercase",
                              }}
                            >
                              {t.quickTable.moreRemaining.replace('{count}', String(displayTables.length - 5))}
                            </p>
                            <button type="button" className="tl-btn" onClick={() => setShowAllRefereeTables(true)}>
                              {t.quickTable.showMore}
                            </button>
                          </div>
                        )}
                        {showAllRefereeTables && displayTables.length > 5 && (
                          <div style={{ textAlign: "center", paddingTop: 8 }}>
                            <button type="button" className="tl-btn" onClick={() => setShowAllRefereeTables(false)}>
                              {t.quickTable.showLess}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </section>
            )}

            {/* Parent Tournaments */}
            {parentTournaments.length > 0 && (
              <section style={{ marginBottom: 56 }}>
                <div className="tl-sec-head">
                  <h2>
                    <em className="tl-serif">
                      {language === "vi" ? "Giải tổng." : "Multi-event."}
                    </em>{" "}
                    <span className="sans">{parentTournaments.length}</span>
                  </h2>
                </div>
                <div className="space-y-3">
                  {parentTournaments.map((pt) => (
                    <ParentTournamentCard key={pt.id} parent={pt} isOwner={isParentOwner(pt)} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        <section style={{ marginBottom: 80 }}>
          <ToolsInternalLinks currentTool="quick-tables" />
          <div style={{ marginTop: 40 }}>
            <QuickTablesSeoContent />
          </div>
        </section>
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
              type="button"
              onClick={() => {
                setShowTypeSelection(false);
                setStep("count");
              }}
              style={{
                width: "100%",
                padding: 16,
                borderRadius: "var(--tl-radius)",
                border: "1px solid var(--tl-green)",
                background: "var(--tl-green-glow)",
                color: "var(--tl-fg)",
                textAlign: "left",
                cursor: "pointer",
                font: "inherit",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 8,
                    background: "var(--tl-green-glow)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Trophy className="w-5 h-5" style={{ color: "var(--tl-green)" }} />
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontWeight: 600 }}>
                      {t.quickTable.parentTournament.singleTitle}
                    </span>
                    <span
                      style={{
                        fontFamily: "Geist Mono, ui-monospace, monospace",
                        fontSize: 10,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        padding: "2px 7px",
                        borderRadius: 999,
                        background: "var(--tl-green)",
                        color: "var(--tl-bg)",
                      }}
                    >
                      {t.quickTable.recommended}
                    </span>
                  </div>
                  <p style={{ fontSize: 13.5, color: "var(--tl-fg-2)", margin: 0 }}>
                    {t.quickTable.parentTournament.singleDesc}
                  </p>
                </div>
              </div>
            </button>
            <button
              type="button"
              onClick={() => {
                setShowTypeSelection(false);
                setShowCreateParent(true);
              }}
              style={{
                width: "100%",
                padding: 16,
                borderRadius: "var(--tl-radius)",
                border: "1px solid var(--tl-border)",
                background: "var(--tl-bg)",
                color: "var(--tl-fg)",
                textAlign: "left",
                cursor: "pointer",
                font: "inherit",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 8,
                    background: "var(--tl-surface-2)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Layers className="w-5 h-5" style={{ color: "var(--tl-fg-2)" }} />
                </div>
                <div>
                  <span style={{ fontWeight: 600 }}>
                    {t.quickTable.parentTournament.multiTitle}
                  </span>
                  <p style={{ fontSize: 13.5, color: "var(--tl-fg-2)", margin: "4px 0 0" }}>
                    {t.quickTable.parentTournament.multiDesc}
                  </p>
                </div>
              </div>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <CreateParentTournamentDialog open={showCreateParent} onOpenChange={setShowCreateParent} />
    </TheLineLayout>
  );
};

// Format option button — used in step "format"
function FormatOption({
  icon, title, desc, recommended, recommendedLabel, disabled, disabledMsg, onClick,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  recommended: boolean;
  recommendedLabel: string;
  disabled: boolean;
  disabledMsg: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        width: "100%",
        padding: 16,
        borderRadius: "var(--tl-radius)",
        border: `1px solid ${recommended ? "var(--tl-green)" : "var(--tl-border)"}`,
        background: recommended ? "var(--tl-green-glow)" : "var(--tl-bg)",
        color: "var(--tl-fg)",
        textAlign: "left",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        font: "inherit",
        transition: "border-color 0.15s, background 0.15s",
      }}
    >
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 8,
            background: recommended ? "var(--tl-green)" : "var(--tl-surface)",
            color: recommended ? "var(--tl-bg)" : "var(--tl-fg-2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{ fontWeight: 600, fontSize: 15 }}>{title}</span>
            {recommended && (
              <span
                style={{
                  fontFamily: "Geist Mono, ui-monospace, monospace",
                  fontSize: 10,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  padding: "2px 7px",
                  borderRadius: 999,
                  background: "var(--tl-green)",
                  color: "var(--tl-bg)",
                }}
              >
                {recommendedLabel}
              </span>
            )}
          </div>
          <p style={{ fontSize: 13.5, color: "var(--tl-fg-2)", margin: 0, lineHeight: 1.45 }}>
            {desc}
          </p>
          {disabled && (
            <p style={{ fontSize: 12.5, color: "var(--tl-live)", margin: "6px 0 0" }}>
              {disabledMsg}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}

// Tournament row — single visual language for "my", "referee" lists
function TournamentRow({
  href, name, createdAt, playerCount, playersLabel, format, statusLabel, statusClass, extraBadge,
}: {
  href: string;
  name: string;
  createdAt: string | null;
  playerCount: number;
  playersLabel: string;
  format: string;
  statusLabel: string;
  statusClass: string;
  extraBadge?: React.ReactNode;
}) {
  return (
    <Link
      to={href}
      style={{
        display: "block",
        padding: "12px 14px",
        borderRadius: "var(--tl-radius)",
        border: "1px solid var(--tl-border)",
        background: "var(--tl-bg)",
        textDecoration: "none",
        color: "inherit",
        transition: "background 0.15s, border-color 0.15s",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = "var(--tl-surface)";
        (e.currentTarget as HTMLElement).style.borderColor = "var(--tl-border-2)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = "var(--tl-bg)";
        (e.currentTarget as HTMLElement).style.borderColor = "var(--tl-border)";
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontWeight: 500,
              fontSize: 14.5,
              color: "var(--tl-fg)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {name}
          </div>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: 6,
              marginTop: 4,
              fontFamily: "Geist Mono, ui-monospace, monospace",
              fontSize: 11,
              color: "var(--tl-fg-3)",
              letterSpacing: "0.02em",
            }}
          >
            {createdAt && (
              <>
                <Calendar className="w-3 h-3" />
                <span>{format2date(createdAt)}</span>
                <span style={{ color: "var(--tl-fg-4)" }}>·</span>
              </>
            )}
            <span>{playerCount} {playersLabel}</span>
            <span style={{ color: "var(--tl-fg-4)" }}>·</span>
            <span>{format}</span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          {extraBadge}
          <span className={statusClass}>{statusLabel}</span>
          <Eye className="w-4 h-4" style={{ color: "var(--tl-fg-3)" }} />
        </div>
      </div>
    </Link>
  );
}

function format2date(iso: string): string {
  try {
    return format(new Date(iso), "dd/MM/yyyy", { locale: vi });
  } catch {
    return "";
  }
}

const faqItems = [
  { question: "Is Quick Tables free to use?", answer: "Yes — Quick Tables is completely free for clubs, organizers, and individual players. There are no ads, no subscriptions, and no signup required to view a bracket. An account is only needed to create and manage your own tournaments." },
  { question: "How many players can Quick Tables handle?", answer: "Quick Tables supports 2 to 200 players. For 2–48 players, the round robin format automatically creates balanced groups. For 48+ players, the large playoff format uses an elimination bracket structure that scales to any size event." },
  { question: "Can I use Quick Tables for doubles pickleball tournaments?", answer: "Yes. Quick Tables supports both singles and doubles tournament formats. You can enter individual players or pair players as doubles teams before generating the bracket. The system handles group balancing and match scheduling identically for both formats." },
  { question: "Does Quick Tables work on mobile devices?", answer: "Fully mobile-friendly. The entire tool — from bracket creation to live scoring — is optimized for phones and tablets. Referees can update match scores from the court using any smartphone browser without installing an app." },
  { question: "What's the difference between round robin and large playoff format?", answer: "Round robin means every player faces every other player in their group, maximizing court time for all participants. Large playoff uses a seeded single-elimination bracket for 48+ player events where time or court constraints make full round robin impractical. Both formats are free and generated instantly." },
];

export default QuickTables;
