import test from "node:test";
import assert from "node:assert/strict";
import { validateLocalTarget, localSnapshot, CHECK_SQL } from "./restore-drill-check.mjs";
test("rejects remote/non-postgres/nameless targets", () => {
  for (const v of ["postgres://user:secret@db.example.com/db","https://localhost/db","postgres://localhost/","bad",undefined])
    assert.throws(() => validateLocalTarget(v));
});
test("accepts loopback only and uses read-only snapshot SQL", () => {
  for (const h of ["localhost","127.0.0.1","[::1]"])
    assert.ok(validateLocalTarget("postgres://u:p@"+h+":54322/postgres"));
  assert.match(CHECK_SQL,/BEGIN READ ONLY/);
  assert.match(CHECK_SQL,/ROLLBACK/);
});
test("connection secret is not placed in argv and query options are ignored", () => {
  let captured;
  localSnapshot("postgres://u:private@127.0.0.1:54322/postgres?options=unsafe", "psql",
    (...args) => { captured=args; return "{}\n"; });
  assert.ok(!captured[1].join(" ").includes("private"));
  assert.equal(captured[2].env.PGPASSWORD,"private");
  assert.equal(captured[2].env.PGOPTIONS,"-c default_transaction_read_only=on");
});
