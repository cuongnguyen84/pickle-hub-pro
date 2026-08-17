/** @vitest-environment jsdom */
/**
 * The media sections, from the buttons a seller presses to the RPC arguments.
 *
 * `useMediaUpload.test.tsx` already owns the upload state machine. Only the
 * upload hook is doubled here, so this file tests the part that has no test:
 * the component's wiring, and every place it could send the right RPC with the
 * wrong subject.
 *
 *   · reorder sends the WHOLE list in its new order plus the product version.
 *     A partial list leaves photos at stale positions; a missing version lets
 *     two tabs each decide the order.
 *   · delete sends the id of the photo whose button was pressed. Off by one
 *     here deletes a different photo and there is no undo.
 *   · variant assignment names both the variant and the media.
 *   · logo and cover are the same component with a different `purpose`, and
 *     the purpose only exists inside the upload target — a swap would upload a
 *     cover into the logo slot with nothing on screen to show it.
 *   · a failed file keeps its Thử lại pointed at its own token, and a failure
 *     never renders as a finished photo.
 *   · every icon-only control has an accessible name that says which photo it
 *     acts on, because "Xoá" four times over is not a choice.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render as rtlRender, screen, waitFor } from "@testing-library/react";

import type { UploadItem, UploadTarget } from "@/hooks/shop/useMediaUpload";
import type { ProductMediaRow, ProductVariantRow, ShopState } from "@/integrations/supabase/shop-schema";

// ─── Doubles ────────────────────────────────────────────────────────────────

const shopRpc = vi.fn();
const createSignedUrls = vi.fn();
const functionsInvoke = vi.fn();
/** What useShopProfileMedia sees. Mutable, so a test can seed a verified row. */
let profileRows: unknown[] = [];

vi.mock("@/integrations/supabase/shop-client", () => ({
  shopRpc: (fn: string, args?: Record<string, unknown>) => shopRpc(fn, args),
  shopFrom: () => ({ select: () => ({ eq: () => Promise.resolve({ data: profileRows, error: null }) }) }),
  escapeLike: (s: string) => s,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    storage: { from: () => ({ createSignedUrls }) },
    functions: { invoke: (...args: unknown[]) => functionsInvoke(...args) },
  },
}));

// The real one posts to the production log endpoint. Doubled so the test can
// assert that a publish failure IS reported without sending anything.
const reportCaughtError = vi.fn();
vi.mock("@/lib/errorReporter", () => ({
  reportCaughtError: (...args: unknown[]) => reportCaughtError(...args),
}));

/** The upload hook, replaced by a handle the test drives. The real target
 *  builders are kept — they are the only place `purpose` is decided. */
const uploadHandle = {
  items: [] as UploadItem[],
  add: vi.fn(),
  retry: vi.fn(),
  remove: vi.fn(),
  clearComplete: vi.fn(),
};
const targets: UploadTarget[] = [];

vi.mock("@/hooks/shop/useMediaUpload", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/hooks/shop/useMediaUpload")>();
  return {
    ...actual,
    useMediaUpload: (target: UploadTarget) => {
      if (!targets.includes(target)) targets.push(target);
      return uploadHandle;
    },
  };
});

const { ProductMediaSection, ShopProfileMediaSection } = await import("../MediaEditor");

// ─── Fixtures ───────────────────────────────────────────────────────────────

const photo = (id: string, position: number, over: Partial<ProductMediaRow> = {}) =>
  ({
    id,
    product_id: "prod-1",
    position,
    draft_path: `draft/${id}.jpg`,
    rendition_source_path: null,
    public_path: null,
    verified_at: "2026-08-10T00:00:00Z",
    alt_text: null,
    original_filename: `${id}.jpg`,
    ...over,
  }) as unknown as ProductMediaRow;

const variant = (id: string, label: string, mediaId: string | null = null) =>
  ({ id, media_id: mediaId, option_values: { Màu: label } }) as unknown as ProductVariantRow;

