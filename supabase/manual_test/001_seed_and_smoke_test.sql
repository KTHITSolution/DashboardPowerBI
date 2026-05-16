-- Run after migrations to validate RBAC + workflow quickly.
-- Replace UUID placeholders with real auth.users ids from your project.

-- Safety for manual execution: ensure department table exists.
create table if not exists public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

-- 1) Seed roles
insert into public.roles (role_name)
values ('SuperAdmin'), ('InCharge'), ('Viewer_Marketing'), ('Publisher_Global'), ('Publisher_Department')
on conflict (role_name) do nothing;

insert into public.departments (name)
values ('Marketing')
on conflict (name) do nothing;

-- 2) Map test auth users to profiles
-- Replace IDs with real auth.users ids from your project.
with seed_profiles as (
  select * from (
    values
      ('088a8d09-5ce1-4d0d-9b65-4d7d323c76ea'::uuid, 'Super Admin User', 'SuperAdmin'),
      ('0d85b78a-baaf-41a6-822c-3e18f77c6695'::uuid, 'In Charge User', 'InCharge'),
      ('69749f15-0e67-450e-9766-7ee6a5becbf9'::uuid, 'Viewer Marketing User', 'Viewer_Marketing'),
      ('2bf76876-c4dc-4b46-afe8-a66fc784b09b'::uuid, 'Publisher Department User', 'Publisher_Department'),
      ('9f9499d4-c8ea-4d8e-b0f6-7ab9fde4e210'::uuid, 'Publisher Global User', 'Publisher_Global')
  ) as t(id, full_name, role_name)
)
insert into public.profiles (id, full_name, role_id, department_id)
select
  sp.id,
  sp.full_name,
  r.id as role_id,
  d.id as department_id
from seed_profiles sp
join auth.users u on u.id = sp.id
join public.roles r on r.role_name = sp.role_name
join public.departments d on d.name = 'Marketing'
on conflict (id) do update
set
  full_name = excluded.full_name,
  role_id = excluded.role_id,
  department_id = excluded.department_id;

-- Shows which seed ids are missing in auth.users.
with seed_profiles as (
  select * from (
    values
      ('088a8d09-5ce1-4d0d-9b65-4d7d323c76ea'::uuid, 'Super Admin User'),
      ('0d85b78a-baaf-41a6-822c-3e18f77c6695'::uuid, 'In Charge User'),
      ('69749f15-0e67-450e-9766-7ee6a5becbf9'::uuid, 'Viewer Marketing User'),
      ('2bf76876-c4dc-4b46-afe8-a66fc784b09b'::uuid, 'Publisher Department User'),
      ('9f9499d4-c8ea-4d8e-b0f6-7ab9fde4e210'::uuid, 'Publisher Global User')
  ) as t(id, full_name)
)
select sp.id as missing_auth_user_id, sp.full_name
from seed_profiles sp
left join auth.users u on u.id = sp.id
where u.id is null;

-- 3) Seed dashboards
insert into public.dashboards
  (title, description, power_bi_embed_url, target_role_id, status, in_charge_id, publisher_id, department_id, rejection_reason)
select
  seed.title,
  seed.description,
  seed.power_bi_embed_url,
  target_role.id,
  seed.status,
  in_charge.id,
  publisher.id,
  department.id,
  null
from (
  values
    ('Marketing KPI Q2', 'Published dashboard visible to Viewer_Marketing', 'https://app.powerbi.com/reportEmbed?reportId=demo-report', 'Published'::text),
    ('Campaign Spend Review', 'Pending approval item for InCharge', 'https://app.powerbi.com/reportEmbed?reportId=demo-report-2', 'Pending_Review'::text)
) as seed(title, description, power_bi_embed_url, status)
join public.roles target_role on target_role.role_name = 'Viewer_Marketing'
join public.profiles in_charge on in_charge.id = '0d85b78a-baaf-41a6-822c-3e18f77c6695'
join public.profiles publisher on publisher.id = '2bf76876-c4dc-4b46-afe8-a66fc784b09b'
join public.departments department on department.name = 'Marketing'
on conflict do nothing;

-- 4) Sanity checks (run as SQL editor admin first)
select id, role_name from public.roles order by role_name;
select id, full_name, role_id, department_id from public.profiles order by full_name;
select id, title, status, in_charge_id, publisher_id, department_id from public.dashboards order by created_at desc;

-- 5) RLS policy checks to run from client sessions:
-- - Viewer_Marketing sees only Published + matching role target.
-- - InCharge sees Pending_Review assigned to own id and can update status/rejection_reason.
-- - Publisher_Department can create/edit own Draft/Rejected, submit, and withdraw Pending_Review.
-- - Publisher_Global can manage department-scoped dashboards and preview all statuses in workspace.
-- - SuperAdmin sees/updates all rows.
