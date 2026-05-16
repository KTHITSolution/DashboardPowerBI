-- Add dedicated Publisher role for managing dashboard content before approval.
insert into public.roles (role_name)
values ('Publisher')
on conflict (role_name) do nothing;

-- Track who owns dashboard content edits.
alter table public.dashboards
  add column if not exists publisher_id uuid references public.profiles (id) on delete restrict;

update public.dashboards
set publisher_id = in_charge_id
where publisher_id is null
  and in_charge_id is not null;

alter table public.dashboards
  alter column publisher_id set not null;

create index if not exists dashboards_publisher_status_idx
  on public.dashboards (publisher_id, status);

-- Publisher can read own dashboards across statuses for revision workflow.
drop policy if exists dashboards_publishers_select_own on public.dashboards;
create policy dashboards_publishers_select_own
on public.dashboards
for select
to authenticated
using (
  publisher_id = auth.uid()
);

-- Publisher can create own working dashboards only.
drop policy if exists dashboards_publishers_insert_own on public.dashboards;
create policy dashboards_publishers_insert_own
on public.dashboards
for insert
to authenticated
with check (
  publisher_id = auth.uid()
  and status in ('Draft', 'Pending_Review')
  and rejection_reason is null
);

-- Publisher can update only own working dashboards.
drop policy if exists dashboards_publishers_update_working on public.dashboards;
create policy dashboards_publishers_update_working
on public.dashboards
for update
to authenticated
using (
  publisher_id = auth.uid()
  and status in ('Draft', 'Rejected')
)
with check (
  publisher_id = auth.uid()
  and status in ('Draft', 'Pending_Review')
  and rejection_reason is null
);

-- Strengthen update guard with role-aware restrictions.
create or replace function public.guard_in_charge_dashboard_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_is_superadmin boolean;
  actor_role_name text;
begin
  actor_is_superadmin := public.is_superadmin(auth.uid());
  if actor_is_superadmin then
    return new;
  end if;

  select r.role_name
  into actor_role_name
  from public.profiles p
  join public.roles r on r.id = p.role_id
  where p.id = auth.uid();

  if actor_role_name = 'InCharge' then
    if old.in_charge_id <> auth.uid() then
      raise exception 'In-Charge users may only update assigned dashboards';
    end if;
    if new.title is distinct from old.title
      or new.description is distinct from old.description
      or new.power_bi_embed_url is distinct from old.power_bi_embed_url
      or new.target_role_id is distinct from old.target_role_id
      or new.in_charge_id is distinct from old.in_charge_id
      or new.publisher_id is distinct from old.publisher_id then
      raise exception 'In-Charge users may only update status and rejection_reason';
    end if;
    return new;
  end if;

  if actor_role_name = 'Publisher' then
    if old.publisher_id <> auth.uid() then
      raise exception 'Publishers may only update their own dashboards';
    end if;
    if old.status not in ('Draft', 'Rejected') then
      raise exception 'Publishers can only edit Draft or Rejected dashboards';
    end if;
    if new.status not in ('Draft', 'Pending_Review') then
      raise exception 'Publishers may only set status to Draft or Pending_Review';
    end if;
    if new.rejection_reason is not null then
      raise exception 'Publishers cannot set rejection_reason';
    end if;
    if new.in_charge_id is distinct from old.in_charge_id
      or new.publisher_id is distinct from old.publisher_id then
      raise exception 'Publishers cannot reassign ownership fields';
    end if;
    return new;
  end if;

  raise exception 'Role not allowed to update dashboards';
end;
$$;

grant execute on function public.guard_in_charge_dashboard_update() to authenticated;
