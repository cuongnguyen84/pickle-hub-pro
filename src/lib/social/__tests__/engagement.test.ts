import { describe, it, expect } from "vitest";
import { blogTargetId } from "../engagement";

/**
 * Blog engagement targets are keyed by a deterministic UUID derived
 * from the canonical slug (blogs are file modules - there is no row
 * id). These tests pin the derivation contract: stable across calls,
 * distinct per slug, and shaped like a version-5 UUID so Postgres
 * accepts it as a uuid target id.
 */
describe("blogTargetId", () => {
  it("is deterministic for the same slug", () => {
    expect(blogTargetId("line-call-rules-ly-hoang-nam-fair-play")).toBe(
      blogTargetId("line-call-rules-ly-hoang-nam-fair-play"),
    );
  });

  it("differs between slugs", () => {
    expect(blogTargetId("alpha-post")).not.toBe(blogTargetId("beta-post"));
    expect(blogTargetId("alpha-post")).not.toBe(blogTargetId("alpha-post-2"));
  });

  it("produces a version-5 shaped UUID", () => {
    const id = blogTargetId("any-slug");
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it("handles unicode and long slugs without collisions on prefixes", () => {
    const a = blogTargetId("luat-goi-bong-out-ly-hoang-nam-fair-play");
    const b = blogTargetId("luat-goi-bong-out-ly-hoang-nam-fair-play-2");
    expect(a).not.toBe(b);
    expect(blogTargetId("")).toMatch(/^[0-9a-f-]{36}$/);
  });
});
