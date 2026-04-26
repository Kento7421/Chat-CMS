create or replace function public.update_site_analytics_settings(
  p_site_id uuid,
  p_provider text,
  p_ga4_property_id text default null
)
returns public.sites
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  updated_site public.sites%rowtype;
  normalized_provider text;
  normalized_property_id text;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  if not public.can_access_site(p_site_id) then
    raise exception 'You do not have access to update this site.';
  end if;

  normalized_provider := lower(trim(coalesce(p_provider, '')));

  if normalized_provider not in ('fallback', 'ga4') then
    raise exception 'Analytics provider is invalid.';
  end if;

  normalized_property_id := nullif(trim(coalesce(p_ga4_property_id, '')), '');

  update public.sites
  set
    analytics_provider = normalized_provider,
    ga4_property_id = case
      when normalized_provider = 'ga4' then normalized_property_id
      else null
    end
  where id = p_site_id
  returning *
  into updated_site;

  if not found then
    raise exception 'Target site was not found.';
  end if;

  return updated_site;
end;
$$;

grant execute on function public.update_site_analytics_settings(uuid, text, text) to authenticated;
