// ============================================================================
// Bảng thông số kỹ thuật — một bản, hai chỗ dùng.
// ----------------------------------------------------------------------------
// Trang sản phẩm và bản xem trước của người bán phải hiện y hệt nhau: bản xem
// trước mà khác trang thật thì nó không còn là bản xem trước.
//
// Không có gì để hiện thì trả null, không phải một khối "Chưa có thông số" —
// một bảng rỗng chiếm chỗ và không nói thêm điều gì.
// ============================================================================

import { specRows, type Specs } from "@/lib/shop/productSpecs";

export function SpecList({
  categorySlug,
  specs,
  headingId = "pdp-specs",
}: {
  categorySlug: string | null | undefined;
  specs: Specs | null | undefined;
  headingId?: string;
}) {
  const rows = specRows(categorySlug, specs);
  if (rows.length === 0) return null;

  return (
    <section aria-labelledby={headingId}>
      <h2 className="tl-shop-h2" id={headingId}>
        Thông số
      </h2>
      <dl className="tl-pdp-specs">
        {rows.map((row) => (
          <div key={row.key}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
      <p className="tl-shop-hint tl-shop-flush-b">Thông số do shop tự khai.</p>
    </section>
  );
}
