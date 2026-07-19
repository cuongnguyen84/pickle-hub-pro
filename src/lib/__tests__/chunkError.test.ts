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

  it("bỏ qua lỗi thường và giá trị không phải string", () => {
    expect(isChunkErrorMessage("Cannot read properties of undefined")).toBe(false);
    expect(isChunkErrorMessage(undefined)).toBe(false);
    expect(isChunkErrorMessage(new Error("Importing a module script failed."))).toBe(false);
  });
});
