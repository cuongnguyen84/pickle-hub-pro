// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
vi.mock("@/components/layout/TheLineLayout", () => ({
  TheLineLayout: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));
vi.mock("@/i18n", () => ({ useI18n: () => ({ setLanguageFromUrl: vi.fn() }) }));
vi.mock("@/lib/assistant-context", () => ({ useAssistantContext: vi.fn() }));
vi.mock("@/hooks/useNoindex", () => ({ useNoindex: vi.fn() }));
vi.mock("@/components/monetization/AdSlot", () => ({ AdSlot: () => null }));
vi.mock("@/components/seo", () => ({
  DynamicMeta: () => null, HreflangTags: () => null,
  BreadcrumbSchema: () => null, ArticleSchema: () => null,
}));
vi.mock("@/hooks/useNewsItemBySlug", () => ({
  useNewsItemSibling: () => ({ data: null }),
  useNewsItemBySlug: () => ({ isLoading: false, data: {
    id: "test-news", slug: "test-news", title: "News image", summary: "Summary",
    published_at: "2026-11-01T00:00:00Z", updated_at: "2026-11-01T00:00:00Z",
    image_url: "/test-news.jpg", source: "ThePickleHub", category: null,
    parent_news_id: null, content_html: "<p>Article body</p>",
  } }),
}));
import NewsArticle from "../NewsArticle";
afterEach(cleanup);
describe("NewsArticle reserved media geometry", () => {
  it("keeps the aspect ratio and figure after a failed image instead of collapsing text", () => {
    render(<MemoryRouter><NewsArticle language="en" /></MemoryRouter>);
    const img = screen.getByRole("img", { name: "News image" }) as HTMLImageElement;
    const figure = img.closest("figure")!;
    expect(img.style.aspectRatio).toBe("16 / 9");
    expect(img.style.maxHeight).toBe("480px");
    fireEvent.error(img);
    expect(img.style.visibility).toBe("hidden");
    expect(img.style.aspectRatio).toBe("16 / 9");
    expect(figure.style.display).not.toBe("none");
    expect(screen.getByText("Article body")).toBeTruthy();
  });
});
