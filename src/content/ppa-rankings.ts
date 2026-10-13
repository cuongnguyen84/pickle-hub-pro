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
export const PPA_WPR_FETCHED_AT = "2026-10-13";

export const PPA_WPR_SOURCE_URL = "https://www.ppatour.com/rankings/";

export const PPA_WPR_MEN: PpaRankingEntry[] = [
  { rank: 1, name: "Ben Johns", points: 16972.5, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 2, name: "Gabriel Tardio", points: 12748.75, eventsPlayed: 0, country: "Bolivia", countryCode: "bo" },
  { rank: 3, name: "Hayden Patriquin", points: 12267.5, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 4, name: "Federico Staksrud", points: 11405, eventsPlayed: 0, country: "Argentina", countryCode: "ar" },
  { rank: 5, name: "Christian Alshon", points: 11090, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 6, name: "Andrei Daescu", points: 9755, eventsPlayed: 0, country: "Romania", countryCode: "ro" },
  { rank: 7, name: "JW Johnson", points: 9460.625, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 8, name: "CJ Klinger", points: 5920, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 9, name: "Eric Oncins", points: 5246.25, eventsPlayed: 0, country: "Brazil", countryCode: "br" },
  { rank: 10, name: "Noe Khlif", points: 4870, eventsPlayed: 0, country: "France", countryCode: "fr" },
  { rank: 11, name: "Tama Shimabukuro", points: 4774.375, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 12, name: "Dylan Frazier", points: 3928.75, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 13, name: "Christopher Haworth", points: 3583.75, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 14, name: "Connor Garnett", points: 3577.5, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 15, name: "Hunter Johnson", points: 3301.875, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 16, name: "Jaume Martinez Vich", points: 3142.5, eventsPlayed: 0, country: "Spain", countryCode: "es" },
  { rank: 17, name: "Len Yang", points: 3118.125, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 18, name: "Augustus Ge", points: 3041.25, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 19, name: "Armaan Bhatia", points: 2808.75, eventsPlayed: 0, country: "India", countryCode: "in" },
  { rank: 20, name: "Roscoe Bellamy", points: 2808.75, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 21, name: "Hong kit Wong", points: 2742.5, eventsPlayed: 0, country: "Hong Kong S.A.R.", countryCode: "hk" },
  { rank: 22, name: "Yuta Funemizu", points: 2493.125, eventsPlayed: 0, country: "Japan", countryCode: "jp" },
  { rank: 23, name: "Riley Newman", points: 2463.75, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 24, name: "Eunggwon KIM", points: 2430, eventsPlayed: 0, country: "South Korea", countryCode: "kr" },
  { rank: 25, name: "Jack Sock", points: 2420, eventsPlayed: 0, country: "United States", countryCode: "us" },
];

