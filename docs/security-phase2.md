# Phase 2 Security Hardening

This document defines practical OWASP-focused hardening for deployment and operations.

## 1) Dependency and supply-chain controls

- Run local checks before merge:
  - `npm run security:audit:prod`
  - `npm run security:deps:outdated`
- CI workflow:
  - `.github/workflows/security-checks.yml`
  - fails pull requests when production dependency vulnerabilities are high/critical.

## 2) Web security headers and CSP

- `vercel.json` includes hardened default headers:
  - `Strict-Transport-Security`
  - `X-Content-Type-Options`
  - `X-Frame-Options`
  - `Referrer-Policy`
  - `Permissions-Policy`
  - `Content-Security-Policy`
- CSP allows only required origins:
  - Supabase API and realtime (`https://*.supabase.co`, `wss://*.supabase.co`)
  - Power BI embed (`https://app.powerbi.com`)
  - CDN for Power BI client (`https://cdn.jsdelivr.net`)

## 3) Supabase Auth hardening checklist

Apply in Supabase Dashboard:

1. Authentication -> Providers -> Email:
   - Keep email provider enabled.
   - Enforce secure password policy.
2. Authentication -> Settings:
   - Enable leaked password protection.
   - Enable email confirmations for production.
   - Set shorter JWT lifetime aligned to UX requirements.
3. Authentication -> Bot/Abuse protection:
   - Enable CAPTCHA/anti-bot for sign-in and sign-up if available on your plan.
4. Authentication -> MFA:
   - Enable MFA for `SuperAdmin` accounts at minimum.
5. API Keys:
   - Rotate publishable keys after accidental exposure.
   - Never use `service_role` in client apps.

## 4) Operational controls

- Audit review decisions from `public.dashboard_review_audit_logs`.
- Monitor unexpected role assignments and review actions.
- Keep `.env` secrets out of source control (`.gitignore`).