const item = (over: Partial<UploadItem> = {}): UploadItem => ({
  token: "t1",
  file: new File(["x"], "a.jpg", { type: "image/jpeg" }),
  name: "a.jpg",
  phase: "queued",
  ...over,
});

/** A logo or cover the worker has verified but nobody has published yet. */
const verifiedRow = (purpose: "logo" | "cover") => ({
  id: `pm-${purpose}`,
  shop_id: "shop-1",
  purpose,
  draft_path: `shop-1/profile/${purpose}/pm/v1/original`,
  rendition_source_path: `shop-1/profile/${purpose}/pm/v1/rendition.webp`,
  public_path: null,
  focal_y: 0.5,
  version: 1,
  verified_at: "2026-08-17T00:00:00Z",
});

const onChanged = vi.fn();

const renderProduct = (over: Partial<Parameters<typeof ProductMediaSection>[0]> = {}) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return rtlRender(
    <QueryClientProvider client={client}>
      <ProductMediaSection
        productId="prod-1"
        productVersion={7}
        media={[photo("m1", 0), photo("m2", 1), photo("m3", 2)]}
        variants={[variant("v1", "Trắng"), variant("v2", "Đen")]}
        optionLabel={(v) => String((v as unknown as { option_values: Record<string, string> }).option_values.Màu)}
        disabled={false}
        onChanged={onChanged}
        {...over}
      />
    </QueryClientProvider>,
  );
};

const renderProfile = (disabled = false, shopState: ShopState = "active") => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return rtlRender(
    <QueryClientProvider client={client}>
      <ShopProfileMediaSection
        shopId="shop-1"
        shopState={shopState}
        disabled={disabled}
        onChanged={onChanged}
      />
    </QueryClientProvider>,
  );
};

const rpcCall = (fn: string) => shopRpc.mock.calls.find((c) => c[0] === fn);

beforeEach(() => {
  shopRpc.mockReset().mockResolvedValue([]);
  createSignedUrls.mockReset().mockResolvedValue({ data: [] });
  functionsInvoke.mockReset().mockResolvedValue({
    data: { ok: true, published: [], failed: [] },
    error: null,
  });
  profileRows = [];
  uploadHandle.items = [];
  uploadHandle.add.mockReset();
  uploadHandle.retry.mockReset();
  uploadHandle.remove.mockReset();
  uploadHandle.clearComplete.mockReset();
  targets.length = 0;
  onChanged.mockReset();
});
afterEach(cleanup);

// ─── Reorder ────────────────────────────────────────────────────────────────

describe("reordering photos", () => {
  it("sends the whole list in its new order, with the product version", async () => {
    renderProduct();

    fireEvent.click(screen.getByLabelText("Chuyển ảnh 3 lên trước"));

    await waitFor(() => expect(rpcCall("product_media_reorder")).toBeTruthy());
    // Not just the moved pair: a partial list leaves the others at stale
    // positions. And the version travels, so a second tab's order is refused.
    expect(rpcCall("product_media_reorder")![1]).toEqual({
      _product_id: "prod-1",
      _expected_version: 7,
      _media_ids: ["m1", "m3", "m2"],
    });
  });

  it("promotes a photo to the front when Ảnh chính is pressed", async () => {
    renderProduct();

    fireEvent.click(screen.getByLabelText("Đặt ảnh 3 làm ảnh chính"));

    await waitFor(() => expect(rpcCall("product_media_reorder")).toBeTruthy());
    expect(rpcCall("product_media_reorder")![1]._media_ids).toEqual(["m3", "m1", "m2"]);
  });

  it("sends the list moved down when the down arrow is pressed", () => {
    renderProduct();

    fireEvent.click(screen.getByLabelText("Chuyển ảnh 1 xuống sau"));

    return waitFor(() =>
      // Down from index 0 is not "up from index 1 with the arguments swapped":
      // the same wrong pair would satisfy the up-arrow test and silently move
      // the wrong photo here.
      expect(rpcCall("product_media_reorder")![1]._media_ids).toEqual(["m2", "m1", "m3"]),
    );
  });

  it("sends nothing at the ends of the list", () => {
    renderProduct();

    expect((screen.getByLabelText("Chuyển ảnh 1 lên trước") as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByLabelText("Chuyển ảnh 3 xuống sau") as HTMLButtonElement).disabled).toBe(true);
    // Nothing to promote when it is already the cover.
    expect(screen.queryByLabelText("Đặt ảnh 1 làm ảnh chính")).toBeNull();
    expect(shopRpc).not.toHaveBeenCalled();
  });

  it("orders by position, not by the order the rows arrived in", async () => {
    renderProduct({ media: [photo("m3", 2), photo("m1", 0), photo("m2", 1)] });

    fireEvent.click(screen.getByLabelText("Chuyển ảnh 2 lên trước"));

    await waitFor(() => expect(rpcCall("product_media_reorder")).toBeTruthy());
    expect(rpcCall("product_media_reorder")![1]._media_ids).toEqual(["m2", "m1", "m3"]);
  });

  it("shows a refusal instead of a silently unchanged order", async () => {
    shopRpc.mockRejectedValue({ code: "PT409" });
    renderProduct();

    fireEvent.click(screen.getByLabelText("Chuyển ảnh 2 lên trước"));

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain("Bản ghi vừa được cập nhật ở nơi khác"),
    );
  });
});

