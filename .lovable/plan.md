

## Fix: audit_logs constraint violation on livestream creation

**Root Cause**: The database trigger `audit_livestream_changes()` logs events with `resource_type = 'stream'`, but the `audit_logs_resource_type_check` constraint only allows `'livestream'`.

**Fix**: Update the `audit_livestream_changes()` function to use `'livestream'` instead of `'stream'` for the `resource_type` parameter in all three calls (`STREAM_CREATED`, `STREAM_STARTED`, `STREAM_STOPPED`).

**Implementation**: Single database migration to replace the function, changing all occurrences of `'stream'` resource_type to `'livestream'`.

