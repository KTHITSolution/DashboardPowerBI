create table if not exists public.dashboard_view_preferences (
  user_id uuid not null references public.profiles (id) on delete cascade,
  dashboard_id uuid not null references public.dashboards (id) on delete cascade,
  view_mode text not null check (view_mode in ('default', 'fit-width', 'fit-page', 'fullscreen')),
  updated_at timestamptz not null default now(),
  primary key (user_id, dashboard_id)
);

create index if not exists dashboard_view_preferences_user_idx
  on public.dashboard_view_preferences (user_id);

grant select, insert, update, delete on public.dashboard_view_preferences to authenticated;

alter table public.dashboard_view_preferences enable row level security;

drop policy if exists dashboard_view_preferences_own_select on public.dashboard_view_preferences;
create policy dashboard_view_preferences_own_select
on public.dashboard_view_preferences
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists dashboard_view_preferences_own_insert on public.dashboard_view_preferences;
create policy dashboard_view_preferences_own_insert
on public.dashboard_view_preferences
for insert
to authenticated
with check (user_id = auth.uid());

drop policy if exists dashboard_view_preferences_own_update on public.dashboard_view_preferences;
create policy dashboard_view_preferences_own_update
on public.dashboard_view_preferences
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists dashboard_view_preferences_own_delete on public.dashboard_view_preferences;
create policy dashboard_view_preferences_own_delete
on public.dashboard_view_preferences
for delete
to authenticated
using (user_id = auth.uid());

drop trigger if exists dashboard_view_preferences_set_updated_at on public.dashboard_view_preferences;
create trigger dashboard_view_preferences_set_updated_at
before update on public.dashboard_view_preferences
for each row
execute procedure public.set_updated_at();
