import { describe, expect, it } from "vitest";
import { isChunkErrorMessage } from "../chunkError";

describe("isChunkErrorMessage", () => {
  // Mỗi browser một wording — thiếu chuỗi Safari từng làm ChunkErrorBoundary
  // hiện lỗi generic thay vì tự reload (sự cố live 2026-07-19).
  it.each([
    "Importing a module script failed.", // Safari / WKWebView
    "Failed to fetch dynamically imported module: https://x/assets/a-1f2e.js", // Chrome
    "error loading dynamically imported module", // Firefox
    "Loading chunk 42 failed", // webpack
    "ChunkLoadError: timeout",
    "Unexpected token '<'", // SPA fallback trả HTML thay JS
  ])("nhận diện %s", (msg) => {
    expect(isChunkErrorMessage(msg)).toBe(true);
  });

  // Nhóm thứ hai: chunk TẢI ĐƯỢC nhưng sai thế hệ (entry cũ + vendor mới sau
  // deploy) → engine ném lỗi lúc link module vì binding đã biến mất. Cùng một
  // nguyên nhân với nhóm trên, nhưng KHÔNG dùng chung một chữ nào — nên phải
  // liệt kê riêng. Ba dòng trên iOS Safari ngày 01–04/09/2026 ở
  // /vi/blog/lich-thi-dau-pickleball-world-cup-2026-da-nang lọt hết xuống UI
  // lỗi generic vì thiếu đúng nhóm này.
  it.each([
    "Importing binding name 'p' is not found.", // Safari / WKWebView
    "SyntaxError: The requested module './x-a1b2.js' does not provide an export named 'ke'", // Chrome / V8
    "SyntaxError: The requested module './x.js' doesn't provide an export named 'a'", // Firefox (modern)
    "SyntaxError: import not found: default", // Firefox
    "SyntaxError: ambiguous import: p", // Firefox
    "SyntaxError: ambiguous indirect export: p", // Firefox
    "Importing binding name 'default' cannot be resolved by star export entries.", // JSC, barrel re-export
  ])("nhận diện lỗi export lệch phiên bản: %s", (msg) => {
    expect(isChunkErrorMessage(msg)).toBe(true);
  });

  // Tên binding là output của minifier, đổi mỗi build — khớp theo tiền tố cố
  // định, không theo tên cụ thể.
  it("không phụ thuộc tên binding cụ thể", () => {
    expect(isChunkErrorMessage("Importing binding name 'zZ9' is not found.")).toBe(true);
  });

  it("bỏ qua lỗi thường và giá trị không phải string", () => {
    expect(isChunkErrorMessage("Cannot read properties of undefined")).toBe(false);
    expect(isChunkErrorMessage("Failed to load resource")).toBe(false);
    expect(isChunkErrorMessage("NetworkError when attempting to fetch resource.")).toBe(false);
    // "import not found" không neo dấu hai chấm sẽ nuốt cả thông báo của
    // luồng bulk-import bên Shop — biến một bug Shop thành vòng lặp reload.
    expect(isChunkErrorMessage("Bulk import not found for this seller")).toBe(false);
    expect(isChunkErrorMessage("Ambiguous import in row 3")).toBe(false);
    expect(isChunkErrorMessage(undefined)).toBe(false);
    expect(isChunkErrorMessage(new Error("Importing a module script failed."))).toBe(false);
  });
});
