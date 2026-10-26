import { afterEach, describe, it, expect, vi } from "vitest";

const { getSession } = vi.hoisted(() => ({ getSession: vi.fn() }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getSession } },
}));

import { fetchPublishedViBlogPosts } from "../useViBlogPosts";

// The published list is a public RLS read: it must go out as a publicRequest
// (anon key, no session wait), exactly like the single-post read. Awaiting
// getSession() first put an auth dependency — potentially a network refresh
// for stale sessions — ahead of the homepage's blog fetch for no benefit:
// RLS already restricts this query to published rows for the anon role.
describe("fetchPublishedViBlogPosts — publicRequest path", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    getSession.mockReset();
  });

  function stubFetchOk() {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [],
    });
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  it("never waits for the auth session", async () => {
    const fetchMock = stubFetchOk();
    await fetchPublishedViBlogPosts(30);
    expect(getSession).not.toHaveBeenCalled();
    const [, init] = fetchMock.mock.calls[0];
    expect(init.headers.Authorization).toMatch(/^Bearer /);
  });

  it("limited variant requests the updated_at window", async () => {
    const fetchMock = stubFetchOk();
    await fetchPublishedViBlogPosts(30);
    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("order=updated_at.desc");
    expect(url).toContain("limit=30");
    expect(url).toContain("status=eq.published");
  });

  it("unlimited variant keeps the full published_at listing", async () => {
    const fetchMock = stubFetchOk();
    await fetchPublishedViBlogPosts();
    const [url] = fetchMock.mock.calls[0];
    expect(url).toContain("order=published_at.desc");
    expect(url).not.toContain("limit=");
    expect(getSession).not.toHaveBeenCalled();
  });
});
