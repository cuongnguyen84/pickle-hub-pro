// ============================================================================
// RecoveryRegistration (`/khoi-phuc-dang-ky`) — phone-keyed recovery flow.
// ----------------------------------------------------------------------------
// Public page (no auth). Player enters their phone number, the
// request-recovery-link edge fn picks the best channel:
//   - Zalo ZNS    — sent silently, page just says "check Zalo"
//   - Email       — sent silently, page says "check inbox" with masked addr
//   - CAPTCHA     — page surfaces a Turnstile widget; on solve, token is
//                   returned and we deep-link straight to /dang-ky/:token
// ============================================================================

import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Phone, MessageCircle, Mail, ShieldCheck, ExternalLink } from "lucide-react";
import { TheLineLayout } from "@/components/layout/TheLineLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/i18n";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import {
  isValidVietnamPhone,
  normalizeVietnamPhone,
} from "@/lib/phone";
import { TurnstileWidget } from "@/components/registration/TurnstileWidget";
import { useNoindex } from "@/hooks/useNoindex";

type ResultState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "zalo"; count: number }
  | { kind: "email"; masked: string; count: number }
  | { kind: "captcha_required"; count: number }
  | { kind: "captcha_solved"; magic_token: string; recovery_url: string }
  | { kind: "error"; code: string };

interface RecoveryResponse {
  ok?: boolean;
  channel?: "zalo" | "email" | "captcha";
  masked_email?: string;
  magic_token?: string;
  recovery_url?: string;
  count?: number;
  code?: string;
  error?: string;
}

