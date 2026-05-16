-- Allow publishers to discover eligible In-Charge profiles in their department.
-- Keep existing "select own profile" behavior from prior policies.

drop policy if exists profiles_publishers_select_in_charge on public.profiles;
create policy profiles_publishers_select_in_charge
on public.profiles
for select
to authenticated
using (
  (
    exists (
      select 1
      from public.roles target_role
      where target_role.id = public.profiles.role_id
        and target_role.role_name = 'InCharge'
    )
    and (
      public.current_role_name(auth.uid()) = 'SuperAdmin'
      or (
        public.current_role_name(auth.uid()) in ('Publisher_Department', 'Publisher_Global')
        and public.department_id_of(auth.uid()) = public.profiles.department_id
      )
    )
  )
);
