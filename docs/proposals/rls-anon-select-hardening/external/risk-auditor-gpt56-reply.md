1. **Most likely production failure: installed iOS tournament pages stop loading teams.**

   Mechanism: the native query explicitly selects `payment_status`. Once that column’s `SELECT` privilege is revoked, PostgreSQL rejects the **entire statement** with SQLSTATE `42501`; PostgREST does not simply omit that named column.

   Trigger: any user opens tournament detail in the installed app.

   User-visible symptom: the team list is empty, stuck loading, or shows the app’s generic network/error state. The captain query also fails if either `payment_status` is selected or `captain_user_id` is used as a filter without privilege.

   There is a second deterministic web regression: after revoking `invite_code`, the old SPA’s `select('*')` succeeds but returns no code, so captains cannot share it until the new RPC-consuming web build reaches them.

2. **Filter-only columns still require `SELECT`.**

   PostgreSQL requires `SELECT` privilege for every referenced column, including columns used only in:

   - `WHERE`
   - PostgREST `.eq(...)`
   - `ORDER BY`
   - joins or relationship conditions
   - `RETURNING`

   Therefore:

   ```swift
   .eq("captain_user_id", uid)
   ```

   fails with `42501` if the role lacks `SELECT(captain_user_id)`, even when that column is not returned. Row scoping, RLS, matching zero rows, and “captain-owned data” do not exempt it. RLS decides which rows are visible; it does not grant column privileges.

   PostgREST normally surfaces this as an authorization error, commonly HTTP 403 for authenticated requests and 401 for anon requests.

3. **No, `payment_status` cannot be revoked while that installed binary remains supported.**

   An RPC does not help an old binary that continues querying the table directly.

   The permanent compatibility grant list must include every column the installed native app references anywhere—not just returned columns. At minimum here:

   - `payment_status`
   - `captain_user_id`
   - all columns in its explicit projections
   - all columns used in filters, ordering, relationships, or mutation `RETURNING`

   `invite_code` can be revoked after the web captain flow has moved to the authorized RPC, assuming the installed iOS binary does not reference it. The payment timestamp columns can likewise be revoked only if no shipped client references them.

4. **Use expand-then-contract ordering.**

   1. **Additive DB migration:** create and grant the authorization-checked `SECURITY DEFINER` RPCs. Do not revoke anything yet.
   2. **Deploy the web client:** move captain invite-code reads and any other affected web queries to those RPCs. The build must work both before and after revocation.
   3. **Verify the deployed SPA is actually live.**
   4. **Contract migration, atomically:** revoke table-level `SELECT`, then grant columns required by all remaining direct consumers.

   Do **not revoke** `payment_status`, `captain_user_id`, or any other column referenced by the immutable native client. Keep `tournament_id` and `status` granted or the social-proof count fails. Do not run the proposed revoke-first migration before the compatible web deployment.

5. **ACL rollback is clean; the security incident is not.**

   `REVOKE` and `GRANT` are transactional and reversible. Re-granting table-level `SELECT` immediately restores the old behavior, including the leak; restoring the previous per-column ACLs also works if they were recorded accurately.

   Not reversible:

   - outage/error sessions users already experienced
   - invite codes already copied or scraped
   - unauthorized users who already joined teams
   - actions taken during the broken interval

   Revoking read access also does not invalidate leaked invite codes. Those codes must be rotated, and unauthorized memberships reviewed separately.

6. **Yes—the sibling-table audit can break unrelated workflows by the same mechanism.**

   Do not audit only displayed output columns. Check every shipped client for projections, filters, ordering, relationship embeds, and mutation `RETURNING`.

   Concrete failures include:

   - Revoking a game referee/status/DUPR column used in an iOS filter or named projection makes the whole game/referee screen fail with `42501`.
   - Revoking a `quick_table_*` code or state column used to look up a public registration link makes the no-login registration flow unable to resolve the team/table.
   - An `UPDATE` or `DELETE` filtered by a revoked column fails even if that column is not returned.
   - An `INSERT`/`UPDATE ... RETURNING` that names a revoked column fails rather than merely hiding that field.

The narrow hardening is safe: revoke `invite_code` and other columns that no immutable direct-table consumer references, after RPC consumers are deployed. Revoking `payment_status` or `captain_user_id` under the stated client contract is not safe.