-- Department-aware publisher model with withdraw support.

create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

insert into public.departments (name)
values ('General')
on conflict (name) do nothing;

insert into public.roles (role_name)
values ('Publisher_Global'), ('Publisher_Department')
on conflict (role_name) do nothing;

-- Migrate legacy Publisher role to Publisher_Department in an FK-safe way.
do $$
declare
  v_old_role_id uuid;
  v_new_role_id uuid;
begin
  select id into v_old_role_id
  from public.roles
  where role_name = 'Publisher'
  limit 1;

  if v_old_role_id is null then
    return;
  end if;

  select id into v_new_role_id
  from public.roles
  where role_name = 'Publisher_Department'
  limit 1;

  if v_new_role_id is null then
    update public.roles
    set role_name = 'Publisher_Department'
    where id = v_old_role_id;
    return;
  end if;

  -- Repoint any profiles using legacy Publisher role to Publisher_Department.
  update public.profiles
  set role_id = v_new_role_id
  where role_id = v_old_role_id;

  -- Safe to delete old role once no FK references remain.
  delete from public.roles
  where id = v_old_role_id;
end;
$$;

alter table public.profiles
  add column if not exists department_id uuid references public.departments (id) on delete restrict;

update public.profiles
set department_id = (select id from public.departments where name = 'General')
where department_id is null;

alter table public.profiles
  alter column department_id set not null;

alter table public.dashboards
  add column if not exists department_id uuid references public.departments (id) on delete restrict;

-- Temporarily disable guard trigger while running admin backfill updates.
do $$
begin
  if exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'dashboards'
      and t.tgname = 'dashboards_guard_in_charge_updates'
      and not t.tgisinternal
  ) then
    execute 'alter table public.dashboards disable trigger dashboards_guard_in_charge_updates';
  end if;
end;
$$;

update public.dashboards d
set department_id = coalesce(
  (select p.department_id from public.profiles p where p.id = d.publisher_id),
  (select p.department_id from public.profiles p where p.id = d.in_charge_id),
  (select id from public.departments where name = 'General')
)
where d.department_id is null;

alter table public.dashboards
  alter column department_id set not null;

create index if not exists profiles_department_role_idx
  on public.profiles (department_id, role_id);

create index if not exists dashboards_department_status_idx
  on public.dashboards (department_id, status);

create or replace function public.current_role_name(uid uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select r.role_name
  from public.profiles p
  join public.roles r on r.id = p.role_id
  where p.id = uid
  limit 1;
$$;

grant execute on function public.current_role_name(uuid) to authenticated;

create or replace function public.is_global_publisher(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_role_name(uid) = 'Publisher_Global';
$$;

grant execute on function public.is_global_publisher(uuid) to authenticated;

create or replace function public.department_id_of(uid uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select p.department_id
  from public.profiles p
  where p.id = uid
  limit 1;
$$;

grant execute on function public.department_id_of(uuid) to authenticated;

drop policy if exists dashboards_publishers_select_own on public.dashboards;
create policy dashboards_publishers_select_own
on public.dashboards
for select
to authenticated
using (
  publisher_id = auth.uid()
  or (
    public.is_global_publisher(auth.uid())
    and department_id = public.department_id_of(auth.uid())
  )
);

drop policy if exists dashboards_publishers_insert_own on public.dashboards;
create policy dashboards_publishers_insert_own
on public.dashboards
for insert
to authenticated
with check (
  (
    publisher_id = auth.uid()
    and public.current_role_name(auth.uid()) = 'Publisher_Department'
    and department_id = public.department_id_of(auth.uid())
  )
  or (
    public.is_global_publisher(auth.uid())
    and department_id = public.department_id_of(auth.uid())
  )
);

drop policy if exists dashboards_publishers_update_working on public.dashboards;
create policy dashboards_publishers_update_working
on public.dashboards
for update
to authenticated
using (
  publisher_id = auth.uid()
  or (
    public.is_global_publisher(auth.uid())
    and department_id = public.department_id_of(auth.uid())
  )
)
with check (
  department_id = public.department_id_of(auth.uid())
  and (
    publisher_id = auth.uid()
    or public.is_global_publisher(auth.uid())
  )
);

create or replace function public.guard_in_charge_dashboard_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_is_superadmin boolean;
  actor_role_name text;
  actor_department uuid;
begin
  actor_is_superadmin := public.is_superadmin(auth.uid());
  if actor_is_superadmin then
    return new;
  end if;

  actor_role_name := public.current_role_name(auth.uid());
  actor_department := public.department_id_of(auth.uid());

  if actor_role_name = 'InCharge' then
    if old.in_charge_id <> auth.uid() then
      raise exception 'In-Charge users may only update assigned dashboards';
    end if;
    if new.title is distinct from old.title
      or new.description is distinct from old.description
      or new.power_bi_embed_url is distinct from old.power_bi_embed_url
      or new.target_role_id is distinct from old.target_role_id
      or new.in_charge_id is distinct from old.in_charge_id
      or new.publisher_id is distinct from old.publisher_id
      or new.department_id is distinct from old.department_id then
      raise exception 'In-Charge users may only update status and rejection_reason';
    end if;
    return new;
  end if;

  if actor_role_name in ('Publisher_Department', 'Publisher_Global') then
    if old.department_id <> actor_department or new.department_id <> actor_department then
      raise exception 'Publishers can only manage dashboards in their department';
    end if;
    if actor_role_name = 'Publisher_Department' and old.publisher_id <> auth.uid() then
      raise exception 'Department publishers may only update their own dashboards';
    end if;
    if actor_role_name = 'Publisher_Department' and new.publisher_id <> old.publisher_id then
      raise exception 'Department publishers cannot reassign publisher';
    end if;

    -- Draft/Rejected: full content edits + submit
    if old.status in ('Draft', 'Rejected') then
      if new.status not in ('Draft', 'Pending_Review') then
        raise exception 'Publishers may only set status to Draft or Pending_Review from Draft/Rejected';
      end if;
      if new.rejection_reason is not null then
        raise exception 'Publishers cannot set rejection_reason';
      end if;
      return new;
    end if;

    -- Pending_Review: only withdraw back to Draft, content remains unchanged.
    if old.status = 'Pending_Review' then
      if new.status <> 'Draft' then
        raise exception 'Publishers may only withdraw Pending_Review to Draft';
      end if;
      if new.title is distinct from old.title
        or new.description is distinct from old.description
        or new.power_bi_embed_url is distinct from old.power_bi_embed_url
        or new.target_role_id is distinct from old.target_role_id
        or new.in_charge_id is distinct from old.in_charge_id
        or new.publisher_id is distinct from old.publisher_id then
        raise exception 'Withdraw does not allow content changes';
      end if;
      if new.rejection_reason is not null then
        raise exception 'Withdraw requires rejection_reason to be null';
      end if;
      return new;
    end if;

    raise exception 'Publishers cannot edit dashboards in this status';
  end if;

  raise exception 'Role not allowed to update dashboards';
end;
$$;

grant execute on function public.guard_in_charge_dashboard_update() to authenticated;

-- Re-enable guard trigger after migration updates and function replacement.
do $$
begin
  if exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = 'dashboards'
      and t.tgname = 'dashboards_guard_in_charge_updates'
      and not t.tgisinternal
  ) then
    execute 'alter table public.dashboards enable trigger dashboards_guard_in_charge_updates';
  end if;
end;
$$;
