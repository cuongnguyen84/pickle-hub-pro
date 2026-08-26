/**
 * Heuristic: một đoạn tiếng Việt thật luôn có tỷ lệ từ mang dấu đáng kể
 * (từ chức năng: "của", "tại", "và"...). Dưới 10% = gần như chắc chắn viết
 * không dấu. Kiểm TỪNG field (title/summary/body) riêng — check gộp từng để
 * lọt title mất dấu vì body dài có dấu kéo tỷ lệ lên (prod 26/08:
 * "Cong Bo Chung Ket ... Tai Thanh Phố" đã xuất bản).
 */
export function missingViDiacritics(text: string): boolean {
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const vietnameseWords = words.filter((word) =>
    /[ăâđêôơưàáạảãằắặẳẵầấậẩẫèéẹẻẽềếệểễìíịỉĩòóọỏõồốộổỗờớợởỡùúụủũừứựửữỳýỵỷỹ]/i
      .test(word)
  ).length;
  return vietnameseWords / words.length < 0.1;
}
