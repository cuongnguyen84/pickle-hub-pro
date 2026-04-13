#!/bin/bash
# Verify import - count rows on both Lovable and new Supabase
# Usage: bash verify_import.sh

set -e

if [ -z "${DATABASE_URL:-}" ]; then
    echo "ERROR: Set DATABASE_URL"
    exit 1
fi

echo "============================================================"
echo "Verification — Row counts on new Supabase"
echo "============================================================"
echo ""

psql "$DATABASE_URL" <<SQL
SELECT 'auth.users' AS table_name, count(*) FROM auth.users
UNION ALL SELECT 'auth.identities', count(*) FROM auth.identities
UNION ALL SELECT 'profiles', count(*) FROM public.profiles
UNION ALL SELECT 'organizations', count(*) FROM public.organizations
UNION ALL SELECT 'tournaments', count(*) FROM public.tournaments
UNION ALL SELECT 'livestreams', count(*) FROM public.livestreams
UNION ALL SELECT 'vi_blog_posts', count(*) FROM public.vi_blog_posts
UNION ALL SELECT 'news_items', count(*) FROM public.news_items
UNION ALL SELECT 'videos', count(*) FROM public.videos
UNION ALL SELECT 'quick_tables', count(*) FROM public.quick_tables
UNION ALL SELECT 'follows', count(*) FROM public.follows
UNION ALL SELECT 'notifications', count(*) FROM public.notifications
UNION ALL SELECT 'chat_messages', count(*) FROM public.chat_messages
UNION ALL SELECT 'forum_posts', count(*) FROM public.forum_posts
ORDER BY table_name;
SQL

echo ""
echo "Compare these with Lovable counts to verify migration."
echo ""
echo "Test critical query (profiles ↔ auth.users link):"
psql "$DATABASE_URL" -c "SELECT count(*) FROM public.profiles p WHERE EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p.id);"
echo ""
echo "Test OAuth identities link:"
psql "$DATABASE_URL" -c "SELECT provider, count(*) FROM auth.identities GROUP BY provider ORDER BY count DESC;"
