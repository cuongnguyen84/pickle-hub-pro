/** @vitest-environment jsdom */
/**
 * The acceptance step, from the seller's side of the glass.
 *
 * The server is the authority — shop_application_submit() refuses without a
 * recorded signature, and pgTAP proves that. What this file covers is the set
 * of things a server-side check cannot: whether the person was shown the text
 * before the box could be ticked, whether a failed write is reported as a
 * failure, and whether "accepted" survives a refresh because the server said
 * so rather than because a local flag remembered.
 *
 * The `onChange` assertions matter more than they look. That callback is what
 * unlocks the submit button, and every bug this component could have ends the
 * same way: a seller looking at an enabled button that will refuse.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SellerRulesAcceptance, type SellerRulesState } from "../SellerRulesAcceptance";

const rpc = vi.hoisted(() => vi.fn());
vi.mock("@/integrations/supabase/shop-client", () => ({
  shopRpc: (fn: string, args?: Record<string, unknown>) => rpc(fn, args),
}));
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "user-1" } }),
}));

afterEach(() => {
  cleanup();
  rpc.mockReset();
});

const DOC = {
  document_key: "seller-rules",
  version: "v1",
  title: "Quy chế người bán",
  body: "Điều 1. Người bán chịu trách nhiệm về thông tin sản phẩm.",
  content_hash: "a".repeat(64),
  effective_at: "2026-08-14T00:00:00Z",
};

/** Wire the two RPCs this component reads, and nothing else. */
const wire = ({
  doc = [DOC],
  receipt = { accepted: false, reason: "never_accepted", current_version: "v1" },
  onAccept,
}: {
  doc?: unknown;
  receipt?: unknown;
  onAccept?: () => unknown;
} = {}) => {
  rpc.mockImplementation(async (fn: string) => {
    if (fn === "legal_current_document") {
      if (doc instanceof Error) throw doc;
      return doc;
    }
    if (fn === "shop_application_rules_receipt") return receipt;
    if (fn === "legal_accept") return onAccept ? onAccept() : { ok: true, replayed: false };
    throw new Error(`unexpected rpc ${fn}`);
  });
};

const mount = () => {
  const states: SellerRulesState[] = [];
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <SellerRulesAcceptance applicationId="app-1" onChange={(s) => states.push(s)} />
    </QueryClientProvider>,
  );
  return { states, last: () => states[states.length - 1] };
};