// ─── Delete ─────────────────────────────────────────────────────────────────

describe("deleting a photo", () => {
  it("deletes the one whose button was pressed", async () => {
    renderProduct();

    fireEvent.click(screen.getByLabelText("Xoá ảnh 2"));

    await waitFor(() => expect(rpcCall("product_media_delete")).toBeTruthy());
    expect(rpcCall("product_media_delete")![1]).toEqual({ _media_id: "m2" });
  });

  it("names every photo in its controls, so four buttons are four choices", () => {
    renderProduct();
    for (const n of [1, 2, 3]) expect(screen.getByLabelText(`Xoá ảnh ${n}`)).toBeTruthy();
    expect(screen.getAllByLabelText(/^Chuyển ảnh/)).toHaveLength(6);
  });

  it("says why when the server refuses", async () => {
    shopRpc.mockRejectedValue({ code: "42501" });
    renderProduct();

    fireEvent.click(screen.getByLabelText("Xoá ảnh 1"));

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain("không có quyền"),
    );
  });
});

// ─── Variant assignment ─────────────────────────────────────────────────────

describe("assigning a photo to a variant", () => {
  it("names both the variant and the photo", async () => {
    renderProduct();

    fireEvent.change(screen.getByLabelText("Đen"), { target: { value: "m3" } });

    await waitFor(() => expect(rpcCall("product_variant_set_media")).toBeTruthy());
    expect(rpcCall("product_variant_set_media")![1]).toEqual({ _variant_id: "v2", _media_id: "m3" });
  });

  it("clears the assignment with null rather than an empty string", async () => {
    renderProduct({ variants: [variant("v1", "Trắng", "m1"), variant("v2", "Đen", "m2")] });

    fireEvent.change(screen.getByLabelText("Trắng"), { target: { value: "" } });

    await waitFor(() => expect(rpcCall("product_variant_set_media")).toBeTruthy());
    expect(rpcCall("product_variant_set_media")![1]).toEqual({ _variant_id: "v1", _media_id: null });
  });

  it("says why the assignment did not stick instead of showing the new choice", async () => {
    // The select is uncontrolled between renders, so a silent failure leaves it
    // showing a photo the variant is not actually using.
    shopRpc.mockRejectedValue({ code: "PT409" });
    renderProduct();

    fireEvent.change(screen.getByLabelText("Đen"), { target: { value: "m3" } });

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain("Bản ghi vừa được cập nhật ở nơi khác"),
    );
  });

  it("is not offered for a product with one variant or no photos", () => {
    const { unmount } = renderProduct({ variants: [variant("v1", "Trắng")] });
    expect(screen.queryByText("Ảnh cho từng phiên bản")).toBeNull();
    unmount();

    renderProduct({ media: [] });
    expect(screen.queryByText("Ảnh cho từng phiên bản")).toBeNull();
    expect(screen.getByText("Chưa có ảnh nào.")).toBeTruthy();
  });
});