export default function RecoveryRegistration() {
  // PR72 (SEO Phase 2A I-7): recovery flow exposes phone numbers in
  // form state + masked email; must stay out of any search index.
  useNoindex();

  const { t } = useI18n();
  const tr = t.socialEvents.recovery;

  const [phone, setPhone] = useState("");
  const [result, setResult] = useState<ResultState>({ kind: "idle" });
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  // Stable callback refs for TurnstileWidget. Inline closures would
  // re-create each render and (if the widget were ever wired to depend
  // on them) cause a remount loop. Belt-and-braces — the widget now
  // routes callbacks through refs, but keeping these stable here means
  // future debugging stays clean.
  const handleCaptchaVerify = useCallback((token: string) => {
    setCaptchaToken(token);
  }, []);
  const handleCaptchaError = useCallback(() => {
    setCaptchaToken(null);
  }, []);
  const [solvingCaptcha, setSolvingCaptcha] = useState(false);

  const normalized = normalizeVietnamPhone(phone);
  const phoneValid = normalized != null && isValidVietnamPhone(normalized);

  async function callRecovery(opts: { captcha?: string }) {
    if (!normalized) return;
    if (opts.captcha) setSolvingCaptcha(true);
    else setResult({ kind: "submitting" });

    try {
      const { data, error } = await supabase.functions.invoke<RecoveryResponse>(
        "request-recovery-link",
        {
          body: {
            phone_e164: normalized,
            captcha_token: opts.captcha,
          },
        },
      );

      let code: string | undefined;
      if (error) {
        const ctx = (error as { context?: Response }).context;
        if (ctx) {
          try {
            const txt = await ctx.text();
            code = (JSON.parse(txt) as { code?: string }).code;
          } catch {
            // ignore
          }
        }
        setResult({ kind: "error", code: code ?? "generic" });
        return;
      }
      if (!data?.ok) {
        if (data?.code === "captcha_required") {
          setResult({ kind: "captcha_required", count: data.count ?? 1 });
          return;
        }
        setResult({ kind: "error", code: data?.code ?? "generic" });
        return;
      }
      if (data.channel === "zalo") {
        setResult({ kind: "zalo", count: data.count ?? 1 });
      } else if (data.channel === "email") {
        setResult({ kind: "email", masked: data.masked_email ?? "", count: data.count ?? 1 });
      } else if (data.channel === "captcha" && data.magic_token) {
        setResult({
          kind: "captcha_solved",
          magic_token: data.magic_token,
          recovery_url: data.recovery_url ?? `/dang-ky/${data.magic_token}`,
        });
      } else {
        setResult({ kind: "error", code: "generic" });
      }
    } catch (e) {
      console.error("request-recovery-link failed", e);
      setResult({ kind: "error", code: "generic" });
    } finally {
      setSolvingCaptcha(false);
    }
  }

  function errorMessage(code: string): string {
    const errs = tr.errors as Record<string, string>;
    return errs[code] ?? errs.generic;
  }

  return (
    <TheLineLayout title={tr.pageTitle} active="events" noindex>
      <div className="tl-shell" style={{ paddingBottom: 80, maxWidth: 560, margin: "0 auto" }}>
        <header className="tl-page-head">
          <div className="kicker">◆ {tr.eyebrow}</div>
          <h1>{tr.heading}</h1>
          <p>{tr.subheading}</p>
        </header>

        <Card>
          <CardContent className="space-y-5 pt-6">
            <div className="space-y-2">
              <Label htmlFor="recovery-phone">{tr.phoneLabel}</Label>
              <div className="relative">
                <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="recovery-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+84..."
                  className="pl-9"
                  disabled={result.kind === "submitting" || result.kind === "captcha_required" || result.kind === "captcha_solved"}
                />
              </div>
              {phone.length > 0 && !phoneValid && (
                <p className="text-xs text-destructive">{tr.phoneInvalid}</p>
              )}
            </div>

            {(result.kind === "idle" || result.kind === "error") && (
              <button
                type="button"
                className="tl-btn green w-full justify-center"
                disabled={!phoneValid}
                onClick={() => callRecovery({})}
                style={{ opacity: phoneValid ? 1 : 0.5 }}
              >
                {tr.submit} →
              </button>
            )}
            {result.kind === "submitting" && (
              <button type="button" className="tl-btn green w-full justify-center" disabled>
                <Loader2 className="h-4 w-4 animate-spin" /> {tr.submitting}
              </button>
            )}

            {/* Zalo channel */}
            {result.kind === "zalo" && (
              <div className="rounded-md border border-emerald-400/40 bg-emerald-50 p-4 dark:bg-emerald-950/30">
                <div className="flex items-start gap-2">
                  <MessageCircle className="mt-0.5 h-5 w-5 text-emerald-600" />
                  <div>
                    <p className="font-semibold text-emerald-900 dark:text-emerald-100">
                      {tr.zaloSentTitle}
                    </p>
                    <p className="text-sm text-emerald-800 dark:text-emerald-200">
                      {tr.zaloSentBody.replace("{n}", String(result.count))}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Email channel */}
            {result.kind === "email" && (
              <div className="rounded-md border border-emerald-400/40 bg-emerald-50 p-4 dark:bg-emerald-950/30">
                <div className="flex items-start gap-2">
                  <Mail className="mt-0.5 h-5 w-5 text-emerald-600" />
                  <div>
                    <p className="font-semibold text-emerald-900 dark:text-emerald-100">
                      {tr.emailSentTitle}
                    </p>
                    <p className="text-sm text-emerald-800 dark:text-emerald-200">
                      {tr.emailSentBody
                        .replace("{n}", String(result.count))
                        .replace("{email}", result.masked)}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* CAPTCHA required */}
            {result.kind === "captcha_required" && (
              <div className="space-y-3 rounded-md border border-border bg-muted/30 p-4">
                <div className="flex items-start gap-2">
                  <ShieldCheck className="mt-0.5 h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-semibold">{tr.captchaTitle}</p>
                    <p className="text-sm text-muted-foreground">{tr.captchaBody}</p>
                  </div>
                </div>
                <TurnstileWidget
                  onVerify={handleCaptchaVerify}
                  onError={handleCaptchaError}
                />
                <button
                  type="button"
                  className="tl-btn green w-full justify-center"
                  disabled={!captchaToken || solvingCaptcha}
                  onClick={() => captchaToken && callRecovery({ captcha: captchaToken })}
                  style={{ opacity: captchaToken && !solvingCaptcha ? 1 : 0.5 }}
                >
                  {solvingCaptcha ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ShieldCheck className="h-4 w-4" />
                  )}
                  {solvingCaptcha ? tr.captchaVerifying : tr.captchaSubmit}
                </button>
              </div>
            )}

            {/* CAPTCHA solved → deep link */}
            {result.kind === "captcha_solved" && (
              <div className="rounded-md border border-emerald-400/40 bg-emerald-50 p-4 dark:bg-emerald-950/30">
                <p className="font-semibold text-emerald-900 dark:text-emerald-100">
                  {tr.captchaSuccessTitle}
                </p>
                <p className="text-sm text-emerald-800 dark:text-emerald-200">
                  {tr.captchaSuccessBody}
                </p>
                <a
                  href={`/dang-ky/${result.magic_token}`}
                  className="tl-btn green mt-3 w-full justify-center"
                  style={{ textDecoration: "none" }}
                >
                  <ExternalLink className="h-4 w-4" /> {tr.captchaOpenCta} →
                </a>
              </div>
            )}

            {result.kind === "error" && (
              <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                {errorMessage(result.code)}
              </div>
            )}

            <p className="text-center text-xs text-muted-foreground">
              {tr.noRegistration}{" "}
              <Link to="/clubs" className="underline">
                {tr.noRegistrationCta}
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </TheLineLayout>
  );
}
