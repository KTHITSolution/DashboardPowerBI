-- Allow In-Charge users to view published dashboards assigned to them.
-- SuperAdmin access is already covered by dashboards_superadmin_all.
drop policy if exists dashboards_in_charge_select_published_assigned on public.dashboards;
create policy dashboards_in_charge_select_published_assigned
on public.dashboards
for select
to authenticated
using (
  status = 'Published'
  and in_charge_id = auth.uid()
);
