// ============================================================================
// Postgres error → something a seller can act on.
// ----------------------------------------------------------------------------
// Two rules, and both are about what NOT to show:
//
//   * a raw Postgres string is noise to a seller and a schema disclosure to
//     everyone else, so nothing unrecognised is passed through;
//   * the RPCs already raise Vietnamese for everything a seller can cause, and
//     those messages are more specific than anything this file could invent —
//     "shop đang ở trạng thái suspended nên chưa đăng sản phẩm được" beats
//     "không lưu được". So a Vietnamese message wins over the code mapping.
// ============================================================================

const VIETNAMESE = /[àáâãèéêìíòóôõùúýăđĩũơưạảấầẩẫậắằẳẵặẹẻẽếềể]/i;

export function shopErrorMessage(error: unknown): string {
  const e = error as { code?: string; message?: string } | null;
  const raw = e?.message ?? "";
  if (VIETNAMESE.test(raw)) return raw;
  switch (e?.code) {
    // PT409 is what the RPCs raise for a stale expected version; PostgREST maps
    // it to HTTP 409. 40001 is kept only because Postgres itself can still
    // raise a genuine serialisation failure under load.
    case "PT409":
    case "40001":
      return "Bản ghi vừa được cập nhật ở nơi khác. Tải lại để xem bản mới nhất.";
    case "23505":
      return "Giá trị này đã có nơi khác dùng.";
    case "23514":
      // A CHECK the client mirror should have caught first. Saying which one
      // would leak the constraint name; saying nothing at all leaves the seller
      // clicking Save again.
      return "Có ô chưa hợp lệ. Kiểm tra lại giá, tồn kho và độ dài các ô chữ.";
    case "42501":
      return "Bạn không có quyền thực hiện thay đổi này.";
    case "PGRST116":
      return "Không tìm thấy bản ghi. Có thể nó vừa bị xoá hoặc ngừng bán.";
    default:
      return "Không lưu được. Thử lại giúp em.";
  }
}

/** True when the save lost a race, i.e. the screen must offer a reconcile
 *  rather than a plain retry. Both spellings occur: the RPC raises 40001 with
 *  a Vietnamese message, which the mapper passes through untouched. */
export const isConflict = (error: unknown) => {
  const e = error as { code?: string; message?: string } | null;
  return (
    e?.code === "PT409" ||
    e?.code === "40001" ||
    /phiên bản|cập nhật ở nơi khác/i.test(e?.message ?? "")
  );
};
