// ============================================================================
// F05 — Search + filtering primitives matrix
// ?variant=sheet opens the mobile filter sheet on load (screenshot state).
// ============================================================================

import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { readVariant } from "../scenario";
import {
  ShopSearchField,
  FacetList,
  AppliedFilterChips,
  SortControl,
  ResultCount,
  FilterSheet,
  FilterSheetTrigger,
  useFilterState,
  type Facet,
} from "../components/SearchFilters";
import { MatrixSection, Cell, Cells } from "../components/Matrix";

export const PADDLE_FACETS: Facet[] = [
  {
    key: "trong-luong",
    label: "Trọng lượng",
    options: [
      { value: "duoi-7-8", label: "Dưới 7.8 oz", count: 3 },
      { value: "7-8-8-2", label: "7.8 – 8.2 oz", count: 9 },
      { value: "tren-8-2", label: "Trên 8.2 oz", count: 4 },
    ],
  },
  {
    key: "do-day",
    label: "Độ dày mặt vợt",
    options: [
      { value: "13", label: "13 mm", count: 5 },
      { value: "14", label: "14 mm", count: 6 },
      { value: "16", label: "16 mm", count: 8 },
    ],
  },
  {
    key: "chat-lieu",
    label: "Chất liệu mặt",
    options: [
      { value: "carbon", label: "Carbon", count: 11 },
      { value: "fiberglass", label: "Fiberglass", count: 4 },
      { value: "hybrid", label: "Kết hợp", count: 2 },
    ],
  },
  {
    key: "loi",
    label: "Lõi",
    options: [
      { value: "polymer", label: "Polymer tổ ong", count: 14 },
      { value: "nomex", label: "Nomex", count: 1 },
    ],
  },
  {
    key: "dang-vot",
    label: "Dáng vợt",
    options: [
      { value: "tieu-chuan", label: "Tiêu chuẩn", count: 9 },
      { value: "thon-dai", label: "Thon dài", count: 6 },
    ],
  },
  {
    key: "chu-vi-can",
    label: "Chu vi cán",
    options: [
      { value: "10-5", label: "10.5 cm", count: 4 },
      { value: "10-8", label: "10.8 cm", count: 8 },
      { value: "11-2", label: "11.2 cm", count: 3 },
    ],
  },
  {
    key: "loi-choi",
    label: "Lối chơi",
    options: [
      { value: "control", label: "Kiểm soát", count: 7 },
      { value: "tan-cong", label: "Tấn công", count: 6 },
      { value: "all-court", label: "Toàn diện", count: 4 },
    ],
  },
  {
    key: "tinh-trang",
    label: "Tình trạng",
    options: [
      { value: "moi", label: "Mới", count: 12 },
      { value: "cu", label: "Đã qua sử dụng", count: 5 },
    ],
  },
  {
    key: "nguoi-ban",
    label: "Người bán",
    options: [{ value: "da-xac-minh", label: "Đã xác minh danh tính", count: 13 }],
  },
  {
    key: "ton-kho",
    label: "Tình trạng bán",
    options: [{ value: "con-hang", label: "Chỉ hiện còn hàng", count: 15 }],
  },
];

export default function F05Search() {
  const location = useLocation();
  const wantsSheet = readVariant(location.search) === "sheet";
  const f = useFilterState({ "do-day": ["16"], "chat-lieu": ["carbon"] });
  const [q, setQ] = useState("vợt carbon");
  const [sort, setSort] = useState("moi-nhat");
  const [count, setCount] = useState(8);

  useEffect(() => {
    if (wantsSheet) f.setSheetOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantsSheet]);

  return (
    <main className="tl-shop-page">
      <p className="tl-shop-eyebrow">F05</p>
      <h1 className="tl-shop-h1">Thành phần tìm kiếm &amp; lọc</h1>
      <p className="tl-shop-sub">
        Số kết quả nằm trong vùng thông báo động, nên trình đọc màn hình cũng biết bộ lọc
        vừa đổi kết quả — không chỉ người nhìn thấy.
      </p>

      <MatrixSection id="f05-field" title="ShopSearchField">
        <Cells min={260}>
          <Cell label="Trống">
            <ShopSearchField value="" onChange={() => {}} id="f05-a" />
          </Cell>
          <Cell label="Có từ khoá (hiện nút xoá)">
            <ShopSearchField value={q} onChange={setQ} id="f05-b" />
          </Cell>
        </Cells>
      </MatrixSection>

      <MatrixSection
        id="f05-chips"
        title="AppliedFilterChips + Sort + số kết quả"
        note="Mỗi chip có nút xoá riêng 28px và nhãn đọc được (“Bỏ lọc 16 mm”), không phải chỉ một dấu X trần."
      >
        <div className="tl-shop-toolbar">
          <SortControl value={sort} onChange={setSort} />
          <FilterSheetTrigger onOpen={() => f.setSheetOpen(true)} applied={f.applied} />
          <span className="tl-proto-spacer" />
          <ResultCount count={count} query={q} />
        </div>
        <AppliedFilterChips
          facets={PADDLE_FACETS}
          applied={f.applied}
          onRemove={f.remove}
          onClearAll={f.clear}
        />
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" className="tl-shop-btn tl-shop-btn--sm" onClick={() => setCount((c) => c + 3)}>
            Giả lập thêm kết quả
          </button>
          <button type="button" className="tl-shop-btn tl-shop-btn--sm" onClick={() => setCount(0)}>
            Giả lập 0 kết quả
          </button>
        </div>
      </MatrixSection>

      <MatrixSection
        id="f05-rail"
        title="FilterRail (máy tính) — 10 nhóm lọc cho vợt"
        note="Trên máy tính, bộ lọc luôn hiện, không giấu sau nút. Mỗi lựa chọn có vùng bấm cao 44px kể cả trên chuột."
      >
        <div style={{ maxWidth: 300 }}>
          <FacetList facets={PADDLE_FACETS} applied={f.applied} onToggle={f.toggle} idPrefix="rail" />
        </div>
      </MatrixSection>

      <MatrixSection
        id="f05-sheet"
        title="FilterSheet (điện thoại)"
        note="Mở bằng nút Bộ lọc ở trên. Đóng bằng Esc hoặc nút X; tiêu điểm bàn phím quay lại đúng nút vừa bấm."
      >
        <button type="button" className="tl-shop-btn" onClick={() => f.setSheetOpen(true)}>
          Mở bảng lọc
        </button>
      </MatrixSection>

      <FilterSheet
        open={f.sheetOpen}
        onClose={() => f.setSheetOpen(false)}
        count={count}
        onClear={f.clear}
      >
        <FacetList facets={PADDLE_FACETS} applied={f.applied} onToggle={f.toggle} idPrefix="sheet" />
      </FilterSheet>
    </main>
  );
}
