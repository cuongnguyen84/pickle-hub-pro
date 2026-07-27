/**
 * Q1 (champion-on-event-card): quick_table_players.name là free-text BTC tự gõ —
 * prod có tên rác ("5", "test4"). Cột champion_name vẫn ghi đủ; MỌI bề mặt hiển
 * thị (card web, featured card, SSR, native twin) lọc qua đây để không in
 * "Vô địch: test4" lên trang công khai. Swift twin: ToolsRepository.swift.
 */
export function displayChampionName(name: string | null | undefined): string | null {
  const trimmed = name?.trim();
  if (!trimmed || trimmed.length < 2 || /^\d+$/.test(trimmed)) return null;
  return trimmed;
}
