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
export const PPA_WPR_FETCHED_AT = "2026-10-28";

export const PPA_WPR_SOURCE_URL = "https://www.ppatour.com/rankings/";

export const PPA_WPR_MEN: PpaRankingEntry[] = [
  { rank: 1, name: "Ben Johns", points: 18060, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 2, name: "Hayden Patriquin", points: 14450, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 3, name: "Gabriel Tardio", points: 13653.75, eventsPlayed: 0, country: "Bolivia", countryCode: "bo" },
  { rank: 4, name: "Federico Staksrud", points: 12037.5, eventsPlayed: 0, country: "Argentina", countryCode: "ar" },
  { rank: 5, name: "Christian Alshon", points: 11792.5, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 6, name: "JW Johnson", points: 10971.875, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 7, name: "Andrei Daescu", points: 10010, eventsPlayed: 0, country: "Romania", countryCode: "ro" },
  { rank: 8, name: "Tama Shimabukuro", points: 6102.5, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 9, name: "CJ Klinger", points: 6005, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 10, name: "Eric Oncins", points: 5711.25, eventsPlayed: 0, country: "Brazil", countryCode: "br" },
  { rank: 11, name: "Noe Khlif", points: 5562.5, eventsPlayed: 0, country: "France", countryCode: "fr" },
  { rank: 12, name: "Dylan Frazier", points: 4666.25, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 13, name: "Connor Garnett", points: 4376.25, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 14, name: "Hunter Johnson", points: 4338.75, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 15, name: "Jaume Martinez Vich", points: 3797.5, eventsPlayed: 0, country: "Spain", countryCode: "es" },
  { rank: 16, name: "Christopher Haworth", points: 3786.25, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 17, name: "Len Yang", points: 3299.375, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 18, name: "Augustus Ge", points: 3153.75, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 19, name: "Riley Newman", points: 3143.75, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 20, name: "Hong Kit Wong", points: 3023.75, eventsPlayed: 0, country: "Hong Kong S.A.R.", countryCode: "hk" },
  { rank: 21, name: "Roscoe Bellamy", points: 2958.75, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 22, name: "Armaan Bhatia", points: 2928.75, eventsPlayed: 0, country: "India", countryCode: "in" },
  { rank: 23, name: "Eunggwon Kim", points: 2692.5, eventsPlayed: 0, country: "South Korea", countryCode: "kr" },
  { rank: 24, name: "Yuta Funemizu", points: 2568.75, eventsPlayed: 0, country: "Japan", countryCode: "jp" },
  { rank: 25, name: "Jack Sock", points: 2477.5, eventsPlayed: 0, country: "United States", countryCode: "us" },
];

