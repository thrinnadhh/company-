# CompanyNow

> **Someone nearby. A moment together.**

CompanyNow is a mobile-first, opt-in proximity app for people who are open to brief real-world company right now. It is designed for moments such as walking in a park, travelling on a metro, having coffee, working out, waiting somewhere, or simply wanting a conversation.

It is **not a dating app**. There is no swiping, attraction ranking, relationship mode, mandatory activity selection, exact map pin, or forced session timer.

## Judge-demo flow

1. Turn **Open to Connect** on.
2. Adjust the visibility radius from 100 m to 2 km.
3. Add an optional status such as “Walking in the park — open to company.”
4. View other active users nearby.
5. Send a private **Say Hi** request.
6. Switch to the simulated receiver screen and accept or ignore it.
7. Chat after mutual acceptance.
8. Suggest a public reference point.
9. Disconnect and leave whenever the moment is complete.

The app runs immediately in demo mode without credentials.

## MVP scope

- Minimal mobile-first interface
- Open-to-Connect visibility toggle
- Adjustable 100 m–2 km radius
- Optional free-text status
- Fuzzy distance buckets only
- Nearby active-user list
- Say Hi request
- Private accept/ignore flow
- Chat after acceptance
- Public meeting-point suggestion
- Disconnect, block, report, and privacy messaging
- Judge-demo reset controls
- Supabase/PostGIS production schema

## Deliberately excluded

- Dating mode or swipe feed
- Exact GPS coordinates or live movement trails
- Mandatory activities or schedules
- Automatic expiry timer
- Payments or subscriptions
- Groups and events
- Social followers and popularity scores
- AI matching

## Run locally

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Validate

```bash
npm run lint
npm run build
```

## Production stack

- Next.js 16 + TypeScript
- Tailwind CSS 4
- Supabase Auth, PostgreSQL/PostGIS, Realtime, and Storage
- Vercel deployment

## Connect Supabase

1. Create a Supabase project.
2. Copy `.env.example` to `.env.local`.
3. Add the project URL and publishable key.
4. Apply `supabase/migrations/0001_companynow_mvp.sql`.
5. Implement phone OTP onboarding and server-side proximity search.
6. Keep the Supabase secret key server-only.

## Safety model

- Both users must deliberately activate visibility.
- Only fuzzy distance labels are returned to clients.
- One person sends a request; the other accepts or ignores privately.
- Exact coordinates are never exposed through the client API.
- Meeting is optional and public reference points are preferred.
- Either person can disconnect, block, report, or turn visibility off.
