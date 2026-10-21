/** @vitest-environment jsdom */
// ============================================================================
// The upload state machine, and the one thing it must never do
// ----------------------------------------------------------------------------
// Four phases per file — process, upload the original, upload the rendition,
// finalize — and the whole reason this is one machine shared by product media
// and shop logo/cover is that two copies would be two places for a
// half-uploaded photo to be reported as done.
//
// So the assertions that matter most are the negative ones: an original that
// lands while the rendition fails is NOT complete, and a finalize that rejects
// is NOT complete. A seller who is told "Xong" and finds a missing image later
// has been lied to by a progress indicator.
//
// processImage is mocked because it is a different unit with its own test
// file; everything under test here — the phase transitions, the token reuse,
// the abort handling, the per-file isolation, the object-URL release — is the
// real hook.
// ============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

const upload = vi.fn();
const rpc = vi.fn();
const processImage = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { storage: { from: () => ({ upload }) } },
}));
vi.mock("@/integrations/supabase/shop-client", () => ({ shopRpc: (...args: unknown[]) => rpc(...args) }));
vi.mock("@/lib/shop/errors", () => ({ shopErrorMessage: (e: Error) => `mapped: ${e.message}` }));
vi.mock("@/lib/shop/imagePipeline", async () => {
  const actual = await vi.importActual<typeof import("@/lib/shop/imagePipeline")>(
    "@/lib/shop/imagePipeline",
  );
  return { ...actual, processImage: (...args: unknown[]) => processImage(...args) };
});

const {
  useMediaUpload,
  productMediaTarget,
  profileMediaTarget,
  isBusy,
  PHASE_LABEL,
} = await import("../useMediaUpload");

const fileNamed = (name: string, type = "image/jpeg", size = 2048) => {
  const file = new File(["x"], name, { type });
  Object.defineProperty(file, "size", { value: size });
  return file;
};

const okInit = (id = "media-1") => ({
  media_id: id,
  draft_path: `shop/prod/${id}/original`,
  rendition_path: `shop/prod/${id}/rendition.webp`,
});

/** A target whose two RPCs are spies, so the hook's contract is visible. */
const spyTarget = (over: Record<string, unknown> = {}) => ({
  init: vi.fn(async () => okInit()),
  finalize: vi.fn(async () => ({ ok: true })),
  onSettled: vi.fn(),
  ...over,
}) as unknown as Parameters<typeof useMediaUpload>[0] & {
  init: ReturnType<typeof vi.fn>;
  finalize: ReturnType<typeof vi.fn>;
  onSettled: ReturnType<typeof vi.fn>;
};

let createdUrls: string[] = [];
let revokedUrls: string[] = [];

beforeEach(() => {
  createdUrls = [];
  revokedUrls = [];
  upload.mockReset().mockResolvedValue({ error: null });
  rpc.mockReset().mockResolvedValue(okInit());
  processImage.mockReset().mockResolvedValue({ blob: new Blob(["r"], { type: "image/webp" }), width: 800, height: 600, sourceType: "image/jpeg" });
  vi.stubGlobal("URL", {
    ...URL,
    createObjectURL: vi.fn((f: File) => { const u = `blob:${f.name}`; createdUrls.push(u); return u; }),
    revokeObjectURL: vi.fn((u: string) => { revokedUrls.push(u); }),
  });
});
afterEach(() => vi.unstubAllGlobals());

describe("a file that works", () => {
  it("walks every phase and ends complete, then tells the caller to refetch", async () => {
    const target = spyTarget();
    const { result } = renderHook(() => useMediaUpload(target));

    await act(async () => { result.current.add([fileNamed("anh.jpg")]); });
    await waitFor(() => expect(result.current.items[0].phase).toBe("complete"));

    // Both objects, in order: the original the seller chose, then the rendition.
    expect(upload).toHaveBeenCalledTimes(2);
    expect(upload.mock.calls[0][0]).toContain("/original");
    // The original goes up as exactly what the seller picked.
    expect(upload.mock.calls[0][2]).toMatchObject({ contentType: "image/jpeg" });
    expect(upload.mock.calls[1][0]).toContain("/rendition.webp");
    // The rendition's contentType is whatever the pipeline produced — it is
    // the value Storage records in storage.objects, which finalize verifies.
    expect(upload.mock.calls[1][2]).toMatchObject({ contentType: "image/webp" });
    expect(target.finalize).toHaveBeenCalledWith({ mediaId: "media-1", width: 800, height: 600 });
    expect(target.onSettled).toHaveBeenCalledTimes(1);
    expect(result.current.items[0].mediaId).toBe("media-1");
  });

  it("uploads a JPEG rendition as image/jpeg — under a key that still ends .webp", async () => {
    // The iOS Safari fallback. The path is the DB's claim and never changes;
    // extension is a claim; the MIME in storage.objects is the truth.
    processImage.mockResolvedValue({
      blob: new Blob(["r"], { type: "image/jpeg" }), width: 800, height: 600, sourceType: "image/jpeg",
    });
    const { result } = renderHook(() => useMediaUpload(spyTarget()));

    await act(async () => { result.current.add([fileNamed("anh.jpg")]); });
    await waitFor(() => expect(result.current.items[0].phase).toBe("complete"));

    expect(upload.mock.calls[1][0]).toMatch(/\.webp$/);
    expect(upload.mock.calls[1][2]).toMatchObject({ contentType: "image/jpeg" });
  });

  it("mints one token per file and hands the same one to init", async () => {
    const target = spyTarget();
    const { result } = renderHook(() => useMediaUpload(target));
    await act(async () => { result.current.add([fileNamed("a.jpg")]); });
    await waitFor(() => expect(target.init).toHaveBeenCalled());
    expect(target.init.mock.calls[0][0].token).toBe(result.current.items[0].token);
  });

  it("reports phases, never a percentage", () => {
    // A percentage driven by a timer is a lie the first time it sits at 90%.
    for (const label of Object.values(PHASE_LABEL)) expect(label).not.toMatch(/%|\d/);
    expect(isBusy("processing")).toBe(true);
    expect(isBusy("finalizing")).toBe(true);
    expect(isBusy("complete")).toBe(false);
    expect(isBusy("failed")).toBe(false);
    expect(isBusy("cancelled")).toBe(false);
  });
});

