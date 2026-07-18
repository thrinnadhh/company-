# CompanyNow Production Sprints

## Delivery target

A real two-person installable web app where two users can create accounts, turn on Open to Connect, discover one another within a mutual radius, request a connection, accept, and exchange realtime messages.

## Estimated delivery

- Functional two-user PWA: 3–5 engineering days from an empty repository.
- Production hardening for a limited public pilot: 2–3 weeks.
- Native iOS/Android store release with background location, push notifications and store review: 4–6 weeks.

The repository already contained the UI prototype, so the functional PWA path is being accelerated here.

## Sprint 1 — Identity and backend foundation

**Goal:** Every installation has a secure account and isolated data.

- Dedicated Supabase project in Mumbai.
- Email/password signup and sign-in.
- Profile onboarding with first name, languages and 18+ confirmation.
- RLS for profiles, presence, connections, messages, blocks and reports.
- Production public configuration without secret keys in the client.

**Acceptance:** Two different browsers can create separate accounts and profiles.

## Sprint 2 — Live nearby presence

**Goal:** Two active users within both selected radii can discover each other.

- Browser geolocation permission.
- Open to Connect toggle.
- Adjustable 100 m–2 km mutual radius.
- PostGIS distance filtering.
- 45-second presence heartbeat and 2-minute stale cutoff.
- Fuzzy distance labels; exact coordinates remain hidden.

**Acceptance:** Two nearby signed-in users who enable visibility appear in each other’s list.

## Sprint 3 — Mutual connection and realtime chat

**Goal:** A nearby user can privately request, accept and communicate.

- Say Hi request.
- Incoming, outgoing and accepted connection states.
- Recipient-only accept/decline.
- Supabase Realtime connection updates.
- Realtime messages restricted to accepted participants.
- Disconnect flow.

**Acceptance:** User A sends a request, User B accepts, and both exchange messages without refreshing.

## Sprint 4 — Installability, safety and release

**Goal:** The app can be installed and used for a controlled pilot.

- PWA manifest and icon.
- Public-meeting suggestions.
- Blocks/reports schema and RLS.
- Security and performance advisor review.
- Production build, deployment and two-browser smoke test.

**Acceptance:** The deployed URL installs to a phone home screen and completes the two-user flow.

## Post-MVP hardening

- CAPTCHA/Turnstile on account creation.
- Phone verification and selfie-liveness option.
- Push notifications for requests and messages.
- Background location strategy with explicit consent.
- Moderation dashboard and report workflows.
- Automated expiry/cleanup for abandoned accounts and presences.
- Native Expo/React Native clients when app-store distribution is required.
