alter table public.dashboards enable row level security;
alter table public.profiles enable row level security;
alter table public.roles enable row level security;
alter table public.dashboard_review_audit_logs enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own
on public.profiles
for select
to authenticated
using (id = auth.uid());

drop policy if exists roles_select_all_authenticated on public.roles;
create policy roles_select_all_authenticated
on public.roles
for select
to authenticated
using (true);

drop policy if exists dashboard_review_logs_select on public.dashboard_review_audit_logs;
create policy dashboard_review_logs_select
on public.dashboard_review_audit_logs
for select
to authenticated
using (
  actor_id = auth.uid()
  or exists (
    select 1
    from public.profiles p
    join public.roles r on r.id = p.role_id
    where p.id = auth.uid()
      and r.role_name = 'SuperAdmin'
  )
);

create or replace function public.is_superadmin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    join public.roles r on r.id = p.role_id
    where p.id = uid
      and r.role_name = 'SuperAdmin'
  );
$$;

grant execute on function public.is_superadmin(uuid) to authenticated;

-- Policy 3: SuperAdmin can do anything.
drop policy if exists dashboards_superadmin_all on public.dashboards;
create policy dashboards_superadmin_all
on public.dashboards
for all
using (public.is_superadmin(auth.uid()))
with check (public.is_superadmin(auth.uid()));

-- Policy 1: Viewers can read only published dashboards for their role.
drop policy if exists dashboards_viewers_select on public.dashboards;
create policy dashboards_viewers_select
on public.dashboards
for select
using (
  status = 'Published'
  and target_role_id = (
    select p.role_id
    from public.profiles p
    where p.id = auth.uid()
  )
);

-- Policy 2: In-Charge can read their pending-review dashboards.
drop policy if exists dashboards_in_charge_select_pending on public.dashboards;
create policy dashboards_in_charge_select_pending
on public.dashboards
for select
using (
  status = 'Pending_Review'
  and in_charge_id = auth.uid()
);

-- Policy 2: In-Charge can update only dashboards assigned to them
-- while still pending review.
drop policy if exists dashboards_in_charge_update_pending on public.dashboards;
create policy dashboards_in_charge_update_pending
on public.dashboards
for update
using (
  status = 'Pending_Review'
  and in_charge_id = auth.uid()
)
with check (
  in_charge_id = auth.uid()
);

-- Restrict In-Charge updates to status/rejection_reason only.
create or replace function public.guard_in_charge_dashboard_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_is_superadmin boolean;
begin
  actor_is_superadmin := public.is_superadmin(auth.uid());

  if actor_is_superadmin then
    return new;
  end if;

  if old.in_charge_id = auth.uid() then
    if new.title is distinct from old.title
      or new.description is distinct from old.description
      or new.power_bi_embed_url is distinct from old.power_bi_embed_url
      or new.target_role_id is distinct from old.target_role_id
      or new.in_charge_id is distinct from old.in_charge_id then
      raise exception 'In-Charge users may only update status and rejection_reason';
    end if;
  end if;

  return new;
end;
$$;

grant execute on function public.guard_in_charge_dashboard_update() to authenticated;

drop trigger if exists dashboards_guard_in_charge_updates on public.dashboards;
create trigger dashboards_guard_in_charge_updates
before update on public.dashboards
for each row
execute procedure public.guard_in_charge_dashboard_update();

-- Stable approval/rejection RPC for authenticated clients.
create or replace function public.review_dashboard(
  p_dashboard_id uuid,
  p_action text,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid;
  v_is_superadmin boolean;
  v_in_charge_id uuid;
  v_status text;
  v_reason text;
  v_actor_role text;
begin
  v_uid := auth.uid();
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  v_is_superadmin := public.is_superadmin(v_uid);
  v_actor_role := case when v_is_superadmin then 'SuperAdmin' else 'InCharge' end;

  select d.in_charge_id, d.status
  into v_in_charge_id, v_status
  from public.dashboards d
  where d.id = p_dashboard_id;

  if not found then
    raise exception 'Dashboard not found';
  end if;

  if not v_is_superadmin then
    if v_in_charge_id <> v_uid then
      raise exception 'Not allowed for this dashboard';
    end if;
    if v_status <> 'Pending_Review' then
      raise exception 'Dashboard is no longer pending review';
    end if;
  end if;

  if p_action = 'approve' then
    update public.dashboards
    set status = 'Published',
        rejection_reason = null
    where id = p_dashboard_id;

    insert into public.dashboard_review_audit_logs (
      dashboard_id,
      actor_id,
      actor_role,
      action,
      previous_status,
      new_status,
      rejection_reason
    ) values (
      p_dashboard_id,
      v_uid,
      v_actor_role,
      'approve',
      v_status,
      'Published',
      null
    );
    return;
  end if;

  if p_action = 'reject' then
    v_reason := trim(coalesce(p_reason, ''));
    if v_reason = '' then
      raise exception 'Rejection reason is required';
    end if;

    update public.dashboards
    set status = 'Rejected',
        rejection_reason = v_reason
    where id = p_dashboard_id;

    insert into public.dashboard_review_audit_logs (
      dashboard_id,
      actor_id,
      actor_role,
      action,
      previous_status,
      new_status,
      rejection_reason
    ) values (
      p_dashboard_id,
      v_uid,
      v_actor_role,
      'reject',
      v_status,
      'Rejected',
      v_reason
    );
    return;
  end if;

  raise exception 'Invalid action. Use approve or reject';
end;
$$;

grant execute on function public.review_dashboard(uuid, text, text) to authenticated;
