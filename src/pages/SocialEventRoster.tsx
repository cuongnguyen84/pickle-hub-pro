// ============================================================================
// SocialEventRoster (`/social/:slug/danh-sach`) — organizer roster table.
// ----------------------------------------------------------------------------
// Lists all registrations with inline organizer actions (check-in,
// payment toggle, no-show, cancel, edit notes). Manual add of a guest
// (no OTP) for walk-ins. CSV export. Auth-gated via useEventOwnership.
// ============================================================================

import { useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import {
  Loader2,
  Plus,
  Download,
  MoreVertical,
  CheckCircle2,
  XCircle,
  Banknote,
  StickyNote,
} from "lucide-react";
import { TheLineLayout } from "@/components/layout/TheLineLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Table,
  TableHeader,
  TableHead,
  TableRow,
  TableBody,
  TableCell,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useI18n } from "@/i18n";
import { useSocialEvent } from "@/hooks/useSocialEvent";
import { useEventRegistrations, type EventRegistrationRow } from "@/hooks/useEventRegistrations";
import { useEventOwnership } from "@/hooks/useClubOwnership";
import { useNoindex } from "@/hooks/useNoindex";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { maskPhone } from "@/lib/phone";
import { buildLoginRedirect } from "@/lib/auth/safeRedirect";
import { ManualAddRegistrationModal } from "@/components/social-events/ManualAddRegistrationModal";

interface PaymentOrderRow {
  id: string;
  registration_id: string;
  amount_vnd: number;
  reference_code: string;
  player_claimed_paid: boolean;
  player_claimed_at: string | null;
}

