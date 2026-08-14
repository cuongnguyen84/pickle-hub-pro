// ============================================================================
// The approved seller rules and the published seller rules are one document
// ----------------------------------------------------------------------------
// Migration 20260814100000 carries the full text of
// docs/proposals/shop-closed-pilot/seller-rules-v1.md inline, because that is
// the only way the thing a seller signs travels to staging and production by
// the same reviewed path as the schema.
//
// Carrying a copy creates the one failure worth a test file of its own: the
// two drifting apart. The approval record would then describe text nobody is
// being shown, or — worse and quieter — the hash constant would keep matching
// a document that has since been edited, and the receipts in
// legal_acceptances would point at wording that no longer exists.
//
// So this file asserts byte equality, recomputes the sha256 from the file
// rather than trusting the constant, and checks every field the Product Owner
// actually decided on 2026-08-13. It is deliberately not a schema test —
// 20260814090000's machinery is covered in shop-schema-parity.test.ts.
// ============================================================================

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";

const DOC_PATH = resolve(__dirname, "../../../docs/proposals/shop-closed-pilot/seller-rules-v1.md");
const MIGRATION_PATH = resolve(
  __dirname,
  "../../../supabase/migrations/20260814100000_shop_seller_rules_v1_publish.sql",
);

const DOC = readFileSync(DOC_PATH, "utf8");
const SQL = readFileSync(MIGRATION_PATH, "utf8");

/** The Product Owner's decision of 2026-08-13, as literals. Written out rather
 *  than parsed from the document, so that editing the document cannot quietly
 *  edit the decision it is supposed to be governed by. */
const DECISION = {
  documentKey: "seller-rules",
  version: "v1",
  scope: "closed-pilot",
  approvedBy: "Cuong Nguyen — Product Owner, ThePickleHub",
  approvedAt: "2026-08-13 07:30:00+07",
  effectiveAt: "2026-08-14 00:00:00+07",
} as const;

const TAG = "$seller_rules_v1$";

/** The body exactly as the migration hands it to Postgres. A dollar-quoted
 *  literal is verbatim — including the newline that would follow the opening
 *  tag if anyone reformatted this, which is why the tag and the document's
 *  first character sit on the same line. */
const publishedBody = (() => {
  const open = SQL.indexOf(TAG);
  const close = SQL.lastIndexOf(TAG);
  expect(open, "the migration must dollar-quote the body").toBeGreaterThan(-1);
  expect(close, "and close the quote").toBeGreaterThan(open);
  return SQL.slice(open + TAG.length, close);
})();

const sha256 = (s: string) => createHash("sha256").update(s, "utf8").digest("hex");

describe("seller rules v1 — the approved file IS the published document", () => {
  it("publishes the approved file byte for byte", () => {
    // Not `toContain`, not a normalised comparison. content_hash is a
    // GENERATED sha256 over exactly these bytes, so a single space of drift is
    // a different document with a different hash and every signature against
    // it stops matching.
    expect(publishedBody).toBe(DOC);
  });

  it("carries the sha256 of that file, recomputed here rather than trusted", () => {
    const hash = sha256(DOC);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(SQL, "the migration's verification block must hold this hash").toContain(hash);
  });

  it("never lets the document contain its own hash", () => {
    // A hash written into the text it hashes is wrong the moment it is
    // written. §20 of the document says so; this is the assertion behind it.
    expect(DOC).not.toContain(sha256(DOC));
  });

  it("publishes under the key, version and scope that were approved", () => {
    expect(SQL).toContain(`'${DECISION.documentKey}',`);
    expect(SQL).toContain(`'${DECISION.version}',`);
    expect(SQL).toContain(`'${DECISION.scope}',`);
  });

  it("records who approved it and when, exactly as decided", () => {
    expect(SQL).toContain(`'${DECISION.approvedBy}'`);
    expect(SQL).toContain(`'${DECISION.approvedAt}'::timestamptz`);
    expect(SQL).toContain(`'${DECISION.effectiveAt}'::timestamptz`);
  });

  it("does not backdate the effective date past the approval", () => {
    // The DB constraint legal_documents_no_backdate enforces this too. Both
    // exist because a violation here is caught while the migration is being
    // written, and a violation there is caught while it is being applied to
    // production.
    const approved = new Date(DECISION.approvedAt.replace(" ", "T").replace("+07", "+07:00"));
    const effective = new Date(DECISION.effectiveAt.replace(" ", "T").replace("+07", "+07:00"));
    expect(Number.isNaN(approved.getTime())).toBe(false);
    expect(effective.getTime()).toBeGreaterThanOrEqual(approved.getTime());
  });

  it("titles the row with the document's own heading", () => {
    const h1 = DOC.split("\n")[0].replace(/^#\s+/, "");
    expect(SQL).toContain(`'${h1}',`);
  });

  it("publishes a document that says it is approved", () => {
    // The body is what a seller reads. Publishing text that still calls itself
    // a draft would be an approved document telling the person signing it that
    // it has no force — which is worse than either state on its own.
    expect(DOC).toContain("| **Status** | `APPROVED` |");
    expect(DOC).not.toContain("chưa có hiệu lực");
    expect(DOC).toContain(DECISION.approvedBy);
  });

  it("reads the stored row back instead of trusting the INSERT", () => {
    // ON CONFLICT DO NOTHING makes a re-run harmless and, on its own, makes an
    // environment that already holds a different v1 silent. The verification
    // block is what turns that silence into a failed migration.
    expect(SQL).toContain("ON CONFLICT (document_key, version) DO NOTHING");
    expect(SQL).toMatch(/SELECT \* INTO _row FROM public\.legal_documents/);
    expect(SQL).toContain("hash mismatch");
  });

  it("does not write content_hash — Postgres generates it", () => {
    const insertCols = SQL.slice(
      SQL.indexOf("INSERT INTO public.legal_documents ("),
      SQL.indexOf(") VALUES ("),
    );
    expect(insertCols).not.toContain("content_hash");
  });
});
