-- RLS smoke checks for the core content tables.
-- Run these queries in the Supabase Policy Tester as:
-- 1. a customer user tied to client A
-- 2. a different customer user tied to client B
-- 3. an operator_admin user
--
-- Expected results:
-- - customer A only sees rows that belong to client A
-- - customer B only sees rows that belong to client B
-- - operator_admin can see every row

select id, client_id, slug, name, status
from public.sites
order by created_at;

select id, client_id, site_id, version_number, summary
from public.site_versions
order by created_at desc;

select id, site_version_id, page_key, section_key, field_key, summary
from public.version_changes
order by created_at desc;

select id, client_id, site_id, title, status, published_at
from public.news_posts
order by created_at desc;

select id, client_id, site_id, original_filename, storage_path
from public.assets
order by created_at desc;

select id, client_id, site_id, user_id, status, title
from public.chat_sessions
order by created_at desc;

select id, session_id, role, content, created_at
from public.chat_messages
order by created_at desc;

select id, session_id, change_set_id, status, selected_suggestion_key
from public.suggestion_sets
order by created_at desc;

select id, client_id, site_id, chat_session_id, requested_by_user_id, status, summary
from public.change_sets
order by created_at desc;

select id, client_id, site_id, actor_user_id, action, target_type, target_id
from public.audit_logs
order by created_at desc;
