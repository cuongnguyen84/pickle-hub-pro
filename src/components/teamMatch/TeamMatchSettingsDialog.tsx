import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MessageCircle } from 'lucide-react';
import { RefereeManagement } from '@/components/quicktable/RefereeManagement';
import RefereePinSettings from '@/components/quicktable/RefereePinSettings';
import { VN_BANKS } from '@/lib/payment/banks';
import { useI18n } from '@/i18n';
import type { TeamMatchTournament, UpdateTournamentDetailsInput } from '@/hooks/useTeamMatch';

interface TeamMatchSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tournament: TeamMatchTournament;
  referees: Array<{ id: string; email?: string; display_name?: string }>;
  refereesLoading: boolean;
  onAddReferee: (email: string) => Promise<boolean>;
  onRemoveReferee: (refereeId: string) => Promise<boolean>;
  onSave: (input: UpdateTournamentDetailsInput) => Promise<unknown>;
  saving: boolean;
}

// ─── W2.4d shared tokens ─────────────────────────────────────────────────
const sectionTitle: React.CSSProperties = {
  fontFamily: 'Instrument Serif, serif',
  fontStyle: 'italic',
  fontWeight: 400,
  fontSize: 20,
  letterSpacing: '-0.015em',
  color: 'var(--tl-fg)',
  margin: 0,
};

const fieldLabel: React.CSSProperties = {
  fontFamily: 'Geist Mono, ui-monospace, monospace',
  fontSize: 11,
  fontWeight: 500,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'var(--tl-fg-2)',
};

const groupTitle: React.CSSProperties = {
  fontFamily: 'Geist Mono, ui-monospace, monospace',
  fontSize: 10.5,
  fontWeight: 600,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  color: 'var(--tl-fg-3)',
  margin: '4px 0',
};

