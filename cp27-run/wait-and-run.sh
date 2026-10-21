#!/bin/bash
# Wait for Seller Rules v1 to come into force, then run the acceptance suite.
#
# The clock is the DATABASE's, not this machine's — the effective_at comparison
# that gates `shop_application_submit` happens in Postgres, and asking the same
# clock is the only way to know the window is really open. Nothing here touches
# effective_at or any timezone.
set -uo pipefail
T=/Users/cm10/.claude/jobs/708b78c5/tmp
cd /Users/cm10/pickle-hub-pro/.claude/worktrees/shop-closed-pilot

cat > "$T/cp27/effective.sql" <<'SQL'
SELECT (effective_at <= now()) AS eff,
       date_trunc('second', effective_at - now()) AS remaining
FROM public.legal_documents WHERE document_key = 'seller-rules';
SQL

for i in $(seq 1 900); do
  out=$("$T/sbq.sh" "$T/cp27/effective.sql")
  if echo "$out" | grep -q '"eff":true'; then
    echo "=== Seller Rules v1 is in force (poll $i) ==="
    echo "$out"
    bash cp27-run/run-all.sh
    exit $?
  fi
  [ $((i % 10)) -eq 0 ] && echo "still waiting: $out"
  sleep 30
done
echo "=== TIMEOUT waiting for the legal window ==="
exit 1
