# Local testing checklist

Use this to verify the app (UI, auth, RBAC, approvals, embed) end to end.

## 1) Prerequisites

- **Node.js LTS** installed and on your `PATH` (so `node`, `npm`, `npx` work in a **new** terminal).
- **Supabase project** with migrations applied (see below).
- **Three Auth users** in Supabase (email/password): SuperAdmin, InCharge, Viewer_Marketing — each with a matching row in `public.profiles`.

## 2) Project setup (once per machine)

From the project root (`PJ02`):

```powershell
cd "D:\Programming Project\PJ02"
npm install
```

Create `.env` at the project root (copy from `.env.example`):

```env
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY
```

- Use **Project URL** for `EXPO_PUBLIC_SUPABASE_URL`.
- Use **Publishable / anon** key for `EXPO_PUBLIC_SUPABASE_ANON_KEY` (never `service_role` in the app).

## 3) Database (Supabase SQL Editor)

Run **in order** (if not already applied):

1. `supabase/migrations/0001_rbac_schema.sql`
2. `supabase/migrations/0002_dashboards_rls.sql`

Optional sample data: edit UUIDs in `supabase/manual_test/001_seed_and_smoke_test.sql` to match your real `auth.users` IDs, then run it.

**Power BI URLs in seed data** must match the DB constraint: `https://app.powerbi.com/...`

**Realtime:** In Supabase, enable replication for `public.dashboards` if you test In-Charge notifications.

## 4) Start the app (web)

```powershell
$env:Path = "C:\Program Files\nodejs;" + $env:Path
npx expo start --web
```

If port **8081** is busy, use another port:

```powershell
npx expo start --web --port 8082
```

Open the URL shown (e.g. `http://localhost:8082`). Hard refresh after code changes: `Ctrl+Shift+R`.

## 5) What to test

### A — Sign in

- Open the app → you should see the **sign-in** screen (brand + card).
- Sign in with each test user; you should reach the main shell (top bar + content).

### B — Viewer (Viewer_Marketing)

- Expect **Published dashboards** list only.
- You should **not** see drafts or pending items for other roles.
- Embed area should show the Power BI preview chrome.

### C — In-Charge

- Expect **Approval queue** with items where `status = Pending_Review` and `in_charge_id` = your user.
- **Approve** → row becomes `Published` (check in SQL or list refresh).
- **Reject** with reason → row becomes `Rejected`; empty reason should be blocked.
- Optional: with another session/tab, insert/update a pending row assigned to this user and confirm **realtime** alert (if replication is on).

### D — SuperAdmin

- Expect access consistent with your policies (typically full visibility/manage depending on data).
- Approve/reject should still work via `review_dashboard` RPC.

### E — UI regression

- Top bar: name, role pill, **Sign out**.
- Cards: spacing, buttons, empty states.
- Mobile: run Expo on device/simulator and confirm embed still uses mobile layout path in `EmbedPanel`.

## 6) Quick SQL checks (optional)

```sql
select id, title, status, in_charge_id from public.dashboards order by updated_at desc limit 10;

select * from public.dashboard_review_audit_logs order by created_at desc limit 10;
```

## 7) Common issues

| Symptom | What to check |
|--------|----------------|
| `npx` / `npm` not found | New terminal after Node install; or prepend `C:\Program Files\nodejs` to `PATH`. |
| Blank / old UI | Hard refresh; restart Expo; ensure you saved files. |
| Profile not found | `profiles.id` must equal `auth.users.id` for that login. |
| RLS errors on reject | Use latest migrations + `review_dashboard` RPC; reset row to `Pending_Review` before retry. |
| Embed blank | URL must be `https://app.powerbi.com/...` and valid for embed. |