// ─── In-flight files ────────────────────────────────────────────────────────

describe("files on their way up", () => {
  it("hands the picked files to the upload pipeline", () => {
    renderProduct({ media: [] });
    const input = document.getElementById("pick-product-media") as HTMLInputElement;
    const files = [new File(["a"], "a.jpg", { type: "image/jpeg" }), new File(["b"], "b.png", { type: "image/png" })];

    fireEvent.change(input, { target: { files } });

    expect(uploadHandle.add).toHaveBeenCalledTimes(1);
    expect(uploadHandle.add.mock.calls[0][0].map((f: File) => f.name)).toEqual(["a.jpg", "b.png"]);
    // Reset, so picking the same file again still fires a change event.
    expect(input.value).toBe("");
  });

  it("shows each file its own phase, and does not let a failure hide a success", () => {
    uploadHandle.items = [
      item({ token: "t1", name: "a.jpg", phase: "uploading_original" }),
      item({ token: "t2", name: "b.jpg", phase: "failed", error: "Ảnh quá nặng" }),
      item({ token: "t3", name: "c.jpg", phase: "complete" }),
    ];
    renderProduct();

    expect(screen.getByText(/Đang tải ảnh gốc/)).toBeTruthy();
    expect(screen.getByText("Ảnh quá nặng")).toBeTruthy();
    expect(screen.getByText(/Xong/)).toBeTruthy();
    // Only the failed one offers a retry.
    expect(screen.getAllByRole("button", { name: "Thử lại" })).toHaveLength(1);
  });

  it("retries the file that failed, by its own token", () => {
    uploadHandle.items = [
      item({ token: "good", name: "a.jpg", phase: "complete" }),
      item({ token: "bad", name: "b.jpg", phase: "failed", error: "Hỏng" }),
    ];
    renderProduct();

    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));

    // The token IS the server's dedupe key. A new one on retry uploads twice.
    expect(uploadHandle.retry).toHaveBeenCalledWith("bad");
  });

  it("offers Huỷ while a file is busy and Bỏ once it is not", () => {
    uploadHandle.items = [
      item({ token: "busy", name: "a.jpg", phase: "processing" }),
      item({ token: "done", name: "b.jpg", phase: "cancelled" }),
    ];
    renderProduct();

    fireEvent.click(screen.getByRole("button", { name: /Huỷ/ }));
    expect(uploadHandle.remove).toHaveBeenCalledWith("busy");

    fireEvent.click(screen.getByRole("button", { name: /Bỏ/ }));
    expect(uploadHandle.remove).toHaveBeenCalledWith("done");
  });

  it("never renders an unfinished file as a photo of the product", () => {
    uploadHandle.items = [item({ phase: "finalizing" })];
    renderProduct({ media: [] });

    expect(screen.getByText(/Đang xác minh/)).toBeTruthy();
    // The product still has no photos: only the server's rows count.
    expect(screen.getByText("Chưa có ảnh nào.")).toBeTruthy();
    expect(screen.queryByLabelText(/^Xoá ảnh/)).toBeNull();
  });

  it("clears finished cards once the server rows arrive, and only then", () => {
    uploadHandle.items = [item({ phase: "failed", error: "Hỏng" })];
    const { unmount } = renderProduct();
    expect(uploadHandle.clearComplete).not.toHaveBeenCalled();
    unmount();

    uploadHandle.items = [item({ phase: "complete" })];
    renderProduct();
    expect(uploadHandle.clearComplete).toHaveBeenCalled();
  });

  it("stops offering the picker once the product is full", () => {
    renderProduct({ media: Array.from({ length: 8 }, (_, i) => photo(`m${i}`, i)) });

    expect((document.getElementById("pick-product-media") as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByText(/Đã đủ 8 ảnh/)).toBeTruthy();
  });
});

