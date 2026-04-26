create or replace function public.commit_site_publication_transaction(
  p_site_id uuid,
  p_expected_current_version_id uuid,
  p_version_payload jsonb,
  p_diff_entries jsonb default '[]'::jsonb,
  p_change_set_id uuid default null,
  p_expected_change_set_status public.change_set_status default null,
  p_change_set_patch jsonb default null,
  p_news_post_payload jsonb default null,
  p_audit_log_payload jsonb default null
)
returns public.site_versions
language plpgsql
as $$
declare
  locked_site public.sites%rowtype;
  inserted_version public.site_versions%rowtype;
  version_client_id uuid;
  version_site_id uuid;
  version_snapshot jsonb;
  target_change_set public.change_sets%rowtype;
  inserted_news_post public.news_posts%rowtype;
begin
  if jsonb_typeof(coalesce(p_version_payload, 'null'::jsonb)) <> 'object' then
    raise exception 'Version payload must be an object.';
  end if;

  if jsonb_typeof(coalesce(p_diff_entries, '[]'::jsonb)) <> 'array' then
    raise exception 'Version diff entries must be an array.';
  end if;

  if p_change_set_patch is not null and jsonb_typeof(p_change_set_patch) <> 'object' then
    raise exception 'Change set patch must be an object.';
  end if;

  if p_news_post_payload is not null and jsonb_typeof(p_news_post_payload) <> 'object' then
    raise exception 'News post payload must be an object.';
  end if;

  if p_audit_log_payload is not null and jsonb_typeof(p_audit_log_payload) <> 'object' then
    raise exception 'Audit log payload must be an object.';
  end if;

  select *
  into locked_site
  from public.sites
  where id = p_site_id
  for update;

  if not found then
    raise exception 'Target site was not found.';
  end if;

  if locked_site.current_version_id is distinct from p_expected_current_version_id then
    raise exception 'Current site version changed during publication.';
  end if;

  version_client_id := nullif(p_version_payload ->> 'client_id', '')::uuid;
  version_site_id := nullif(p_version_payload ->> 'site_id', '')::uuid;
  version_snapshot := p_version_payload -> 'snapshot_json';

  if version_client_id is null then
    raise exception 'Version payload must include client_id.';
  end if;

  if version_site_id is distinct from p_site_id then
    raise exception 'Version payload site_id must match target site.';
  end if;

  if jsonb_typeof(coalesce(version_snapshot, 'null'::jsonb)) <> 'object' then
    raise exception 'Version payload must include snapshot_json as an object.';
  end if;

  if p_change_set_id is not null then
    select *
    into target_change_set
    from public.change_sets
    where id = p_change_set_id
    for update;

    if not found then
      raise exception 'Target change set was not found.';
    end if;

    if target_change_set.site_id is distinct from p_site_id then
      raise exception 'Target change set does not belong to the requested site.';
    end if;

    if p_expected_change_set_status is not null
       and target_change_set.status is distinct from p_expected_change_set_status then
      raise exception 'Change set status changed during publication.';
    end if;
  end if;

  if p_news_post_payload is not null then
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
      coalesce(nullif(p_news_post_payload ->> 'id', '')::uuid, gen_random_uuid()),
      nullif(p_news_post_payload ->> 'client_id', '')::uuid,
      nullif(p_news_post_payload ->> 'site_id', '')::uuid,
      coalesce(p_news_post_payload ->> 'title', ''),
      coalesce(p_news_post_payload ->> 'body', ''),
      nullif(p_news_post_payload ->> 'image_asset_id', '')::uuid,
      coalesce((p_news_post_payload ->> 'status')::public.news_post_status, 'draft'),
      nullif(p_news_post_payload ->> 'published_at', '')::timestamptz,
      nullif(p_news_post_payload ->> 'created_by_user_id', '')::uuid
    )
    returning *
    into inserted_news_post;
  end if;

  insert into public.site_versions (
    client_id,
    site_id,
    version_number,
    parent_version_id,
    rollback_from_version_id,
    snapshot_json,
    summary,
    created_by_user_id,
    source_change_set_id
  )
  values (
    version_client_id,
    version_site_id,
    (p_version_payload ->> 'version_number')::integer,
    nullif(p_version_payload ->> 'parent_version_id', '')::uuid,
    nullif(p_version_payload ->> 'rollback_from_version_id', '')::uuid,
    version_snapshot,
    p_version_payload ->> 'summary',
    nullif(p_version_payload ->> 'created_by_user_id', '')::uuid,
    nullif(p_version_payload ->> 'source_change_set_id', '')::uuid
  )
  returning *
  into inserted_version;

  insert into public.version_changes (
    site_version_id,
    page_key,
    section_key,
    field_key,
    change_type,
    before_value,
    after_value,
    summary
  )
  select
    inserted_version.id,
    nullif(item ->> 'page_key', ''),
    nullif(item ->> 'section_key', ''),
    nullif(item ->> 'field_key', ''),
    coalesce(item ->> 'change_type', ''),
    item -> 'before_value',
    item -> 'after_value',
    nullif(item ->> 'summary', '')
  from jsonb_array_elements(coalesce(p_diff_entries, '[]'::jsonb)) as item;

  update public.sites
  set current_version_id = inserted_version.id
  where id = p_site_id;

  if p_change_set_id is not null then
    update public.change_sets
    set
      status = case
        when p_change_set_patch ? 'status'
          then (p_change_set_patch ->> 'status')::public.change_set_status
        else status
      end,
      approved_by_user_id = case
        when p_change_set_patch ? 'approved_by_user_id'
          then nullif(p_change_set_patch ->> 'approved_by_user_id', '')::uuid
        else approved_by_user_id
      end,
      approved_at = case
        when p_change_set_patch ? 'approved_at'
          then nullif(p_change_set_patch ->> 'approved_at', '')::timestamptz
        else approved_at
      end,
      applied_at = case
        when p_change_set_patch ? 'applied_at'
          then nullif(p_change_set_patch ->> 'applied_at', '')::timestamptz
        else applied_at
      end,
      rejected_at = case
        when p_change_set_patch ? 'rejected_at'
          then nullif(p_change_set_patch ->> 'rejected_at', '')::timestamptz
        else rejected_at
      end
    where id = p_change_set_id;
  end if;

  if p_audit_log_payload is not null then
    insert into public.audit_logs (
      client_id,
      site_id,
      actor_user_id,
      action,
      target_type,
      target_id,
      metadata
    )
    values (
      nullif(p_audit_log_payload ->> 'client_id', '')::uuid,
      nullif(p_audit_log_payload ->> 'site_id', '')::uuid,
      nullif(p_audit_log_payload ->> 'actor_user_id', '')::uuid,
      coalesce(p_audit_log_payload ->> 'action', ''),
      coalesce(p_audit_log_payload ->> 'target_type', ''),
      coalesce(
        nullif(p_audit_log_payload ->> 'target_id', '')::uuid,
        inserted_version.id
      ),
      coalesce(p_audit_log_payload -> 'metadata', '{}'::jsonb)
        || jsonb_build_object('publishedVersionId', inserted_version.id)
    );
  end if;

  return inserted_version;
end;
$$;
