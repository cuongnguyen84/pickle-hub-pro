import { describe, it, expect } from "vitest";
import { findMigrationDuplicates } from "../../../scripts/check-migration-duplicates.mjs";

describe("findMigrationDuplicates", () => {
  it("returns no duplicates for a clean, uniquely-versioned set", () => {
    const files = [
      { name: "20260101000000_a.sql", content: "create table a();" },
      { name: "20260101000001_b.sql", content: "create table b();" },
      { name: "20260102000000_c.sql", content: "create table c();" },
    ];
    const { versionDuplicates, contentDuplicates } = findMigrationDuplicates(files);
    expect(versionDuplicates).toEqual([]);
    expect(contentDuplicates).toEqual([]);
  });

  it("flags two files sharing the same 14-digit version prefix", () => {
    const files = [
      { name: "20260701120000_assign_groups.sql", content: "-- one" },
      { name: "20260701120000_fee_rules.sql", content: "-- two" },
    ];
    const { versionDuplicates } = findMigrationDuplicates(files);
    expect(versionDuplicates).toHaveLength(1);
    expect(versionDuplicates[0].version).toBe("20260701120000");
    expect(versionDuplicates[0].files).toEqual([
      "20260701120000_assign_groups.sql",
      "20260701120000_fee_rules.sql",
    ]);
  });

  it("flags byte-identical content at different versions (the #280 re-add)", () => {
    const body = "create table team_match_fee_rules();";
    const files = [
      { name: "20260701120000_fee_rules.sql", content: body },
      { name: "20260701120001_fee_rules.sql", content: body },
    ];
    const { versionDuplicates, contentDuplicates } = findMigrationDuplicates(files);
    // Different version prefixes → not a version collision …
    expect(versionDuplicates).toEqual([]);
    // … but identical content is caught.
    expect(contentDuplicates).toHaveLength(1);
    expect(contentDuplicates[0].files).toEqual([
      "20260701120000_fee_rules.sql",
      "20260701120001_fee_rules.sql",
    ]);
  });

  it("ignores files without a 14-digit version prefix for version checks", () => {
    const files = [
      { name: "README.md", content: "docs" },
      { name: "seed.sql", content: "insert;" },
    ];
    const { versionDuplicates } = findMigrationDuplicates(files);
    expect(versionDuplicates).toEqual([]);
  });

  it("allowlists a reviewed identical-content pair instead of failing it", () => {
    const body = "grant select on public.t to authenticated;";
    const files = [
      { name: "20260101000000_grant_a.sql", content: body },
      { name: "20260102000000_grant_b.sql", content: body },
    ];
    const blocked = findMigrationDuplicates(files);
    expect(blocked.contentDuplicates).toHaveLength(1);
    expect(blocked.allowedContentDuplicates).toHaveLength(0);

    const allowed = findMigrationDuplicates(files, [
      { files: ["20260101000000_grant_a.sql", "20260102000000_grant_b.sql"], reason: "idempotent re-GRANT" },
    ]);
    expect(allowed.contentDuplicates).toHaveLength(0);
    expect(allowed.allowedContentDuplicates).toHaveLength(1);
    expect(allowed.allowedContentDuplicates[0].reason).toBe("idempotent re-GRANT");
  });
});