export function TeamMatchSettingsDialog({
  open,
  onOpenChange,
  tournament,
  referees,
  refereesLoading,
  onAddReferee,
  onRemoveReferee,
  onSave,
  saving,
}: TeamMatchSettingsDialogProps) {
  const { language } = useI18n();
  const vi = language === 'vi';

  // ─── Form state (khởi tạo từ giải hiện tại) ──────────────────────────────
  const [name, setName] = useState(tournament.name ?? '');
  const [chatUrl, setChatUrl] = useState(tournament.chat_group_url ?? '');
  const [hasEventDate, setHasEventDate] = useState(!!tournament.event_date);
  const [eventDate, setEventDate] = useState(tournament.event_date ?? '');
  const [location, setLocation] = useState(tournament.location ?? '');
  const [rules, setRules] = useState(tournament.rules_summary ?? '');
  const [feeVnd, setFeeVnd] = useState(tournament.entry_fee_vnd ?? 0);
  const [feeTeamVnd, setFeeTeamVnd] = useState(tournament.entry_fee_team_vnd ?? 0);
  const [bankCode, setBankCode] = useState(tournament.bank_code ?? '');
  const [bankNumber, setBankNumber] = useState(tournament.bank_account_number ?? '');
  const [bankName, setBankName] = useState(tournament.bank_account_name ?? '');
  const [requireDupr, setRequireDupr] = useState(!!tournament.require_dupr);
  const [duprMale, setDuprMale] = useState(tournament.dupr_max_male ?? 5.0);
  const [duprFemale, setDuprFemale] = useState(tournament.dupr_max_female ?? 4.5);

  const hasFee = feeVnd > 0 || feeTeamVnd > 0;
  const nameValid = name.trim().length >= 3;

  const txt = {
    title: vi ? 'Cài đặt giải' : 'Tournament settings',
    desc: vi
      ? 'Chỉnh sửa thông tin giải, link nhóm chat và quản lý trọng tài.'
      : 'Edit tournament info, chat group link, and manage referees.',
    info: vi ? 'Thông tin giải' : 'Tournament info',
    fees: vi ? 'Lệ phí & tài khoản nhận' : 'Fees & receiving account',
    dupr: 'DUPR',
    save: vi ? 'Lưu thay đổi' : 'Save changes',
    saving: vi ? 'Đang lưu…' : 'Saving…',
  };

  const handleSave = async () => {
    await onSave({
      tournamentId: tournament.id,
      name: name.trim(),
      chat_group_url: chatUrl.trim() || null,
      event_date: hasEventDate && eventDate ? eventDate : null,
      location: location.trim() || null,
      rules_summary: rules.trim() || null,
      entry_fee_vnd: feeVnd > 0 ? feeVnd : null,
      entry_fee_team_vnd: feeTeamVnd > 0 ? feeTeamVnd : null,
      bank_code: hasFee ? bankCode || null : null,
      bank_account_number: hasFee ? bankNumber.trim() || null : null,
      bank_account_name: hasFee ? bankName.trim() || null : null,
      require_dupr: requireDupr,
      dupr_max_male: requireDupr ? duprMale : null,
      dupr_max_female: requireDupr ? duprFemale : null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle style={sectionTitle}>{txt.title}</DialogTitle>
          <DialogDescription style={{ marginTop: 4, fontSize: 13, color: 'var(--tl-fg-3)' }}>
            {txt.desc}
          </DialogDescription>
        </DialogHeader>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, padding: '8px 0' }}>
          {/* Link nhóm chat — tính năng chính, để trên cùng */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <Label style={{ ...fieldLabel, display: 'flex', alignItems: 'center', gap: 6 }}>
              <MessageCircle className="w-3.5 h-3.5" style={{ color: 'var(--tl-green)' }} />
              {vi ? 'Link nhóm chat (Zalo/Telegram…)' : 'Chat group link (Zalo/Telegram…)'}
            </Label>
            <Input
              type="url"
              inputMode="url"
              placeholder="https://zalo.me/g/... · https://t.me/..."
              value={chatUrl}
              onChange={(e) => setChatUrl(e.target.value)}
            />
            <p style={{ fontSize: 11.5, color: 'var(--tl-fg-3)', lineHeight: 1.4 }}>
              {vi
                ? 'Người xem bấm nút “Nhóm chat” trên giải là mở thẳng nhóm.'
                : 'Viewers tap the “Chat group” button to open it directly.'}
            </p>
          </div>

          {/* Thông tin giải */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={groupTitle}>{txt.info}</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Label style={fieldLabel}>{vi ? 'Tên giải' : 'Name'}</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} />
              {!nameValid && (
                <p style={{ fontSize: 11.5, color: 'var(--tl-live)' }}>
                  {vi ? 'Tên tối thiểu 3 ký tự.' : 'Name needs at least 3 characters.'}
                </p>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <Label style={fieldLabel}>{vi ? 'Ngày tổ chức' : 'Event date'}</Label>
              <Switch checked={hasEventDate} onCheckedChange={setHasEventDate} />
            </div>
            {hasEventDate && (
              <Input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Label style={fieldLabel}>{vi ? 'Địa điểm' : 'Location'}</Label>
              <Input
                placeholder={vi ? 'VD: Sân ABC, Q.7' : 'e.g. ABC Courts'}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Label style={fieldLabel}>{vi ? 'Tóm tắt thể lệ' : 'Rules summary'}</Label>
              <Textarea
                rows={3}
                value={rules}
                onChange={(e) => setRules(e.target.value)}
                placeholder={vi ? 'VD: MLP, 4 game + DreamBreaker. Check-in trước 15 phút…' : ''}
              />
            </div>
          </div>

          {/* Lệ phí & tài khoản */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={groupTitle}>{txt.fees}</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <Label style={fieldLabel}>{vi ? 'Phí / VĐV (đ)' : 'Fee / player (đ)'}</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={feeVnd || ''}
                  onChange={(e) => setFeeVnd(Math.max(0, Number(e.target.value) || 0))}
                />
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <Label style={fieldLabel}>{vi ? 'Phí / đội (đ)' : 'Fee / team (đ)'}</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={feeTeamVnd || ''}
                  onChange={(e) => setFeeTeamVnd(Math.max(0, Number(e.target.value) || 0))}
                />
              </div>
            </div>
            {hasFee && (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <Label style={fieldLabel}>{vi ? 'Ngân hàng' : 'Bank'}</Label>
                  <Select value={bankCode} onValueChange={setBankCode}>
                    <SelectTrigger>
                      <SelectValue placeholder={vi ? 'Chọn ngân hàng' : 'Select bank'} />
                    </SelectTrigger>
                    <SelectContent>
                      {VN_BANKS.map((b) => (
                        <SelectItem key={b.code} value={b.code}>
                          {b.shortName} ({b.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <Label style={fieldLabel}>{vi ? 'Số tài khoản' : 'Account number'}</Label>
                  <Input
                    inputMode="numeric"
                    value={bankNumber}
                    onChange={(e) => setBankNumber(e.target.value)}
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <Label style={fieldLabel}>{vi ? 'Tên chủ tài khoản' : 'Account holder'}</Label>
                  <Input
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value.toUpperCase())}
                  />
                </div>
              </>
            )}
          </div>

          {/* DUPR */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <p style={groupTitle}>{txt.dupr}</p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <Label style={fieldLabel}>{vi ? 'Giới hạn điểm DUPR' : 'DUPR cap'}</Label>
              <Switch checked={requireDupr} onCheckedChange={setRequireDupr} />
            </div>
            {requireDupr && (
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <Label style={fieldLabel}>{vi ? 'Nam tối đa' : 'Male max'}</Label>
                  <Input
                    type="number" step={0.25} min={2} max={8}
                    value={duprMale}
                    onChange={(e) => setDuprMale(Number(e.target.value) || 0)}
                  />
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <Label style={fieldLabel}>{vi ? 'Nữ tối đa' : 'Female max'}</Label>
                  <Input
                    type="number" step={0.25} min={2} max={8}
                    value={duprFemale}
                    onChange={(e) => setDuprFemale(Number(e.target.value) || 0)}
                  />
                </div>
              </div>
            )}
          </div>

          <Button onClick={handleSave} disabled={!nameValid || saving}>
            {saving ? txt.saving : txt.save}
          </Button>

          {/* Trọng tài — giữ nguyên chức năng cũ */}
          <div style={{ borderTop: '1px solid var(--tl-border)', paddingTop: 16 }}>
            <RefereeManagement
              referees={referees}
              loading={refereesLoading}
              onAddReferee={onAddReferee}
              onRemoveReferee={onRemoveReferee}
            />
            {tournament?.id && <RefereePinSettings format="team_match" parentId={tournament.id} />}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