export const PPA_WPR_WOMEN: PpaRankingEntry[] = [
  { rank: 1, name: "Anna Leigh Waters", points: 21160, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 2, name: "Anna Bright", points: 16527.5, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 3, name: "Tyra Hurricane Black", points: 10640, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 4, name: "Jorja Johnson", points: 10203.75, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 5, name: "Catherine Parenteau", points: 8373.75, eventsPlayed: 0, country: "Canada", countryCode: "ca" },
  { rank: 6, name: "Rachel Rohrabacher", points: 8237.5, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 7, name: "Parris Todd", points: 7720, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 8, name: "Kate Fahey", points: 7632.5, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 9, name: "Tina Pisnik", points: 5980, eventsPlayed: 0, country: "Slovenia", countryCode: "si" },
  { rank: 10, name: "Lacy Schneemann", points: 4778.125, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 11, name: "Kaitlyn Christian", points: 4201.25, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 12, name: "Chao Yi Wang", points: 4063.75, eventsPlayed: 0, country: "Chinese Taipei", countryCode: "tw" },
  { rank: 13, name: "Jessie Irvine", points: 3916.25, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 14, name: "Meghan Dizon", points: 3877.5, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 15, name: "Lea Jansen", points: 3807.5, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 16, name: "Alix Truong", points: 3466.25, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 17, name: "Brooke Buckner", points: 3286.25, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 18, name: "Jade Kawamoto", points: 3103.75, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 19, name: "Sahra Dennehy", points: 3021.25, eventsPlayed: 0, country: "Australia", countryCode: "au" },
  { rank: 20, name: "Ting Chieh Wei", points: 2900, eventsPlayed: 0, country: "Chinese Taipei", countryCode: "tw" },
  { rank: 21, name: "Milan Rane", points: 2753.125, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 22, name: "Mari Humberg", points: 2745.75, eventsPlayed: 0, country: "Brazil", countryCode: "br" },
  { rank: 23, name: "Callie Smith", points: 2491.25, eventsPlayed: 0, country: "United States", countryCode: "us" },
  { rank: 24, name: "Judit Castillo", points: 2479.375, eventsPlayed: 0, country: "Spain", countryCode: "es" },
  { rank: 25, name: "Lingwei Kong", points: 2420, eventsPlayed: 0, country: "China", countryCode: "cn" },
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
  { board: "women", rank: 16, name: "Alix Truong", countryCode: "us", points: 3466.25 },
  { board: "men", rank: 33, name: "Jonathan Truong", countryCode: "us", points: 1871.875 },
  { board: "men", rank: 34, name: "Hien Truong", countryCode: "vn", points: 1845 },
  { board: "men", rank: 38, name: "Luc Pham", countryCode: "us", points: 1713.625 },
  { board: "women", rank: 51, name: "Sophia Nhi Huynh", countryCode: "vn", points: 1168.75 },
  { board: "women", rank: 58, name: "Ho Tam", countryCode: "vn", points: 976.25 },
  { board: "men", rank: 60, name: "Quan Do", countryCode: "vn", points: 1167.5 },
  { board: "women", rank: 78, name: "Sophia Phuong Anh Tran", countryCode: "vn", points: 741 },
  { board: "men", rank: 92, name: "Hoang Nam Ly", countryCode: "vn", points: 600 },
  { board: "women", rank: 136, name: "NGOC SI", countryCode: "vn", points: 230 },
  { board: "men", rank: 167, name: "Giang Trinh", countryCode: "vn", points: 190 },
  { board: "men", rank: 204, name: "LE Xuan Duc", countryCode: "vn", points: 136.25 },
  { board: "men", rank: 208, name: "Nguyen Hung Anh", countryCode: "vn", points: 130 },
  { board: "men", rank: 224, name: "Hoang Nguyen Anh", countryCode: "vn", points: 105 },
  { board: "men", rank: 243, name: "HO Hoan", countryCode: "vn", points: 83.1 },
  { board: "men", rank: 256, name: "Tiến Đạt Lê", countryCode: "vn", points: 75 },
  { board: "women", rank: 258, name: "Tran Tue Ngoc", countryCode: "vn", points: 50 },
  { board: "men", rank: 266, name: "Hai Dang Ngo", countryCode: "vn", points: 70.625 },
  { board: "men", rank: 273, name: "Nguyen Huy", countryCode: "vn", points: 63.4 },
  { board: "women", rank: 274, name: "Binh Phan", countryCode: "vn", points: 42.5 },
  { board: "men", rank: 281, name: "Anh Pham", countryCode: "vn", points: 57.5 },
  { board: "men", rank: 297, name: "Carlos Rubio", countryCode: "vn", points: 50 },
  { board: "men", rank: 300, name: "Khuong Huynh", countryCode: "vn", points: 50 },
  { board: "men", rank: 337, name: "Nhật Minh T", countryCode: "vn", points: 38.4 },
  { board: "women", rank: 339, name: "Thuy Pham", countryCode: "vn", points: 25 },
  { board: "men", rank: 341, name: "Andrew Anh Pham", countryCode: "vn", points: 37.5 },
  { board: "men", rank: 343, name: "Khoa Vo", countryCode: "vn", points: 37.5 },
  { board: "men", rank: 398, name: "Ngoc Trieu Tran", countryCode: "vn", points: 25 },
  { board: "men", rank: 414, name: "Nguyen Thang", countryCode: "vn", points: 25 },
  { board: "men", rank: 464, name: "Minh Nhật", countryCode: "vn", points: 17.5 },
  { board: "men", rank: 481, name: "Nguyen Tien", countryCode: "vn", points: 16.25 },
  { board: "men", rank: 500, name: "Nguyễn Hoàng", countryCode: "vn", points: 15 },
  { board: "men", rank: 543, name: "Phong Tran", countryCode: "vn", points: 12.5 },
  { board: "men", rank: 546, name: "Nam Vu", countryCode: "vn", points: 12.5 },
  { board: "men", rank: 547, name: "Minh Nguyễn Hoàng", countryCode: "vn", points: 12.5 },
  { board: "men", rank: 549, name: "Tran Tuan Minh", countryCode: "vn", points: 12.5 },
  { board: "men", rank: 550, name: "Hoang Bao Long", countryCode: "vn", points: 12.5 },
  { board: "men", rank: 563, name: "quang tran", countryCode: "vn", points: 12.5 },
  { board: "men", rank: 581, name: "Pham XuanVu", countryCode: "vn", points: 11.25 },
];
