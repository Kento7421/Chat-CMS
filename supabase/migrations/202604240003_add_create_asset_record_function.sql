create or replace function public.create_asset_record(
  p_site_id uuid,
  p_storage_path text,
  p_original_filename text,
  p_mime_type text,
  p_byte_size bigint,
  p_width integer default null,
  p_height integer default null,
  p_alt_text text default null,
  p_asset_id uuid default null
)
returns public.assets
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  target_site public.sites%rowtype;
  created_asset public.assets%rowtype;
  app_user_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  if not public.can_access_site(p_site_id) then
    raise exception 'You do not have access to create assets for this site.';
  end if;

  if p_storage_path is null or btrim(p_storage_path) = '' then
    raise exception 'Storage path is required.';
  end if;

  if p_storage_path not like p_site_id::text || '/%' then
    raise exception 'Storage path must stay within the target site namespace.';
  end if;

  select *
  into target_site
  from public.sites
  where id = p_site_id;

  if not found then
    raise exception 'Target site was not found.';
  end if;

  app_user_id := public.current_app_user_id();

  insert into public.assets (
    id,
    client_id,
    site_id,
    kind,
    storage_path,
    original_filename,
    mime_type,
    byte_size,
    width,
    height,
    alt_text,
    created_by_user_id
  )
  values (
    coalesce(p_asset_id, gen_random_uuid()),
    target_site.client_id,
    p_site_id,
    'image',
    p_storage_path,
    p_original_filename,
    p_mime_type,
    p_byte_size,
    p_width,
    p_height,
    nullif(btrim(coalesce(p_alt_text, '')), ''),
    app_user_id
  )
  returning *
  into created_asset;

  return created_asset;
end;
$$;

grant execute on function public.create_asset_record(
  uuid,
  text,
  text,
  text,
  bigint,
  integer,
  integer,
  text,
  uuid
) to authenticated;
