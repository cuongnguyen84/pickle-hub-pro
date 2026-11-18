// ============================================================================
// PPA Tour World Pickleball Rankings (WPR) — editorial snapshot.
// ----------------------------------------------------------------------------
// Nguồn: https://www.ppatour.com/rankings/ — trích dẫn biên tập top 25 mỗi
// board, có credit + link về nguồn (KHÔNG mirror toàn bộ bảng: ToS của PPA cấm
// scrape/mirror thương mại khi chưa có văn bản cho phép — xem
// docs/proposals/ppa-rankings-tab/proposal.md mục 6, rủi ro #1).
//
// Cập nhật thủ công: chạy scratchpad parse (proposal §4 Option B) hoặc sửa tay
// theo trang nguồn, rồi đổi PPA_WPR_FETCHED_AT. WPR là điểm tổng hợp rolling
// 52 tuần (đôi 50% + đôi nam nữ 35% + đơn 15%) — nguồn KHÔNG công bố ngày
// cập nhật, nên UI phải nói "số liệu lấy ngày X", không phải "cập nhật ngày X".
// ============================================================================

export type PpaBoardKey = "men" | "women";

export interface PpaRankingEntry {
  rank: number;
  name: string;
  /** Điểm WPR — hiển thị qua Intl.NumberFormat theo locale (12.212,5 cho VI). */
  points: number;
  /**
   * Số giải đã chơi. Nguồn NGỪNG công bố trường này từ lần refresh 2026-09-24
   * (payload chỉ còn rank/name/points/countryCode) → ghi 0. Không nơi nào render
   * nó (web lẫn native); giữ field vì Swift `WprEntry.eventsPlayed: Int` decode
   * bắt buộc. REVIEW: gỡ hẳn cần PR riêng đụng cả apple/ + gen-native-wpr.mjs.
   */
  eventsPlayed: number;
  country: string;
  /** ISO 3166-1 alpha-2, lowercase — nguồn trả sẵn. */
  countryCode: string;
  isTied?: boolean;
}

/** Ngày ThePickleHub lấy số liệu từ trang nguồn (không phải ngày PPA cập nhật). */
export const PPA_WPR_FETCHED_AT = "2026-11-17";

export const PPA_WPR_SOURCE_URL = "https://www.ppatour.com/rankings/";

export const PPA_WPR_MEN: PpaRankingEntry[] = [
  { rank: 1, name: "Ben Johns", points: 18210, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 2, name: "Gabriel Tardio", points: 13803.75, eventsPlayed: 0, country: "Bolivia", countryCode: "bo" },
  { rank: 3, name: "Hayden Patriquin", points: 13145, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 4, name: "Christian Alshon", points: 12377.5, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 5, name: "JW Johnson", points: 11294.375, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 6, name: "Federico Staksrud", points: 10327.5, eventsPlayed: 0, country: "Argentina", countryCode: "ar" },
  { rank: 7, name: "Andrei Daescu", points: 10310, eventsPlayed: 0, country: "Romania", countryCode: "ro" },
  { rank: 8, name: "Tama Shimabukuro", points: 7740, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 9, name: "Eric Oncins", points: 6318.75, eventsPlayed: 0, country: "Brazil", countryCode: "br" },
  { rank: 10, name: "CJ Klinger", points: 5566.25, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 11, name: "Noe Khlif", points: 5562.5, eventsPlayed: 0, country: "France", countryCode: "fr" },
  { rank: 12, name: "Dylan Frazier", points: 4651.25, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 13, name: "Hunter Johnson", points: 4391.25, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 14, name: "Connor Garnett", points: 4380, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 15, name: "Jaume Martinez Vich", points: 3568.75, eventsPlayed: 0, country: "Spain", countryCode: "es" },
  { rank: 16, name: "Christopher Haworth", points: 3516.25, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 17, name: "Len Yang", points: 3388.75, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 18, name: "Hong Kit Wong", points: 3257.1, eventsPlayed: 0, country: "Hong Kong S.A.R.", countryCode: "hk" },
  { rank: 19, name: "Augustus Ge", points: 3195, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 20, name: "Riley Newman", points: 3143.75, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 21, name: "Roscoe Bellamy", points: 3003.75, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 22, name: "Armaan Bhatia", points: 2943.75, eventsPlayed: 0, country: "India", countryCode: "in" },
  { rank: 23, name: "Eunggwon Kim", points: 2922.5, eventsPlayed: 0, country: "South Korea", countryCode: "kr" },
  { rank: 24, name: "Jack Sock", points: 2743.75, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 25, name: "John Lucian Goins", points: 2720.625, eventsPlayed: 0, country: "United States", countryCode: "us" },
];

