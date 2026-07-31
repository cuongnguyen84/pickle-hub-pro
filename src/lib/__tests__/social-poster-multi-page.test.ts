import { describe, expect, it } from "vitest";
import {
  buildFbPayload,
  configuredPages,
  sanitizeCaption,
  type Env,
} from "../../../workers/social-poster/src/index";

const env = {
  FB_PAGE_ID: "primary",
  FB_PAGE_ACCESS_TOKEN: "primary-token",
  FB_SECONDARY_PAGE_ID: "secondary",
  FB_SECONDARY_PAGE_ACCESS_TOKEN: "secondary-token",
  FB_SECONDARY_START_AT: "2026-07-31T10:04:31Z",
} as Env;

describe("social-poster multi-page rollout", () => {
  it("keeps the existing Page and adds TA Pickleball with a cutoff", () => {
    expect(configuredPages(env)).toEqual([
      { key: "thepicklehub", id: "primary", accessToken: "primary-token", startAt: null },
      {
        key: "ta-pickleball",
        id: "secondary",
        accessToken: "secondary-token",
        startAt: "2026-07-31T10:04:31Z",
      },
    ]);
  });

  it("never leaves the article URL in the main caption", () => {
    expect(sanitizeCaption("Đọc bài: https://example.com/vi/news/test\n\n#Pickleball"))
      .toBe("🔗 Link bài viết ở bình luận đầu tiên.\n\n#Pickleball");
  });

  it("builds an image post without embedding the article link", () => {
    const payload = buildFbPayload(
      { image_url: "https://images.example.com/news.jpg" } as never,
      "Caption",
    );
    expect(payload).toEqual({
      endpoint: "photos",
      body: {
        url: "https://images.example.com/news.jpg",
        caption: "Caption",
        published: "true",
      },
    });
  });
});
