// ============================================================================
// PlayerRegistration (`/dang-ky/:magic_token`) — player self-service (PR58).
// ----------------------------------------------------------------------------
// Public page (no auth) — the magic_token is the bearer credential. The
// player lands here from the success state of the registration modal or
// from a copy/paste bookmark. They can:
//   - See registration status (active vs cancelled)
//   - See refund eligibility based on event.cancellation_hours
//   - Cancel an active registration (with optional reason)
//   - Reactivate a cancelled registration if slot is still free
//
// Data is fetched via a read-only RPC `get_registration_by_token` that
// joins event + payment info into a single row. Cancel + reactivate go
// through the cancel-registration / reactivate-registration edge fns.
// ============================================================================

import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, CheckCircle2, XCircle, Copy, AlertTriangle, Clock } from "lucide-react";
import { TheLineLayout } from "@/components/layout/TheLineLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/i18n";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { formatEventDateRange } from "@/lib/social-events/format";

interface RegistrationView {
  registration_id: string;
  event_id: string;
  event_slug: string;
  event_title_vi: string;
  event_title_en: string | null;
  event_status: "draft" | "published" | "cancelled" | "completed";
  event_start_at: string;
  event_end_at: string;
  event_location_text: string | null;
  event_price_vnd: number;
  event_cancellation_hours: number;
  event_max_players: number;
  /** PR67 — populated by get_registration_by_token. */
  event_requires_prepayment: boolean;
  event_prepayment_deadline_hours: number;
  active_registrations: number;
  display_name: string;
  phone: string | null;
  status: "registered" | "checked_in" | "cancelled" | "no_show";
  cancelled_at: string | null;
  cancelled_reason: string | null;
  payment_status: "unpaid" | "pending_payment" | "paid" | "refunded";
  /** PR67 — order_id for mark-payment-claimed when the user clicks
   *  "Đã thanh toán" on the countdown banner. */
  payment_order_id: string | null;
  payment_reference_code: string | null;
  /** PR67 — true if the player has marked the transfer claimed via
   *  create-payment-order/mark-payment-claimed. */
  player_claimed_paid: boolean;
  registered_at: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function formatVnd(amount: number, lang: "vi" | "en"): string {
  return new Intl.NumberFormat(lang === "vi" ? "vi-VN" : "en-US").format(amount);
}

function formatTimestamp(iso: string, lang: "vi" | "en"): string {
  const d = new Date(iso);
  return d.toLocaleString(lang === "vi" ? "vi-VN" : "en-GB", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour12: false,
  });
}

