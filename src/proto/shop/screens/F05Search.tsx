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
import { buyableProducts, shopById, type ProtoProduct } from "../fixtures";

/**
 * Facet counts are COMPUTED from the fixture catalogue, never typed in.
 * A hand-written "Carbon (11)" beside a six-product catalogue is an invented
 * metric — the reviewer would be judging a number the system cannot produce.
 * Small counts here are the honest shape of a pilot catalogue.
 */
const attr = (p: ProtoProduct, label: string) =>
  p.attributes.find((a) => a.label === label)?.value ?? "";

const countPaddles = (pred: (p: ProtoProduct) => boolean) =>
  buyableProducts().filter((p) => p.category === "vot" && pred(p)).length;

const opt = (value: string, label: string, pred: (p: ProtoProduct) => boolean) => ({
  value,
  label,
  count: countPaddles(pred),
});

const ozOf = (p: ProtoProduct) => parseFloat(attr(p, "Trọng lượng")) || 0;

export const PADDLE_FACETS: Facet[] = [
  {
    key: "trong-luong",
    label: "Trọng lượng",
    options: [
      opt("duoi-7-8", "Dưới 7.8 oz", (p) => ozOf(p) > 0 && ozOf(p) < 7.8),
      opt("7-8-8-2", "7.8 – 8.2 oz", (p) => ozOf(p) >= 7.8 && ozOf(p) <= 8.2),
      opt("tren-8-2", "Trên 8.2 oz", (p) => ozOf(p) > 8.2),
    ],
  },
  {
    key: "do-day",
    label: "Độ dày mặt vợt",
    options: ["13", "14", "16"].map((mm) =>
      opt(mm, `${mm} mm`, (p) => attr(p, "Độ dày mặt vợt").startsWith(mm)),
    ),
  },
  {
    key: "chat-lieu",
    label: "Chất liệu mặt",
    options: [
      opt("carbon", "Carbon", (p) => /carbon/i.test(attr(p, "Chất liệu mặt"))),
      opt("fiberglass", "Fiberglass", (p) => /fiberglass/i.test(attr(p, "Chất liệu mặt"))),
      opt("hybrid", "Kết hợp", (p) => /kết hợp/i.test(attr(p, "Chất liệu mặt"))),
    ],
  },
  {
    key: "loi",
    label: "Lõi",
    options: [
      opt("polymer", "Polymer tổ ong", (p) => /polymer/i.test(attr(p, "Lõi"))),
      opt("nomex", "Nomex", (p) => /nomex/i.test(attr(p, "Lõi"))),
    ],
  },
  {
    key: "dang-vot",
    label: "Dáng vợt",
    options: [
      opt("tieu-chuan", "Tiêu chuẩn", (p) => attr(p, "Dáng vợt") === "Tiêu chuẩn"),
      opt("thon-dai", "Thon dài", (p) => attr(p, "Dáng vợt") === "Thon dài"),
    ],
  },
  {
    key: "chu-vi-can",
    label: "Chu vi cán",
    options: ["10.5", "10.8", "11.2"].map((cm) =>
      opt(cm.replace(".", "-"), `${cm} cm`, (p) => attr(p, "Chu vi cán").startsWith(cm)),
    ),
  },
  {
    key: "loi-choi",
    label: "Lối chơi",
    options: [
      opt("control", "Kiểm soát", (p) => /control|dink/i.test(attr(p, "Lối chơi phù hợp"))),
      opt("tan-cong", "Tấn công", (p) => /tấn công/i.test(attr(p, "Lối chơi phù hợp"))),
      opt("all-court", "Toàn diện", (p) => /all-court/i.test(attr(p, "Lối chơi phù hợp"))),
    ],
  },
  {
    key: "tinh-trang",
    label: "Tình trạng",
    options: [
      opt("moi", "Mới", (p) => p.condition === "moi"),
      opt("cu", "Đã qua sử dụng", (p) => p.condition === "da-qua-su-dung"),
    ],
  },
  {
    key: "nguoi-ban",
    label: "Người bán",
    options: [
      opt("da-xac-minh", "Đã xác minh danh tính", (p) => !!shopById(p.shopId).verifiedMethod),
    ],
  },
  {
    key: "ton-kho",
    label: "Tình trạng bán",
    options: [
      opt("con-hang", "Chỉ hiện còn hàng", (p) =>
        p.variants.some((v) => v.stock === null || v.stock > 0),
      ),
    ],
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
Số kết quả nằm trong vùng thông báo động, nên trình đọc màn hình cũng biết bộ lọc vừa
        đổi kết quả — không chỉ người nhìn thấy. <strong>Số bên cạnh mỗi lựa chọn được tính
        từ dữ liệu mẫu</strong>, không phải số gõ tay: với kho hàng nhỏ thì nó nhỏ, và đó là
        sự thật.
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
        note="Mỗi chip có nút xoá riêng 44×44px và nhãn đọc được (“Bỏ lọc 16 mm”), không phải chỉ một dấu X trần."
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