export const PPA_WPR_WOMEN: PpaRankingEntry[] = [
  { rank: 1, name: "Anna Leigh Waters", points: 22160, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 2, name: "Anna Bright", points: 17697.5, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 3, name: "Tyra Hurricane Black", points: 12097.5, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 4, name: "Jorja Johnson", points: 12078.75, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 5, name: "Catherine Parenteau", points: 9295, eventsPlayed: 0, country: "Canada", countryCode: "ca" },
  { rank: 6, name: "Parris Todd", points: 9167.5, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 7, name: "Rachel Rohrabacher", points: 8590, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 8, name: "Kate Fahey", points: 8332.5, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 9, name: "Tina Pisnik", points: 6015, eventsPlayed: 0, country: "Slovenia", countryCode: "si" },
  { rank: 10, name: "Kaitlyn Christian", points: 4906.25, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 11, name: "Lacy Schneemann", points: 4829.375, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 12, name: "Jessie Irvine", points: 4658.75, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 13, name: "Meghan Dizon", points: 4302.5, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 14, name: "Chao Yi Wang", points: 4210, eventsPlayed: 0, country: "Chinese Taipei", countryCode: "tw" },
  { rank: 15, name: "Alix Truong", points: 4022.5, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 16, name: "Sahra Dennehy", points: 3981.25, eventsPlayed: 0, country: "Australia", countryCode: "au" },
  { rank: 17, name: "Lea Jansen", points: 3865, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 18, name: "Brooke Buckner", points: 3533.75, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 19, name: "Judit Castillo", points: 3255, eventsPlayed: 0, country: "Spain", countryCode: "es" },
  { rank: 20, name: "Mari Humberg", points: 3185.75, eventsPlayed: 0, country: "Brazil", countryCode: "br" },
  { rank: 21, name: "Ting Chieh Wei", points: 3168.75, eventsPlayed: 0, country: "Chinese Taipei", countryCode: "tw" },
  { rank: 22, name: "Jade Kawamoto", points: 3103.75, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 23, name: "Danni-Elle Townsend", points: 2868.75, eventsPlayed: 0, country: "Australia", countryCode: "au" },
  { rank: 24, name: "Milan Rane", points: 2833.75, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 25, name: "Kiora Kunimoto", points: 2756.25, eventsPlayed: 0, country: "United States", countryCode: "us" },
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
  { board: "women", rank: 15, name: "Alix Truong", countryCode: "us", points: 4022.5 },
  { board: "men", rank: 29, name: "Hien Truong", countryCode: "vn", points: 2291.25 },
  { board: "men", rank: 31, name: "Jonathan Truong", countryCode: "us", points: 2259.375 },
  { board: "men", rank: 37, name: "Luc Pham", countryCode: "us", points: 1901.125 },
  { board: "men", rank: 46, name: "Quan Do", countryCode: "vn", points: 1520 },
  { board: "women", rank: 46, name: "Sophia Nhi Huynh", countryCode: "vn", points: 1480 },
  { board: "women", rank: 62, name: "HO Tam", countryCode: "vn", points: 1049.375 },
  { board: "women", rank: 71, name: "Sophia Phuong Anh Tran", countryCode: "vn", points: 926.625 },
  { board: "men", rank: 96, name: "Hoang Nam Ly", countryCode: "vn", points: 600 },
  { board: "women", rank: 141, name: "NGOC SI", countryCode: "vn", points: 230 },
  { board: "men", rank: 176, name: "Giang Trinh", countryCode: "vn", points: 190 },
  { board: "men", rank: 186, name: "LE Xuan Duc", countryCode: "vn", points: 179.375 },
  { board: "men", rank: 217, name: "Nguyen Hung Anh", countryCode: "vn", points: 130 },
  { board: "men", rank: 243, name: "Hoang Nguyen Anh", countryCode: "vn", points: 105 },
  { board: "men", rank: 251, name: "Nguyen Huy", countryCode: "vn", points: 100.9 },
  { board: "men", rank: 256, name: "Hai Dang Ngo", countryCode: "vn", points: 95 },
  { board: "men", rank: 269, name: "HO Hoan", countryCode: "vn", points: 83.1 },
  { board: "women", rank: 270, name: "Tran Tue Ngoc", countryCode: "vn", points: 50 },
  { board: "men", rank: 282, name: "Tiến Đạt Lê", countryCode: "vn", points: 75 },
  { board: "women", rank: 287, name: "Binh Phan", countryCode: "vn", points: 42.5 },
  { board: "men", rank: 303, name: "Anh Pham", countryCode: "vn", points: 57.5 },
  { board: "men", rank: 323, name: "Carlos Rubio", countryCode: "vn", points: 50 },
  { board: "men", rank: 326, name: "Khuong Huynh", countryCode: "vn", points: 50 },
  { board: "men", rank: 370, name: "Nhật Minh T", countryCode: "vn", points: 38.4 },
  { board: "men", rank: 378, name: "Andrew Anh Pham", countryCode: "vn", points: 37.5 },
  { board: "women", rank: 381, name: "Thuy Pham", countryCode: "vn", points: 25 },
  { board: "men", rank: 382, name: "Khoa Vo", countryCode: "vn", points: 37.5 },
  { board: "men", rank: 444, name: "Ngoc Trieu Tran", countryCode: "vn", points: 25 },
  { board: "men", rank: 449, name: "Nguyen Thang", countryCode: "vn", points: 25 },
  { board: "men", rank: 528, name: "Minh Nhật", countryCode: "vn", points: 17.5 },
  { board: "men", rank: 546, name: "Nguyen Tien", countryCode: "vn", points: 16.25 },
  { board: "men", rank: 561, name: "Nguyễn Hoàng", countryCode: "vn", points: 15 },
  { board: "men", rank: 604, name: "Quang Tran", countryCode: "vn", points: 12.5 },
  { board: "men", rank: 605, name: "Minh Nguyễn Hoàng", countryCode: "vn", points: 12.5 },
  { board: "men", rank: 606, name: "Phong Tran", countryCode: "vn", points: 12.5 },
  { board: "men", rank: 608, name: "Nam Vu", countryCode: "vn", points: 12.5 },
  { board: "men", rank: 625, name: "Hoang Bao Long", countryCode: "vn", points: 12.5 },
  { board: "men", rank: 628, name: "Tran Tuan Minh", countryCode: "vn", points: 12.5 },
  { board: "men", rank: 651, name: "Pham XuanVu", countryCode: "vn", points: 11.25 },
  { board: "men", rank: 1149, name: "Đạt Trần", countryCode: "vn", points: 2.45 },
];
