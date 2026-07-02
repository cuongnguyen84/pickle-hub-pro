// ============================================================================
// TeamMatchPaymentSection — thể lệ + lệ phí + luồng nộp lệ phí (web parity với
// native). Hiển thị ở tab Tổng quan:
//   • Thể lệ + lệ phí (mỗi VĐV / mỗi đội) — cho bất kỳ ai.
//   • Đội trưởng: nút "Nộp lệ phí" → QR VietQR → "Đã chuyển khoản" (claimed, đỏ).
//   • BTC: badge trạng thái từng đội + "Xác nhận đã nhận" → confirmed (xanh).
// QR dựng client-side từ bank trio đã lưu (img.vietqr.io), không cần API key.
// ============================================================================
import { useState } from 'react';
import { QrCode, CheckCircle2, CircleDollarSign } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useI18n } from '@/i18n';
import { generateVietQRUrl } from '@/lib/payment/vietqr';
import { findBankByCode } from '@/lib/payment/banks';
import { useTeamMatchTeams, type TeamMatchTeam } from '@/hooks/useTeamMatchTeams';
import type { TeamMatchTournament } from '@/hooks/useTeamMatch';

interface Props {
  tournament: TeamMatchTournament;
  userTeam: TeamMatchTeam | null;
  isOwner: boolean;
  teams: TeamMatchTeam[];
}

const card: React.CSSProperties = {
  background: 'var(--tl-bg-elev)',
  border: '1px solid var(--tl-border)',
  borderRadius: 'var(--tl-radius-lg)',
  padding: 16,
};

const eyebrow: React.CSSProperties = {
  fontFamily: 'Geist Mono, ui-monospace, monospace',
  fontSize: 11,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'var(--tl-green)',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
};

function fmt(n: number, lang: string) {
  return n.toLocaleString(lang === 'vi' ? 'vi-VN' : 'en-US');
}

/** Chip trạng thái: claimed = đỏ (chờ), confirmed = xanh (đã nộp). */
function PaymentChip({ status, lang }: { status?: string; lang: string }) {
  if (status === 'claimed') {
    return (
      <span style={chipStyle('var(--tl-live)')}>
        {lang === 'vi' ? 'Đã nộp lệ phí' : 'Fee submitted'}
      </span>
    );
  }
  if (status === 'confirmed') {
    return (
      <span style={chipStyle('var(--tl-green)')}>
        {lang === 'vi' ? 'Đã nộp lệ phí' : 'Fee paid'}
      </span>
    );
  }
  return null;
}

function chipStyle(color: string): React.CSSProperties {
  return {
    fontFamily: 'Geist Mono, ui-monospace, monospace',
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: '0.03em',
    color,
    background: `color-mix(in srgb, ${color} 14%, transparent)`,
    borderRadius: 999,
    padding: '3px 8px',
    whiteSpace: 'nowrap',
  };
}

