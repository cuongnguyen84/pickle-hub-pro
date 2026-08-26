# thepicklehub.net — SEO audit, 2026-08-25

Working artifacts from the full-site audit run on 2026-08-25. Committed so the
evidence survives a clean working tree: several findings turned out to be
mis-attributed, and the only way to tell a real regression from a repeat of
that mistake is to still have the measurements.

## Read these

| File | What it is |
|---|---|
| `ACTION-PLAN.md` | **The live checklist.** Updated as items close, with the real cause when it differed from the finding. Start here. |
| `FULL-AUDIT-REPORT.md` | The run's own write-up, health score 64/100. |
| `findings/*.md` | Eight specialist reports (technical, content, schema, GEO, SXO, performance, local, sitemap). |

## Evidence, not conclusions

- `psi-*.json` — raw PageSpeed Insights runs. `psi-<hash>.json` and
  `psi-after-<hash>.json` are the same URL before and after the CLS fix
  (#676); they are point-in-time measurements and cannot be re-taken.
- `crawl-sample.json`, `all-urls.tsv`, `links.json`, `homepage-render.json` —
  the crawl this audit reasoned over.
- `sm-*.xml`, `sitemap-index.xml`, `robots.txt`, `llms.txt` — snapshots of what
  production served that day.
- `*.mjs`, `*.py` — the Playwright / crawl scripts that produced the above.
  `measure-cls.mjs` and `trace-cls.mjs` are the ones worth re-running.

## Caveat

Numbers are from **2026-08-25** and go stale. Trust the reporting window inside
a file over its mtime, and re-pull GSC rather than quoting these totals back.
