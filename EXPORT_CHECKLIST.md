# Phase 4A — Export 63 tables từ Lovable

## Workflow cho mỗi table

1. Mở Lovable SQL Editor
2. Paste query vào
3. Click Run
4. Click Export CSV
5. Save file với tên đúng vào folder `migration_data/`

## ⚠️ Lưu ý quan trọng

- Tên file CSV phải KHỚP CHÍNH XÁC tên table (vd: `profiles.csv`, không phải `Profiles.csv`)
- Folder `migration_data/` đặt cùng cấp với folder dự án `pickle-hub-pro` (hoặc bất cứ đâu, miễn nhớ path)
- Lovable có thể hiển thị cả `;` và `,` làm delimiter — script import handle cả 2
- Tables trống (0 rows) vẫn cần export — sẽ tạo CSV chỉ có header

## Tier explanation

- **P0**: Critical (5 tables) — auth-related, foundation
- **P1**: Content (9 tables) — public-facing content
- **P2**: Tools data (30 tables) — quick_table, doubles, flex, team_match
- **P3**: Social (17 tables) — chat, forum, social interactions
- **P4**: Optional (2 tables) — analytics, audit (skip if want)

---

## P0 Core (5 tables)

### 1. `organizations` → save as `organizations.csv`

```sql
SELECT * FROM public.organizations;
```

### 2. `profiles` → save as `profiles.csv`

```sql
SELECT * FROM public.profiles;
```

### 3. `user_roles` → save as `user_roles.csv`

```sql
SELECT * FROM public.user_roles;
```

### 4. `api_keys` → save as `api_keys.csv`

```sql
SELECT * FROM public.api_keys;
```

### 5. `system_settings` → save as `system_settings.csv`

```sql
SELECT * FROM public.system_settings;
```

---

## P1 Content (9 tables)

### 6. `master_teams` → save as `master_teams.csv`

```sql
SELECT * FROM public.master_teams;
```

### 7. `master_team_roster` → save as `master_team_roster.csv`

```sql
SELECT * FROM public.master_team_roster;
```

### 8. `parent_tournaments` → save as `parent_tournaments.csv`

```sql
SELECT * FROM public.parent_tournaments;
```

### 9. `tournaments` → save as `tournaments.csv`

```sql
SELECT * FROM public.tournaments;
```

### 10. `livestreams` → save as `livestreams.csv`

```sql
SELECT * FROM public.livestreams;
```

### 11. `vi_blog_posts` → save as `vi_blog_posts.csv`

```sql
SELECT * FROM public.vi_blog_posts;
```

### 12. `news_items` → save as `news_items.csv`

```sql
SELECT * FROM public.news_items;
```

### 13. `videos` → save as `videos.csv`

```sql
SELECT * FROM public.videos;
```

### 14. `forum_categories` → save as `forum_categories.csv`

```sql
SELECT * FROM public.forum_categories;
```

---

## P2 QuickTables (9 tables)

### 15. `quick_tables` → save as `quick_tables.csv`

```sql
SELECT * FROM public.quick_tables;
```

### 16. `quick_table_groups` → save as `quick_table_groups.csv`

```sql
SELECT * FROM public.quick_table_groups;
```

### 17. `quick_table_teams` → save as `quick_table_teams.csv`

```sql
SELECT * FROM public.quick_table_teams;
```

### 18. `quick_table_players` → save as `quick_table_players.csv`

```sql
SELECT * FROM public.quick_table_players;
```

### 19. `quick_table_pair_requests` → save as `quick_table_pair_requests.csv`

```sql
SELECT * FROM public.quick_table_pair_requests;
```

### 20. `quick_table_partner_invitations` → save as `quick_table_partner_invitations.csv`

```sql
SELECT * FROM public.quick_table_partner_invitations;
```

### 21. `quick_table_matches` → save as `quick_table_matches.csv`

```sql
SELECT * FROM public.quick_table_matches;
```

### 22. `quick_table_referees` → save as `quick_table_referees.csv`

```sql
SELECT * FROM public.quick_table_referees;
```

### 23. `quick_table_registrations` → save as `quick_table_registrations.csv`

```sql
SELECT * FROM public.quick_table_registrations;
```

---

## P2 DoublesElimination (4 tables)

### 24. `doubles_elimination_tournaments` → save as `doubles_elimination_tournaments.csv`

```sql
SELECT * FROM public.doubles_elimination_tournaments;
```

### 25. `doubles_elimination_teams` → save as `doubles_elimination_teams.csv`

```sql
SELECT * FROM public.doubles_elimination_teams;
```

### 26. `doubles_elimination_matches` → save as `doubles_elimination_matches.csv`

```sql
SELECT * FROM public.doubles_elimination_matches;
```

### 27. `doubles_elimination_referees` → save as `doubles_elimination_referees.csv`

```sql
SELECT * FROM public.doubles_elimination_referees;
```

---

