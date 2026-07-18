-- CompanyNow MVP schema
-- Apply through the Supabase SQL editor or convert into a CLI migration.

create extension if not exists postgis with schema extensions;

create type public.connection_state as enum ('pending', 'accepted', 'closed');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 40),
  birth_date date not null,
  avatar_path text,
  languages text[] not null default '{}',
  phone_verified boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint adults_only check (birth_date <= (current_date - interval '18 years')::date)
);

create table public.presences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  location extensions.geography(point, 4326) not null,
  radius_m integer not null check (radius_m between 100 and 2000),
  status_text text check (char_length(status_text) <= 100),
  is_active boolean not null default true,
  updated_at timestamptz not null default now()
);

create index presences_location_gix on public.presences using gist (location);

create table public.connection_requests (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  receiver_id uuid not null references public.profiles(id) on delete cascade,
  state public.connection_state not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (sender_id, receiver_id),
  check (sender_id <> receiver_id)
);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null unique references public.connection_requests(id) on delete cascade,
  user_a uuid not null references public.profiles(id) on delete cascade,
  user_b uuid not null references public.profiles(id) on delete cascade,
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  check (user_a <> user_b)
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

create index messages_conversation_created_idx
  on public.messages (conversation_id, created_at);

create table public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reported_id uuid not null references public.profiles(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  category text not null check (category in ('harassment', 'spam', 'unsafe_meetup', 'fake_profile', 'other')),
  details text check (char_length(details) <= 1000),
  created_at timestamptz not null default now(),
  check (reporter_id <> reported_id)
);

alter table public.profiles enable row level security;
alter table public.presences enable row level security;
alter table public.connection_requests enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.blocks enable row level security;
alter table public.reports enable row level security;

create policy "authenticated users can read profiles"
on public.profiles for select to authenticated
using (true);

create policy "users insert own profile"
on public.profiles for insert to authenticated
with check ((select auth.uid()) = id);

create policy "users update own profile"
on public.profiles for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

-- Raw coordinates remain owner-only. A server-side endpoint performs the
-- PostGIS search and returns fuzzy distance labels, never exact coordinates.
create policy "users read own presence"
on public.presences for select to authenticated
using ((select auth.uid()) = user_id);

create policy "users create own presence"
on public.presences for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "users update own presence"
on public.presences for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "users delete own presence"
on public.presences for delete to authenticated
using ((select auth.uid()) = user_id);

create policy "participants read requests"
on public.connection_requests for select to authenticated
using ((select auth.uid()) in (sender_id, receiver_id));

create policy "users send requests"
on public.connection_requests for insert to authenticated
with check ((select auth.uid()) = sender_id);

create policy "receiver updates request"
on public.connection_requests for update to authenticated
using ((select auth.uid()) = receiver_id)
with check ((select auth.uid()) = receiver_id);

create policy "participants read conversations"
on public.conversations for select to authenticated
using ((select auth.uid()) in (user_a, user_b));

create policy "participants read messages"
on public.messages for select to authenticated
using (
  exists (
    select 1 from public.conversations c
    where c.id = conversation_id
      and (select auth.uid()) in (c.user_a, c.user_b)
  )
);

create policy "participants send messages"
on public.messages for insert to authenticated
with check (
  (select auth.uid()) = sender_id
  and exists (
    select 1 from public.conversations c
    where c.id = conversation_id
      and c.closed_at is null
      and (select auth.uid()) in (c.user_a, c.user_b)
  )
);

create policy "users manage own blocks"
on public.blocks for all to authenticated
using ((select auth.uid()) = blocker_id)
with check ((select auth.uid()) = blocker_id);

create policy "users create reports"
on public.reports for insert to authenticated
with check ((select auth.uid()) = reporter_id);

-- Server-side search reference:
-- ST_DWithin(candidate.location, me.location, LEAST(me.radius_m, candidate.radius_m))
-- AND candidate.is_active = true
-- Return labels such as Nearby or Around 500 m away, not candidate.location.
