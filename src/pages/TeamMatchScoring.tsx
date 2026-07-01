import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { TheLineLayout } from '@/components/layout';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useTeamMatchMatch } from '@/hooks/useTeamMatchMatches';
import { TeamMatchScoringSheet } from '@/components/teamMatch';
import { useI18n } from '@/i18n';

// Full-page referee scoring route for Team Match (MLP) — standardized entry
// like /tools/doubles-elimination/match/:matchId/score. Reuses the scoring
// panel (asPage) which drives the shared RefereeScoringScreen engine.
export default function TeamMatchScoring() {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { language } = useI18n();
  const vi = language === 'vi';

  const { match, isLoading } = useTeamMatchMatch(matchId);
  const [shareId, setShareId] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!match || !user) return;
      const { data: tour } = await supabase
        .from('team_match_tournaments')
        .select('id, share_id, created_by')
        .eq('id', match.tournament_id)
        .maybeSingle();
      if (cancelled || !tour) return;
      setShareId(tour.share_id);

      if (tour.created_by === user.id) {
        setCanEdit(true);
        return;
      }
      const { data: ref } = await supabase
        .from('team_match_referees')
        .select('id')
        .eq('tournament_id', tour.id)
        .eq('user_id', user.id)
        .maybeSingle();
      if (!cancelled) setCanEdit(!!ref);
    })();
    return () => { cancelled = true; };
  }, [match, user]);

  const goBack = () => navigate(shareId ? `/tools/team-match/${shareId}` : '/tools/team-match');

  if (isLoading || (match && canEdit === null)) {
    return (
      <TheLineLayout title="Team Match Scoring" noindex active="lab">
        <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--tl-fg-3)' }} />
        </div>
      </TheLineLayout>
    );
  }

  if (!match) {
    return (
      <TheLineLayout title="Team Match Scoring" noindex active="lab">
        <div style={{ minHeight: '50vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--tl-fg-2)' }}>
          <p>{vi ? 'Không tìm thấy trận đấu.' : 'Match not found.'}</p>
          <button type="button" className="tl-btn" onClick={goBack}>{vi ? 'Quay lại' : 'Back'}</button>
        </div>
      </TheLineLayout>
    );
  }

  if (canEdit === false) {
    return (
      <TheLineLayout title="Team Match Scoring" noindex active="lab">
        <div style={{ minHeight: '50vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--tl-fg-2)' }}>
          <p>{vi ? 'Bạn không có quyền chấm trận này.' : "You can't score this match."}</p>
          <button type="button" className="tl-btn" onClick={goBack}>{vi ? 'Quay lại' : 'Back'}</button>
        </div>
      </TheLineLayout>
    );
  }

  return (
    <TheLineLayout title="Team Match Scoring" noindex active="lab">
      <TeamMatchScoringSheet asPage match={match} tournamentId={match.tournament_id} onBack={goBack} />
    </TheLineLayout>
  );
}
