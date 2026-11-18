/**
 * Cắt câu trả lời quá dài ở ranh giới câu gần nhất — không bao giờ giữa chữ,
 * giữa ý. Không có ranh giới câu đủ xa thì cắt ở khoảng trắng và thêm "…".
 */
export function clipReply(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  // +1 để thấy khoảng trắng sau dấu chấm nằm đúng ở vị trí max
  const head = t.slice(0, max + 1);
  let cut = -1;
  for (const m of head.matchAll(/[.!?…](?=\s)|\n/g)) if (m.index! < max) cut = m.index!;
  if (cut >= max / 2) return t.slice(0, cut + 1).trim();
  const space = t.lastIndexOf(" ", max - 1);
  return `${t.slice(0, space > 0 ? space : max - 1).replace(/[\s,;:–-]+$/, "")}…`;
}
