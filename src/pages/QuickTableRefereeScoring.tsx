import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useQuickTableMutations } from '@/hooks/useQuickTableMutations';
import { useI18n } from '@/i18n';
import { RefereeScoringScreen, RefereeCentered, type RefereeLoaded } from '@/components/referee/RefereeScoringScreen';
import type { RefereeLiveState } from '@/lib/refereeScoring';

/** Quick Table referee live-scoring — thin loader over RefereeScoringScreen. */
export default function QuickTableRefereeScoring() {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  const { language } = useI18n();
  const { updateMatchScore } = useQuickTableMutations();
  const vi = language === 'vi';

  const [loaded, setLoaded] = useState<RefereeLoaded | null>(null);
  const [initialLiveState, setInitialLiveState] = useState<unknown>(null);
  const [readOnly, setReadOnly] = useState(false);
  const [meId, setMeId] = useState<string | null>(null);
  const meIdRef = useRef<string | null>(null);
  // S3c: live row updates (envelope + claim) from the realtime subscription.
  const [liveRow, setLiveRow] = useState<{ env: unknown; claimedBy: string | null } | null>(null);
  // Codex round 3: once a FOREIGN claim is seen, stay locked until the page
  // reloads — a later claimedBy:null (finish/release) must not unlock a
  // retained board that S2 could then republish.
  const [foreignClaimSeen, setForeignClaimSeen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Quick-Table-only context used by onFinish (kept out of the generic shape).
  const ctx = useRef<{ isPlayoff: boolean; shareId: string }>({ isPlayoff: false, shareId: '' });

  useEffect(() => {
    if (!matchId) return;
    // Codex round 3: reset match-scoped state on matchId change (router
    // element reuse must not leak the previous match's envelope/claim).
    setLoaded(null); setInitialLiveState(null); setReadOnly(false);
    setLiveRow(null); setForeignClaimSeen(false);
    (async () => {
      try {
        // select('*') because referee_live_state is newer than the generated
        // types — a typed column list would resolve to SelectQueryError.
        const { data: m, error: me } = await supabase
          .from('quick_table_matches').select('*').eq('id', matchId).single();
        if (me || !m) throw me || new Error('match');
        setInitialLiveState((m as unknown as { referee_live_state?: unknown }).referee_live_state ?? null);
        // S3a: another referee holds the claim -> static snapshot, no writes.
        const lref = (m as unknown as { live_referee_id?: string | null }).live_referee_id ?? null;
        const { data: auth } = await supabase.auth.getUser();
        meIdRef.current = auth.user?.id ?? null;
        setMeId(auth.user?.id ?? null);
        setReadOnly(!!lref && lref !== auth.user?.id);
        const { data: tb } = await supabase
          .from('quick_tables').select('id, share_id, name, is_doubles').eq('id', m.table_id).single();
        const ids = [m.player1_id, m.player2_id].filter(Boolean) as string[];
        const { data: psRaw } = await supabase.from('quick_table_players').select('*').in('id', ids);
        type PRow = { id: string; name: string; player1_name: string | null; player2_name: string | null };
        const ps = (psRaw ?? []) as unknown as PRow[];
        const byId = new Map(ps.map((p) => [p.id, p]));
        const p1 = m.player1_id ? byId.get(m.player1_id) : undefined;
        const p2 = m.player2_id ? byId.get(m.player2_id) : undefined;
        const names = (p: PRow | undefined): [string, string] | null =>
          p?.player1_name && p?.player2_name ? [p.player1_name, p.player2_name] : null;
        ctx.current = { isPlayoff: m.is_playoff === true, shareId: tb?.share_id ?? '' };
        setLoaded({
          matchId, isDoubles: tb?.is_doubles === true,
          teamAName: p1?.name ?? 'Đội A', teamBName: p2?.name ?? 'Đội B',
          playersA: names(p1), playersB: names(p2),
          backHref: `/tools/quick-tables/${tb?.share_id ?? ''}`,
        });
      } catch { setError(vi ? 'Không tải được trận đấu.' : 'Could not load match.'); }
    })();
  }, [matchId, vi]);

  // S3c: follow the row live — spectators see every rally; a takeover
  // (live_referee_id moving to someone else) locks this screen mid-game.
  // quick_table_matches joined the realtime publication in 20260717170000.
  useEffect(() => {
    if (!matchId) return undefined;
    const ch = supabase
      .channel(`qt-ref-live:${matchId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'quick_table_matches', filter: `id=eq.${matchId}` }, (payload) => {
        const row = payload.new as { referee_live_state?: unknown; live_referee_id?: string | null };
        setLiveRow({ env: row.referee_live_state ?? null, claimedBy: row.live_referee_id ?? null });
        if (row.live_referee_id && row.live_referee_id !== meIdRef.current) setForeignClaimSeen(true);
      })
      .subscribe();
    return () => { void supabase.removeChannel(ch); };
  }, [matchId]);

  const effectiveReadOnly = foreignClaimSeen || (liveRow ? (!!liveRow.claimedBy && liveRow.claimedBy !== meId) : readOnly);

  // Codex round 3: every live write carries a server-side ownership
  // predicate — a queued write from a taken-over referee must not commit.
  const onLiveScore = useCallback((a: number, b: number) => {
    if (!matchId || !meIdRef.current) return;
    void supabase.from('quick_table_matches').update({ score1: a, score2: b } as never).eq('id', matchId).eq('live_referee_id', meIdRef.current).then((): void => undefined, (): void => undefined);
  }, [matchId]);

  // S2: best-effort full-state persistence (referee_live_state jsonb).
  const onLiveState = useCallback((s: RefereeLiveState | null) => {
    if (!matchId || !meIdRef.current) return;
    void supabase.from('quick_table_matches').update({ referee_live_state: s } as never).eq('id', matchId).eq('live_referee_id', meIdRef.current).then((): void => undefined, (): void => undefined);
  }, [matchId]);

  // Codex review 2026-07-17: report a LOST claim (false) so the screen
  // refuses to start — two referees racing an empty claim must not both
  // score. Errors stay best-effort (void).
  const onClaimLive = useCallback(async (): Promise<boolean | void> => {
    try {
      const { data } = await supabase.auth.getUser();
      if (!data.user || !matchId) return undefined;
      const { data: claimed } = await supabase
        .from('quick_table_matches')
        .update({ live_referee_id: data.user.id } as never)
        .eq('id', matchId).is('live_referee_id', null)
        .select('id').maybeSingle();
      if (claimed) return true;
      const { data: row } = await supabase
        .from('quick_table_matches').select('live_referee_id').eq('id', matchId).single();
      return (row as { live_referee_id?: string | null } | null)?.live_referee_id === data.user.id;
    } catch { return undefined; }
  }, [matchId]);

  const onFinish = useCallback(async (a: number, b: number, note: string | null, sets?: { setsWon: { a: number; b: number }; setScores: { s1: number; s2: number }[]; totalSets: number }) => {
    if (!matchId) return;
    const { isPlayoff, shareId } = ctx.current;
    // Multi-set manual games arrive with sets-won as (a, b) — the correct
    // winner input for updateMatchScore — plus the archived per-set scores.
    await updateMatchScore(matchId, a, b);
    // Clear the live envelope HERE (updateMatchScore just released the
    // claim, so the screen's ownership-gated onLiveState(null) can no
    // longer match) and archive the per-set scores in the same write.
    try {
      await supabase.from('quick_table_matches')
        .update({
          referee_live_state: null,
          ...(sets && sets.setScores.length > 0
            ? { set_scores: sets.setScores, total_sets: sets.totalSets }
            : {}),
        } as never)
        .eq('id', matchId);
    } catch { /* best-effort */ }
    // Group standings and playoff propagation are committed by the score RPC.
    if (note) {
      try { await supabase.from('quick_table_matches').update({ referee_note: note } as never).eq('id', matchId); } catch { /* best-effort */ }
    }
    navigate(`/tools/quick-tables/${shareId}?tab=${isPlayoff ? 'playoff' : 'groups'}`);
  }, [matchId, navigate, updateMatchScore]);

  if (error) return <RefereeCentered>{error}</RefereeCentered>;
  if (!loaded) return <RefereeCentered>{vi ? 'Đang tải…' : 'Loading…'}</RefereeCentered>;

  return (
    <RefereeScoringScreen
      loaded={loaded} vi={vi} persistKey={`qt-ref:${matchId}`}
      initialLiveState={initialLiveState} liveState={liveRow?.env ?? null}
      onLiveState={onLiveState} readOnly={effectiveReadOnly}
      onLiveScore={onLiveScore} onClaimLive={onClaimLive} onFinish={onFinish}
    />
  );
}
