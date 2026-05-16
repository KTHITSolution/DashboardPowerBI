-- Enable extension needed for UUID generation.
create extension if not exists pgcrypto;

-- Roles table.
create table if not exists public.roles (
  id uuid primary key default gen_random_uuid(),
  role_name text not null unique
);

-- Profiles linked 1:1 to Supabase auth users.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  role_id uuid not null references public.roles (id) on delete restrict
);

-- Dashboards with approval workflow metadata.
create table if not exists public.dashboards (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  power_bi_embed_url text not null,
  target_role_id uuid not null references public.roles (id) on delete restrict,
  status text not null check (status in ('Draft', 'Pending_Review', 'Published', 'Rejected')),
  in_charge_id uuid not null references public.profiles (id) on delete restrict,
  rejection_reason text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- OWASP hardening constraints.
alter table public.dashboards
  drop constraint if exists dashboards_power_bi_url_allowed_chk;
alter table public.dashboards
  add constraint dashboards_power_bi_url_allowed_chk
  check (power_bi_embed_url ~ '^https://app\.powerbi\.com/.*');

alter table public.dashboards
  drop constraint if exists dashboards_rejection_reason_status_chk;
alter table public.dashboards
  add constraint dashboards_rejection_reason_status_chk
  check (
    (status <> 'Rejected' and (rejection_reason is null or length(trim(rejection_reason)) = 0))
    or
    (status = 'Rejected' and rejection_reason is not null and length(trim(rejection_reason)) between 1 and 500)
  );

create table if not exists public.dashboard_review_audit_logs (
  id uuid primary key default gen_random_uuid(),
  dashboard_id uuid not null references public.dashboards (id) on delete cascade,
  actor_id uuid not null references public.profiles (id) on delete restrict,
  actor_role text not null,
  action text not null check (action in ('approve', 'reject')),
  previous_status text not null,
  new_status text not null,
  rejection_reason text null,
  created_at timestamptz not null default now()
);

create index if not exists dashboard_review_audit_logs_dashboard_created_idx
  on public.dashboard_review_audit_logs (dashboard_id, created_at desc);

create index if not exists dashboard_review_audit_logs_actor_created_idx
  on public.dashboard_review_audit_logs (actor_id, created_at desc);

grant usage on schema public to authenticated;
grant select on public.roles to authenticated;
grant select on public.profiles to authenticated;
grant select, update on public.dashboards to authenticated;
grant select on public.dashboard_review_audit_logs to authenticated;

create index if not exists dashboards_target_role_status_idx
  on public.dashboards (target_role_id, status);

create index if not exists dashboards_in_charge_status_idx
  on public.dashboards (in_charge_id, status);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists dashboards_set_updated_at on public.dashboards;
create trigger dashboards_set_updated_at
before update on public.dashboards
for each row
execute procedure public.set_updated_at();