describe("SellerRulesAcceptance", () => {
  it("shows the document text, not a link to one", async () => {
    wire();
    mount();
    expect(await screen.findByText(/Điều 1\. Người bán chịu trách nhiệm/)).toBeTruthy();
    expect(screen.getByText(/Bản v1/)).toBeTruthy();
  });

  it("offers no checkbox at all while the document is loading", () => {
    wire();
    mount();
    // Before the query resolves there is nothing to agree to. A disabled box
    // would still be a box; there should not be one.
    expect(screen.queryByRole("checkbox")).toBeNull();
    expect(screen.getByText(/Đang tải quy chế/)).toBeTruthy();
  });

  it("blocks submission and offers a retry when the document cannot be loaded", async () => {
    wire({ doc: new Error("network down") });
    const { last } = mount();
    // The hook retries once before giving up — a transient blip should not put
    // a seller in front of an error — so the failure state is a second away,
    // not immediate. Waiting for it is the test respecting the behaviour.
    expect(await screen.findByText(/Không tải được quy chế/, {}, { timeout: 4000 })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Thử lại/ })).toBeTruthy();
    expect(screen.queryByRole("checkbox")).toBeNull();
    await waitFor(() => expect(last()).toEqual({ ready: false, version: null }));
  });

  it("says so plainly when nothing has been published, and stays locked", async () => {
    wire({ doc: [] });
    const { last } = mount();
    expect(await screen.findByText(/chưa được ban hành/)).toBeTruthy();
    expect(screen.queryByRole("checkbox")).toBeNull();
    await waitFor(() => expect(last()).toEqual({ ready: false, version: null }));
  });

  it("starts unticked, and does not unlock the submit until the server says so", async () => {
    wire();
    const { last } = mount();
    const box = (await screen.findByRole("checkbox")) as HTMLInputElement;
    expect(box.checked, "a pre-ticked consent box is not consent").toBe(false);
    await waitFor(() => expect(last()).toEqual({ ready: false, version: "v1" }));
  });

  it("records acceptance and reports it as recorded", async () => {
    let receipt: unknown = { accepted: false, reason: "never_accepted", current_version: "v1" };
    rpc.mockImplementation(async (fn: string) => {
      if (fn === "legal_current_document") return [DOC];
      if (fn === "shop_application_rules_receipt") return receipt;
      if (fn === "legal_accept") {
        receipt = {
          accepted: true,
          title: DOC.title,
          version: "v1",
          content_hash: DOC.content_hash,
          accepted_at: "2026-08-14T10:00:00Z",
        };
        return { ok: true, replayed: false };
      }
      throw new Error(`unexpected rpc ${fn}`);
    });

    const { last } = mount();
    fireEvent.click(await screen.findByRole("checkbox"));

    expect(await screen.findByText(/Đã ghi nhận lúc/)).toBeTruthy();
    await waitFor(() => expect(last()).toEqual({ ready: true, version: "v1" }));
  });

  it("sends the version and hash it displayed, and no timestamp", async () => {
    wire();
    mount();
    fireEvent.click(await screen.findByRole("checkbox"));
    await waitFor(() => expect(rpc).toHaveBeenCalledWith("legal_accept", expect.anything()));
    const args = rpc.mock.calls.find((c) => c[0] === "legal_accept")![1] as Record<string, unknown>;
    expect(args._version).toBe("v1");
    expect(args._content_hash).toBe(DOC.content_hash);
    // Anything the client could state about WHO or WHEN would be a thing to
    // validate away later. There is nothing to validate.
    expect(Object.keys(args).some((k) => /accepted_at|user|by/i.test(k))).toBe(false);
  });

  it("does not claim it signed when the write failed", async () => {
    wire({
      onAccept: () => {
        throw new Error("seller_rules_version_changed");
      },
    });
    const { last } = mount();
    const box = (await screen.findByRole("checkbox")) as HTMLInputElement;
    fireEvent.click(box);

    expect(await screen.findByText(/Chưa ghi nhận được/)).toBeTruthy();
    expect(screen.queryByText(/Đã ghi nhận lúc/)).toBeNull();
    await waitFor(() => expect(box.checked, "a failed write must untick the box").toBe(false));
    await waitFor(() => expect(last().ready).toBe(false));
    expect(screen.getByRole("button", { name: /Thử lại/ })).toBeTruthy();
  });

  it("recovers the receipt from the server, not from a local flag", async () => {
    // What a refresh looks like: fresh component, nothing in local state, and
    // an already-recorded signature on the server.
    wire({
      receipt: {
        accepted: true,
        title: DOC.title,
        version: "v1",
        content_hash: DOC.content_hash,
        accepted_at: "2026-08-14T10:00:00Z",
      },
    });
    const { last } = mount();
    const box = (await screen.findByRole("checkbox")) as HTMLInputElement;
    await waitFor(() => expect(box.checked).toBe(true));
    expect(box.disabled, "an already-recorded signature is not re-signable").toBe(true);
    await waitFor(() => expect(last()).toEqual({ ready: true, version: "v1" }));
  });

  it("takes the tick away when a new version takes effect under an open form", async () => {
    // The form was filled against v1. v2 is now in force and the old signature
    // no longer counts — which the server would also say, but only after the
    // seller pressed a button they were told would work.
    wire({
      doc: [{ ...DOC, version: "v2", title: "Quy chế người bán" }],
      receipt: {
        accepted: false,
        reason: "stale_version",
        current_version: "v2",
        accepted_version: "v1",
        accepted_at: "2026-08-01T10:00:00Z",
      },
    });
    const { last } = mount();

    expect(await screen.findByText(/Quy chế đã có bản mới/)).toBeTruthy();
    const box = (await screen.findByRole("checkbox")) as HTMLInputElement;
    expect(box.checked).toBe(false);
    expect(box.disabled, "they must be able to sign the new one").toBe(false);
    await waitFor(() => expect(last()).toEqual({ ready: false, version: "v2" }));
  });
});