function fmtRegisteredAt(iso: string, lang: "vi" | "en"): string {
  try {
    return new Date(iso).toLocaleString(lang === "vi" ? "vi-VN" : "en-GB", {
      timeZone: "Asia/Ho_Chi_Minh",
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function buildCsv(rows: EventRegistrationRow[]): string {
  const header = [
    "name",
    "phone",
    "self_rated_level",
    "status",
    "payment_status",
    "paid_at",
    "registered_at",
    "notes",
  ].join(",");
  const escape = (v: string | null | undefined) => {
    if (v == null) return "";
    const s = String(v);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const lines = rows.map((r) =>
    [
      escape(r.display_name),
      escape(r.phone),
      r.self_rated_level == null ? "" : r.self_rated_level.toFixed(1),
      r.status,
      r.payment_status,
      escape(r.paid_at),
      escape(r.registered_at),
      escape(r.notes),
    ].join(","),
  );
  return [header, ...lines].join("\n");
}

export default function SocialEventRoster() {
  // PR72 (SEO Phase 2A I-7): roster has masked PII (phone, display_name)
  // for every registered player — organizer-only surface, never index.
  useNoindex();

  const { slug } = useParams<{ slug: string }>();
  const { t, language } = useI18n();
  const roster = t.socialEvents.roster;
  const manage = t.socialEvents.manage;
  const queryClient = useQueryClient();
  const permission = useEventOwnership(slug);
  const { data: event } = useSocialEvent(slug);
  const { data: registrations, refetch } = useEventRegistrations(event?.id);

  // Payment orders for this event (PR49). RLS restricts SELECT to the
  // event organizer + admin, which matches who's allowed to view this
  // page. The map is keyed by registration_id so a single roster row
  // can look up its order in O(1).
  const { data: paymentOrders } = useQuery<PaymentOrderRow[]>({
    queryKey: ["payment-orders-event", event?.id],
    queryFn: async () => {
      if (!event?.id) return [];
      const { data, error } = await supabase
        .from("payment_orders")
        .select(
          `id, registration_id, amount_vnd, reference_code,
           player_claimed_paid, player_claimed_at,
           event_registrations!inner(event_id)`,
        )
        .eq("event_registrations.event_id", event.id);
      if (error) {
        console.error("payment-orders-event fetch error", error);
        return [];
      }
      // The inner-join filter is server-side; the response shape still
      // includes the join column but we don't need it client-side.
      return (data as PaymentOrderRow[]) ?? [];
    },
    enabled: Boolean(event?.id),
    staleTime: 30_000,
  });

  const ordersByRegistration = useMemo(() => {
    const map = new Map<string, PaymentOrderRow>();
    for (const o of paymentOrders ?? []) map.set(o.registration_id, o);
    return map;
  }, [paymentOrders]);

  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
  const [confirmNoShowId, setConfirmNoShowId] = useState<string | null>(null);
  const [notesRow, setNotesRow] = useState<EventRegistrationRow | null>(null);
  const [notesValue, setNotesValue] = useState("");
  const [manualOpen, setManualOpen] = useState(false);

  // PR proxy/manual — look up display_name of the proxy / organizer
  // who created each non-self registration so the cell can render
  // "bạn của <A>" / "BTC <organizer>" next to the friend's name.
  const registeredByIds = useMemo(() => {
    const ids = new Set<string>();
    for (const r of registrations ?? []) {
      if (r.registered_by_profile_id) ids.add(r.registered_by_profile_id);
    }
    return Array.from(ids);
  }, [registrations]);

  const { data: registeredByProfiles } = useQuery<Record<string, string>>({
    queryKey: ["registered-by-profiles", registeredByIds.join(",")],
    queryFn: async () => {
      if (registeredByIds.length === 0) return {};
      const { data, error } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", registeredByIds);
      if (error) {
        console.error("registered-by-profiles fetch error", error);
        return {};
      }
      const map: Record<string, string> = {};
      for (const row of data ?? []) {
        map[(row as { id: string }).id] = (row as { display_name: string | null }).display_name ?? "";
      }
      return map;
    },
    enabled: registeredByIds.length > 0,
    staleTime: 60_000,
  });

  const stats = useMemo(() => {
    const list = registrations ?? [];
    // PR52: rename "Đã thanh toán" → "Player đã claim". With PR51 the
    // organizer-toggled payment_status field is essentially dead — only
    // player_claimed_paid changes during a live event. Count the latter.
    const claimed = (paymentOrders ?? []).filter((o) => o.player_claimed_paid).length;
    return {
      registered: list.length,
      claimed,
      checkedIn: list.filter((r) => r.status === "checked_in").length,
    };
  }, [registrations, paymentOrders]);

  if (permission.state === "loading") {
    return (
      <TheLineLayout title="Loading…" active="events" noindex>
        <div className="tl-shell" style={{ padding: "60px 16px" }}>
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </TheLineLayout>
    );
  }
  if (permission.state === "anonymous") {
    return <Navigate to={buildLoginRedirect(window.location.pathname + window.location.search)} replace />;
  }
  if (permission.state === "denied") {
    return (
      <TheLineLayout title={manage.noPermissionTitle} active="events" noindex>
        <div className="tl-shell" style={{ padding: "60px 16px", textAlign: "center" }}>
          <h1 style={{ fontSize: 24, marginBottom: 12 }}>{manage.noPermissionTitle}</h1>
          <p style={{ color: "var(--tl-fg-3)", maxWidth: 480, margin: "0 auto" }}>{manage.noPermissionBody}</p>
        </div>
      </TheLineLayout>
    );
  }

  if (!event) {
    return (
      <TheLineLayout title="Loading…" active="events" noindex>
        <div className="tl-shell" style={{ padding: "60px 16px" }}>
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </TheLineLayout>
    );
  }

  const eventTitle = language === "vi" ? event.title_vi : (event.title_en || event.title_vi);

  async function patch(id: string, patch: Partial<EventRegistrationRow>) {
    const { error } = await supabase
      .from("event_registrations")
      .update(patch)
      .eq("id", id);
    if (error) {
      toast({ title: t.common.error, description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: roster.updatedToast });
    refetch();
    if (event) queryClient.invalidateQueries({ queryKey: ["club-events-manage"] });
  }

  async function checkIn(row: EventRegistrationRow) {
    await patch(row.id, { status: row.status === "checked_in" ? "registered" : "checked_in" });
  }

  async function togglePaid(row: EventRegistrationRow) {
    await patch(row.id, {
      payment_status: row.payment_status === "paid" ? "unpaid" : "paid",
      paid_at: row.payment_status === "paid" ? null : new Date().toISOString(),
    });
  }

  async function markNoShow(id: string) {
    await patch(id, { status: "no_show" });
    setConfirmNoShowId(null);
  }

  async function cancelReg(id: string) {
    await patch(id, { status: "cancelled" });
    setConfirmCancelId(null);
    toast({ title: roster.deletedToast });
  }

  async function saveNotes() {
    if (!notesRow) return;
    await patch(notesRow.id, { notes: notesValue.trim() === "" ? null : notesValue.trim() });
    setNotesRow(null);
    setNotesValue("");
  }

  // PR proxy/manual — manualAdd was previously a thin wrapper around the
  // add_walk_in_registration RPC. It now runs through the
  // add-registration-direct edge function (mode='manual') via the new
  // ManualAddRegistrationModal so the organizer also gets:
  //   - optional payment-status setting (unpaid/claimed/waived)
  //   - internal notes
  //   - a /dang-ky/<token> link + Zalo/FB share buttons in the success
  //     state, so the BTC can hand off the link immediately.
  // The legacy local state (manualName/manualPhone/manualLevel) lives
  // inside the modal now.

  function downloadCsv() {
    const csv = buildCsv(registrations ?? []);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `roster-${event.slug}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <TheLineLayout title={`${roster.pageTitle} — ${eventTitle}`} active="events" noindex>
      <div className="tl-shell" style={{ paddingBottom: 60, maxWidth: 1080, margin: "0 auto" }}>
        <header
          className="tl-page-head"
          style={{ display: "flex", flexWrap: "wrap", gap: 16, justifyContent: "space-between", alignItems: "flex-start" }}
        >
          <div>
            <div className="kicker">
              ◆{" "}
              <Link to={`/social/${event.slug}`} style={{ color: "inherit", textDecoration: "none" }}>
                {eventTitle}
              </Link>
            </div>
            <h1>{roster.pageTitle}</h1>
          </div>
          {/* TheLine action row — mono caps + arrow inline links (CSV +
              matchmaking link) plus a vibrant-green pill for the primary
              "+ Thêm thủ công" CTA (creates a new row). */}
          <div
            style={{
              display: "flex",
              gap: 14,
              alignItems: "center",
              alignSelf: "center",
              flexWrap: "wrap",
              fontFamily: "Geist Mono",
              fontSize: 11,
              letterSpacing: "0.04em",
              textTransform: "uppercase",
            }}
          >
            <Link
              to={`/social/${event.slug}/xep-cap`}
              style={{ color: "var(--tl-fg)", textDecoration: "none" }}
              className="inline-flex items-center gap-1 hover:underline"
            >
              {t.socialEvents.matchmaking.pageTitle} →
            </Link>
            <button
              type="button"
              onClick={downloadCsv}
              style={{
                background: "none",
                border: 0,
                padding: 0,
                cursor: "pointer",
                color: "var(--tl-fg)",
                fontFamily: "inherit",
                fontSize: "inherit",
                letterSpacing: "inherit",
                textTransform: "inherit",
              }}
              className="inline-flex items-center gap-1 hover:underline"
            >
              <Download className="h-3 w-3" /> {roster.export} →
            </button>
            <button
              type="button"
              className="tl-btn green"
              onClick={() => setManualOpen(true)}
            >
              <Plus className="h-3.5 w-3.5" /> {roster.addManual}
            </button>
          </div>
        </header>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
          <Badge variant="secondary">{roster.registeredCount}: {stats.registered}/{event.max_players}</Badge>
          <Badge variant="secondary">{roster.claimedCount}: {stats.claimed}</Badge>
          <Badge variant="secondary">{manage.statsCheckedIn}: {stats.checkedIn}</Badge>
        </div>

        {(paymentOrders ?? []).length > 0 && (
          <p
            className="mb-3 rounded-md border border-amber-400/40 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200"
          >
            ⚠️ {roster.reconcileBanner}
          </p>
        )}

        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{roster.colName}</TableHead>
                <TableHead className="hidden sm:table-cell">{roster.colPhone}</TableHead>
                <TableHead className="hidden md:table-cell">{roster.colLevel}</TableHead>
                <TableHead>{roster.colStatus}</TableHead>
                <TableHead className="hidden sm:table-cell">{roster.colPayment}</TableHead>
                <TableHead className="hidden md:table-cell">{roster.colReferenceCode}</TableHead>
                <TableHead className="hidden md:table-cell">{roster.colTransferStatus}</TableHead>
                <TableHead className="hidden lg:table-cell">{roster.colRegistered}</TableHead>
                <TableHead className="text-right">{roster.colActions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(registrations ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground py-6">
                    {roster.noRegistrations}
                  </TableCell>
                </TableRow>
              )}
              {(registrations ?? []).map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <div style={{ fontWeight: 500, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      {/* 2026-05-22 — clicking a player name used to
                          deep-link to /u/<slug> (public profile) but that
                          page currently crashes for some seed profiles
                          ("Can't find variable: username"). The roster
                          already shows every column the organizer needs
                          inline, so we render the name as plain text. */}
                      <span>{row.display_name}</span>
                      {/* PR feat/proxy-and-manual-registration — origin
                          badge for both proxy and manual rows. Visible
                          only on this organizer dashboard (public roster
                          only shows the proxy badge). Includes the
                          proxy/organizer's display_name when known. */}
                      {row.registration_source === "proxy" && (
                        <span className="tl-format-badge" style={{ borderColor: "var(--tl-border)", color: "var(--tl-fg-3)" }}>
                          {(() => {
                            const proxyName = row.registered_by_profile_id
                              ? registeredByProfiles?.[row.registered_by_profile_id]
                              : null;
                            return proxyName
                              ? `${t.socialEvents.proxyRegister.proxyBadgeLabel} · ${language === "vi" ? "bạn của" : "friend of"} ${proxyName}`
                              : t.socialEvents.proxyRegister.proxyBadgeLabel;
                          })()}
                        </span>
                      )}
                      {row.registration_source === "manual" && (
                        <span className="tl-format-badge" style={{ borderColor: "var(--tl-border)", color: "var(--tl-fg-3)" }}>
                          {(() => {
                            const orgName = row.registered_by_profile_id
                              ? registeredByProfiles?.[row.registered_by_profile_id]
                              : null;
                            return orgName
                              ? `${t.socialEvents.proxyRegister.manualBadgeLabel} · ${orgName}`
                              : t.socialEvents.proxyRegister.manualBadgeLabel;
                          })()}
                        </span>
                      )}
                    </div>
                    {row.notes && (
                      <div style={{ fontSize: 12, color: "var(--tl-fg-3)" }}>
                        <StickyNote className="inline h-3 w-3" /> {row.notes}
                      </div>
                    )}
                    {/* Internal notes — organizer-only field. */}
                    {row.internal_notes && (
                      <div style={{ fontSize: 12, color: "var(--tl-fg-3)", marginTop: 2 }}>
                        <StickyNote className="inline h-3 w-3" /> <span className="italic">{row.internal_notes}</span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {row.phone ? maskPhone(row.phone) : "—"}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {row.self_rated_level != null ? row.self_rated_level.toFixed(1) : "—"}
                  </TableCell>
                  <TableCell>
                    {/* PR63 follow-up — mobile (<sm) hides the Payment +
                        Reference + Transfer columns entirely. Without
                        those signals the organizer can't tell who paid
                        at the venue. Stack a compact column of badges
                        inside the always-visible Status cell so the
                        info travels with the row on narrow screens.
                        Desktop is unchanged. */}
                    <div className="flex flex-col gap-1">
                      {/* Status badge — same as before. */}
                      {row.status === "checked_in" ? (
                        <span
                          className="tl-format-badge w-fit"
                          style={{ borderColor: "var(--tl-green)", color: "var(--tl-green)" }}
                        >
                          {manage.statsCheckedIn}
                        </span>
                      ) : row.status === "no_show" ? (
                        <span
                          className="tl-format-badge w-fit"
                          style={{ borderColor: "var(--tl-live)", color: "var(--tl-live)" }}
                        >
                          {language === "vi" ? "Vắng" : "No show"}
                        </span>
                      ) : (
                        <span className="tl-format-badge w-fit">{manage.statsRegistered}</span>
                      )}

                      {/* Mobile-only payment badge. Hidden once the
                          Payment column comes back at sm+. */}
                      {row.payment_status === "paid" ? (
                        <span
                          className="tl-format-badge w-fit sm:hidden"
                          style={{ borderColor: "var(--tl-green)", color: "var(--tl-green)" }}
                        >
                          <Banknote className="mr-1 inline h-3 w-3" /> {manage.statsPaid}
                        </span>
                      ) : (
                        <span className="tl-format-badge w-fit sm:hidden">
                          {language === "vi" ? "Chưa thanh toán" : "Not paid"}
                        </span>
                      )}

                      {/* Mobile-only transfer badge. Hidden once the
                          Transfer status column comes back at md+. */}
                      {(() => {
                        const order = ordersByRegistration.get(row.id);
                        if (!order) return null;
                        if (order.player_claimed_paid) {
                          return (
                            <span
                              className="tl-format-badge w-fit md:hidden"
                              style={{
                                borderColor: "var(--tl-green)",
                                color: "var(--tl-green)",
                              }}
                            >
                              {roster.transferClaimed}
                            </span>
                          );
                        }
                        return (
                          <span
                            className="tl-format-badge w-fit md:hidden"
                            style={{
                              borderColor: "hsl(38 92% 50%)",
                              color: "hsl(38 92% 50%)",
                            }}
                          >
                            {roster.transferNotClaimed}
                          </span>
                        );
                      })()}
                    </div>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {row.payment_status === "paid" ? (
                      <span
                        className="tl-format-badge"
                        style={{ borderColor: "var(--tl-green)", color: "var(--tl-green)" }}
                      >
                        <Banknote className="mr-1 inline h-3 w-3" /> {manage.statsPaid}
                      </span>
                    ) : (
                      <span className="tl-format-badge">—</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden md:table-cell font-mono text-xs">
                    {ordersByRegistration.get(row.id)?.reference_code ?? "—"}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {(() => {
                      const order = ordersByRegistration.get(row.id);
                      if (!order) {
                        return <span className="text-xs text-muted-foreground">—</span>;
                      }
                      if (order.player_claimed_paid) {
                        return (
                          <span
                            className="tl-format-badge"
                            style={{ borderColor: "var(--tl-green)", color: "var(--tl-green)" }}
                            title={
                              order.player_claimed_at
                                ? new Date(order.player_claimed_at).toLocaleString(
                                    language === "vi" ? "vi-VN" : "en-GB",
                                    {
                                      timeZone: "Asia/Ho_Chi_Minh",
                                      day: "2-digit",
                                      month: "2-digit",
                                      year: "2-digit",
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    },
                                  )
                                : undefined
                            }
                          >
                            {roster.transferClaimed}
                          </span>
                        );
                      }
                      return (
                        <span className="tl-format-badge">{roster.transferNotClaimed}</span>
                      );
                    })()}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                    {fmtRegisteredAt(row.registered_at, language)}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => checkIn(row)}>
                          <CheckCircle2 className="mr-2 h-3.5 w-3.5" />
                          {row.status === "checked_in" ? roster.actionUndoCheckIn : roster.actionCheckIn}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => togglePaid(row)}>
                          <Banknote className="mr-2 h-3.5 w-3.5" />
                          {row.payment_status === "paid" ? roster.actionMarkUnpaid : roster.actionMarkPaid}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => { setNotesRow(row); setNotesValue(row.notes ?? ""); }}>
                          <StickyNote className="mr-2 h-3.5 w-3.5" />
                          {roster.actionEditNotes}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setConfirmNoShowId(row.id)}>
                          <XCircle className="mr-2 h-3.5 w-3.5" />
                          {roster.actionMarkNoShow}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setConfirmCancelId(row.id)}
                          className="text-destructive focus:text-destructive"
                        >
                          <XCircle className="mr-2 h-3.5 w-3.5" />
                          {roster.actionCancel}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>

        {/* Cancel confirm */}
        <AlertDialog open={confirmCancelId != null} onOpenChange={(o) => !o && setConfirmCancelId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{roster.confirmCancelTitle}</AlertDialogTitle>
              <AlertDialogDescription>{roster.confirmCancelBody}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
              <AlertDialogAction onClick={() => confirmCancelId && cancelReg(confirmCancelId)}>
                {roster.actionCancel}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* No-show confirm */}
        <AlertDialog open={confirmNoShowId != null} onOpenChange={(o) => !o && setConfirmNoShowId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{roster.confirmNoShowTitle}</AlertDialogTitle>
              <AlertDialogDescription>{roster.confirmNoShowBody}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t.common.cancel}</AlertDialogCancel>
              <AlertDialogAction onClick={() => confirmNoShowId && markNoShow(confirmNoShowId)}>
                {roster.actionMarkNoShow}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Notes dialog */}
        <Dialog open={notesRow != null} onOpenChange={(o) => !o && setNotesRow(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{roster.actionEditNotes}</DialogTitle>
              <DialogDescription>{notesRow?.display_name}</DialogDescription>
            </DialogHeader>
            <Textarea
              rows={4}
              value={notesValue}
              onChange={(e) => setNotesValue(e.target.value)}
              placeholder={roster.notesPlaceholder}
              maxLength={500}
            />
            <DialogFooter>
              <Button variant="outline" onClick={() => setNotesRow(null)}>
                {t.common.cancel}
              </Button>
              <Button onClick={saveNotes}>{roster.saveNotes}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Manual add modal — PR proxy/manual.
            Replaces the old simple Dialog with the richer modal that
            supports payment status, internal notes, and returns a
            shareable /dang-ky/<token> link in the success state. */}
        <ManualAddRegistrationModal
          open={manualOpen}
          onOpenChange={setManualOpen}
          eventId={event.id}
          eventTitle={eventTitle}
          priceVnd={event.price_vnd ?? 0}
          onSuccess={() => {
            refetch();
            queryClient.invalidateQueries({ queryKey: ["club-events-manage"] });
            queryClient.invalidateQueries({ queryKey: ["payment-orders-event", event.id] });
          }}
        />
      </div>
    </TheLineLayout>
  );
}
