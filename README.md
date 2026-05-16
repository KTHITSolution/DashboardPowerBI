# PJ02 - Secure Power BI Portal

Cross-platform Expo (Web + Mobile) app with Supabase RBAC, approval workflow, and Power BI embed support.

## Database

Run in Supabase SQL Editor in order:

1. `supabase/migrations/0001_rbac_schema.sql`
2. `supabase/migrations/0002_dashboards_rls.sql`
3. `supabase/migrations/0003_dashboard_view_preferences.sql`
4. `supabase/migrations/0004_incharge_published_view_access.sql`
5. `supabase/migrations/0005_publisher_workflow_rbac.sql`
6. `supabase/migrations/0006_department_publishers_and_withdraw.sql`
7. `supabase/migrations/0007_profiles_publisher_incharge_lookup.sql`
8. Optional seed/smoke validation: `supabase/manual_test/001_seed_and_smoke_test.sql`

## Required env vars

Copy `.env.example` to `.env` locally and fill in your Supabase values. **Do not commit `.env`** — it is gitignored; only `.env.example` belongs in the repo.

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

## Local testing

Step-by-step checklist: [docs/TESTING.md](docs/TESTING.md)

## Feature mapping

- Viewer access uses RLS on `dashboards` (`Published` + matching target role).
- In-Charge review uses RLS + trigger guard for status/rejection-only updates.
- SuperAdmin bypass is implemented via role function `is_superadmin`.
- Realtime notifications listen to `INSERT`/`UPDATE` for assigned pending reviews.
- Mobile Power BI embed sets `models.LayoutType.MobilePortrait`.
- Viewer mode preferences persist per user and dashboard with RLS.
- Publisher roles support draft creation, department-aware ownership, preview mode, and withdraw flow.

## Phase 1 OWASP hardening

- `dashboards.power_bi_embed_url` is constrained to `https://app.powerbi.com/...`.
- `rejection_reason` is validated by DB constraints (required for `Rejected`, max 500 chars).
- Profiles, roles, and audit logs have explicit RLS policies in migrations.
- `review_dashboard` RPC writes immutable review events to `dashboard_review_audit_logs`.

## Phase 2 OWASP hardening

- Security CI workflow: `.github/workflows/security-checks.yml`
- Local security scripts: `npm run security:check`
- Web security headers and CSP template: `vercel.json`
- Supabase auth hardening checklist: `docs/security-phase2.md`
