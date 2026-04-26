grant usage on schema public to anon, authenticated, service_role;

grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

grant select on table public.sites to authenticated;
grant select on table public.site_versions to authenticated;
grant select on table public.version_changes to authenticated;
grant select on table public.news_posts to authenticated;
grant select on table public.assets to authenticated;
grant select on table public.chat_sessions to authenticated;
grant select on table public.chat_messages to authenticated;
grant select on table public.suggestion_sets to authenticated;
grant select on table public.change_sets to authenticated;
grant select on table public.audit_logs to authenticated;

grant execute on all functions in schema public to authenticated;
