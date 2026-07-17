import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useI18n } from "@/i18n";
import { TheLineLayout } from "@/components/layout";
import { useFlexTournament } from "@/hooks/useFlexTournament";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, Layers } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  SetupBreadcrumb,
  SetupPageHead,
  SetupLoginGate,
} from "@/components/tournament/SetupShell";
import {
  surfaceCard,
  stepKickerStyle,
  stepHeadingStyle,
  stepDescStyle,
} from "@/components/tournament/setup-styles";

const FlexTournamentSetup = () => {
  const { t, language } = useI18n();
  const { user } = useAuth();
  const { createTournament, isCreating } = useFlexTournament();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [name, setName] = useState("");
  const [playersText, setPlayersText] = useState("");
  const [isPublic, setIsPublic] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      toast({ title: t.common.error, description: t.tools.flexTournament.tournamentName, variant: "destructive" });
      return;
    }

    const playerNames = playersText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .slice(0, 200);

    try {
      const tournament = await createTournament({
        name: name.trim(),
        playerNames,
        isPublic,
      });

      toast({ title: t.tools.flexTournament.createSuccess });
      navigate(`/tools/flex-tournament/${tournament.share_id}`);
    } catch (error) {
      // W3.2 — quota-aware error toast. The hook throws an Error with
      // .code='LIMIT_REACHED' when the user has hit their per-account cap.
      const code = (error as { code?: string })?.code;
      const message = error instanceof Error ? error.message : '';
      if (code === 'LIMIT_REACHED' || message === 'LIMIT_REACHED') {
        toast({
          title: t.quickTable.quota.limitReached,
          description: t.quickTable.quota.limitReachedDesc,
          variant: "destructive",
        });
        return;
      }
      toast({
        title: t.common.error,
        description: t.tools.flexTournament.createError,
        variant: "destructive",
      });
    }
  };

  if (!user) {
    return (
      <SetupLoginGate
        layoutTitle="Flex Tournament Setup"
        toolLabel="Flex Tournament"
        toolPath="/tools/flex-tournament"
        icon={Layers}
        title={t.tools.flexTournament.title}
        desc={t.auth.loginRequired}
        loginRedirect="/tools/flex-tournament/new"
      />
    );
  }

  return (
    <TheLineLayout title="Flex Tournament Setup" active="lab">
      <div className="tl-shell">
        <SetupBreadcrumb toolLabel="Flex Tournament" toolPath="/tools/flex-tournament" />

        <SetupPageHead
          kicker={language === "vi" ? "Tạo giải mới · Tự do format" : "New tournament · Custom format"}
          h1Sans={language === "vi" ? "giải đấu." : "tournament."}
        />

        <section style={{ maxWidth: 720, margin: "0 auto", padding: "32px 0 80px", width: "100%" }}>
          <div style={surfaceCard}>
            <div style={{ marginBottom: 24 }}>
              <div style={stepKickerStyle}>
                ◆ {language === "vi" ? "Thông tin cơ bản" : "Basics"}
              </div>
              <h2 style={stepHeadingStyle}>{t.tools.flexTournament.create}</h2>
              <p style={stepDescStyle}>{t.tools.flexTournament.subtitleFull}</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Tournament Name */}
              <div className="space-y-2">
                <Label htmlFor="name">
                  {t.tools.flexTournament.tournamentName}{" "}
                  <span style={{ color: "var(--tl-live)" }}>*</span>
                </Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t.tools.flexTournament.tournamentNamePlaceholder}
                  required
                  maxLength={100}
                />
              </div>

              {/* Visibility */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 12,
                  padding: 16,
                  borderRadius: "var(--tl-radius)",
                  background: "var(--tl-bg)",
                  border: "1px solid var(--tl-border)",
                }}
              >
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: "var(--tl-fg)" }}>
                    {t.tools.flexTournament.visibility}
                  </div>
                  <p style={{ fontSize: 12.5, color: "var(--tl-fg-3)", margin: "4px 0 0", lineHeight: 1.5 }}>
                    {t.tools.flexTournament.visibilityHint}
                  </p>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                  <span
                    style={{
                      fontFamily: "Geist Mono, ui-monospace, monospace",
                      fontSize: 11,
                      fontWeight: 500,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      color: isPublic ? "var(--tl-green)" : "var(--tl-fg-3)",
                    }}
                  >
                    {isPublic ? t.tools.flexTournament.public : t.tools.flexTournament.unlisted}
                  </span>
                  <Switch checked={isPublic} onCheckedChange={setIsPublic} />
                </div>
              </div>

              {/* Players */}
              <div className="space-y-2">
                <Label htmlFor="players">{t.tools.flexTournament.addPlayers}</Label>
                <Textarea
                  id="players"
                  value={playersText}
                  onChange={(e) => setPlayersText(e.target.value)}
                  placeholder={t.tools.flexTournament.addPlayersPlaceholder}
                  rows={8}
                />
                <p style={{ fontSize: 12.5, color: "var(--tl-fg-3)", margin: "6px 0 0", lineHeight: 1.5 }}>
                  {t.tools.flexTournament.addPlayersHint}
                </p>
              </div>

              {/* Submit */}
              <div
                style={{
                  paddingTop: 8,
                  position: "sticky",
                  bottom: 16,
                  background: "var(--tl-bg-elev)",
                }}
              >
                <button
                  type="submit"
                  className="tl-btn green"
                  disabled={isCreating}
                  style={{ width: "100%", justifyContent: "center", padding: "14px 18px" }}
                >
                  {isCreating && <Loader2 className="w-4 h-4 animate-spin" />}
                  {t.tools.flexTournament.create}
                </button>
              </div>
            </form>
          </div>
        </section>
      </div>
    </TheLineLayout>
  );
};

export default FlexTournamentSetup;
