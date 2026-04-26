create or replace function public.current_app_user_id()
returns uuid
language sql
stable
security definer
set search_path = public, auth
as $$
  select u.id
  from public.users as u
  where u.auth_user_id = auth.uid()
  limit 1;
$$;

create or replace function public.can_access_chat_session(target_chat_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.chat_sessions as cs
    where cs.id = target_chat_session_id
      and public.can_access_client(cs.client_id)
      and public.can_access_site(cs.site_id)
  );
$$;

create or replace function public.can_access_change_set(target_change_set_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.change_sets as ch
    where ch.id = target_change_set_id
      and public.can_access_client(ch.client_id)
      and public.can_access_site(ch.site_id)
  );
$$;

create or replace function public.can_access_audit_log(
  target_client_id uuid,
  target_site_id uuid,
  target_actor_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select
    case
      when public.current_app_user_role() = 'operator_admin' then true
      when target_site_id is not null then public.can_access_site(target_site_id)
      when target_client_id is not null then public.can_access_client(target_client_id)
      when target_actor_user_id is not null then exists (
        select 1
        from public.users as u
        where u.id = target_actor_user_id
          and u.client_id = public.current_app_user_client_id()
      )
      else false
    end;
$$;

alter table public.chat_sessions enable row level security;
alter table public.chat_messages enable row level security;
alter table public.suggestion_sets enable row level security;
alter table public.change_sets enable row level security;
alter table public.audit_logs enable row level security;

drop policy if exists chat_sessions_select_for_client_members on public.chat_sessions;
create policy chat_sessions_select_for_client_members
  on public.chat_sessions
  for select
  to authenticated
  using (
    public.current_app_user_role() in ('client_owner', 'client_editor')
    and client_id = public.current_app_user_client_id()
    and public.can_access_site(site_id)
  );

drop policy if exists chat_sessions_select_for_operator_admin on public.chat_sessions;
create policy chat_sessions_select_for_operator_admin
  on public.chat_sessions
  for select
  to authenticated
  using (public.current_app_user_role() = 'operator_admin');

drop policy if exists chat_messages_select_for_client_members on public.chat_messages;
create policy chat_messages_select_for_client_members
  on public.chat_messages
  for select
  to authenticated
  using (
    public.current_app_user_role() in ('client_owner', 'client_editor')
    and public.can_access_chat_session(session_id)
  );

drop policy if exists chat_messages_select_for_operator_admin on public.chat_messages;
create policy chat_messages_select_for_operator_admin
  on public.chat_messages
  for select
  to authenticated
  using (public.current_app_user_role() = 'operator_admin');

drop policy if exists suggestion_sets_select_for_client_members on public.suggestion_sets;
create policy suggestion_sets_select_for_client_members
  on public.suggestion_sets
  for select
  to authenticated
  using (
    public.current_app_user_role() in ('client_owner', 'client_editor')
    and public.can_access_chat_session(session_id)
    and (
      change_set_id is null
      or public.can_access_change_set(change_set_id)
    )
  );

drop policy if exists suggestion_sets_select_for_operator_admin on public.suggestion_sets;
create policy suggestion_sets_select_for_operator_admin
  on public.suggestion_sets
  for select
  to authenticated
  using (public.current_app_user_role() = 'operator_admin');

drop policy if exists change_sets_select_for_client_members on public.change_sets;
create policy change_sets_select_for_client_members
  on public.change_sets
  for select
  to authenticated
  using (
    public.current_app_user_role() in ('client_owner', 'client_editor')
    and client_id = public.current_app_user_client_id()
    and public.can_access_site(site_id)
    and (
      chat_session_id is null
      or public.can_access_chat_session(chat_session_id)
    )
  );

drop policy if exists change_sets_select_for_operator_admin on public.change_sets;
create policy change_sets_select_for_operator_admin
  on public.change_sets
  for select
  to authenticated
  using (public.current_app_user_role() = 'operator_admin');

drop policy if exists audit_logs_select_for_client_members on public.audit_logs;
create policy audit_logs_select_for_client_members
  on public.audit_logs
  for select
  to authenticated
  using (
    public.current_app_user_role() in ('client_owner', 'client_editor')
    and public.can_access_audit_log(client_id, site_id, actor_user_id)
  );

drop policy if exists audit_logs_select_for_operator_admin on public.audit_logs;
create policy audit_logs_select_for_operator_admin
  on public.audit_logs
  for select
  to authenticated
  using (public.current_app_user_role() = 'operator_admin');