describe("a file that does not work", () => {
  it("🔴 does NOT report complete when the rendition upload fails after the original landed", async () => {
    upload
      .mockResolvedValueOnce({ error: null })
      .mockResolvedValueOnce({ error: new Error("rendition rejected") });
    const target = spyTarget();
    const { result } = renderHook(() => useMediaUpload(target));

    await act(async () => { result.current.add([fileNamed("anh.jpg")]); });
    await waitFor(() => expect(result.current.items[0].phase).toBe("failed"));

    expect(result.current.items[0].phase).not.toBe("complete");
    expect(target.finalize).not.toHaveBeenCalled();
    expect(target.onSettled).not.toHaveBeenCalled();
    expect(result.current.items[0].error).toContain("rendition rejected");
  });

  it("🔴 does NOT report complete when finalize rejects", async () => {
    const target = spyTarget({ finalize: vi.fn(async () => { throw new Error("verify failed"); }) });
    const { result } = renderHook(() => useMediaUpload(target));

    await act(async () => { result.current.add([fileNamed("anh.jpg")]); });
    await waitFor(() => expect(result.current.items[0].phase).toBe("failed"));

    expect(result.current.items[0].phase).not.toBe("complete");
    expect(target.onSettled).not.toHaveBeenCalled();
  });

  it("keeps an ImageRejected message as written instead of mapping it to a server error", async () => {
    const { ImageRejected } = await import("@/lib/shop/imagePipeline");
    processImage.mockRejectedValueOnce(new ImageRejected("Trình duyệt này chưa xử lý được ảnh HEIC."));
    const { result } = renderHook(() => useMediaUpload(spyTarget()));

    await act(async () => { result.current.add([fileNamed("anh.heic")]); });
    await waitFor(() => expect(result.current.items[0].phase).toBe("failed"));
    // The pipeline already said what to do about it; re-mapping would replace
    // the iPhone advice with a generic network sentence.
    expect(result.current.items[0].error).toBe("Trình duyệt này chưa xử lý được ảnh HEIC.");
    expect(result.current.items[0].error).not.toMatch(/^mapped:/);
  });

  it("maps anything else through the shared error mapper", async () => {
    const target = spyTarget({ init: vi.fn(async () => { throw new Error("PGRST301"); }) });
    const { result } = renderHook(() => useMediaUpload(target));
    await act(async () => { result.current.add([fileNamed("anh.jpg")]); });
    await waitFor(() => expect(result.current.items[0].error).toBe("mapped: PGRST301"));
  });

  it("lets one file fail without taking the others down", async () => {
    processImage
      .mockRejectedValueOnce(new Error("first is broken"))
      .mockResolvedValue({ blob: new Blob(["r"]), width: 10, height: 10, sourceType: "image/jpeg" });
    const { result } = renderHook(() => useMediaUpload(spyTarget()));

    await act(async () => { result.current.add([fileNamed("hong.jpg"), fileNamed("tot.jpg")]); });
    await waitFor(() => expect(result.current.items.every((i) => !isBusy(i.phase))).toBe(true));

    expect(result.current.items.map((i) => i.phase).sort()).toEqual(["complete", "failed"]);
  });
});

