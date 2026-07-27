/**
 * Q1 (champion-on-event-card): quick_table_players.name là free-text BTC tự gõ —
 * prod có tên rác ("5", "test4", "VDV 3", "Player 4"). Cột champion_name vẫn ghi
 * đủ; MỌI bề mặt hiển thị (card web, featured card, SSR, native twin) lọc qua
 * đây để không in tên rác lên trang công khai. Swift twin: ToolsModels.swift
 * (MyTournament.displayChampion) — đổi luật thì đổi CẢ HAI.
 *
 * Luật (đối chiếu đủ 22 tên prod 2026-07-27 — chặn đúng 8 rác, giữ 14 thật):
 *  - < 2 ký tự hoặc toàn chữ số ("5", "18")
 *  - placeholder BTC lười gõ: một từ khóa chung + số ("test4", "VDV 3",
 *    "Player 4", "đội 2"). Tên thật là tên riêng/cặp đôi nên không khớp mẫu này.
 */
const PLACEHOLDER = /^(test|demo|player|vdv|team|doi|đội|ng(ư|u)(ờ|o)i(\s*ch(ơ|o)i)?)[\s._-]*\d*$/i;

export function displayChampionName(name: string | null | undefined): string | null {
  const trimmed = name?.trim();
  if (!trimmed || trimmed.length < 2 || /^\d+$/.test(trimmed) || PLACEHOLDER.test(trimmed)) {
    return null;
  }
  return trimmed;
}
