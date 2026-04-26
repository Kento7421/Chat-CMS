create or replace function public.current_app_user_role()
returns public.user_role
language sql
stable
security definer
set search_path = public, auth
as $$
  select u.role
  from public.users as u
  where u.auth_user_id = auth.uid()
  limit 1;
$$;

create or replace function public.current_app_user_client_id()
returns uuid
language sql
stable
security definer
set search_path = public, auth
as $$
  select u.client_id
  from public.users as u
  where u.auth_user_id = auth.uid()
  limit 1;
$$;

create or replace function public.can_access_client(target_client_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.users as u
    where u.auth_user_id = auth.uid()
      and (
        u.role = 'operator_admin'
        or (
          u.role in ('client_owner', 'client_editor')
          and u.client_id = target_client_id
        )
      )
  );
$$;

create or replace function public.can_access_site(target_site_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.sites as s
    where s.id = target_site_id
      and public.can_access_client(s.client_id)
  );
$$;

create or replace function public.can_access_site_version(target_site_version_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.site_versions as sv
    where sv.id = target_site_version_id
      and public.can_access_client(sv.client_id)
  );
$$;

alter table public.sites enable row level security;
alter table public.site_versions enable row level security;
alter table public.version_changes enable row level security;
alter table public.news_posts enable row level security;
alter table public.assets enable row level security;

drop policy if exists sites_select_for_client_members on public.sites;
create policy sites_select_for_client_members
  on public.sites
  for select
  to authenticated
  using (
    public.current_app_user_role() in ('client_owner', 'client_editor')
    and client_id = public.current_app_user_client_id()
  );

drop policy if exists sites_select_for_operator_admin on public.sites;
create policy sites_select_for_operator_admin
  on public.sites
  for select
  to authenticated
  using (public.current_app_user_role() = 'operator_admin');

drop policy if exists site_versions_select_for_client_members on public.site_versions;
create policy site_versions_select_for_client_members
  on public.site_versions
  for select
  to authenticated
  using (
    public.current_app_user_role() in ('client_owner', 'client_editor')
    and client_id = public.current_app_user_client_id()
    and public.can_access_site(site_id)
  );

drop policy if exists site_versions_select_for_operator_admin on public.site_versions;
create policy site_versions_select_for_operator_admin
  on public.site_versions
  for select
  to authenticated
  using (public.current_app_user_role() = 'operator_admin');

drop policy if exists version_changes_select_for_client_members on public.version_changes;
create policy version_changes_select_for_client_members
  on public.version_changes
  for select
  to authenticated
  using (
    public.current_app_user_role() in ('client_owner', 'client_editor')
    and public.can_access_site_version(site_version_id)
  );

drop policy if exists version_changes_select_for_operator_admin on public.version_changes;
create policy version_changes_select_for_operator_admin
  on public.version_changes
  for select
  to authenticated
  using (public.current_app_user_role() = 'operator_admin');

drop policy if exists news_posts_select_for_client_members on public.news_posts;
create policy news_posts_select_for_client_members
  on public.news_posts
  for select
  to authenticated
  using (
    public.current_app_user_role() in ('client_owner', 'client_editor')
    and client_id = public.current_app_user_client_id()
    and public.can_access_site(site_id)
  );

drop policy if exists news_posts_select_for_operator_admin on public.news_posts;
create policy news_posts_select_for_operator_admin
  on public.news_posts
  for select
  to authenticated
  using (public.current_app_user_role() = 'operator_admin');

drop policy if exists assets_select_for_client_members on public.assets;
create policy assets_select_for_client_members
  on public.assets
  for select
  to authenticated
  using (
    public.current_app_user_role() in ('client_owner', 'client_editor')
    and client_id = public.current_app_user_client_id()
    and public.can_access_site(site_id)
  );

drop policy if exists assets_select_for_operator_admin on public.assets;
create policy assets_select_for_operator_admin
  on public.assets
  for select
  to authenticated
  using (public.current_app_user_role() = 'operator_admin');
