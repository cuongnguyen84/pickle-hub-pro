# Exact-commit preview resolution — 20 November 2026

Failure investigated: visual run44769890284 on PR1085 headf8a033e179fc858d42e2248f6eee67325e93f6c8
failed before Playwright. Twenty probes of advertised branch alias returned404;
there were no screenshot comparisons or diff artifacts to approve. Cloudflare
main project reported deployment success16:21:04UTC, after readiness timeout
16:18:41UTC. Later immutable63cc93af.pickle-hub-pro.pages.dev returned200 while
branch alias db-catalog-equivalence-evide.pickle-hub-pro.pages.dev still404.

The resolver reads GitHub Checks API metadata for the exact PR head SHA, with
checks:read and contents:read only. Accept only the newest matching
Cloudflare Pages: pickle-hub-pro check from app cloudflare-workers-and-pages,
matching full head_sha, completed success. An immutable eight-hex project URL
is extracted from trusted check summary, restricted to pickle-hub-pro.pages.dev
with no userinfo/port/path/query/fragment. Arbitrary metadata hosts and branch
aliases are rejected. HEAD must return200 with redirects forbidden before
writing PLAYWRIGHT_BASE_URL. No token is sent on HEAD. Pending/late builds and
propagation get a bounded15minute wait; failure/missing metadata never falls
back to alias or production. Workflow timeout30minutes leaves time for suite.

Fork visual jobs explicitly skip: no CF secrets, privileged pull_request_target,
write token or untrusted privileged execution is introduced. Same-repository
code receives only GitHub metadata read access. Manual workflow_dispatch retains
its existing explicit manual behavior; this patch changes PR target resolution.
Pixel thresholds, advisory semantics and baselines are unchanged. A resolution
failure remains a failed job rather than a silent skipped visual proof.

Ten local resolver tests pass: exact/wrong SHA, trusted app, pending/late build,
failed deployment, missing URL, host/alias/credential rejection, fork refusal,
credential-free HEAD200, persistent404 deadline and newest-check precedence.
Actual workflow execution on the patch still needs CI evidence. No deployment,
baseline replacement or production write was performed by this agent.