// ─── Logo and cover ─────────────────────────────────────────────────────────

describe("the shop logo and cover are one component with two purposes", () => {
  it("gives each slot an upload target carrying its own purpose", async () => {
    renderProfile();

    // The purpose is not on screen anywhere — it exists only inside the target,
    // so a swapped argument would upload a cover into the logo slot invisibly.
    for (const t of targets) {
      await t.init({ contentType: "image/jpeg", byteSize: 1000, filename: "x.jpg", token: "tok" });
    }
    const byPurpose = new Map(
      shopRpc.mock.calls
        .filter((c) => c[0] === "shop_profile_media_upload_init")
        .map((c) => [c[1]._purpose as string, c[1] as Record<string, unknown>]),
    );
    expect([...byPurpose.keys()].sort()).toEqual(["cover", "logo"]);
    expect(byPurpose.get("logo")!._shop_id).toBe("shop-1");
    // A logo rendered at 96px does not need 2048px of source; a cover does.
    const caps = new Set(targets.map((t) => t.cap));
    expect(caps.has(512)).toBe(true);
    expect(caps.size).toBe(2);
  });

  it("uses separate file inputs so a logo pick cannot land on the cover", () => {
    renderProfile();
    const logo = document.getElementById("pick-logo") as HTMLInputElement;
    const cover = document.getElementById("pick-cover") as HTMLInputElement;

    expect(logo).toBeTruthy();
    expect(cover).toBeTruthy();
    // One file each: a logo is not a gallery.
    expect(logo.multiple).toBe(false);
    expect(cover.multiple).toBe(false);
  });

  it("says nothing is there rather than showing an empty frame", () => {
    renderProfile();
    expect(screen.getByText(/Chưa có logo/)).toBeTruthy();
    expect(screen.getByText(/Chưa có ảnh bìa/)).toBeTruthy();
  });

  it("offers no upload, delete or framing while the shop is locked", () => {
    renderProfile(true);
    expect(document.getElementById("pick-logo")).toBeNull();
    expect(screen.queryByRole("button", { name: /Xoá/ })).toBeNull();
    expect(screen.queryByLabelText(/Vị trí khung ảnh/)).toBeNull();
  });
});

// ─── Publishing the logo and cover (round 5) ────────────────────────────────

