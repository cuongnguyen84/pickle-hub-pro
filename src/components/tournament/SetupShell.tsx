// ARCH-04: shared shell for the tournament-format setup pages
// (Flex / TeamMatch / DoublesElimination / QuickTable). Extracted verbatim
// from the per-page copies — the four wizards keep their own logic and
// step content; only the presentational skeleton (style tokens, breadcrumb,
// page head, login gate) is shared. One format migrates per PR.

import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { LogIn } from "lucide-react";
import { TheLineLayout } from "@/components/layout";
import { useI18n } from "@/i18n";
import { getLoginUrl } from "@/lib/auth-config";
import { surfaceCard, stepHeadingStyle } from "./setup-styles";

// ─── Breadcrumb: Bracket Lab / <tool> / Tạo mới|New ─────────────────────────

export function SetupBreadcrumb({ toolLabel, toolPath }: { toolLabel: string; toolPath: string }) {
  const { language } = useI18n();
  return (
    <nav className="tl-breadcrumb">
      <Link to="/tools">Bracket Lab</Link>
      <span className="sep">/</span>
      <Link to={toolPath}>{toolLabel}</Link>
      <span className="sep">/</span>
      <span className="current">{language === "vi" ? "Tạo mới" : "New"}</span>
    </nav>
  );
}

// ─── Page head: ◆ kicker + "Tạo <noun>." h1 ─────────────────────────────────

export function SetupPageHead({
  kicker,
  h1Sans,
  subtitle,
}: {
  kicker: string;
  h1Sans: string;
  subtitle?: string;
}) {
  const { language } = useI18n();
  return (
    <header className="tl-page-head">
      <div className="kicker">◆ {kicker}</div>
      <h1 style={{ fontSize: "clamp(28px, 4vw, 56px)" }}>
        <em className="tl-serif">{language === "vi" ? "Tạo" : "Create"}</em>{" "}
        <span className="sans">{h1Sans}</span>
      </h1>
      {subtitle ? <p>{subtitle}</p> : null}
    </header>
  );
}

// ─── Login gate (whole gated page) ───────────────────────────────────────────

export function SetupLoginGate({
  layoutTitle,
  noindex,
  toolLabel,
  toolPath,
  icon: Icon,
  title,
  desc,
  loginRedirect,
}: {
  layoutTitle: string;
  noindex?: boolean;
  toolLabel: string;
  toolPath: string;
  icon: LucideIcon;
  title: string;
  desc?: string;
  loginRedirect: string;
}) {
  const { t } = useI18n();
  return (
    <TheLineLayout title={layoutTitle} noindex={noindex} active="lab">
      <div className="tl-shell">
        <SetupBreadcrumb toolLabel={toolLabel} toolPath={toolPath} />
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
              <Icon className="w-7 h-7" style={{ color: "var(--tl-green)" }} />
            </div>
            <h2 style={{ ...stepHeadingStyle, fontSize: 24, marginBottom: 10 }}>{title}</h2>
            {desc ? (
              <p style={{ fontSize: 14, color: "var(--tl-fg-3)", marginBottom: 24, lineHeight: 1.5 }}>
                {desc}
              </p>
            ) : null}
            <Link to={getLoginUrl(loginRedirect)} className="tl-btn green">
              <LogIn className="w-4 h-4" />
              {t.auth.login}
            </Link>
          </div>
        </section>
      </div>
    </TheLineLayout>
  );
}
