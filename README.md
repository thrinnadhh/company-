# CompanyNow

> **Someone nearby. A moment together.**

CompanyNow is an installable, mobile-first proximity app for multiple people who are open to brief real-world company nearby. Users create accounts, turn on **Open to Connect**, discover active people inside a mutual radius, send private requests, accept, and communicate through realtime chat.

## Functional multi-user scope

- Email/password signup and sign-in
- Minimal 18+ profile onboarding
- GPS-backed presence with a 45-second heartbeat
- Adjustable 100 m–2 km mutual radius
- PostGIS nearby search for up to 50 active users per refresh
- Fuzzy distance only; exact coordinates are never returned
- Private Say Hi requests with explicit acceptance
- Up to five concurrent outgoing pending requests per user
- Duplicate and reciprocal request prevention
- Multiple simultaneous accepted conversations
- Realtime chat with unread counts and 100-message recent history
- Request and message rate limits
- Cancel request and disconnect flows
- Block and report enforcement
- Profile enumeration prevention through restricted RLS and guarded RPCs
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
supabase/migrations/0003_companynow_multi_user_mvp.sql
```

The active CompanyNow Supabase project is hosted in `ap-south-1` (Mumbai).

## Validation

```bash
npm run lint
npm run build
```

## Controlled-pilot capacity

The MVP is structured for a controlled city or event pilot rather than internet-scale launch. The current discovery query returns the nearest 50 eligible active users and every user can maintain multiple accepted conversations. Before a large public rollout, add CAPTCHA, phone verification, push notifications, moderation operations, observability and load testing.

## Delivery plan

See [`docs/implementation/companynow-production-sprints.md`](docs/implementation/companynow-production-sprints.md).