describe("publishing the logo and cover", () => {
  it("attempts publish automatically once, right after a finalize settles", async () => {
    renderProfile();

    // The upload machine calls onSettled only after finalize resolved; the
    // slot's wrapper is what must then fire the publish leg.
    await act(async () => {
      targets[0].onSettled();
    });

    await waitFor(() =>
      expect(functionsInvoke).toHaveBeenCalledWith("shop-media-lifecycle", {
        body: { action: "publish_profile", shop_id: "shop-1" },
        // 20s < the 30s "nothing hangs without a button" rule, in code.
        timeout: 20_000,
      }),
    );
    expect(functionsInvoke).toHaveBeenCalledTimes(1);
    // And the screen is told to refetch — the server's rows, not a guess.
    expect(onChanged).toHaveBeenCalled();
  });

  it("does not fire at a shop the prepare RPC will refuse anyway", async () => {
    renderProfile(false, "pending_activation");

    await act(async () => {
      targets[0].onSettled();
    });

    // A 403 per upload is not information; the hint is.
    expect(functionsInvoke).not.toHaveBeenCalled();
    expect(onChanged).toHaveBeenCalled();
  });

  it("offers no button while the shop cannot publish, only what happens next", async () => {
    profileRows = [verifiedRow("logo")];
    renderProfile(false, "pending_activation");

    expect(await screen.findByText(/Shop được kích hoạt xong là ảnh tự lên trang shop/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Thử đưa logo/ })).toBeNull();
  });

  it("names the state a suspended shop is actually in", async () => {
    profileRows = [verifiedRow("logo")];
    renderProfile(false, "suspended");

    expect(await screen.findByText(/Shop đang ở trạng thái "Tạm ngưng"/)).toBeTruthy();
  });

  it("shows a verified-but-unpublished row honestly, with a working retry", async () => {
    profileRows = [verifiedRow("logo")];
    renderProfile();

    // The consequence, not the internal step: the shop page has no logo.
    expect(await screen.findByText(/Trang shop hiện chưa có logo/)).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Thử đưa logo lên trang shop lại" }));
    await waitFor(() =>
      expect(functionsInvoke).toHaveBeenCalledWith("shop-media-lifecycle", {
        body: { action: "publish_profile", shop_id: "shop-1" },
        timeout: 20_000,
      }),
    );
  });

  it("says what the worker actually refused, and shows the code to screenshot", async () => {
    profileRows = [verifiedRow("logo")];
    // The production 502: each item carries its own reason and the body has no
    // top-level `error` at all.
    functionsInvoke.mockResolvedValue({
      data: null,
      error: new Error("Edge Function returned a non-2xx status code"),
      response: new Response(
        JSON.stringify({ ok: false, published: [], failed: [{ error: "rendition_metadata_present" }] }),
        { status: 502 },
      ),
    });
    renderProfile();

    fireEvent.click(await screen.findByRole("button", { name: "Thử đưa logo lên trang shop lại" }));

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain("Thử chọn ảnh khác"),
    );
    expect(screen.getByText("502 · rendition_metadata_present")).toBeTruthy();
    // Reported once — and the reporter's own 5-minute dedupe means a second
    // press inside that window adds no second client event.
    expect(reportCaughtError).toHaveBeenCalledWith(expect.any(Error), "shop:publish_profile");
    // The upload pipeline reports nothing: the file DID upload and verify.
    expect(screen.queryByText("Chưa xong")).toBeNull();
  });

  it("keeps the seller's shop page refusal word for word", async () => {
    profileRows = [verifiedRow("logo")];
    functionsInvoke.mockResolvedValue({
      data: null,
      error: new Error("non-2xx"),
      response: new Response(
        JSON.stringify({ error: "shop đang ở trạng thái restricted nên chưa đưa ảnh lên trang công khai được" }),
        { status: 403 },
      ),
    });
    renderProfile();

    fireEvent.click(await screen.findByRole("button", { name: "Thử đưa logo lên trang shop lại" }));

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain("shop đang ở trạng thái restricted"),
    );
  });

  it("leaves a pressable button when the 20s timeout fires, not a dead sentence", async () => {
    profileRows = [verifiedRow("logo")];
    // What supabase-js hands back when its AbortController fires: no Response
    // at all, and the error only identifies itself by `name`. No fake timers
    // needed — the SHAPE is the contract, not the wall clock.
    functionsInvoke.mockResolvedValue({
      data: null,
      error: Object.assign(new Error("Failed to send a request to the Edge Function"), {
        name: "FunctionsFetchError",
      }),
      response: undefined,
    });
    renderProfile();

    fireEvent.click(await screen.findByRole("button", { name: "Thử đưa logo lên trang shop lại" }));

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain(
        "Không kết nối được máy chủ. Kiểm tra mạng rồi bấm Thử lại.",
      ),
    );
    expect(screen.getByText(/Mã lỗi:/)).toBeTruthy();
    // The rule this protects: nothing hangs past 30s without a button.
    const retry = screen.getByRole("button", {
      name: "Thử đưa logo lên trang shop lại",
    }) as HTMLButtonElement;
    expect(retry.disabled).toBe(false);
  });

  it("names an expired session, the one failure a retry cannot fix", async () => {
    profileRows = [verifiedRow("logo")];
    functionsInvoke.mockResolvedValue({
      data: null,
      error: new Error("non-2xx"),
      response: new Response(JSON.stringify({ error: "JWT expired" }), { status: 403 }),
    });
    renderProfile();

    fireEvent.click(await screen.findByRole("button", { name: "Thử đưa logo lên trang shop lại" }));

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain("Phiên đăng nhập đã hết hạn"),
    );
  });

  it("keeps Postgres' English out of the sentence and in the code line", async () => {
    profileRows = [verifiedRow("logo")];
    // A missing GRANT reads as English from PostgREST. A seller can do nothing
    // with it — but we need it in the screenshot, so it belongs in the code.
    functionsInvoke.mockResolvedValue({
      data: null,
      error: new Error("non-2xx"),
      response: new Response(
        JSON.stringify({ error: "permission denied for function shop_profile_media_publish_prepare" }),
        { status: 403 },
      ),
    });
    renderProfile();

    fireEvent.click(await screen.findByRole("button", { name: "Thử đưa logo lên trang shop lại" }));

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain("Lỗi từ phía hệ thống"),
    );
    expect(screen.getByRole("alert").textContent).not.toContain("permission denied");
    expect(screen.getByText(/permission denied for function/)).toBeTruthy();
  });

  it("clears the error line once a retry actually succeeds", async () => {
    profileRows = [verifiedRow("logo")];
    functionsInvoke
      .mockResolvedValueOnce({
        data: null,
        error: new Error("non-2xx"),
        response: new Response(
          JSON.stringify({ ok: false, published: [], failed: [{ error: "rendition_metadata_present" }] }),
          { status: 502 },
        ),
      })
      .mockResolvedValue({
        data: { ok: true, published: [{ media_id: "pm-logo", target: "public" }], failed: [] },
        error: null,
      });
    renderProfile();

    fireEvent.click(await screen.findByRole("button", { name: "Thử đưa logo lên trang shop lại" }));
    await waitFor(() => expect(screen.getByRole("alert")).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: "Thử đưa logo lên trang shop lại" }));

    // A stale red line under a publish that worked is worse than no line.
    await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
    expect(screen.queryByText(/Mã lỗi:/)).toBeNull();
  });

  it("does not call a 200 that says ok:false a success", async () => {
    profileRows = [verifiedRow("logo")];
    // No `error` at all — a body the SDK is happy with. Trusting the status
    // here is how a photo that was never copied reads as published.
    functionsInvoke.mockResolvedValue({
      data: { ok: false, published: [], failed: [{ media_id: "pm-logo", error: "rendition_too_large" }] },
      error: null,
    });
    renderProfile();

    fireEvent.click(await screen.findByRole("button", { name: "Thử đưa logo lên trang shop lại" }));

    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toContain("Thử chọn ảnh khác"),
    );
    expect(screen.getByText("200 · rendition_too_large")).toBeTruthy();
  });

  it("never hides the button while the call is in flight", async () => {
    profileRows = [verifiedRow("logo")];
    // A request that never settles — the state that used to leave the seller
    // with a sentence and nothing to press, forever.
    functionsInvoke.mockReturnValue(new Promise(() => {}));
    renderProfile();

    fireEvent.click(await screen.findByRole("button", { name: "Thử đưa logo lên trang shop lại" }));

    await waitFor(() => {
      const button = screen.getByRole("button", { name: "Đang đưa lên trang shop…" }) as HTMLButtonElement;
      expect(button.disabled).toBe(true);
    });
    expect(screen.getByRole("status").textContent).toContain("Đang đưa ảnh lên trang shop");
  });
});

