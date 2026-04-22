create extension if not exists pgcrypto;

create type public.client_status as enum ('trial', 'active', 'paused', 'cancelled');
create type public.user_role as enum ('client_owner', 'client_editor', 'operator_admin');
create type public.site_status as enum ('draft', 'published', 'archived');
create type public.asset_kind as enum ('image');
create type public.chat_session_status as enum ('active', 'closed');
create type public.chat_message_role as enum ('user', 'assistant', 'system');
create type public.suggestion_status as enum ('pending', 'selected', 'dismissed');
create type public.change_set_status as enum (
  'draft',
  'awaiting_confirmation',
  'approved',
  'applied',
  'rejected',
  'cancelled'
);
create type public.news_post_status as enum ('draft', 'published', 'archived');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null,
  plan_name text,
  status public.client_status not null default 'trial',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint clients_slug_not_blank check (btrim(slug) <> '')
);

create unique index clients_slug_unique_idx
  on public.clients ((lower(slug)));

create table public.users (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete cascade,
  auth_user_id uuid references auth.users(id) on delete set null,
  role public.user_role not null,
  email text not null,
  full_name text,
  last_login_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint users_email_not_blank check (btrim(email) <> ''),
  constraint users_operator_client_rule check (
    (role = 'operator_admin' and client_id is null)
    or (role <> 'operator_admin' and client_id is not null)
  )
);

create unique index users_email_unique_idx
  on public.users ((lower(email)));

create unique index users_auth_user_id_unique_idx
  on public.users (auth_user_id)
  where auth_user_id is not null;

create index users_client_id_idx
  on public.users (client_id);

create table public.site_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null,
  description text,
  template_version text not null,
  editable_fields_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint site_templates_name_not_blank check (btrim(name) <> ''),
  constraint site_templates_code_not_blank check (btrim(code) <> ''),
  constraint site_templates_version_not_blank check (btrim(template_version) <> ''),
  constraint site_templates_editable_fields_is_array check (
    jsonb_typeof(editable_fields_json) = 'array'
  )
);

create unique index site_templates_code_version_unique_idx
  on public.site_templates ((lower(code)), template_version);

create table public.sites (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  template_id uuid not null references public.site_templates(id) on delete restrict,
  slug text not null,
  domain text,
  name text not null,
  status public.site_status not null default 'draft',
  current_version_id uuid,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint sites_slug_not_blank check (btrim(slug) <> ''),
  constraint sites_name_not_blank check (btrim(name) <> '')
);

create unique index sites_client_slug_unique_idx
  on public.sites (client_id, lower(slug));

create unique index sites_domain_unique_idx
  on public.sites ((lower(domain)))
  where domain is not null;

create index sites_template_id_idx
  on public.sites (template_id);

create index sites_client_id_idx
  on public.sites (client_id);

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  kind public.asset_kind not null default 'image',
  storage_path text not null,
  original_filename text not null,
  mime_type text not null,
  byte_size bigint not null,
  width integer,
  height integer,
  alt_text text,
  created_by_user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint assets_storage_path_not_blank check (btrim(storage_path) <> ''),
  constraint assets_original_filename_not_blank check (btrim(original_filename) <> ''),
  constraint assets_mime_type_not_blank check (btrim(mime_type) <> ''),
  constraint assets_byte_size_positive check (byte_size > 0),
  constraint assets_width_positive check (width is null or width > 0),
  constraint assets_height_positive check (height is null or height > 0)
);

create unique index assets_site_storage_path_unique_idx
  on public.assets (site_id, storage_path);

create index assets_client_id_idx
  on public.assets (client_id);

create index assets_created_by_user_id_idx
  on public.assets (created_by_user_id);

create table public.news_posts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  title text not null,
  body text not null,
  image_asset_id uuid references public.assets(id) on delete set null,
  status public.news_post_status not null default 'draft',
  published_at timestamptz,
  created_by_user_id uuid references public.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint news_posts_title_not_blank check (btrim(title) <> ''),
  constraint news_posts_body_not_blank check (btrim(body) <> '')
);

create index news_posts_site_id_idx
  on public.news_posts (site_id);

create index news_posts_published_at_idx
  on public.news_posts (site_id, published_at desc);

create table public.chat_sessions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  title text,
  status public.chat_session_status not null default 'active',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  closed_at timestamptz
);

create index chat_sessions_site_status_idx
  on public.chat_sessions (site_id, status, created_at desc);

create index chat_sessions_user_id_idx
  on public.chat_sessions (user_id, created_at desc);

create table public.change_sets (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  chat_session_id uuid references public.chat_sessions(id) on delete set null,
  requested_by_user_id uuid not null references public.users(id) on delete restrict,
  approved_by_user_id uuid references public.users(id) on delete set null,
  status public.change_set_status not null default 'draft',
  intent_category text,
  summary text,
  payload_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  approved_at timestamptz,
  applied_at timestamptz,
  rejected_at timestamptz,
  constraint change_sets_payload_is_object check (jsonb_typeof(payload_json) = 'object')
);

