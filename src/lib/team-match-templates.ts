// Bộ game mặc định của giải đồng đội MLP — tách khỏi GameTemplateEditor để chat AI
// tạo giải dùng được mà không kéo theo cả editor (Select/Input).
export interface GameTemplateItem {
  id: string;
  order_index: number;
  game_type: 'WD' | 'MD' | 'MX' | 'WS' | 'MS';
  display_name: string;
  scoring_type: 'rally21' | 'sideout11';
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

// Số người tự nhập → lấy bộ game của preset gần nhất (≤4 → 4, ≤6 → 6, còn lại → 8).
export function getDefaultTemplates(rosterSize: number): GameTemplateItem[] {
  const preset = rosterSize <= 4 ? 4 : rosterSize <= 6 ? 6 : 8;
  return DEFAULT_TEMPLATES[preset].map(t => ({ ...t }));
}
