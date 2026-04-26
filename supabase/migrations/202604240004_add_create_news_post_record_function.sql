create or replace function public.create_news_post_record(
  p_site_id uuid,
  p_title text,
  p_body text,
  p_image_asset_id uuid default null,
  p_status public.news_post_status default 'draft',
  p_published_at timestamptz default null,
  p_news_post_id uuid default null
)
returns public.news_posts
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  target_site public.sites%rowtype;
  created_post public.news_posts%rowtype;
  app_user_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  if not public.can_access_site(p_site_id) then
    raise exception 'You do not have access to create news posts for this site.';
  end if;

  if p_title is null or btrim(p_title) = '' then
    raise exception 'Title is required.';
  end if;

  if p_body is null or btrim(p_body) = '' then
    raise exception 'Body is required.';
  end if;

  select *
  into target_site
  from public.sites
  where id = p_site_id;

  if not found then
    raise exception 'Target site was not found.';
  end if;

  if p_image_asset_id is not null then
    if not exists (
      select 1
      from public.assets as a
      where a.id = p_image_asset_id
        and a.site_id = p_site_id
        and a.client_id = target_site.client_id
    ) then
      raise exception 'Selected asset does not belong to the target site.';
    end if;
  end if;

  app_user_id := public.current_app_user_id();

  insert into public.news_posts (
    id,
    client_id,
    site_id,
    title,
    body,
    image_asset_id,
    status,
    published_at,
    created_by_user_id
  )
  values (
    coalesce(p_news_post_id, gen_random_uuid()),
    target_site.client_id,
    p_site_id,
    p_title,
    p_body,
    p_image_asset_id,
    p_status,
    case
      when p_status = 'published' then coalesce(p_published_at, timezone('utc', now()))
      else null
    end,
    app_user_id
  )
  returning *
  into created_post;

  return created_post;
end;
$$;

grant execute on function public.create_news_post_record(
  uuid,
  text,
  text,
  uuid,
  public.news_post_status,
  timestamptz,
  uuid
) to authenticated;