create index change_sets_site_status_idx
  on public.change_sets (site_id, status, created_at desc);

create index change_sets_chat_session_id_idx
  on public.change_sets (chat_session_id);

create index change_sets_requested_by_user_id_idx
  on public.change_sets (requested_by_user_id);

create table public.site_versions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  site_id uuid not null references public.sites(id) on delete cascade,
  version_number integer not null,
  parent_version_id uuid references public.site_versions(id) on delete set null,
  rollback_from_version_id uuid references public.site_versions(id) on delete set null,
  snapshot_json jsonb not null,
  summary text,
  created_by_user_id uuid references public.users(id) on delete set null,
  source_change_set_id uuid references public.change_sets(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint site_versions_version_number_positive check (version_number > 0),
  constraint site_versions_snapshot_is_object check (jsonb_typeof(snapshot_json) = 'object')
);

comment on table public.site_versions is
  '公開状態の正本を保持するフルスナップショット。公開判定後にのみ追加される。';

create unique index site_versions_site_version_number_unique_idx
  on public.site_versions (site_id, version_number);

create index site_versions_parent_version_id_idx
  on public.site_versions (parent_version_id);

create index site_versions_rollback_from_version_id_idx
  on public.site_versions (rollback_from_version_id);

create index site_versions_source_change_set_id_idx
  on public.site_versions (source_change_set_id);

create index site_versions_created_by_user_id_idx
  on public.site_versions (created_by_user_id);

create table public.version_changes (
  id uuid primary key default gen_random_uuid(),
  site_version_id uuid not null references public.site_versions(id) on delete cascade,
  page_key text,
  section_key text,
  field_key text,
  change_type text not null,
  before_value jsonb,
  after_value jsonb,
  summary text,
  created_at timestamptz not null default timezone('utc', now()),
  constraint version_changes_change_type_not_blank check (btrim(change_type) <> ''),
  constraint version_changes_has_value check (
    before_value is not null or after_value is not null
  )
);

comment on table public.version_changes is
  '差分表示専用テーブル。復元の正本ではなく、履歴画面表示のために保持する。';

create index version_changes_site_version_id_idx
  on public.version_changes (site_version_id);

create index version_changes_site_version_page_idx
  on public.version_changes (site_version_id, page_key, section_key, field_key);

create table public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.chat_sessions(id) on delete cascade,
  role public.chat_message_role not null,
  content text not null,
  metadata jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  constraint chat_messages_content_not_blank check (btrim(content) <> '')
);

create index chat_messages_session_created_at_idx
  on public.chat_messages (session_id, created_at);

create table public.suggestion_sets (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.chat_sessions(id) on delete cascade,
  change_set_id uuid references public.change_sets(id) on delete set null,
  suggestions_json jsonb not null,
  status public.suggestion_status not null default 'pending',
  selected_suggestion_key text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint suggestion_sets_suggestions_is_array check (
    jsonb_typeof(suggestions_json) = 'array'
  )
);

create index suggestion_sets_session_status_idx
  on public.suggestion_sets (session_id, status, created_at desc);

create index suggestion_sets_change_set_id_idx
  on public.suggestion_sets (change_set_id);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete cascade,
  site_id uuid references public.sites(id) on delete cascade,
  actor_user_id uuid references public.users(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  constraint audit_logs_action_not_blank check (btrim(action) <> ''),
  constraint audit_logs_target_type_not_blank check (btrim(target_type) <> ''),
  constraint audit_logs_metadata_is_object check (jsonb_typeof(metadata) = 'object')
);

create index audit_logs_site_created_at_idx
  on public.audit_logs (site_id, created_at desc);

create index audit_logs_actor_user_id_idx
  on public.audit_logs (actor_user_id, created_at desc);

alter table public.sites
  add constraint sites_current_version_id_fkey
  foreign key (current_version_id)
  references public.site_versions(id)
  on delete set null;

create index sites_current_version_id_idx
  on public.sites (current_version_id);

create trigger set_clients_updated_at
before update on public.clients
for each row
execute function public.set_updated_at();

create trigger set_users_updated_at
before update on public.users
for each row
execute function public.set_updated_at();

create trigger set_site_templates_updated_at
before update on public.site_templates
for each row
execute function public.set_updated_at();

create trigger set_sites_updated_at
before update on public.sites
for each row
execute function public.set_updated_at();

create trigger set_assets_updated_at
before update on public.assets
for each row
execute function public.set_updated_at();

create trigger set_news_posts_updated_at
before update on public.news_posts
for each row
execute function public.set_updated_at();

create trigger set_chat_sessions_updated_at
before update on public.chat_sessions
for each row
execute function public.set_updated_at();

create trigger set_change_sets_updated_at
before update on public.change_sets
for each row
execute function public.set_updated_at();

create trigger set_suggestion_sets_updated_at
before update on public.suggestion_sets
for each row
execute function public.set_updated_at();
