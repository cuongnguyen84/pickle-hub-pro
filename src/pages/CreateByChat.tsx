import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";
import { TheLineLayout } from "@/components/layout/TheLineLayout";
import { HreflangTags } from "@/components/seo/HreflangTags";
import { CREATE_BY_CHAT_COPY, CREATE_BY_CHAT_PATHS } from "@/content/tools/create-by-chat-copy";

/**
 * Landing page for the AI-chat tournament creator
 * (/tools/create-by-chat, VI: /vi/tools/tao-giai-bang-chat - a literal
 * route pair in App.tsx because the VI slug differs). Copy lives in
 * src/content/tools/create-by-chat-copy.ts and is shared with the bot
 * SSR renderer so the two surfaces cannot drift. The demo block is a
 * sample conversation in the product's real flow (paste list - draft -
 * create); the demo video is tracked separately with Bot MXH.
 */
export default function CreateByChat() {
  const { language } = useI18n();
  const vi = language === "vi";
  const c = CREATE_BY_CHAT_COPY[vi ? "vi" : "en"];
  const chatHref = vi ? CREATE_BY_CHAT_PATHS.chatVi : CREATE_BY_CHAT_PATHS.chatEn;
  const guideHref = vi ? "/vi/blog/tao-giai-pickleball-bang-ai" : "/blog/create-tournament-by-chat";

  return (
    <TheLineLayout title={c.metaTitle} description={c.metaDescription} active="lab">
      <HreflangTags enPath={CREATE_BY_CHAT_PATHS.en} viPath={CREATE_BY_CHAT_PATHS.vi} />
      <div className="tl-shell">
        <nav className="tl-breadcrumb">
          <Link to="/">{vi ? "Trang chủ" : "Home"}</Link>
          <span className="sep">/</span>
          <Link to={vi ? "/vi/tools" : "/tools"}>{vi ? "Công cụ" : "Bracket Lab"}</Link>
          <span className="sep">/</span>
          <span className="current">{vi ? "Tạo giải bằng chat AI" : "Create by chat"}</span>
        </nav>

        <header className="tl-page-head">
          <div className="kicker">{c.kicker}</div>
          <h1>{c.h1}</h1>
          <p>{c.lead}</p>
          <div style={{ display: "flex", gap: 10, marginTop: 28, flexWrap: "wrap" }}>
            <Button asChild variant="tl-primary">
              <Link to={chatHref}>{c.cta} →</Link>
            </Button>
            <Button asChild variant="outline">
              <Link to={guideHref}>{vi ? "Đọc hướng dẫn" : "Read the guide"}</Link>
            </Button>
          </div>
        </header>

        <section style={{ marginBottom: 48 }}>
          <div className="tl-sec-head">
            <h2>{c.demoTitle}</h2>
          </div>
          <div style={{ border: "1px solid var(--tl-line)", borderRadius: 12, padding: 20, display: "grid", gap: 12 }}>
            {c.demo.map(([speaker, text]) => (
              <p key={text} style={{ margin: 0 }}>
                <strong>{speaker}:</strong> {text}
              </p>
            ))}
          </div>
        </section>

        <section style={{ marginBottom: 48 }}>
          <div className="tl-sec-head">
            <h2>{c.stepsHeading}</h2>
          </div>
          <ol style={{ display: "grid", gap: 14, paddingLeft: 20 }}>
            {c.steps.map(([name, text], i) => (
              <li key={name} id={`step-${i + 1}`}>
                <strong>{name}.</strong> {text}
              </li>
            ))}
          </ol>
        </section>

        <section style={{ marginBottom: 48 }}>
          <div className="tl-sec-head">
            <h2>{c.formatsHeading}</h2>
          </div>
          <ul style={{ display: "grid", gap: 8, paddingLeft: 20 }}>
            {c.formats.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>
          <p>{c.formatsNote}</p>
        </section>

        <section style={{ marginBottom: 48 }}>
          <div className="tl-sec-head">
            <h2>{c.proofHeading}</h2>
          </div>
          <div className="tl-stats-row">
            {c.proofStats.map(([value, label]) => (
              <div className="tl-stat-box" key={label}>
                <div className="val">
                  <span className="green">{value}</span>
                </div>
                <div className="sub">{label}</div>
              </div>
            ))}
          </div>
          <p style={{ marginTop: 16 }}>{c.proofText}</p>
        </section>

        <section style={{ marginBottom: 56 }}>
          <div className="tl-sec-head">
            <h2>{c.faqHeading}</h2>
          </div>
          <div style={{ display: "grid", gap: 18 }}>
            {c.faq.map(([q, a]) => (
              <div key={q}>
                <h3 style={{ margin: "0 0 6px" }}>{q}</h3>
                <p style={{ margin: 0 }}>{a}</p>
              </div>
            ))}
          </div>
        </section>

        <section style={{ marginBottom: 80, textAlign: "center" }}>
          <h2>{c.closing}</h2>
          <p>{c.lead}</p>
          <Button asChild variant="tl-primary">
            <Link to={chatHref}>{c.cta} →</Link>
          </Button>
        </section>
      </div>
    </TheLineLayout>
  );
}
