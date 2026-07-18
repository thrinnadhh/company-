# CompanyNow

> **Someone nearby. A moment together.**

CompanyNow is a mobile-first, opt-in proximity app for brief real-world company: walking in a park, travelling on a metro, having coffee, working out, waiting somewhere, or simply wanting a conversation.

It is **not a dating app**. There is no swiping, attraction ranking, relationship mode, mandatory activity selection, exact map pin, or forced session timer.

## Real two-user MVP flow

1. Two people open or install CompanyNow on separate phones.
2. Each device gets a private anonymous Supabase identity.
3. Each person creates a minimal first-name profile and confirms they are 18+.
4. Both switch **Open to Connect** on and allow location access.
5. They appear only when they are inside **both users’ selected radius**.
6. One person sends a private **Say Hi** request.
7. The other accepts or ignores it.
8. Acceptance opens a Supabase Realtime chat on both devices.
9. They may suggest a public meeting point, chat only, disconnect, or turn visibility off.

## Implemented

- Anonymous first-launch authentication
- Minimal profile onboarding
- Installable mobile web-app manifest
- GPS-backed presence heartbeat
- Adjustable 100 m–2 km mutual radius
- Optional activity/status
- PostGIS nearby matching
- Fuzzy distance buckets only
- Private Say Hi request
- Accept/ignore flow
- Realtime connection updates
- Realtime two-device chat
- Public meeting-point suggestions
- Disconnect and test-identity reset
- RLS, block/report tables, explicit Data API grants

## Local setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

Add these values to `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

Then:

1. Apply `supabase/migrations/0001_companynow_mvp.sql` in the Supabase SQL editor.
2. In Supabase Auth settings, enable **Allow anonymous sign-ins**.
3. Open the app on two physical phones or two separate browser profiles.
4. Create different profiles, allow location, and switch Open to Connect on.

## Validate

```bash
npm run lint
npm run build
```

## Security model

- Both users must deliberately activate visibility.
- Exact coordinates are stored behind RLS and used only inside guarded database functions.
- Nearby discovery returns only rounded distance labels.
- Database functions verify `auth.uid()` and revoke default public execution.
- A request must be explicitly accepted before chat opens.
- Stale presence disappears from discovery after two minutes without a heartbeat.
- Meeting remains optional and public reference points are preferred.

## Stack

- Next.js 16 + React 19 + TypeScript
- Tailwind CSS 4
- Supabase Auth, PostgreSQL/PostGIS, and Realtime
- Vercel-ready deployment