export default function PlayerRegistration() {
  const { magic_token } = useParams<{ magic_token: string }>();
  const { t, language } = useI18n();
  const tr = t.socialEvents.playerRegistration;
  const queryClient = useQueryClient();

  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [reactivating, setReactivating] = useState(false);
  // PR67 — bumps every minute so the prepayment countdown re-renders.
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [markingPaid, setMarkingPaid] = useState(false);
  // PR67 follow-up — two-step confirmation guard on the prepayment
  // claim button. Original single-click variant was too easy to fire
  // accidentally (a label-looking button on a focused user-visit),
  // resulting in payment_orders.player_claimed_paid=true even when
  // the user only meant to inspect the page. Now click 1 transforms
  // the button into a Confirm + Cancel pair; only Confirm actually
  // calls mark-payment-claimed.
  const [confirmingClaim, setConfirmingClaim] = useState(false);

  useEffect(() => {
    // 60s tick is plenty for an HH:MM countdown display.
    const handle = window.setInterval(() => setNowTick(Date.now()), 60_000);
    return () => window.clearInterval(handle);
  }, []);

  const tokenValid = typeof magic_token === "string" && UUID_RE.test(magic_token);

  const { data, isLoading, refetch } = useQuery<RegistrationView | null>({
    queryKey: ["player-registration", magic_token],
    queryFn: async () => {
      if (!tokenValid) return null;
      const { data, error } = await supabase.rpc("get_registration_by_token", {
        p_magic_token: magic_token,
      });
      if (error) {
        console.error("PlayerRegistration RPC error", error);
        return null;
      }
      const row = Array.isArray(data) ? data[0] : data;
      return (row ?? null) as RegistrationView | null;
    },
    enabled: tokenValid,
    staleTime: 30_000,
  });

  const refundEligible = useMemo(() => {
    if (!data) return false;
    const hoursUntilStart =
      (new Date(data.event_start_at).getTime() - Date.now()) / (1000 * 60 * 60);
    return hoursUntilStart >= data.event_cancellation_hours;
  }, [data]);

  async function handleCancel() {
    if (!magic_token) return;
    setCancelling(true);
    try {
      const { data: resp, error } = await supabase.functions.invoke<{
        ok?: boolean;
        error?: string;
        code?: string;
      }>("cancel-registration", {
        body: { magic_token, reason: cancelReason.trim() || undefined },
      });

      if (error) {
        const ctx = (error as { context?: Response }).context;
        let code: string | undefined;
        if (ctx) {
          try {
            const txt = await ctx.text();
            code = JSON.parse(txt)?.code;
          } catch {
            // ignore
          }
        }
        const msg =
          code && tr.errors[code as keyof typeof tr.errors]
            ? tr.errors[code as keyof typeof tr.errors]
            : tr.errors.generic;
        toast({ title: msg, variant: "destructive" });
        return;
      }
      if (resp?.code) {
        const msg =
          tr.errors[resp.code as keyof typeof tr.errors] ?? tr.errors.generic;
        toast({ title: msg, variant: "destructive" });
        return;
      }

      toast({ title: tr.cancelSuccessTitle, description: tr.cancelSuccessBody });
      setCancelOpen(false);
      setCancelReason("");
      await refetch();
      await queryClient.invalidateQueries({ queryKey: ["social-event", data?.event_slug] });
    } finally {
      setCancelling(false);
    }
  }

  async function handleReactivate() {
    if (!magic_token) return;
    setReactivating(true);
    try {
      const { data: resp, error } = await supabase.functions.invoke<{
        ok?: boolean;
        error?: string;
        code?: string;
      }>("reactivate-registration", {
        body: { magic_token },
      });
      if (error) {
        const ctx = (error as { context?: Response }).context;
        let code: string | undefined;
        if (ctx) {
          try {
            const txt = await ctx.text();
            code = JSON.parse(txt)?.code;
          } catch {
            // ignore
          }
        }
        const msg =
          code && tr.errors[code as keyof typeof tr.errors]
            ? tr.errors[code as keyof typeof tr.errors]
            : tr.errors.generic;
        toast({ title: msg, variant: "destructive" });
        return;
      }
      if (resp?.code) {
        const msg =
          tr.errors[resp.code as keyof typeof tr.errors] ?? tr.errors.generic;
        toast({ title: msg, variant: "destructive" });
        return;
      }

      toast({ title: tr.reactivateSuccessTitle, description: tr.reactivateSuccessBody });
      await refetch();
      await queryClient.invalidateQueries({ queryKey: ["social-event", data?.event_slug] });
    } finally {
      setReactivating(false);
    }
  }

  function copyReferenceCode() {
    if (!data?.payment_reference_code) return;
    void navigator.clipboard.writeText(data.payment_reference_code);
    toast({ title: tr.referenceCodeCopied });
  }

  if (!tokenValid) {
    return (
      <TheLineLayout title={tr.notFoundTitle} active="events" noindex>
        <div className="tl-shell" style={{ padding: "60px 16px", textAlign: "center" }}>
          <h1 style={{ fontSize: 24, marginBottom: 12 }}>{tr.notFoundTitle}</h1>
          <p style={{ color: "var(--tl-fg-3)" }}>{tr.notFoundBody}</p>
        </div>
      </TheLineLayout>
    );
  }

  if (isLoading) {
    return (
      <TheLineLayout title="Loading…" active="events" noindex>
        <div className="tl-shell" style={{ padding: "60px 16px" }}>
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </TheLineLayout>
    );
  }

  if (!data) {
    return (
      <TheLineLayout title={tr.notFoundTitle} active="events" noindex>
        <div className="tl-shell" style={{ padding: "60px 16px", textAlign: "center" }}>
          <h1 style={{ fontSize: 24, marginBottom: 12 }}>{tr.notFoundTitle}</h1>
          <p style={{ color: "var(--tl-fg-3)" }}>{tr.notFoundBody}</p>
        </div>
      </TheLineLayout>
    );
  }

  const title =
    language === "vi"
      ? data.event_title_vi
      : (data.event_title_en && data.event_title_en.trim().length > 0
          ? data.event_title_en
          : data.event_title_vi);

  const eventStarted = new Date(data.event_start_at).getTime() <= Date.now();
  const eventCancelled = data.event_status === "cancelled";
  const isCancelled = data.cancelled_at !== null;
  const slotsLeft = Math.max(0, data.event_max_players - data.active_registrations);
  const canReactivate = isCancelled && !eventStarted && !eventCancelled && slotsLeft > 0;

  return (
    <TheLineLayout title={`${tr.pageTitle} — ${title}`} active="events" noindex>
      <div className="tl-shell" style={{ paddingBottom: 80, maxWidth: 720, margin: "0 auto" }}>
        <header className="tl-page-head">
          <div className="kicker">◆ {tr.eyebrow}</div>
          <h1>{title}</h1>
          <p>
            <Link to={`/social/${data.event_slug}`} className="hover:underline">
              {tr.viewPublic} →
            </Link>
          </p>
        </header>

        {eventCancelled && (
          <Card className="mb-6 border-destructive/40 bg-destructive/5 p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-5 w-5 text-destructive" />
              <div>
                <h2 className="font-semibold">{tr.eventCancelledTitle}</h2>
                <p className="text-sm text-muted-foreground">{tr.eventCancelledBody}</p>
              </div>
            </div>
          </Card>
        )}

        {/* PR67 — prepayment countdown banner. Renders when the event
            requires prepayment, the registration is still pending, the
            player hasn't claimed, and the event hasn't been cancelled
            by the organizer. nowTick (re-bumped every 60s) keeps the
            countdown fresh. */}
        {!isCancelled && !eventCancelled && data.event_requires_prepayment &&
          data.payment_status === "pending_payment" && !data.player_claimed_paid && (
            (() => {
              const deadlineMs =
                new Date(data.registered_at).getTime() +
                data.event_prepayment_deadline_hours * 60 * 60 * 1000;
              const remainingMs = deadlineMs - nowTick;
              const overdue = remainingMs <= 0;
              const hours = Math.floor(remainingMs / (60 * 60 * 1000));
              const minutes = Math.max(
                0,
                Math.floor((remainingMs % (60 * 60 * 1000)) / 60_000),
              );
              const countdownLabel = overdue
                ? tr.paymentOverdue
                : tr.timeRemaining
                    .replace("{hours}", String(hours))
                    .replace("{minutes}", String(minutes));
              return (
                <Card className="mb-6 border-amber-400/50 bg-amber-50 p-4 dark:bg-amber-950/40">
                  <div className="flex items-start gap-2">
                    <Clock className="mt-0.5 h-5 w-5 text-amber-700 dark:text-amber-200" />
                    <div className="flex-1">
                      <h2 className="font-semibold text-amber-900 dark:text-amber-100">
                        {tr.unpaidRegistrationBannerTitle}
                      </h2>
                      <p className="mt-0.5 text-sm text-amber-800 dark:text-amber-200">
                        {tr.unpaidRegistrationBannerDescription}
                      </p>
                      <p className="mt-2 font-mono text-sm font-semibold text-amber-900 dark:text-amber-100">
                        {countdownLabel}
                      </p>
                      {data.payment_order_id && magic_token && (
                        // PR67 follow-up — 2-step confirmation. Click 1
                        // transforms button into a Confirm + Cancel pair.
                        // Single accidental tap no longer claims.
                        !confirmingClaim ? (
                          <Button
                            type="button"
                            variant="default"
                            size="sm"
                            className="mt-3"
                            disabled={markingPaid}
                            onClick={() => setConfirmingClaim(true)}
                          >
                            {tr.payNowButton}
                          </Button>
                        ) : (
                          <div className="mt-3 flex flex-col gap-2 rounded-md border border-amber-500/40 bg-amber-100/40 p-3 dark:bg-amber-900/30">
                            <p className="text-xs font-medium text-amber-900 dark:text-amber-100">
                              {tr.payNowConfirmPrompt}
                            </p>
                            <div className="flex gap-2">
                              <Button
                                type="button"
                                variant="default"
                                size="sm"
                                disabled={markingPaid}
                                onClick={async () => {
                                  if (!magic_token || !data.payment_order_id) return;
                                  setMarkingPaid(true);
                                  try {
                                    const { error } = await supabase.functions.invoke(
                                      "mark-payment-claimed",
                                      {
                                        body: {
                                          order_id: data.payment_order_id,
                                          magic_token,
                                        },
                                      },
                                    );
                                    if (error) {
                                      toast({
                                        title: tr.errors.generic,
                                        variant: "destructive",
                                      });
                                      return;
                                    }
                                    await refetch();
                                    setConfirmingClaim(false);
                                    toast({ title: tr.payNowSuccess });
                                  } finally {
                                    setMarkingPaid(false);
                                  }
                                }}
                              >
                                {markingPaid ? (
                                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                                ) : null}
                                {tr.payNowConfirm}
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled={markingPaid}
                                onClick={() => setConfirmingClaim(false)}
                              >
                                {tr.payNowCancel}
                              </Button>
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                </Card>
              );
            })()
          )}

        <Card className="mb-4 p-5">
          <div className="mb-3 flex items-center gap-2">
            {isCancelled || eventCancelled ? (
              <span
                className="tl-format-badge"
                style={{ borderColor: "var(--tl-live)", color: "var(--tl-live)" }}
              >
                {tr.statusCancelled}
              </span>
            ) : (
              <span
                className="tl-format-badge"
                style={{ borderColor: "var(--tl-green)", color: "var(--tl-green)" }}
              >
                {tr.statusActive}
              </span>
            )}
          </div>

          <dl className="space-y-2 text-sm">
            <div className="flex flex-wrap gap-2">
              <dt className="w-32 font-medium text-muted-foreground">{tr.labelName}</dt>
              <dd>{data.display_name}</dd>
            </div>
            <div className="flex flex-wrap gap-2">
              <dt className="w-32 font-medium text-muted-foreground">{tr.labelWhen}</dt>
              <dd>{formatEventDateRange(data.event_start_at, data.event_end_at, language)}</dd>
            </div>
            {data.event_location_text && (
              <div className="flex flex-wrap gap-2">
                <dt className="w-32 font-medium text-muted-foreground">{tr.labelWhere}</dt>
                <dd>{data.event_location_text}</dd>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <dt className="w-32 font-medium text-muted-foreground">{tr.labelPrice}</dt>
              <dd>
                {data.event_price_vnd === 0
                  ? tr.priceFree
                  : `${formatVnd(data.event_price_vnd, language)} ₫`}
              </dd>
            </div>
            {isCancelled && data.cancelled_at && (
              <>
                <div className="flex flex-wrap gap-2">
                  <dt className="w-32 font-medium text-muted-foreground">{tr.labelCancelledAt}</dt>
                  <dd>{formatTimestamp(data.cancelled_at, language)}</dd>
                </div>
                {data.cancelled_reason && (
                  <div className="flex flex-wrap gap-2">
                    <dt className="w-32 font-medium text-muted-foreground">{tr.labelCancelledReason}</dt>
                    <dd>{data.cancelled_reason}</dd>
                  </div>
                )}
              </>
            )}
          </dl>
        </Card>

        {data.payment_reference_code && (
          <Card className="mb-4 p-5">
            <h2 className="mb-2 font-mono text-xs uppercase tracking-wider text-muted-foreground">
              {tr.paymentHeading}
            </h2>
            <div className="flex items-center gap-2">
              <code className="rounded-md bg-muted px-3 py-1.5 font-mono text-sm">
                {data.payment_reference_code}
              </code>
              <Button type="button" variant="outline" size="sm" onClick={copyReferenceCode}>
                <Copy className="h-3.5 w-3.5" />
              </Button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              {data.payment_status === "paid" ? tr.paymentMarked : tr.paymentPending}
            </p>
          </Card>
        )}

        {data.event_price_vnd > 0 && !isCancelled && !eventCancelled && (
          <Card className="mb-4 p-5">
            <h2 className="mb-2 font-mono text-xs uppercase tracking-wider text-muted-foreground">
              {tr.cancellationPolicyHeading}
            </h2>
            <p className="text-sm">
              {refundEligible
                ? tr.refundEligible.replace("{h}", String(data.event_cancellation_hours))
                : tr.refundIneligible.replace("{h}", String(data.event_cancellation_hours))}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{tr.refundManualNote}</p>
          </Card>
        )}

        {/* Action footer */}
        <div className="mt-6 flex flex-wrap gap-3">
          {!isCancelled && !eventCancelled && !eventStarted && (
            <Button
              type="button"
              variant="destructive"
              onClick={() => setCancelOpen(true)}
              className="gap-1"
            >
              <XCircle className="h-4 w-4" /> {tr.cancelCta}
            </Button>
          )}
          {!isCancelled && eventStarted && !eventCancelled && (
            <p className="text-sm text-muted-foreground">{tr.eventStartedHint}</p>
          )}
          {canReactivate && (
            <button
              type="button"
              className="tl-btn green"
              disabled={reactivating}
              onClick={handleReactivate}
            >
              {reactivating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              {reactivating ? tr.reactivating : `${tr.reactivateCta} →`}
            </button>
          )}
          {isCancelled && !canReactivate && !eventCancelled && (
            <p className="text-sm text-muted-foreground">
              {eventStarted ? tr.eventStartedHint : tr.eventFullHint}
            </p>
          )}
        </div>

        {cancelOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            onClick={() => !cancelling && setCancelOpen(false)}
          >
            <div
              className="w-full max-w-md rounded-md border border-border bg-card p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold">{tr.cancelModalTitle}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{tr.cancelModalBody}</p>
              <div className="mt-4 space-y-2">
                <Label htmlFor="cancel-reason">{tr.cancelReasonLabel}</Label>
                <Textarea
                  id="cancel-reason"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  rows={3}
                  maxLength={280}
                  placeholder={tr.cancelReasonPlaceholder}
                  disabled={cancelling}
                />
              </div>
              <div className="mt-5 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={cancelling}
                  onClick={() => {
                    setCancelOpen(false);
                    setCancelReason("");
                  }}
                >
                  {tr.modalBack}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  disabled={cancelling}
                  onClick={handleCancel}
                >
                  {cancelling ? (
                    <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  ) : (
                    <XCircle className="mr-1 h-4 w-4" />
                  )}
                  {cancelling ? tr.cancelling : tr.cancelConfirmCta}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </TheLineLayout>
  );
}
