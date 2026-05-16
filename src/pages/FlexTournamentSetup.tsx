import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useI18n } from "@/i18n";
import { TheLineLayout } from "@/components/layout";
import { useFlexTournament } from "@/hooks/useFlexTournament";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, Layers, LogIn } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { getLoginUrl } from "@/lib/auth-config";

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

  // ─── Login gate ──────────────────────────────────────────────────────────
  if (!user) {
    return (
      <TheLineLayout title="Flex Tournament Setup" active="lab">
        <div className="tl-shell">
          <nav className="tl-breadcrumb">
            <Link to="/tools">{language === "vi" ? "Bracket Lab" : "Bracket Lab"}</Link>
            <span className="sep">/</span>
            <Link to="/tools/flex-tournament">Flex Tournament</Link>
            <span className="sep">/</span>
            <span className="current">{language === "vi" ? "Tạo mới" : "New"}</span>
          </nav>

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
                <Layers className="w-7 h-7" style={{ color: "var(--tl-green)" }} />
              </div>
              <h2 style={{ ...stepHeadingStyle, fontSize: 24, marginBottom: 10 }}>
                {t.tools.flexTournament.title}
              </h2>
              <p style={{ ...stepDescStyle, marginTop: 0, marginBottom: 24, fontSize: 14 }}>
                {t.auth.loginRequired}
              </p>
              <Link to={getLoginUrl('/tools/flex-tournament/new')} className="tl-btn green">
                <LogIn className="w-4 h-4" />
                {t.auth.login}
              </Link>
            </div>
          </section>
        </div>
      </TheLineLayout>
    );
  }

  return (
    <TheLineLayout title="Flex Tournament Setup" active="lab">
      <div className="tl-shell">
        <nav className="tl-breadcrumb">
          <Link to="/tools">{language === "vi" ? "Bracket Lab" : "Bracket Lab"}</Link>
          <span className="sep">/</span>
          <Link to="/tools/flex-tournament">Flex Tournament</Link>
          <span className="sep">/</span>
          <span className="current">{language === "vi" ? "Tạo mới" : "New"}</span>
        </nav>

        <header className="tl-page-head">
          <div className="kicker">
            ◆ {language === "vi" ? "Tạo giải mới · Tự do format" : "New tournament · Custom format"}
          </div>
          <h1 style={{ fontSize: "clamp(28px, 4vw, 56px)" }}>
            <em className="tl-serif">{language === "vi" ? "Tạo" : "Create"}</em>{" "}
            <span className="sans">{language === "vi" ? "giải đấu." : "tournament."}</span>
          </h1>
        </header>

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
