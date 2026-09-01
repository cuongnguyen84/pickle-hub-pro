// viBlogFetch là đường ra Supabase duy nhất của toàn bộ CMS tiếng Việt: trang
// công khai /vi/blog/:slug đọc qua nó, và admin tạo/sửa/xoá bài cũng qua nó.
// Trước file này chỉ nhánh THÀNH CÔNG được chạy (useViBlogPosts.slug.test.ts).
// Cái chưa ai kiểm là thang lấy câu lỗi khi server từ chối — và đó chính là
// câu chữ mà admin đọc được khi lưu bài thất bại. Một thang hỏng biến "slug đã
// tồn tại" thành "Internal Server Error", tức là biến lỗi sửa được thành lỗi
// không hiểu nổi.
import { afterEach, describe, it, expect, vi } from "vitest";

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getSession } },
}));

import { fetchPublishedViBlogPostBySlug } from "../useViBlogPosts";

afterEach(() => {
  vi.unstubAllGlobals();
  getSession.mockReset();
});

describe("viBlogFetch — thang câu lỗi khi server từ chối", () => {
  it("ưu tiên .message của PostgREST", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      statusText: "Bad Request",
      json: async () => ({ message: "duplicate key value violates unique constraint" }),
    }));

    await expect(fetchPublishedViBlogPostBySlug("hcmc-open-2026")).rejects.toThrow(
      "duplicate key value violates unique constraint",
    );
  });

  it("lùi về .error khi body không có .message", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      statusText: "Forbidden",
      json: async () => ({ error: "row-level security policy" }),
    }));

    await expect(fetchPublishedViBlogPostBySlug("hcmc-open-2026")).rejects.toThrow(
      "row-level security policy",
    );
  });

  it("lùi về statusText khi body lỗi không parse được — không ném SyntaxError", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: false,
      statusText: "Bad Gateway",
      json: async () => { throw new SyntaxError("Unexpected token < in JSON"); },
    }));

    await expect(fetchPublishedViBlogPostBySlug("hcmc-open-2026")).rejects.toThrow(
      "Bad Gateway",
    );
  });

  // Bài không tồn tại phải là DỮ LIỆU (mảng rỗng → null), không phải lỗi. Đây
  // là lý do query bỏ header pgrst.object+json: có nó thì PostgREST trả 406
  // cho slug không tồn tại, và ViBlogPost sẽ hiện "Lỗi kết nối — Thử lại" cho
  // một URL không bao giờ chạy được.
  it("trả null cho slug không tồn tại thay vì ném lỗi", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));

    await expect(fetchPublishedViBlogPostBySlug("khong-co-bai-nay")).resolves.toBeNull();
  });
});
