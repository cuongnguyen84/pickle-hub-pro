// ============================================================================
// What the seller is told when the publish worker refuses.
// ----------------------------------------------------------------------------
// The bug this file exists for: `supabase.functions.invoke` hands back the
// untouched Response and every call site threw it away, so a shop that is not
// active, an expired session and a rendition the worker rejected all reached
// the screen as one hardcoded sentence — and the real reason
// (rendition_metadata_present, the reason profile publish never worked from an
// iPhone) was never on screen, never in a client event, and never in a
// screenshot a seller could send.
//
// So the assertions are about the body being READ: the message the seller can
// act on, and the code they can screenshot.
// ============================================================================

import { describe, expect, it } from "vitest";
import { edgeError, edgeErrorMessage, shopErrorMessage } from "../errors";

const res = (body: unknown, status: number) =>
  new Response(typeof body === "string" ? body : JSON.stringify(body), { status });

describe("shopErrorMessage — the codes PostgREST answers in English", () => {
  // Postgres raises these three in English, so nothing the seller reads can
  // come from the raw message: each one has to be recognised by code and
  // answered with the next step, in Vietnamese.
  it.each([
    ["23505", /đã có nơi khác dùng/i],
    ["23514", /giá, tồn kho/i],
    ["PGRST116", /không tìm thấy bản ghi/i],
  ])("turns %s into something a seller can act on", (code, expected) => {
    const out = shopErrorMessage({ code, message: "duplicate key value violates unique constraint" });
    expect(out).toMatch(expected);
    // The constraint name is a schema disclosure and means nothing to a seller.
    expect(out).not.toContain("constraint");
  });
});

describe("edgeErrorMessage — reading the worker's answer", () => {
  it("pulls the reason out of failed[] when the worker half-published", async () => {
    // The production shape: publishProfile answers 502 with each item's own
    // error, and `error` is absent from the body entirely. The status is the
    // trap: publish_profile NEVER answers 422 — every rendition refusal it
    // reports arrives as 502 + failed[0].error, so keying the photo branch on
    // 422 told the seller to "wait a few minutes" about a photo no amount of
    // waiting will fix.
    const out = await edgeErrorMessage(
      new Error("Edge Function returned a non-2xx status code"),
      res({ ok: false, published: [], failed: [{ error: "rendition_metadata_present" }] }, 502),
    );

    expect(out.code).toBe("502 · rendition_metadata_present");
    expect(out.message).toContain("Thử chọn ảnh khác");
  });

  it("still blames the system, not the photo, for a 502 the photo did not cause", async () => {
    // copy_failed and commit_failed are the worker's own storage steps. They
    // arrive with the same status and the same shape as a rendition refusal —
    // so this is the case that says the 422 relaxation did not turn every 502
    // into "your photo is bad".
    const out = await edgeErrorMessage(
      new Error("Edge Function returned a non-2xx status code"),
      res({ ok: false, published: [], failed: [{ error: "copy_failed" }] }, 502),
    );

    expect(out.message).toContain("Lỗi từ phía hệ thống");
    expect(out.code).toContain("502 · copy_failed");
  });

  it("keeps the RPC's own Vietnamese refusal, then says what to do about it", async () => {
    const refusal = "shop đang ở trạng thái pending_activation nên chưa đưa ảnh lên trang công khai được";
    const out = await edgeErrorMessage(new Error("non-2xx"), res({ error: refusal }, 403));

    expect(out.message).toContain(refusal);
    expect(out.message).toContain("kích hoạt shop xong bấm lại là hiện");
    expect(out.code).toContain("403");
  });

  it("does not pass a raw Postgres string through as advice", async () => {
    // 42501 arrives as English from PostgREST; a seller can do nothing with it,
    // so it belongs in the code line, not in the sentence.
    const out = await edgeErrorMessage(
      new Error("non-2xx"),
      res({ error: "permission denied for function shop_profile_media_publish_prepare" }, 403),
    );

    expect(out.message).not.toContain("permission denied");
    expect(out.message).toContain("Lỗi từ phía hệ thống");
    expect(out.code).toContain("permission denied");
  });

  it("names an expired session, which is the one thing a retry cannot fix", async () => {
    const out = await edgeErrorMessage(new Error("non-2xx"), res({ msg: "JWT expired" }, 401));
    expect(out.message).toContain("Phiên đăng nhập đã hết hạn");
  });

  it("says it is the network when nothing came back at all", async () => {
    const aborted = Object.assign(new Error("aborted"), { name: "AbortError" });
    const out = await edgeErrorMessage(aborted, undefined);

    expect(out.message).toContain("Không kết nối được máy chủ");
    expect(out.code).toBe("AbortError");
  });

  it("blames the photo only when the server actually rejected the photo", async () => {
    const out = await edgeErrorMessage(new Error("non-2xx"), res({ error: "rendition_too_large" }, 422));
    expect(out.message).toContain("Thử chọn ảnh khác");
    expect(out.code).toBe("422 · rendition_too_large");
  });

  it("survives a body that is not JSON, and still shows something", async () => {
    const out = await edgeErrorMessage(new Error("non-2xx"), res("<html>gateway</html>", 500));
    expect(out.code).toContain("500");
    expect(out.message).toContain("Lỗi từ phía hệ thống");
  });

  it("keeps the code short enough to fit two lines on a 320px phone", async () => {
    const out = await edgeErrorMessage(new Error("non-2xx"), res({ error: "x".repeat(300) }, 502));
    expect(out.code.length).toBeLessThanOrEqual(80);
    expect(out.code.endsWith("…")).toBe(true);
  });

  it("carries the code on the thrown Error, so the screen can show both lines", () => {
    const thrown = edgeError({ message: "Không kết nối được máy chủ.", code: "502 · copy_failed" });
    expect(thrown).toBeInstanceOf(Error);
    expect(thrown.message).toContain("Không kết nối được");
    expect((thrown as Error & { code?: string }).code).toBe("502 · copy_failed");
  });
});