describe("retry, cancel and remove", () => {
  it("re-runs only the failed file, reusing its token so the server deduplicates", async () => {
    processImage.mockRejectedValueOnce(new Error("nope"));
    const target = spyTarget();
    const { result } = renderHook(() => useMediaUpload(target));

    await act(async () => { result.current.add([fileNamed("anh.jpg")]); });
    await waitFor(() => expect(result.current.items[0].phase).toBe("failed"));
    const token = result.current.items[0].token;

    await act(async () => { result.current.retry(token); });
    await waitFor(() => expect(result.current.items[0].phase).toBe("complete"));

    // Same token on both attempts: a retry after a timeout the browser never
    // saw the answer to must reattach, not leave an orphan row behind.
    expect(target.init).toHaveBeenCalledTimes(1);
    expect(target.init.mock.calls[0][0].token).toBe(token);
    expect(result.current.items).toHaveLength(1);
  });

  it("cancels into `cancelled`, and never finalizes afterwards", async () => {
    let release: (v: unknown) => void = () => {};
    processImage.mockImplementationOnce(() => new Promise((r) => { release = r; }));
    const target = spyTarget();
    const { result } = renderHook(() => useMediaUpload(target));

    await act(async () => { result.current.add([fileNamed("anh.jpg")]); });
    await waitFor(() => expect(result.current.items[0].phase).toBe("processing"));

    await act(async () => {
      result.current.cancel(result.current.items[0].token);
      release({ blob: new Blob(["r"]), width: 10, height: 10, sourceType: "image/jpeg" });
    });

    await waitFor(() => expect(result.current.items[0].phase).toBe("cancelled"));
    expect(target.finalize).not.toHaveBeenCalled();
    expect(target.onSettled).not.toHaveBeenCalled();
  });

  it("releases the preview URL when an item is removed", async () => {
    const { result } = renderHook(() => useMediaUpload(spyTarget()));
    await act(async () => { result.current.add([fileNamed("anh.jpg")]); });
    await waitFor(() => expect(result.current.items[0].phase).toBe("complete"));

    const url = result.current.items[0].previewUrl!;
    await act(async () => { result.current.remove(result.current.items[0].token); });

    expect(result.current.items).toHaveLength(0);
    expect(revokedUrls).toContain(url);
  });

  it("clears finished items but keeps failures on screen", async () => {
    processImage
      .mockResolvedValueOnce({ blob: new Blob(["r"]), width: 10, height: 10, sourceType: "image/jpeg" })
      .mockRejectedValueOnce(new Error("nope"));
    const { result } = renderHook(() => useMediaUpload(spyTarget()));

    await act(async () => { result.current.add([fileNamed("tot.jpg"), fileNamed("hong.jpg")]); });
    await waitFor(() => expect(result.current.items.every((i) => !isBusy(i.phase))).toBe(true));

    await act(async () => { result.current.clearComplete(); });

    // A file that did not upload must not vanish quietly — that is how a
    // seller ends up with a product missing an image they believe they added.
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].phase).toBe("failed");
    expect(revokedUrls).toHaveLength(1);
  });

  it("reports busy only while something is actually in flight", async () => {
    let release: (v: unknown) => void = () => {};
    processImage.mockImplementationOnce(() => new Promise((r) => { release = r; }));
    const { result } = renderHook(() => useMediaUpload(spyTarget()));

    await act(async () => { result.current.add([fileNamed("anh.jpg")]); });
    await waitFor(() => expect(result.current.busy).toBe(true));
    await act(async () => { release({ blob: new Blob(["r"]), width: 10, height: 10, sourceType: "image/jpeg" }); });
    await waitFor(() => expect(result.current.busy).toBe(false));
  });
});

describe("the two targets differ in three strings and nothing else", () => {
  it("product media inits and finalizes through the product RPCs", async () => {
    const onSettled = vi.fn();
    const target = productMediaTarget("prod-9", onSettled);
    await target.init({ contentType: "image/png", byteSize: 10, filename: "a.png", token: "tok" });
    expect(rpc).toHaveBeenCalledWith("product_media_upload_init", expect.objectContaining({
      _product_id: "prod-9", _client_token: "tok", _content_type: "image/png",
    }));
    await target.finalize({ mediaId: "m1", width: 4, height: 5 });
    expect(rpc).toHaveBeenLastCalledWith("product_media_finalize", { _media_id: "m1", _width: 4, _height: 5 });
    expect(target.cap).toBeUndefined();
  });

  it("a logo is capped smaller than a cover, because it renders at 96px", () => {
    expect(profileMediaTarget("shop-1", "logo", vi.fn()).cap).toBe(512);
    expect(profileMediaTarget("shop-1", "cover", vi.fn()).cap).toBe(2048);
  });

  it("profile media carries the purpose the server checks", async () => {
    const target = profileMediaTarget("shop-1", "cover", vi.fn());
    await target.init({ contentType: "image/webp", byteSize: 10, filename: "c.webp", token: "tok2" });
    expect(rpc).toHaveBeenCalledWith("shop_profile_media_upload_init", expect.objectContaining({
      _shop_id: "shop-1", _purpose: "cover", _client_token: "tok2",
    }));
  });
});
