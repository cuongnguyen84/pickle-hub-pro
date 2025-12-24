import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout";
import { useI18n } from "@/i18n";
import { useAuth } from "@/hooks/useAuth";
import { useQuickTable, suggestGroupConfigs, type GroupSuggestion, type QuickTable } from "@/hooks/useQuickTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Trophy, Zap, Check, ArrowRight, Info, LogIn, Calendar, Eye, Plus, ListTodo } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";
import { format } from "date-fns";
import { vi } from "date-fns/locale";

type Step = "count" | "format" | "groups" | "players";

const QuickTables = () => {
  const { t } = useI18n();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { createTable, getUserTables, loading } = useQuickTable();

  const [step, setStep] = useState<Step>("count");
  const [playerCount, setPlayerCount] = useState<number>(0);
  const [tableName, setTableName] = useState("Tên giải đấu");
  const [suggestedFormat, setSuggestedFormat] = useState<"round_robin" | "large_playoff" | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<"round_robin" | "large_playoff" | null>(null);
  const [groupSuggestions, setGroupSuggestions] = useState<GroupSuggestion[]>([]);
  const [selectedGroupCount, setSelectedGroupCount] = useState<number | null>(null);

  // User's tables
  const [userTables, setUserTables] = useState<QuickTable[]>([]);
  const [tablesLoading, setTablesLoading] = useState(true);

  useEffect(() => {
    const loadUserTables = async () => {
      if (!user) {
        setTablesLoading(false);
        return;
      }
      setTablesLoading(true);
      const tables = await getUserTables();
      setUserTables(tables);
      setTablesLoading(false);
    };
    loadUserTables();
  }, [user, getUserTables]);

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

    const table = await createTable(
      tableName,
      playerCount,
      finalFormat,
      finalFormat === "round_robin" ? selectedGroupCount || undefined : undefined,
    );

    if (table) {
      navigate(`/quick-tables/${table.share_id}/setup`);
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "setup":
        return "Đang thiết lập";
      case "group_stage":
        return "Vòng bảng";
      case "playoff":
        return "Playoff";
      case "completed":
        return "Hoàn thành";
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
            <h1 className="text-2xl font-bold mb-2">Chia bảng nhanh</h1>
            <p className="text-foreground-secondary mb-6">
              Công cụ miễn phí giúp chia bảng, tạo danh sách trận đấu và tổ chức thi đấu phong trào.
            </p>
            <p className="text-foreground-muted mb-6">Vui lòng đăng nhập để tạo bảng đấu mới.</p>
            <Link to="/login">
              <Button className="gap-2">
                <LogIn className="w-4 h-4" />
                Đăng nhập
              </Button>
            </Link>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container-wide py-8">
        <div className="max-w-2xl mx-auto space-y-8">
          {/* Header */}
          <div className="text-center">
            <div className="w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Chia bảng nhanh</h1>
            <p className="text-foreground-secondary">
              Công cụ miễn phí giúp chia bảng, tạo danh sách trận đấu và tổ chức thi đấu phong trào.
            </p>
          </div>

          {/* Step 1: Player Count */}
          {step === "count" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Bước 1: Số người chơi</CardTitle>
                <CardDescription>Nhập tổng số người chơi tham gia giải đấu</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Tên giải / bảng đấu</Label>
                  <Input
                    value={tableName}
                    onChange={(e) => setTableName(e.target.value)}
                    placeholder="VD: Giải Pickleball Mùa Hè 2024"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Số người chơi</Label>
                  <Input
                    type="number"
                    min={2}
                    max={200}
                    value={playerCount || ""}
                    onChange={(e) => setPlayerCount(parseInt(e.target.value) || 0)}
                    placeholder="VD: 16"
                  />
                </div>

                <Button className="w-full" onClick={handlePlayerCountSubmit} disabled={playerCount < 2}>
                  Tiếp tục
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Step 2: Format Selection */}
          {step === "format" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Bước 2: Chọn thể thức</CardTitle>
                <CardDescription>
                  {playerCount} người chơi -{" "}
                  {suggestedFormat === "round_robin"
                    ? "Phù hợp với thể thức chia bảng (Round Robin)"
                    : suggestedFormat === "large_playoff"
                      ? "Số lượng lớn, phù hợp với thể thức Playoff đông người"
                      : "Bạn có thể chọn Round Robin hoặc Playoff"}
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
                          <span className="font-semibold">Chia bảng (Round Robin)</span>
                          {suggestedFormat === "round_robin" && (
                            <Badge variant="default" className="text-xs">
                              Khuyến nghị
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-foreground-secondary">
                          Chia người chơi thành các bảng, mỗi người đấu với tất cả người khác trong bảng. Top của mỗi
                          bảng sẽ vào vòng Playoff.
                        </p>
                        {playerCount > 48 && (
                          <p className="text-sm text-destructive mt-1">Không khả dụng với &gt;48 người</p>
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
                          <span className="font-semibold">Playoff đông người</span>
                          {suggestedFormat === "large_playoff" && (
                            <Badge variant="default" className="text-xs">
                              Khuyến nghị
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-foreground-secondary">
                          Thể thức dành cho giải đông người. Lượt 1-2 ghi nhận thắng/thua và hiệu số, từ lượt 3 trở đi
                          là single elimination.
                        </p>
                        {playerCount < 32 && (
                          <p className="text-sm text-destructive mt-1">Chỉ khả dụng với ≥32 người</p>
                        )}
                      </div>
                    </div>
                  </button>
                </div>

                <Button variant="ghost" onClick={() => setStep("count")}>
                  ← Quay lại
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Step 3: Group Selection (Round Robin only) */}
          {step === "groups" && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Bước 3: Chọn số bảng</CardTitle>
                <CardDescription>Chọn cách chia {playerCount} người chơi vào các bảng</CardDescription>
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
                            <span className="font-semibold">{suggestion.groupCount} bảng</span>
                            {suggestion.isRecommended && (
                              <Badge variant="default" className="text-xs">
                                Khuyến nghị
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-foreground-secondary">
                            {suggestion.playersPerGroup.join(", ")} người/bảng
                          </p>
                          <p className="text-sm text-foreground-muted mt-1">
                            {suggestion.reason} → {suggestion.totalPlayoffSpots} người vào Playoff
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
                    <p>Không có cấu hình phù hợp với {playerCount} người.</p>
                    <p className="text-sm">Thử số người chơi khác.</p>
                  </div>
                )}

                <div className="flex gap-3">
                  <Button variant="ghost" onClick={() => setStep("format")}>
                    ← Quay lại
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={() => handleCreateTable()}
                    disabled={!selectedGroupCount || loading}
                  >
                    {loading ? "Đang tạo..." : "Tạo bảng đấu"}
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
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base flex items-center gap-2">
                        <ListTodo className="w-4 h-4 text-primary" />
                        Giải đấu của tôi
                      </CardTitle>
                      <Badge variant="secondary">{userTables.length}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {userTables.slice(0, 5).map((table) => (
                      <Link
                        key={table.id}
                        to={
                          table.status === "setup"
                            ? `/quick-tables/${table.share_id}/setup`
                            : `/quick-tables/${table.share_id}`
                        }
                        className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{table.name}</div>
                          <div className="flex items-center gap-2 text-xs text-foreground-muted">
                            <Calendar className="w-3 h-3" />
                            {format(new Date(table.created_at), "dd/MM/yyyy", { locale: vi })}
                            <span>•</span>
                            <span>{table.player_count} người</span>
                            <span>•</span>
                            <span>{table.format === "round_robin" ? "Chia bảng" : "Playoff"}</span>
                          </div>
                        </div>
                        <Badge variant={getStatusVariant(table.status)}>{getStatusLabel(table.status)}</Badge>
                        <Eye className="w-4 h-4 text-foreground-muted" />
                      </Link>
                    ))}
                    {userTables.length > 5 && (
                      <div className="text-center pt-2">
                        <span className="text-sm text-foreground-muted">
                          và {userTables.length - 5} bảng đấu khác...
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ) : !tablesLoading ? (
                <Card className="border-dashed">
                  <CardContent className="py-6 text-center">
                    <ListTodo className="w-8 h-8 mx-auto mb-2 text-foreground-muted opacity-50" />
                    <p className="text-foreground-muted">Bạn chưa tạo bảng đấu nào</p>
                  </CardContent>
                </Card>
              ) : null}
            </>
          )}
        </div>
      </div>
    </MainLayout>
  );
};

export default QuickTables;
