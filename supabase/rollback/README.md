# Content rollback snapshots

Down-migrations for rows that live in Supabase but not in git.

## Why this directory exists

`vi_blog_posts` holds the Vietnamese half of the site's content. It has no
migration history, no audit table and no revision trigger. An `UPDATE` on
`content_html` overwrites the previous version irrecoverably, and `git revert`
does not reach it — the row is not in the repo.

That asymmetry is the actual risk in any content change: the English post is a
file you can revert, the Vietnamese post is a row you cannot. A snapshot taken
*before* the write is the only way back.

Files were previously written to `growth-tasks/sql/`, which `.gitignore` excludes
as personal planning notes. That put the only copy of the rollback on one laptop.
These live here instead, tracked.

## Convention

Before any `UPDATE`/`DELETE` on published content rows:

1. `SELECT` the columns you are about to change, for every affected slug.
2. Write `supabase/rollback/<YYYY-MM-DD>-<topic>.sql` containing an `UPDATE`
   that restores each row byte for byte.
3. Only then run the change.

Use `$body$…$body$` dollar quoting — content HTML contains quotes and newlines.
If the content itself could contain `$body$`, pick another tag and say so in a
comment.

Applying a rollback: POST the statement to the Supabase Management API query
endpoint (same path used to apply it), then re-warm the bot view:

```sh
curl -sI -A "Googlebot" "https://www.thepicklehub.net/vi/blog/<slug>?nocache=1"
```

The `?nocache=1` matters — `_middleware.ts` compares the value to exactly `"1"`,
and the prerender KV otherwise serves the bad HTML for up to 6 more hours.

## Not a substitute for a real history table

This is a manual discipline, and manual disciplines get skipped. If content
edits become frequent, a `vi_blog_posts_history` table written by trigger would
remove the need for this directory entirely.
