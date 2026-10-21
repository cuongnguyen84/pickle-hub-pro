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
export const PPA_WPR_FETCHED_AT = "2026-10-21";

export const PPA_WPR_SOURCE_URL = "https://www.ppatour.com/rankings/";

export const PPA_WPR_MEN: PpaRankingEntry[] = [
  { rank: 1, name: "Ben Johns", points: 16972.5, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 2, name: "Gabriel Tardio", points: 13553.75, eventsPlayed: 0, country: "Bolivia", countryCode: "bo" },
  { rank: 3, name: "Hayden Patriquin", points: 13280, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 4, name: "Christian Alshon", points: 11770, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 5, name: "Federico Staksrud", points: 11405, eventsPlayed: 0, country: "Argentina", countryCode: "ar" },
  { rank: 6, name: "JW Johnson", points: 10323.125, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 7, name: "Andrei Daescu", points: 10010, eventsPlayed: 0, country: "Romania", countryCode: "ro" },
  { rank: 8, name: "CJ Klinger", points: 6005, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 9, name: "Eric Oncins", points: 5576.25, eventsPlayed: 0, country: "Brazil", countryCode: "br" },
  { rank: 10, name: "Tama Shimabukuro", points: 5521.25, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 11, name: "Noe Khlif", points: 5338.75, eventsPlayed: 0, country: "France", countryCode: "fr" },
  { rank: 12, name: "Dylan Frazier", points: 4303.75, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 13, name: "Connor Garnett", points: 4005, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 14, name: "Jaume Martinez Vich", points: 3797.5, eventsPlayed: 0, country: "Spain", countryCode: "es" },
  { rank: 15, name: "Hunter Johnson", points: 3781.875, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 16, name: "Christopher Haworth", points: 3642.5, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 17, name: "Riley Newman", points: 3143.75, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 18, name: "Len Yang", points: 3118.125, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 19, name: "Augustus Ge", points: 3093.75, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 20, name: "Roscoe Bellamy", points: 2958.75, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 21, name: "Hong Kit Wong", points: 2915, eventsPlayed: 0, country: "Hong Kong S.A.R.", countryCode: "hk" },
  { rank: 22, name: "Armaan Bhatia", points: 2851.25, eventsPlayed: 0, country: "India", countryCode: "in" },
  { rank: 23, name: "Eunggwon Kim", points: 2580, eventsPlayed: 0, country: "South Korea", countryCode: "kr" },
  { rank: 24, name: "Yuta Funemizu", points: 2518.125, eventsPlayed: 0, country: "Japan", countryCode: "jp" },
  { rank: 25, name: "Jack Sock", points: 2477.5, eventsPlayed: 0, country: "United States", countryCode: "us" },
];

