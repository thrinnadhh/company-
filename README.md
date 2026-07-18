# CompanyNow

> **Someone nearby. A moment together.**

CompanyNow is an installable, mobile-first proximity app. Two people create accounts, turn on **Open to Connect**, discover one another inside their mutual radius, send a private request, accept, and exchange realtime messages.

## Current functional scope

- Email/password signup and sign-in
- Minimal 18+ profile onboarding
- GPS-backed presence
- Adjustable 100 m–2 km mutual radius
- PostGIS nearby search
- Fuzzy distance only; exact coordinates are not returned
- Say Hi request and explicit acceptance
- Supabase Realtime chat
- Disconnect, block and report foundations
- PWA manifest and icon

## Run locally

```bash
npm install
npm run dev
```

The production Supabase URL and publishable key are safe client configuration and are included as defaults. They can be overridden:

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
```

## Database

Apply migrations in order:

```text
supabase/migrations/0001_companynow_mvp.sql
supabase/migrations/0002_production_hardening.sql
```

The active CompanyNow Supabase project is hosted in `ap-south-1` (Mumbai).

## Validation

```bash
npm run lint
npm run build
```

## Delivery plan

See [`docs/implementation/companynow-production-sprints.md`](docs/implementation/companynow-production-sprints.md).
