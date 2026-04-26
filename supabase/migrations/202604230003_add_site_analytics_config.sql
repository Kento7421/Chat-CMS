alter table public.sites
  add column if not exists analytics_provider text not null default 'fallback',
  add column if not exists ga4_property_id text;

alter table public.sites
  drop constraint if exists sites_analytics_provider_check;

alter table public.sites
  add constraint sites_analytics_provider_check
  check (analytics_provider in ('fallback', 'ga4'));

comment on column public.sites.analytics_provider is
  'Analytics data source for dashboard analytics. fallback or ga4.';

comment on column public.sites.ga4_property_id is
  'Optional GA4 property id used when analytics_provider is ga4.';