export function TeamMatchPaymentSection({ tournament, userTeam, isOwner, teams }: Props) {
  const { language } = useI18n();
  const { claimPayment, isClaimingPayment, confirmPayment, isConfirmingPayment } =
    useTeamMatchTeams(tournament.id);
  const [qrOpen, setQrOpen] = useState(false);

  const feePlayer = tournament.entry_fee_vnd ?? 0;
  const feeTeam = tournament.entry_fee_team_vnd ?? 0;
  const hasFee = feePlayer > 0 || feeTeam > 0;
  const hasBank = !!tournament.bank_code && !!tournament.bank_account_number;
  const rules = (tournament.rules_summary ?? '').trim();

  // Payment status của đội trưởng lấy từ list (select '*' có payment_status).
  const myTeam = teams.find((t) => t.id === userTeam?.id) ?? userTeam;
  const myStatus = myTeam?.payment_status ?? 'unpaid';
  const teamAmount = feeTeam > 0 ? feeTeam : feePlayer;

  const qrUrl =
    hasBank && teamAmount > 0
      ? generateVietQRUrl({
          bankCode: tournament.bank_code!,
          accountNumber: tournament.bank_account_number!,
          accountName: tournament.bank_account_name ?? '',
          amount: teamAmount,
          memo: `Le phi ${myTeam?.team_name ?? tournament.name}`,
        })
      : null;

  if (!rules && !hasFee) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {rules && (
        <section style={card}>
          <div style={eyebrow}>
            <CircleDollarSign className="w-3.5 h-3.5" />
            {language === 'vi' ? 'Thể lệ giải' : 'Rules'}
          </div>
          <p style={{ marginTop: 8, fontSize: 14, color: 'var(--tl-fg-2)', lineHeight: 1.55, whiteSpace: 'pre-wrap' }}>
            {rules}
          </p>
        </section>
      )}

      {hasFee && (
        <section style={card}>
          <div style={eyebrow}>
            <CircleDollarSign className="w-3.5 h-3.5" />
            {language === 'vi' ? 'Lệ phí tham gia' : 'Entry fees'}
          </div>
          <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {feePlayer > 0 && (
              <div style={feeRow}>
                <span>{language === 'vi' ? 'Mỗi VĐV' : 'Per player'}</span>
                <strong style={{ color: 'var(--tl-green)' }}>{fmt(feePlayer, language)} đ</strong>
              </div>
            )}
            {feeTeam > 0 && (
              <div style={feeRow}>
                <span>{language === 'vi' ? 'Mỗi đội' : 'Per team'}</span>
                <strong style={{ color: 'var(--tl-green)' }}>{fmt(feeTeam, language)} đ</strong>
              </div>
            )}
          </div>

          {/* Đội trưởng — nộp lệ phí / trạng thái */}
          {userTeam && !isOwner && hasBank && (
            <div style={{ marginTop: 14, borderTop: '1px solid var(--tl-border)', paddingTop: 14 }}>
              {myStatus === 'unpaid' && (
                <Button className="w-full" onClick={() => setQrOpen(true)}>
                  <QrCode className="w-4 h-4 mr-2" />
                  {language === 'vi' ? 'Nộp lệ phí' : 'Pay fee'}
                </Button>
              )}
              {myStatus === 'claimed' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={chipStyle('var(--tl-gold)')}>
                    {language === 'vi' ? 'Chờ BTC xác nhận' : 'Awaiting confirmation'}
                  </span>
                  <button type="button" className="tl-link" style={linkBtn} onClick={() => setQrOpen(true)}>
                    {language === 'vi' ? 'Xem QR' : 'View QR'}
                  </button>
                </div>
              )}
              {myStatus === 'confirmed' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--tl-green)' }}>
                  <CheckCircle2 className="w-4 h-4" />
                  <span style={{ fontSize: 13, fontWeight: 600 }}>
                    {language === 'vi' ? 'Đã nộp lệ phí — đội chính thức tham gia' : 'Fee paid — team confirmed'}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* BTC — trạng thái + xác nhận từng đội */}
          {isOwner && teams.length > 0 && (
            <div style={{ marginTop: 14, borderTop: '1px solid var(--tl-border)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {teams.map((tm) => (
                <div key={tm.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--tl-fg)' }}>{tm.team_name}</span>
                  <PaymentChip status={tm.payment_status} lang={language} />
                  <span style={{ flex: 1 }} />
                  {tm.payment_status === 'claimed' && (
                    <Button
                      size="sm"
                      disabled={isConfirmingPayment}
                      onClick={() => confirmPayment({ teamId: tm.id, tournamentId: tournament.id, confirmed: true })}
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                      {language === 'vi' ? 'Xác nhận đã nhận' : 'Confirm received'}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* QR dialog cho đội trưởng */}
      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{language === 'vi' ? 'Nộp lệ phí đội' : 'Pay team fee'}</DialogTitle>
          </DialogHeader>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            {qrUrl && (
              <img src={qrUrl} alt="VietQR" width={240} style={{ borderRadius: 12, background: '#fff' }} />
            )}
            <div style={{ width: '100%', fontSize: 13, color: 'var(--tl-fg-2)', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={feeRow}><span>{language === 'vi' ? 'Ngân hàng' : 'Bank'}</span><strong>{findBankByCode(tournament.bank_code ?? '')?.shortName ?? tournament.bank_code}</strong></div>
              <div style={feeRow}><span>{language === 'vi' ? 'Số tài khoản' : 'Account'}</span><strong>{tournament.bank_account_number}</strong></div>
              <div style={feeRow}><span>{language === 'vi' ? 'Chủ tài khoản' : 'Holder'}</span><strong>{tournament.bank_account_name}</strong></div>
              <div style={feeRow}><span>{language === 'vi' ? 'Số tiền' : 'Amount'}</span><strong style={{ color: 'var(--tl-green)' }}>{fmt(teamAmount, language)} đ</strong></div>
            </div>
            {myStatus === 'unpaid' ? (
              <Button
                className="w-full"
                disabled={isClaimingPayment}
                onClick={async () => {
                  await claimPayment({ teamId: myTeam!.id, tournamentId: tournament.id });
                  setQrOpen(false);
                }}
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                {language === 'vi' ? 'Đã chuyển khoản' : "I've transferred"}
              </Button>
            ) : (
              <p style={{ fontSize: 12.5, color: 'var(--tl-fg-3)', textAlign: 'center', margin: 0 }}>
                {language === 'vi' ? 'Đã báo chuyển khoản — chờ BTC xác nhận.' : 'Reported — awaiting organizer confirmation.'}
              </p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const feeRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  fontSize: 13.5,
  color: 'var(--tl-fg-2)',
};

const linkBtn: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--tl-green)',
  fontSize: 12.5,
  fontWeight: 600,
  cursor: 'pointer',
  padding: 0,
};