## P2 Flex (9 tables)

### 28. `flex_tournaments` → save as `flex_tournaments.csv`

```sql
SELECT * FROM public.flex_tournaments;
```

### 29. `flex_groups` → save as `flex_groups.csv`

```sql
SELECT * FROM public.flex_groups;
```

### 30. `flex_teams` → save as `flex_teams.csv`

```sql
SELECT * FROM public.flex_teams;
```

### 31. `flex_team_members` → save as `flex_team_members.csv`

```sql
SELECT * FROM public.flex_team_members;
```

### 32. `flex_players` → save as `flex_players.csv`

```sql
SELECT * FROM public.flex_players;
```

### 33. `flex_group_items` → save as `flex_group_items.csv`

```sql
SELECT * FROM public.flex_group_items;
```

### 34. `flex_matches` → save as `flex_matches.csv`

```sql
SELECT * FROM public.flex_matches;
```

### 35. `flex_player_stats` → save as `flex_player_stats.csv`

```sql
SELECT * FROM public.flex_player_stats;
```

### 36. `flex_pair_stats` → save as `flex_pair_stats.csv`

```sql
SELECT * FROM public.flex_pair_stats;
```

---

## P2 TeamMatch (8 tables)

### 37. `team_match_tournaments` → save as `team_match_tournaments.csv`

```sql
SELECT * FROM public.team_match_tournaments;
```

### 38. `team_match_teams` → save as `team_match_teams.csv`

```sql
SELECT * FROM public.team_match_teams;
```

### 39. `team_match_groups` → save as `team_match_groups.csv`

```sql
SELECT * FROM public.team_match_groups;
```

### 40. `team_match_roster` → save as `team_match_roster.csv`

```sql
SELECT * FROM public.team_match_roster;
```

### 41. `team_match_game_templates` → save as `team_match_game_templates.csv`

```sql
SELECT * FROM public.team_match_game_templates;
```

### 42. `team_match_matches` → save as `team_match_matches.csv`

```sql
SELECT * FROM public.team_match_matches;
```

### 43. `team_match_games` → save as `team_match_games.csv`

```sql
SELECT * FROM public.team_match_games;
```

### 44. `team_match_referees` → save as `team_match_referees.csv`

```sql
SELECT * FROM public.team_match_referees;
```

---

## P3 Social (17 tables)

### 45. `follows` → save as `follows.csv`

```sql
SELECT * FROM public.follows;
```

### 46. `likes` → save as `likes.csv`

```sql
SELECT * FROM public.likes;
```

### 47. `comments` → save as `comments.csv`

```sql
SELECT * FROM public.comments;
```

### 48. `forum_posts` → save as `forum_posts.csv`

```sql
SELECT * FROM public.forum_posts;
```

### 49. `forum_comments` → save as `forum_comments.csv`

```sql
SELECT * FROM public.forum_comments;
```

### 50. `forum_likes` → save as `forum_likes.csv`

```sql
SELECT * FROM public.forum_likes;
```

### 51. `blocked_users` → save as `blocked_users.csv`

```sql
SELECT * FROM public.blocked_users;
```

### 52. `content_reports` → save as `content_reports.csv`

```sql
SELECT * FROM public.content_reports;
```

### 53. `notifications` → save as `notifications.csv`

```sql
SELECT * FROM public.notifications;
```

### 54. `push_tokens` → save as `push_tokens.csv`

```sql
SELECT * FROM public.push_tokens;
```

### 55. `chat_room_settings` → save as `chat_room_settings.csv`

```sql
SELECT * FROM public.chat_room_settings;
```

### 56. `chat_messages` → save as `chat_messages.csv`

```sql
SELECT * FROM public.chat_messages;
```

### 57. `chat_message_likes` → save as `chat_message_likes.csv`

```sql
SELECT * FROM public.chat_message_likes;
```

### 58. `chat_pinned_messages` → save as `chat_pinned_messages.csv`

```sql
SELECT * FROM public.chat_pinned_messages;
```

### 59. `chat_highlighted_users` → save as `chat_highlighted_users.csv`

```sql
SELECT * FROM public.chat_highlighted_users;
```

### 60. `chat_mutes` → save as `chat_mutes.csv`

```sql
SELECT * FROM public.chat_mutes;
```

### 61. `view_counts` → save as `view_counts.csv`

```sql
SELECT * FROM public.view_counts;
```

---

## P4 Optional (2 tables)

### 62. `view_events` → save as `view_events.csv`

```sql
SELECT * FROM public.view_events;
```

### 63. `audit_logs` → save as `audit_logs.csv`

```sql
SELECT * FROM public.audit_logs;
```

---

## AUTH (2 tables, special)

### 64. `auth.users` → save as `auth_users.csv`

```sql
SELECT * FROM auth.users;
```

### 65. `auth.identities` → save as `auth_identities.csv`

```sql
SELECT * FROM auth.identities;
```