export const PPA_WPR_WOMEN: PpaRankingEntry[] = [
  { rank: 1, name: "Anna Leigh Waters", points: 22160, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 2, name: "Anna Bright", points: 17592.5, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 3, name: "Jorja Johnson", points: 11523.75, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 4, name: "Tyra Hurricane Black", points: 11287.5, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 5, name: "Catherine Parenteau", points: 9295, eventsPlayed: 0, country: "Canada", countryCode: "ca" },
  { rank: 6, name: "Rachel Rohrabacher", points: 9055, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 7, name: "Kate Fahey", points: 8835, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 8, name: "Parris Todd", points: 8627.5, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 9, name: "Tina Pisnik", points: 6517.5, eventsPlayed: 0, country: "Slovenia", countryCode: "si" },
  { rank: 10, name: "Kaitlyn Christian", points: 5180, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 11, name: "Lacy Schneemann", points: 4701.875, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 12, name: "Jessie Irvine", points: 4472.5, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 13, name: "Chao Yi Wang", points: 4402.5, eventsPlayed: 0, country: "Chinese Taipei", countryCode: "tw" },
  { rank: 14, name: "Sahra Dennehy", points: 4363.75, eventsPlayed: 0, country: "Australia", countryCode: "au" },
  { rank: 15, name: "Meghan Dizon", points: 4100, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 16, name: "Alix Truong", points: 3947.5, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 17, name: "Lea Jansen", points: 3865, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 18, name: "Brooke Buckner", points: 3713.75, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 19, name: "Mari Humberg", points: 3197, eventsPlayed: 0, country: "Brazil", countryCode: "br" },
  { rank: 20, name: "Ting Chieh Wei", points: 3195, eventsPlayed: 0, country: "Chinese Taipei", countryCode: "tw" },
  { rank: 21, name: "Judit Castillo", points: 3183.75, eventsPlayed: 0, country: "Spain", countryCode: "es" },
  { rank: 22, name: "Sofia Sewing", points: 3175.625, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 23, name: "Danni-Elle Townsend", points: 3146.25, eventsPlayed: 0, country: "Australia", countryCode: "au" },
  { rank: 24, name: "Layne Sleeth", points: 3041.25, eventsPlayed: 0, country: "Canada", countryCode: "ca" },
  { rank: 25, name: "Milan Rane", points: 2953.75, eventsPlayed: 0, country: "United States", countryCode: "us" },
];

export const PPA_WPR_BOARDS: Record<PpaBoardKey, PpaRankingEntry[]> = {
  men: PPA_WPR_MEN,
  women: PPA_WPR_WOMEN,
};

// VĐV Việt Nam / gốc Việt trên bảng WPR đầy đủ của nguồn (kể cả ngoài top 25).
//
// QUY TẮC BIÊN TẬP (in trên trang, giữ nguyên khi cập nhật): mọi VĐV mang cờ
// Việt Nam (countryCode "vn") trên bảng WPR tại ngày PPA_WPR_FETCHED_AT, cộng
// 3 VĐV Mỹ gốc Việt nổi bật chọn tay (Alix Truong, Jonathan Truong, Luc Pham).
// Danh sách này là hằng số VIẾT TAY — proposal rankings-dupr-wpr-tabs, risk D2
// điều kiện (4): KHÔNG commit script filter sinh nó; KHÔNG cron/auto-refresh;
// KHÔNG copy headshot. Cập nhật = đối chiếu tay với trang nguồn rồi sửa tại đây
// (mốc refresh: docs/milestones.md WPR-REFRESH).
export interface PpaVietHighlight {
  board: PpaBoardKey;
  rank: number;
  name: string;
  countryCode: string;
  points: number;
}