// ─── Replacing and reframing the shop's own photos ──────────────────────────

describe("removing and reframing the logo and cover", () => {
  it("deletes the row of the slot whose button was pressed", async () => {
    // Only the logo exists, so only one Xoá is on screen — and it must carry
    // the logo's id: the cover is one row away in the same table.
    profileRows = [verifiedRow("logo")];
    renderProfile();

    fireEvent.click(await screen.findByRole("button", { name: /Xoá/ }));

    await waitFor(() => expect(rpcCall("shop_profile_media_delete")).toBeTruthy());
    expect(rpcCall("shop_profile_media_delete")![1]).toEqual({ _media_id: "pm-logo" });
  });

  it("says why a delete was refused instead of leaving the photo looking gone", async () => {
    profileRows = [verifiedRow("logo")];
    shopRpc.mockRejectedValue({ code: "42501" });
    renderProfile();

    fireEvent.click(await screen.findByRole("button", { name: /Xoá/ }));

    await waitFor(() =>
      expect(
        screen.getAllByRole("alert").some((el) => el.textContent?.includes("không có quyền")),
      ).toBe(true),
    );
  });

  it("sends the cover framing as a fraction, not the percent on the label", async () => {
    // The slider is 0–100 and the column is 0–1. Sending 80 stores a focal
    // point far outside the image and the shop header renders blank.
    profileRows = [verifiedRow("cover")];
    renderProfile();

    fireEvent.change(await screen.findByLabelText(/Vị trí khung ảnh/), { target: { value: "80" } });

    await waitFor(() => expect(rpcCall("shop_profile_media_set_focal")).toBeTruthy());
    expect(rpcCall("shop_profile_media_set_focal")![1]).toEqual({
      _media_id: "pm-cover",
      _focal_y: 0.8,
    });
  });

  it("clears a finished upload card once the server row is there", async () => {
    profileRows = [verifiedRow("logo")];
    uploadHandle.items = [item({ phase: "complete" })];
    renderProfile();

    await waitFor(() => expect(uploadHandle.clearComplete).toHaveBeenCalled());
  });
});

