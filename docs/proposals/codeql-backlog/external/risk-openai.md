## Blocker: “28 → 0” can leave the live product unfixed

The concrete production failure is **source/deployment drift**:

- **Trigger:** Merge the three Cloudflare Worker fixes and the SSR sanitizer fix.
- **Mechanism:** CodeQL scans the repository and closes the alerts, but Workers require manual `wrangler deploy`, while existing prerendered HTML remains in KV under the unchanged manual version key.
- **Production symptom:**
  - Triggering an exception against an undeployed Worker still returns `err.message` to the caller.
  - Googlebot requesting a previously cached prerender still receives the old, inadequately sanitized HTML. A cached bypass payload can remain visible/indexable after CI reports zero alerts.

Thus “CodeQL 0” is not evidence that these production vulnerabilities are closed. The change needs a deployment manifest plus a KV version bump/purge.

## Do not edit `_shared/auth.ts` for the three DUPR findings

That is the other concrete operational trap:

- **Trigger:** Change `_shared/auth.ts` because CodeQL attributes the sinks there.
- **Mechanism:** The deploy guard starts approximately 50 sequential deployments. Any failure stops the loop with `set -e`.
- **Symptom:** Production ends up with a mixed fleet—functions before the failure run the new shared implementation, functions after it run the old one. If the helper’s response contract changes, users receive different JSON/error behavior depending on which endpoint they call. Recovery is manual per-function deployment.

The taint originates in the three callers. Replace `err.message` there and redeploy only those three. A shared-helper edit is unjustified blast radius.

## Fix order

### 1. Auth redirect regex — first

This is the only confirmed production defect already affecting normal users.

- **Trigger:** Login with a return path containing a hyphen, such as `/news/some-slug`.
- **Mechanism:** `[ -\s]` includes literal `-`, so the guard rejects the path.
- **User-visible symptom:** Successful login sends the user to `/` instead of the requested page.

Fix this separately and add tests for hyphenated paths, whitespace/control characters, protocol-relative URLs, and absolute URLs.

### 2. Incomplete HTML sanitizers — highest security priority if input is attacker-controlled

Single-pass regex replacement is bypassable using nested/reconstructed tokens such as `<scr<script>ipt>`.

- **Trigger:** Attacker-controlled content reaches one of these sanitizers.
- **Mechanism:** Removing the inner match creates a dangerous outer tag after the sole sanitization pass.
- **Symptom:** Malicious markup survives into generated/cached HTML; depending on where that HTML is later rendered, this becomes script execution or indexed content/SEO poisoning.

Use a real allowlist HTML sanitizer rather than repeated regex replacement. For the prerender path, also bump the KV version or purge old entries.

### 3. `includes("googleusercontent.com")`

This is a true allowlist bypass:

- `https://googleusercontent.com.attacker.example/...`
- `https://evilgoogleusercontent.com/...`

will satisfy substring matching.

Urgency depends on what the check authorizes. If it gates server-side fetching, trusted embedding, or an auth decision, fix immediately after the sanitizer. Parse with `new URL()`, require the intended protocol, and compare the normalized hostname to the exact allowed domain/subdomain policy.

### 4. User-facing ILIKE backslash escaping

This has a concrete reliability trigger:

- **Trigger:** Search input containing a backslash, especially a trailing `\`.
- **Mechanism:** PostgreSQL treats backslash as the LIKE escape character; an unmatched trailing escape can produce an invalid pattern/error.
- **Symptom:** The DUPR search returns a 500 instead of results.

Fix and test `%`, `_`, `\`, and combinations such as `abc\`, `\%`, and `\\`.

### 5. Public stack-trace exposure

Fix public endpoints before admin, cron, and HMAC-only endpoints. Return a stable generic error plus a request/correlation ID; log details server-side. This is real information disclosure, but it is less urgent than the already-confirmed redirect break and reachable injection/allowlist bypasses.

### Lower priority / likely contextual

- Admin-only `<img src>` / `<a href>` findings: usually self-XSS or unsafe navigation unless untrusted users can populate values an admin later clicks.
- `Math.random()` username candidates: not a security issue unless the value is used as a credential, reset token, or security boundary. Database uniqueness still needs collision handling.
- Console format-string, double-escaping, and bad-tag-filter alerts require sink-specific confirmation; do not rewrite behavior merely to silence CodeQL.

## Verdict

This is not safely reviewable as one “28 → 0” batch. The individual source fixes can be low-risk, but the proposed closure criterion is defective: it can report success while live Workers and cached SSR output remain vulnerable, and a misplaced shared-helper fix creates a non-atomic 50-function rollout. Split the changes, fix the redirect first, patch DUPR callers rather than `_shared`, explicitly deploy every Worker, and invalidate the SSR KV cache.