export const PPA_WPR_VIET_HIGHLIGHTS: PpaVietHighlight[] = [
  { board: "women", rank: 16, name: "Alix Truong", countryCode: "us", points: 3947.5 },
  { board: "men", rank: 30, name: "Hien Truong", countryCode: "vn", points: 2291.25 },
  { board: "men", rank: 33, name: "Jonathan Truong", countryCode: "us", points: 2131.875 },
  { board: "men", rank: 34, name: "Luc Pham", countryCode: "us", points: 2073 },
  { board: "women", rank: 47, name: "Sophia Nhi Huynh", countryCode: "vn", points: 1480 },
  { board: "men", rank: 50, name: "Quan Do", countryCode: "vn", points: 1520 },
  { board: "women", rank: 66, name: "HO Tam", countryCode: "vn", points: 1049.375 },
  { board: "women", rank: 70, name: "Sophia Phuong Anh Tran", countryCode: "vn", points: 944.975 },
  { board: "men", rank: 94, name: "Hoang Nam Ly", countryCode: "vn", points: 600 },
  { board: "women", rank: 145, name: "NGOC SI", countryCode: "vn", points: 230 },
  { board: "men", rank: 184, name: "Giang Trinh", countryCode: "vn", points: 190 },
  { board: "men", rank: 188, name: "LE Xuan Duc", countryCode: "vn", points: 179.375 },
  { board: "men", rank: 223, name: "Nguyen Hung Anh", countryCode: "vn", points: 130 },
  { board: "men", rank: 246, name: "Hoang Nguyen Anh", countryCode: "vn", points: 105 },
  { board: "men", rank: 251, name: "Nguyen Huy", countryCode: "vn", points: 100.9 },
  { board: "men", rank: 254, name: "Hai Dang Ngo", countryCode: "vn", points: 95 },
  { board: "women", rank: 265, name: "Tran Tue Ngoc", countryCode: "vn", points: 50 },
  { board: "men", rank: 268, name: "HO Hoan", countryCode: "vn", points: 83.1 },
  { board: "men", rank: 279, name: "Carlos Rubio", countryCode: "vn", points: 75 },
  { board: "men", rank: 280, name: "Tiến Đạt Lê", countryCode: "vn", points: 75 },
  { board: "women", rank: 284, name: "Binh Phan", countryCode: "vn", points: 42.5 },
  { board: "men", rank: 307, name: "Anh Pham", countryCode: "vn", points: 57.5 },
  { board: "men", rank: 329, name: "Khuong Huynh", countryCode: "vn", points: 50 },
  { board: "men", rank: 354, name: "Andrew Anh Pham", countryCode: "vn", points: 43.5 },
  { board: "women", rank: 371, name: "Thuy Pham", countryCode: "vn", points: 25 },
  { board: "men", rank: 375, name: "Nhật Minh T", countryCode: "vn", points: 38.4 },
  { board: "men", rank: 384, name: "Khoa Vo", countryCode: "vn", points: 37.5 },
  { board: "men", rank: 461, name: "Ngoc Trieu Tran", countryCode: "vn", points: 25 },
  { board: "men", rank: 468, name: "Nguyen Thang", countryCode: "vn", points: 25 },
  { board: "women", rank: 472, name: "Huong Dan Linh", countryCode: "vn", points: 12.75 },
  { board: "men", rank: 538, name: "Minh Nhật", countryCode: "vn", points: 17.5 },
  { board: "men", rank: 559, name: "Nguyen Tien", countryCode: "vn", points: 16.25 },
  { board: "men", rank: 577, name: "Nguyễn Hoàng", countryCode: "vn", points: 15 },
  { board: "men", rank: 619, name: "Phong Tran", countryCode: "vn", points: 12.5 },
  { board: "men", rank: 620, name: "Nam Vu", countryCode: "vn", points: 12.5 },
  { board: "men", rank: 630, name: "quang tran", countryCode: "vn", points: 12.5 },
  { board: "men", rank: 635, name: "Tran Tuan Minh", countryCode: "vn", points: 12.5 },
  { board: "men", rank: 636, name: "Minh Nguyễn Hoàng", countryCode: "vn", points: 12.5 },
  { board: "men", rank: 638, name: "Hoang Bao Long", countryCode: "vn", points: 12.5 },
  { board: "men", rank: 664, name: "Pham XuanVu", countryCode: "vn", points: 11.25 },
  { board: "men", rank: 1176, name: "Đạt Trần", countryCode: "vn", points: 2.45 },
];
