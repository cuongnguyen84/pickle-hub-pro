import { useI18n } from "@/i18n";
import {
  TOOLS_FAQ_EN,
  TOOLS_FAQ_VI,
  TOOLS_HOWTO_EN,
  TOOLS_HOWTO_VI,
  TOOLS_HOWTO_META,
} from "@/content/tools/hub-copy";

/**
 * Visible how-to steps + FAQ for the /tools hub.
 *
 * SEO-GUARD-01 (2026-08-19). Two problems this fixes:
 *
 * 1. The SSR bot path (functions/_lib/render/tools.ts) emitted FAQPage JSON-LD
 *    and now HowTo JSON-LD, but the React page rendered neither the questions
 *    nor the steps. Google requires FAQ and HowTo structured data to describe
 *    content a visitor can actually see. The older ToolsSeoContent.tsx
 *    `ToolsHubSeoContent` block was written for this slot but was never
 *    imported by Tools.tsx, so it shipped as dead code — and it is EN-only,
 *    which does not work for a ~95% Vietnamese audience.
 *
 * 2. GSC 10–16/8 vs 3–9/8: /tools went 16 clicks → 0 and "pickleball bracket
 *    generator" slid pos 12.2 → 19. The page had the head term in its title
 *    but no procedural depth behind it.
 *
 * Copy is imported from src/content/tools/hub-copy.ts — the same arrays the SSR
 * renderer uses — so the two paths cannot drift.
 */
export const ToolsHubFaqSection = () => {
  const { language } = useI18n();
  const isVi = language === "vi";
  const meta = isVi ? TOOLS_HOWTO_META.vi : TOOLS_HOWTO_META.en;
  const steps = isVi ? TOOLS_HOWTO_VI : TOOLS_HOWTO_EN;
  const faqs = isVi ? TOOLS_FAQ_VI : TOOLS_FAQ_EN;

  return (
    <>
      {/* How-to steps — mirrors the HowTo JSON-LD in the SSR renderer. */}
      <section style={{ marginBottom: 56 }} id={isVi ? "cach-tao" : "how-to"}>
        <div className="tl-sec-head">
          <h2>{meta.heading}</h2>
        </div>
        <div
          style={{
            maxWidth: "68ch",
            margin: "0 auto",
            color: "var(--tl-fg-2)",
            fontSize: 16,
            lineHeight: 1.7,
          }}
        >
          <p style={{ marginBottom: 24 }}>{meta.description}</p>
          <ol style={{ listStyle: "none", padding: 0, margin: 0, counterReset: "tl-step" }}>
            {steps.map(([name, text], i) => (
              <li
                key={name}
                id={`step-${i + 1}`}
                style={{
                  display: "flex",
                  gap: 16,
                  paddingBottom: 20,
                  marginBottom: 20,
                  borderBottom:
                    i === steps.length - 1 ? "none" : "1px solid var(--tl-border)",
                }}
              >
                <span
                  className="tl-mono"
                  aria-hidden="true"
                  style={{
                    flex: "0 0 auto",
                    fontSize: 12,
                    lineHeight: "26px",
                    width: 26,
                    height: 26,
                    borderRadius: "50%",
                    textAlign: "center",
                    color: "var(--tl-green)",
                    border: "1px solid var(--tl-border)",
                  }}
                >
                  {i + 1}
                </span>
                <span>
                  <strong style={{ color: "var(--tl-fg)" }}>{name}.</strong> {text}
                </span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* FAQ — mirrors the FAQPage JSON-LD in the SSR renderer. */}
      <section style={{ marginBottom: 56 }}>
        <div className="tl-sec-head">
          <h2>{meta.faqHeading}</h2>
        </div>
        <div
          style={{
            maxWidth: "68ch",
            margin: "0 auto",
            color: "var(--tl-fg-2)",
            fontSize: 16,
            lineHeight: 1.7,
          }}
        >
          {faqs.map(([question, answer], i) => (
            <div
              key={question}
              style={{
                paddingBottom: 20,
                marginBottom: 20,
                borderBottom: i === faqs.length - 1 ? "none" : "1px solid var(--tl-border)",
              }}
            >
              <h3
                style={{
                  fontSize: 16.5,
                  fontWeight: 600,
                  color: "var(--tl-fg)",
                  margin: "0 0 8px",
                  lineHeight: 1.4,
                }}
              >
                {question}
              </h3>
              <p style={{ margin: 0 }}>{answer}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
};

export default ToolsHubFaqSection;
