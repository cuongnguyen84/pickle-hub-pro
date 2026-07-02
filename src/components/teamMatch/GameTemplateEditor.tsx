import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { useI18n } from '@/i18n';

// ─── W2.4d shared tokens ─────────────────────────────────────────────────
const surfaceCard: React.CSSProperties = {
  background: 'var(--tl-bg-elev)',
  border: '1px solid var(--tl-border)',
  borderRadius: 'var(--tl-radius-lg)',
};

const sectionTitle: React.CSSProperties = {
  fontFamily: 'Instrument Serif, serif',
  fontStyle: 'italic',
  fontWeight: 400,
  fontSize: 18,
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

export interface GameTemplateItem {
  id: string;
  order_index: number;
  game_type: 'WD' | 'MD' | 'MX' | 'WS' | 'MS';
  display_name: string;
  scoring_type: 'rally21' | 'sideout11';
}

interface GameTemplateEditorProps {
  templates: GameTemplateItem[];
  onChange: (templates: GameTemplateItem[]) => void;
  rosterSize: 4 | 6 | 8;
  // Total-score mode overrides each game's target with pointsPerGame (native parity).
  totalScoreMode?: boolean;
  pointsPerGame?: number;
}

const DEFAULT_TEMPLATES: Record<4 | 6 | 8, GameTemplateItem[]> = {
  4: [
    { id: '1', order_index: 0, game_type: 'MX', display_name: 'MX 1', scoring_type: 'rally21' },
    { id: '2', order_index: 1, game_type: 'MX', display_name: 'MX 2', scoring_type: 'rally21' },
    { id: '3', order_index: 2, game_type: 'MD', display_name: 'MD', scoring_type: 'rally21' },
    { id: '4', order_index: 3, game_type: 'WD', display_name: 'WD', scoring_type: 'rally21' },
  ],
  6: [
    { id: '1', order_index: 0, game_type: 'WD', display_name: 'WD', scoring_type: 'rally21' },
    { id: '2', order_index: 1, game_type: 'MD', display_name: 'MD', scoring_type: 'rally21' },
    { id: '3', order_index: 2, game_type: 'MX', display_name: 'MX 1', scoring_type: 'rally21' },
    { id: '4', order_index: 3, game_type: 'MX', display_name: 'MX 2', scoring_type: 'rally21' },
  ],
  8: [
    { id: '1', order_index: 0, game_type: 'WD', display_name: 'WD 1', scoring_type: 'rally21' },
    { id: '2', order_index: 1, game_type: 'WD', display_name: 'WD 2', scoring_type: 'rally21' },
    { id: '3', order_index: 2, game_type: 'MD', display_name: 'MD 1', scoring_type: 'rally21' },
    { id: '4', order_index: 3, game_type: 'MD', display_name: 'MD 2', scoring_type: 'rally21' },
    { id: '5', order_index: 4, game_type: 'MX', display_name: 'MX 1', scoring_type: 'rally21' },
    { id: '6', order_index: 5, game_type: 'MX', display_name: 'MX 2', scoring_type: 'rally21' },
  ],
};

export function getDefaultTemplates(rosterSize: 4 | 6 | 8): GameTemplateItem[] {
  return DEFAULT_TEMPLATES[rosterSize].map(t => ({ ...t }));
}

export function GameTemplateEditor({ templates, onChange, rosterSize, totalScoreMode = false, pointsPerGame = 7 }: GameTemplateEditorProps) {
  const { language } = useI18n();

  const txt = {
    title: language === 'vi' ? 'Các game trong trận đấu' : 'Games in this match',
    gameCount: (n: number, even: boolean) =>
      language === 'vi'
        ? `${n} game${even ? ' (số chẵn — có thể cần DreamBreaker)' : ''}`
        : `${n} game${n === 1 ? '' : 's'}${even ? ' (even count — DreamBreaker may apply)' : ''}`,
    reset: language === 'vi' ? 'Reset mặc định' : 'Reset to default',
    namePh: language === 'vi' ? 'Tên hiển thị' : 'Display name',
    add: language === 'vi' ? 'Thêm game' : 'Add game',
    moveUp: language === 'vi' ? 'Lên' : 'Move up',
    moveDown: language === 'vi' ? 'Xuống' : 'Move down',
    remove: language === 'vi' ? 'Xóa' : 'Remove',
  };

  const GAME_TYPE_OPTIONS = [
    { value: 'WD', label: language === 'vi' ? 'Đôi Nữ (WD)' : 'Women’s Doubles (WD)' },
    { value: 'MD', label: language === 'vi' ? 'Đôi Nam (MD)' : 'Men’s Doubles (MD)' },
    { value: 'MX', label: language === 'vi' ? 'Đôi Nam Nữ (MX)' : 'Mixed Doubles (MX)' },
    { value: 'WS', label: language === 'vi' ? 'Đơn Nữ (WS)' : 'Women’s Singles (WS)' },
    { value: 'MS', label: language === 'vi' ? 'Đơn Nam (MS)' : 'Men’s Singles (MS)' },
  ];

  // Total-score mode: mỗi game con thi đấu tới pointsPerGame (không phải 21/11).
  const SCORING_OPTIONS = [
    { value: 'rally21', label: `Rally ${totalScoreMode ? pointsPerGame : 21}` },
    { value: 'sideout11', label: `Sideout ${totalScoreMode ? pointsPerGame : 11}` },
  ];

  const addTemplate = () => {
    const newId = Date.now().toString();
    const newTemplate: GameTemplateItem = {
      id: newId,
      order_index: templates.length,
      game_type: 'MX',
      display_name: `Game ${templates.length + 1}`,
      scoring_type: 'rally21',
    };
    onChange([...templates, newTemplate]);
  };

  const removeTemplate = (id: string) => {
    const updated = templates
      .filter(t => t.id !== id)
      .map((t, index) => ({ ...t, order_index: index }));
    onChange(updated);
  };

  const updateTemplate = (id: string, field: keyof GameTemplateItem, value: string) => {
    const updated = templates.map(t =>
      t.id === id ? { ...t, [field]: value } : t
    );
    onChange(updated);
  };

  const moveTemplate = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === templates.length - 1)
    ) {
      return;
    }

    const newIndex = direction === 'up' ? index - 1 : index + 1;
    const newTemplates = [...templates];
    [newTemplates[index], newTemplates[newIndex]] = [newTemplates[newIndex], newTemplates[index]];

    onChange(newTemplates.map((t, i) => ({ ...t, order_index: i })));
  };

  const resetToDefault = () => {
    onChange(getDefaultTemplates(rosterSize));
  };

  const isEvenGames = templates.length % 2 === 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div>
          <h3 style={sectionTitle}>{txt.title}</h3>
          <p style={{ ...fieldLabel, marginTop: 4, textTransform: 'none', letterSpacing: '0.01em', fontFamily: 'inherit', fontSize: 13, color: 'var(--tl-fg-3)' }}>
            {txt.gameCount(templates.length, isEvenGames)}
          </p>
        </div>
        <button
          type="button"
          className="tl-btn"
          onClick={resetToDefault}
          style={{ padding: '5px 10px', fontSize: 12 }}
        >
          {txt.reset}
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {templates.map((template, index) => (
          <div key={template.id} style={{ ...surfaceCard, padding: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <button
                  type="button"
                  className="tl-btn"
                  onClick={() => moveTemplate(index, 'up')}
                  disabled={index === 0}
                  aria-label={txt.moveUp}
                  style={{
                    height: 22,
                    width: 24,
                    padding: 0,
                    justifyContent: 'center',
                    opacity: index === 0 ? 0.4 : 1,
                  }}
                >
                  <ArrowUp className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  className="tl-btn"
                  onClick={() => moveTemplate(index, 'down')}
                  disabled={index === templates.length - 1}
                  aria-label={txt.moveDown}
                  style={{
                    height: 22,
                    width: 24,
                    padding: 0,
                    justifyContent: 'center',
                    opacity: index === templates.length - 1 ? 0.4 : 1,
                  }}
                >
                  <ArrowDown className="h-3 w-3" />
                </button>
              </div>

              <span
                style={{
                  width: 28,
                  textAlign: 'center',
                  fontFamily: 'Geist Mono, ui-monospace, monospace',
                  fontSize: 12,
                  color: 'var(--tl-fg-3)',
                  letterSpacing: '0.04em',
                }}
              >
                {index + 1}.
              </span>

              <div
                style={{
                  flex: 1,
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr)',
                  gap: 8,
                }}
              >
                <Select
                  value={template.game_type}
                  onValueChange={(value) => updateTemplate(template.id, 'game_type', value)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {GAME_TYPE_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Input
                  name={`game-template-name-${template.id}`}
                  value={template.display_name}
                  onChange={(e) => updateTemplate(template.id, 'display_name', e.target.value)}
                  placeholder={txt.namePh}
                  className="h-9"
                />

                <Select
                  value={template.scoring_type}
                  onValueChange={(value) => updateTemplate(template.id, 'scoring_type', value)}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SCORING_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <button
                type="button"
                onClick={() => removeTemplate(template.id)}
                disabled={templates.length <= 1}
                aria-label={txt.remove}
                style={{
                  width: 32,
                  height: 32,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'transparent',
                  border: '1px solid transparent',
                  borderRadius: 'var(--tl-radius)',
                  color: templates.length <= 1 ? 'var(--tl-fg-4)' : 'var(--tl-fg-3)',
                  cursor: templates.length <= 1 ? 'not-allowed' : 'pointer',
                  flexShrink: 0,
                  transition: 'color 0.15s, border-color 0.15s',
                }}
                onMouseEnter={(e) => {
                  if (templates.length > 1) {
                    (e.currentTarget as HTMLElement).style.color = 'var(--tl-live)';
                    (e.currentTarget as HTMLElement).style.borderColor = 'var(--tl-border)';
                  }
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.color =
                    templates.length <= 1 ? 'var(--tl-fg-4)' : 'var(--tl-fg-3)';
                  (e.currentTarget as HTMLElement).style.borderColor = 'transparent';
                }}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        className="tl-btn"
        onClick={addTemplate}
        style={{ width: '100%', justifyContent: 'center', padding: '8px 12px' }}
      >
        <Plus className="h-4 w-4" />
        {txt.add}
      </button>
    </div>
  );
}
