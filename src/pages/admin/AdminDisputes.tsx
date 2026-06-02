// ============================================================================
// /admin/disputes — platform admin review queue for disputed matches
// ----------------------------------------------------------------------------
// Lists every disputed match (list_resolvable_disputes returns ALL for an
// admin) with the opponents' dispute reasons. The admin can:
//   • Accept the logged score → verified (+ DUPR push).
//   • Edit the score → verified (+ DUPR push).
// Club organizers resolve their own club's disputes from the club page; this
// page is the global admin surface.
// ============================================================================

import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useI18n } from "@/i18n";
import { AlertTriangle, CheckCircle2, Loader2, Pencil, Trophy, X } from "lucide-react";
import {
  useResolvableDisputes,
  useResolveMatchDispute,
  type ResolvableDispute,
} from "@/hooks/useDisputes";

export default function AdminDisputes() {
  const { language } = useI18n();
  const vi = language === "vi";
  const { disputes, isLoading } = useResolvableDisputes();

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">
            {vi ? "Tranh chấp trận đấu" : "Match disputes"}
          </h1>
          <p className="text-foreground-muted mt-1">
            {vi
              ? "Trận bị đối thủ tranh chấp tỉ số — duyệt và xác nhận hoặc sửa lại tỉ số."
              : "Matches an opponent disputed — review and accept or correct the score."}
          </p>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        ) : disputes.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
              <CheckCircle2 className="h-7 w-7 text-foreground-muted" />
              <p className="font-medium">
                {vi ? "Không có tranh chấp nào" : "No disputes"}
              </p>
              <p className="text-sm text-foreground-muted">
                {vi
                  ? "Khi có trận bị tranh chấp, nó sẽ xuất hiện ở đây."
                  : "Disputed matches will show up here."}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {disputes.map((d) => (
              <DisputeCard key={d.id} dispute={d} />
            ))}
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

function teamNames(players: ResolvableDispute["team_a_players"]): string {
  return players.map((p) => p.display_name ?? "—").join(" / ") || "—";
}

