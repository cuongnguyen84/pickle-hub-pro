// ============================================================================
// 2026-09-10 — a VI post emitted FAQPage JSON-LD without the questions being
// anywhere in the prerendered body.
// ----------------------------------------------------------------------------
// Google's structured-data policy requires FAQ question and answer text to be
// visible on the page. The React page (src/pages/ViBlogPost.tsx) had always
// rendered the accordion, so a crawler that executes JS saw both. The bot path
// — which exists precisely so crawlers do NOT have to execute JS, and is the
// copy `curl -A Googlebot` returns — emitted the schema and no body FAQ. The
// two renders disagreed, and only the bot one was in breach.
//
// A schema-only assertion could never have caught this: the JSON-LD was always
// correct. The check has to be "the same text appears OUTSIDE the script tag".
// ============================================================================

import { describe, expect, it } from "vitest";
import { renderViBlogPost } from "../blog";
import type { SupabaseClient } from "../../supabase";

const SITE = "https://www.thepicklehub.net";

const POST = {
  title: "Bài kiểm tra",
  meta_title: "Bài kiểm tra",
  meta_description: "Mô tả",
  content_html: "<h1>Bài kiểm tra</h1><p>Thân bài.</p>",
  cover_image_url: null,
  faq_items: [
    { question: "Giải diễn ra khi nào?", answer: "Ngày 23 tháng 9." },
    { question: 'Vé bán ở đâu & "giá" bao nhiêu?', answer: "Chưa công bố." },
  ],
  alternate_en_slug: "test-post",
  published_at: "2026-09-01T00:00:00Z",
  updated_at: "2026-09-01T00:00:00Z",
};

/** Minimal stand-in for the two parallel queries renderViBlogPost makes. */
function fakeSupabase(post: unknown): SupabaseClient {
  const chain = (result: unknown) => {
    const api: Record<string, unknown> = {};
    for (const k of ["select", "eq", "neq", "limit", "order"]) {
      api[k] = () => api;
    }
    api.single = async () => ({ data: post, error: null });
    api.then = (resolve: (v: unknown) => unknown) => resolve(result);
    return api;
  };
  return {
    from: () => chain({ data: [], error: null }),
  } as unknown as SupabaseClient;
}

/** Body text with every <script> block stripped, i.e. what a reader can see. */
function visibleText(html: string): string {
  return html.replace(/<script[\s\S]*?<\/script>/g, "");
}

describe("renderViBlogPost FAQ", () => {
  it("renders the FAQ questions in the body, not only in the JSON-LD", async () => {
    const res = await renderViBlogPost(fakeSupabase(POST), "bai-kiem-tra", SITE);
    const html = await res.text();

    // The schema is present (it always was — that is not what regressed).
    expect(html).toContain("FAQPage");

    // The regression guard: the same text outside every <script>.
    const visible = visibleText(html);
    expect(visible).toContain("Câu hỏi thường gặp");
    expect(visible).toContain("Giải diễn ra khi nào?");
    expect(visible).toContain("Ngày 23 tháng 9.");
  });

  it("escapes FAQ text so a quote or ampersand cannot break the markup", async () => {
    const res = await renderViBlogPost(fakeSupabase(POST), "bai-kiem-tra", SITE);
    const visible = visibleText(await res.text());
    expect(visible).toContain("&amp;");
    expect(visible).toContain("&quot;giá&quot;");
  });

  it("emits no FAQ section when the post has none", async () => {
    const res = await renderViBlogPost(
      fakeSupabase({ ...POST, faq_items: [] }),
      "bai-kiem-tra",
      SITE,
    );
    const html = await res.text();
    expect(html).not.toContain("FAQPage");
    expect(visibleText(html)).not.toContain("Câu hỏi thường gặp");
  });
});