// ─── Locked product ─────────────────────────────────────────────────────────

describe("while the product is waiting for review", () => {
  it("shows the photos but offers no way to change them", () => {
    renderProduct({ disabled: true });

    expect(document.getElementById("pick-product-media")).toBeNull();
    expect(screen.queryByLabelText(/^Xoá ảnh/)).toBeNull();
    expect(screen.queryByLabelText(/^Chuyển ảnh/)).toBeNull();
    expect((screen.getByLabelText("Đen") as HTMLSelectElement).disabled).toBe(true);
    // Read-only, not hidden: the seller can still see what is under review.
    expect(screen.getByText("Ảnh 2")).toBeTruthy();
  });
});

// ─── Previews ───────────────────────────────────────────────────────────────

describe("previews of unpublished photos", () => {
  it("signs the draft paths and never puts a signed URL anywhere it persists", async () => {
    createSignedUrls.mockResolvedValue({
      data: [{ path: "draft/m1.jpg", signedUrl: "https://signed.example/m1?token=abc" }],
    });
    renderProduct({ media: [photo("m1", 0)] });

    await waitFor(() => expect(createSignedUrls).toHaveBeenCalled());
    expect(createSignedUrls.mock.calls[0][0]).toEqual(["draft/m1.jpg"]);
    // Five minutes, not a day.
    expect(createSignedUrls.mock.calls[0][1]).toBe(300);

    await waitFor(() =>
      expect((screen.getByRole("img") as HTMLImageElement).src).toContain("signed.example"),
    );
    fireEvent.click(screen.getByLabelText("Xoá ảnh 1"));
    await waitFor(() => expect(rpcCall("product_media_delete")).toBeTruthy());
    // Nothing signed reaches an RPC argument.
    expect(JSON.stringify(shopRpc.mock.calls)).not.toContain("signed.example");
  });

  it("prefers the rendition over the original when there is one", async () => {
    renderProduct({ media: [photo("m1", 0, { rendition_source_path: "draft/m1-1600.webp" })] });

    await waitFor(() => expect(createSignedUrls).toHaveBeenCalled());
    expect(createSignedUrls.mock.calls[0][0]).toEqual(["draft/m1-1600.webp"]);
  });

  it("marks a photo the worker has not checked yet", () => {
    renderProduct({ media: [photo("m1", 0, { verified_at: null })] });
    expect(screen.getByText("Chưa xác minh")).toBeTruthy();
  });
});