function DisputeCard({ dispute }: { dispute: ResolvableDispute }) {
  const { language } = useI18n();
  const vi = language === "vi";
  const { toast } = useToast();
  const resolve = useResolveMatchDispute();

  const [editing, setEditing] = useState(false);
  const [aScores, setAScores] = useState<number[]>(dispute.team_a_score);
  const [bScores, setBScores] = useState<number[]>(dispute.team_b_score);

  const aWins = dispute.winning_team === "a";
  const bWins = dispute.winning_team === "b";

  function notifyResult(res: Awaited<ReturnType<typeof resolve.mutateAsync>>) {
    const dupr = res.dupr;
    const desc = dupr.ok && dupr.matchCode
      ? vi ? `Đã gửi DUPR · ${dupr.matchCode}` : `Sent to DUPR · ${dupr.matchCode}`
      : dupr.skipped
        ? vi ? "Đã xác nhận (thiếu DUPR ID nên chưa gửi DUPR)." : "Verified (no DUPR ID — not submitted)."
        : vi ? `Đã xác nhận. Gửi DUPR lỗi: ${dupr.reason ?? ""}` : `Verified. DUPR submit failed: ${dupr.reason ?? ""}`;
    toast({ title: vi ? "Đã xử lý tranh chấp" : "Dispute resolved", description: desc });
  }

  async function onAccept() {
    try {
      const res = await resolve.mutateAsync({ dispute, action: "accept" });
      notifyResult(res);
    } catch (e) {
      toast({
        variant: "destructive",
        title: vi ? "Lỗi" : "Failed",
        description: e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e),
      });
    }
  }

  async function onSaveEdit() {
    try {
      const res = await resolve.mutateAsync({
        dispute,
        action: "edit",
        teamAScore: aScores,
        teamBScore: bScores,
      });
      setEditing(false);
      notifyResult(res);
    } catch (e) {
      toast({
        variant: "destructive",
        title: vi ? "Lỗi" : "Failed",
        description: e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e),
      });
    }
  }

  const busy = resolve.isPending;

  return (
    <Card>
      <CardContent className="space-y-4 py-5">
        {/* meta */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-foreground-muted">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-destructive/40 text-destructive">
              <AlertTriangle className="mr-1 h-3 w-3" />
              {vi ? "Tranh chấp" : "Disputed"}
            </Badge>
            <span className="uppercase">{dispute.format}</span>
            {dispute.club_name && <span>· {dispute.club_name}</span>}
          </div>
          <span>{new Date(dispute.played_at).toLocaleString(vi ? "vi-VN" : "en-US")}</span>
        </div>

        {/* teams + scores */}
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div className={aWins ? "font-semibold" : ""}>
            <div className="flex items-center gap-1">
              {aWins && <Trophy className="h-3.5 w-3.5 text-emerald-500" />}
              <span className="truncate">{teamNames(dispute.team_a_players)}</span>
            </div>
          </div>
          {editing ? (
            <ScoreEditor
              aScores={aScores}
              bScores={bScores}
              onA={setAScores}
              onB={setBScores}
            />
          ) : (
            <div className="flex items-center gap-2 font-mono text-lg">
              <span className={aWins ? "text-emerald-500" : ""}>
                {dispute.team_a_score.join(" ")}
              </span>
              <span className="text-foreground-muted">–</span>
              <span className={bWins ? "text-emerald-500" : ""}>
                {dispute.team_b_score.join(" ")}
              </span>
            </div>
          )}
          <div className={`text-right ${bWins ? "font-semibold" : ""}`}>
            <div className="flex items-center justify-end gap-1">
              <span className="truncate">{teamNames(dispute.team_b_players)}</span>
              {bWins && <Trophy className="h-3.5 w-3.5 text-emerald-500" />}
            </div>
          </div>
        </div>

        {/* dispute reasons */}
        {dispute.dispute_reasons.length > 0 && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm">
            {dispute.dispute_reasons.map((r, i) => (
              <div key={i} className="text-foreground">
                <span className="font-medium">{r.name ?? "—"}</span>
                {r.reason ? `: ${r.reason}` : ` — ${vi ? "không nêu lý do" : "no reason given"}`}
              </div>
            ))}
          </div>
        )}

        {/* actions */}
        <div className="flex flex-wrap justify-end gap-2">
          {editing ? (
            <>
              <Button variant="ghost" size="sm" disabled={busy} onClick={() => setEditing(false)}>
                <X className="mr-1 h-4 w-4" />
                {vi ? "Huỷ" : "Cancel"}
              </Button>
              <Button size="sm" disabled={busy} onClick={onSaveEdit}>
                {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1 h-4 w-4" />}
                {vi ? "Lưu & xác nhận" : "Save & verify"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" size="sm" disabled={busy} onClick={() => setEditing(true)}>
                <Pencil className="mr-1 h-4 w-4" />
                {vi ? "Sửa tỉ số" : "Edit score"}
              </Button>
              <Button size="sm" disabled={busy} onClick={onAccept}>
                {busy ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <CheckCircle2 className="mr-1 h-4 w-4" />}
                {vi ? "Chấp nhận tỉ số" : "Accept score"}
              </Button>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ScoreEditor({
  aScores,
  bScores,
  onA,
  onB,
}: {
  aScores: number[];
  bScores: number[];
  onA: (s: number[]) => void;
  onB: (s: number[]) => void;
}) {
  const setAt = (arr: number[], i: number, v: number) =>
    arr.map((x, idx) => (idx === i ? v : x));
  return (
    <div className="flex flex-col gap-1">
      {aScores.map((_, i) => (
        <div key={i} className="flex items-center gap-1">
          <Input
            type="number"
            min={0}
            value={aScores[i]}
            onChange={(e) => onA(setAt(aScores, i, Number(e.target.value)))}
            className="h-8 w-14 text-center font-mono"
          />
          <span className="text-foreground-muted">–</span>
          <Input
            type="number"
            min={0}
            value={bScores[i]}
            onChange={(e) => onB(setAt(bScores, i, Number(e.target.value)))}
            className="h-8 w-14 text-center font-mono"
          />
        </div>
      ))}
    </div>
  );
}
