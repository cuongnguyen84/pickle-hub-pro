// ============================================================================
// SocialEventRoster (`/su-kien/:slug/danh-sach`) — organizer roster table.
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { maskPhone, normalizeVietnamPhone } from "@/lib/phone";

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
  const { slug } = useParams<{ slug: string }>();
  const { t, language } = useI18n();
  const roster = t.socialEvents.roster;
  const manage = t.socialEvents.manage;
  const queryClient = useQueryClient();
  const permission = useEventOwnership(slug);
  const { data: event } = useSocialEvent(slug);
  const { data: registrations, refetch } = useEventRegistrations(event?.id);

  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
  const [confirmNoShowId, setConfirmNoShowId] = useState<string | null>(null);
  const [notesRow, setNotesRow] = useState<EventRegistrationRow | null>(null);
  const [notesValue, setNotesValue] = useState("");
  const [manualOpen, setManualOpen] = useState(false);
  const [manualName, setManualName] = useState("");
  const [manualPhone, setManualPhone] = useState("");
  const [manualLevel, setManualLevel] = useState("");

  const stats = useMemo(() => {
    const list = registrations ?? [];
    return {
      registered: list.length,
      paid: list.filter((r) => r.payment_status === "paid").length,
      checkedIn: list.filter((r) => r.status === "checked_in").length,
    };
  }, [registrations]);

  if (permission.state === "loading") {
    return (
      <TheLineLayout title="Loading…" active="events" noindex>
        <div className="tl-shell" style={{ padding: "60px 16px" }}>
          <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </TheLineLayout>
    );
  }
  if (permission.state === "anonymous") return <Navigate to="/login" replace />;
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

  async function manualAdd() {
    if (!event) return;
    if (manualName.trim().length < 1) {
      toast({ title: roster.colName + " *", variant: "destructive" });
      return;
    }
    const phoneNorm = manualPhone.trim() === "" ? null : normalizeVietnamPhone(manualPhone);
    if (manualPhone.trim() !== "" && !phoneNorm) {
      toast({ title: t.socialEvents.register.phoneInvalid, variant: "destructive" });
      return;
    }
    const levelNum = manualLevel.trim() === "" ? null : Number(manualLevel);
    const { error } = await supabase.from("event_registrations").insert({
      event_id: event.id,
      display_name: manualName.trim(),
      phone: phoneNorm,
      self_rated_level: levelNum,
      status: "registered",
      payment_status: "unpaid",
    });
    if (error) {
      toast({ title: t.common.error, description: error.message, variant: "destructive" });
      return;
    }
    setManualOpen(false);
    setManualName("");
    setManualPhone("");
    setManualLevel("");
    refetch();
    toast({ title: roster.updatedToast });
  }

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
      <div className="tl-shell" style={{ padding: "32px 16px 60px", maxWidth: 1080, margin: "0 auto" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <h1 style={{ fontSize: 24, marginBottom: 4 }}>{roster.pageTitle}</h1>
            <p style={{ color: "var(--tl-fg-3)", fontSize: 14 }}>
              <Link to={`/su-kien/${event.slug}`} style={{ color: "inherit" }}>{eventTitle}</Link>
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Button asChild variant="ghost" size="sm">
              <Link to={`/su-kien/${event.slug}/xep-cap`}>{t.socialEvents.matchmaking.pageTitle}</Link>
            </Button>
            <Button variant="outline" size="sm" onClick={downloadCsv}>
              <Download className="mr-1 h-3.5 w-3.5" /> {roster.export}
            </Button>
            <Button size="sm" onClick={() => setManualOpen(true)}>
              <Plus className="mr-1 h-3.5 w-3.5" /> {roster.addManual}
            </Button>
          </div>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
          <Badge variant="secondary">{roster.registeredCount}: {stats.registered}/{event.max_players}</Badge>
          <Badge variant="secondary">{roster.paidCount}: {stats.paid}</Badge>
          <Badge variant="secondary">{manage.statsCheckedIn}: {stats.checkedIn}</Badge>
        </div>

        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{roster.colName}</TableHead>
                <TableHead className="hidden sm:table-cell">{roster.colPhone}</TableHead>
                <TableHead className="hidden md:table-cell">{roster.colLevel}</TableHead>
                <TableHead>{roster.colStatus}</TableHead>
                <TableHead className="hidden sm:table-cell">{roster.colPayment}</TableHead>
                <TableHead className="hidden lg:table-cell">{roster.colRegistered}</TableHead>
                <TableHead className="text-right">{roster.colActions}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(registrations ?? []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                    {roster.noRegistrations}
                  </TableCell>
                </TableRow>
              )}
              {(registrations ?? []).map((row) => (
                <TableRow key={row.id}>
                  <TableCell>
                    <div style={{ fontWeight: 500 }}>{row.display_name}</div>
                    {row.notes && (
                      <div style={{ fontSize: 12, color: "var(--tl-fg-3)" }}>
                        <StickyNote className="inline h-3 w-3" /> {row.notes}
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
                    {row.status === "checked_in" ? (
                      <Badge variant="default">{manage.statsCheckedIn}</Badge>
                    ) : row.status === "no_show" ? (
                      <Badge variant="destructive">{language === "vi" ? "Vắng" : "No show"}</Badge>
                    ) : (
                      <Badge variant="secondary">{manage.statsRegistered}</Badge>
                    )}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    {row.payment_status === "paid" ? (
                      <Badge variant="default">
                        <Banknote className="mr-1 h-3 w-3" /> {manage.statsPaid}
                      </Badge>
                    ) : (
                      <Badge variant="outline">—</Badge>
                    )}
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

        {/* Manual add dialog */}
        <Dialog open={manualOpen} onOpenChange={setManualOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{roster.addManualTitle}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="m-name">{roster.colName}*</Label>
                <Input id="m-name" value={manualName} onChange={(e) => setManualName(e.target.value)} maxLength={80} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="m-phone">{roster.colPhone}</Label>
                <Input
                  id="m-phone"
                  type="tel"
                  value={manualPhone}
                  onChange={(e) => setManualPhone(e.target.value)}
                  placeholder="0901 234 567"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="m-level">{roster.colLevel}</Label>
                <Input
                  id="m-level"
                  inputMode="decimal"
                  value={manualLevel}
                  onChange={(e) => setManualLevel(e.target.value)}
                  placeholder="3.5"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setManualOpen(false)}>
                {t.common.cancel}
              </Button>
              <Button onClick={manualAdd}>{roster.addManualSubmit}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TheLineLayout>
  );
}
