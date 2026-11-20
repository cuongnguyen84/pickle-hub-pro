-- Metadata only. No credential or application-row data.
SELECT now() AS observed_at,
       (SELECT jsonb_agg(version ORDER BY version)
        FROM supabase_migrations.schema_migrations) AS versions,
       (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='public' AND c.relkind='r') AS public_tables,
       (SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
        WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity) AS rls_tables,
       (SELECT count(*) FROM pg_policies WHERE schemaname='public') AS public_policies;