export const PPA_WPR_WOMEN: PpaRankingEntry[] = [
  { rank: 1, name: "Anna Leigh Waters", points: 21385, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 2, name: "Anna Bright", points: 16527.5, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 3, name: "Tyra Hurricane Black", points: 11662.5, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 4, name: "Jorja Johnson", points: 11216.25, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 5, name: "Catherine Parenteau", points: 9072.5, eventsPlayed: 0, country: "Canada", countryCode: "ca" },
  { rank: 6, name: "Parris Todd", points: 8740, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 7, name: "Rachel Rohrabacher", points: 8237.5, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 8, name: "Kate Fahey", points: 8212.5, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 9, name: "Tina Pisnik", points: 6015, eventsPlayed: 0, country: "Slovenia", countryCode: "si" },
  { rank: 10, name: "Kaitlyn Christian", points: 4793.75, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 11, name: "Lacy Schneemann", points: 4789.375, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 12, name: "Jessie Irvine", points: 4488.75, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 13, name: "Meghan Dizon", points: 4302.5, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 14, name: "Chao Yi Wang", points: 4107.5, eventsPlayed: 0, country: "Chinese Taipei", countryCode: "tw" },
  { rank: 15, name: "Alix Truong", points: 3875, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 16, name: "Lea Jansen", points: 3865, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 17, name: "Sahra Dennehy", points: 3613.75, eventsPlayed: 0, country: "Australia", countryCode: "au" },
  { rank: 18, name: "Brooke Buckner", points: 3533.75, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 19, name: "Jade Kawamoto", points: 3103.75, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 20, name: "Mari Humberg", points: 3020.75, eventsPlayed: 0, country: "Brazil", countryCode: "br" },
  { rank: 21, name: "Judit Castillo", points: 2988.75, eventsPlayed: 0, country: "Spain", countryCode: "es" },
  { rank: 22, name: "Ting Chieh Wei", points: 2900, eventsPlayed: 0, country: "Chinese Taipei", countryCode: "tw" },
  { rank: 23, name: "Milan Rane", points: 2818.75, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 24, name: "Layne Sleeth", points: 2703.75, eventsPlayed: 0, country: "Canada", countryCode: "ca" },
  { rank: 25, name: "Danni-Elle Townsend", points: 2655, eventsPlayed: 0, country: "Australia", countryCode: "au" },
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
  { board: "women", rank: 15, name: "Alix Truong", countryCode: "us", points: 3875 },
  { board: "men", rank: 33, name: "Jonathan Truong", countryCode: "us", points: 2129.375 },
  { board: "men", rank: 34, name: "Hien Truong", countryCode: "vn", points: 2092.5 },
  { board: "men", rank: 39, name: "Luc Pham", countryCode: "us", points: 1818.625 },
  { board: "women", rank: 49, name: "Sophia Nhi Huynh", countryCode: "vn", points: 1393.75 },
  { board: "men", rank: 54, name: "Quan Do", countryCode: "vn", points: 1343.75 },
  { board: "women", rank: 65, name: "HO Tam", countryCode: "vn", points: 976.25 },
  { board: "women", rank: 74, name: "Sophia Phuong Anh Tran", countryCode: "vn", points: 853.5 },
  { board: "men", rank: 95, name: "Hoang Nam Ly", countryCode: "vn", points: 600 },
  { board: "women", rank: 138, name: "NGOC SI", countryCode: "vn", points: 230 },
  { board: "men", rank: 171, name: "Giang Trinh", countryCode: "vn", points: 190 },
  { board: "men", rank: 211, name: "LE Xuan Duc", countryCode: "vn", points: 136.25 },
  { board: "men", rank: 215, name: "Nguyen Hung Anh", countryCode: "vn", points: 130 },
  { board: "men", rank: 237, name: "Hoang Nguyen Anh", countryCode: "vn", points: 105 },
  { board: "men", rank: 262, name: "HO Hoan", countryCode: "vn", points: 83.1 },
  { board: "women", rank: 268, name: "Tran Tue Ngoc", countryCode: "vn", points: 50 },
  { board: "men", rank: 275, name: "Tiến Đạt Lê", countryCode: "vn", points: 75 },
  { board: "women", rank: 285, name: "Binh Phan", countryCode: "vn", points: 42.5 },
  { board: "men", rank: 286, name: "Hai Dang Ngo", countryCode: "vn", points: 70.625 },
  { board: "men", rank: 291, name: "Nguyen Huy", countryCode: "vn", points: 63.4 },
  { board: "men", rank: 299, name: "Anh Pham", countryCode: "vn", points: 57.5 },
  { board: "men", rank: 319, name: "Khuong Huynh", countryCode: "vn", points: 50 },
  { board: "men", rank: 320, name: "Carlos Rubio", countryCode: "vn", points: 50 },
  { board: "women", rank: 358, name: "Thuy Pham", countryCode: "vn", points: 25 },
  { board: "men", rank: 366, name: "Nhật Minh T", countryCode: "vn", points: 38.4 },
  { board: "men", rank: 375, name: "Andrew Anh Pham", countryCode: "vn", points: 37.5 },
  { board: "men", rank: 377, name: "Khoa Vo", countryCode: "vn", points: 37.5 },
  { board: "men", rank: 447, name: "Ngoc Trieu Tran", countryCode: "vn", points: 25 },
  { board: "men", rank: 448, name: "Nguyen Thang", countryCode: "vn", points: 25 },
  { board: "men", rank: 501, name: "Minh Nhật", countryCode: "vn", points: 17.5 },
  { board: "men", rank: 518, name: "Nguyen Tien", countryCode: "vn", points: 16.25 },
  { board: "men", rank: 537, name: "Nguyễn Hoàng", countryCode: "vn", points: 15 },
  { board: "men", rank: 583, name: "quang tran", countryCode: "vn", points: 12.5 },
  { board: "men", rank: 586, name: "Hoang Bao Long", countryCode: "vn", points: 12.5 },
  { board: "men", rank: 588, name: "Phong Tran", countryCode: "vn", points: 12.5 },
  { board: "men", rank: 596, name: "Tran Tuan Minh", countryCode: "vn", points: 12.5 },
  { board: "men", rank: 597, name: "Nam Vu", countryCode: "vn", points: 12.5 },
  { board: "men", rank: 602, name: "Minh Nguyễn Hoàng", countryCode: "vn", points: 12.5 },
  { board: "men", rank: 621, name: "Pham XuanVu", countryCode: "vn", points: 11.25 },
  { board: "men", rank: 1109, name: "Đạt Trần", countryCode: "vn", points: 2.45 },
];
