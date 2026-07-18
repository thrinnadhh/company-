-- CompanyNow: real two-user MVP
-- Apply this migration to a dedicated Supabase project.

create extension if not exists postgis with schema extensions;

create type public.connection_state as enum ('pending', 'accepted', 'declined', 'closed');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 40),
  languages text[] not null default '{}',
  adult_confirmed boolean not null check (adult_confirmed),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.presences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  location extensions.geography(point, 4326) not null,
  radius_m integer not null check (radius_m between 100 and 2000),
  status_text text check (char_length(status_text) <= 100),
  is_active boolean not null default false,
  updated_at timestamptz not null default now()
);

create index presences_location_gix on public.presences using gist (location);
create index presences_active_updated_idx on public.presences (is_active, updated_at desc);

create table public.connections (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references public.profiles(id) on delete cascade,
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  state public.connection_state not null default 'pending',
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  closed_at timestamptz,
  check (sender_id <> recipient_id),
  unique (sender_id, recipient_id)
);

create index connections_sender_idx on public.connections (sender_id, state, created_at desc);
create index connections_recipient_idx on public.connections (recipient_id, state, created_at desc);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references public.connections(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index messages_connection_created_idx on public.messages (connection_id, created_at);

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
  connection_id uuid references public.connections(id) on delete set null,
  reason text not null check (reason in ('harassment', 'spam', 'unsafe', 'fake_profile', 'other')),
  details text check (char_length(details) <= 1000),
  created_at timestamptz not null default now(),
  check (reporter_id <> reported_id)
);

alter table public.profiles enable row level security;
alter table public.presences enable row level security;
alter table public.connections enable row level security;
alter table public.messages enable row level security;
alter table public.blocks enable row level security;
alter table public.reports enable row level security;

create policy "authenticated users read minimal profiles"
on public.profiles for select to authenticated
using (true);

create policy "users create own profile"
on public.profiles for insert to authenticated
with check ((select auth.uid()) = id);

create policy "users update own profile"
on public.profiles for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

create policy "users read own presence"
on public.presences for select to authenticated
using ((select auth.uid()) = user_id);

create policy "participants read connections"
on public.connections for select to authenticated
using ((select auth.uid()) in (sender_id, recipient_id));

create policy "participants read messages"
on public.messages for select to authenticated
using (
  exists (
    select 1
    from public.connections c
    where c.id = connection_id
      and (select auth.uid()) in (c.sender_id, c.recipient_id)
  )
);

create policy "participants send messages to accepted connections"
on public.messages for insert to authenticated
with check (
  (select auth.uid()) = sender_id
  and exists (
    select 1
    from public.connections c
    where c.id = connection_id
      and c.state = 'accepted'
      and (select auth.uid()) in (c.sender_id, c.recipient_id)
  )
);

create policy "users read own blocks"
on public.blocks for select to authenticated
using ((select auth.uid()) = blocker_id);

create policy "users create own blocks"
on public.blocks for insert to authenticated
with check ((select auth.uid()) = blocker_id);

create policy "users remove own blocks"
on public.blocks for delete to authenticated
using ((select auth.uid()) = blocker_id);

create policy "users create own reports"
on public.reports for insert to authenticated
with check ((select auth.uid()) = reporter_id);

-- Exact locations are written through this function and never returned.
create or replace function public.set_my_presence(
  p_latitude double precision,
  p_longitude double precision,
  p_radius_m integer,
  p_status_text text,
  p_is_active boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_latitude not between -90 and 90 or p_longitude not between -180 and 180 then
    raise exception 'Invalid coordinates';
  end if;

  if p_radius_m not between 100 and 2000 then
    raise exception 'Radius must be between 100 and 2000 metres';
  end if;

  if not exists (select 1 from public.profiles where id = v_user_id) then
    raise exception 'Create a profile first';
  end if;

  insert into public.presences (user_id, location, radius_m, status_text, is_active, updated_at)
  values (
    v_user_id,
    extensions.st_setsrid(extensions.st_makepoint(p_longitude, p_latitude), 4326)::extensions.geography,
    p_radius_m,
    nullif(trim(p_status_text), ''),
    p_is_active,
    now()
  )
  on conflict (user_id) do update
  set location = excluded.location,
      radius_m = excluded.radius_m,
      status_text = excluded.status_text,
      is_active = excluded.is_active,
      updated_at = now();
end;
$$;

create or replace function public.nearby_active_people()
returns table (
  user_id uuid,
  display_name text,
  languages text[],
  status_text text,
  distance_m integer,
  distance_label text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_me public.presences%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select * into v_me
  from public.presences
  where presences.user_id = v_user_id
    and is_active = true;

  if not found then
    return;
  end if;

  return query
  with candidates as (
    select
      p.id as candidate_id,
      p.display_name as candidate_name,
      p.languages as candidate_languages,
      pr.status_text as candidate_status,
      round(extensions.st_distance(pr.location, v_me.location))::integer as metres
    from public.presences pr
    join public.profiles p on p.id = pr.user_id
    where pr.user_id <> v_user_id
      and pr.is_active = true
      and pr.updated_at > now() - interval '2 minutes'
      and extensions.st_dwithin(pr.location, v_me.location, least(v_me.radius_m, pr.radius_m))
      and not exists (
        select 1 from public.blocks b
        where (b.blocker_id = v_user_id and b.blocked_id = pr.user_id)
           or (b.blocker_id = pr.user_id and b.blocked_id = v_user_id)
      )
  )
  select
    candidate_id,
    candidate_name,
    candidate_languages,
    candidate_status,
    metres,
    case
      when metres < 100 then 'Very close'
      when metres < 300 then 'Nearby'
      when metres < 700 then 'Around 500 m away'
      when metres < 1500 then 'Around 1 km away'
      else 'Around 2 km away'
    end
  from candidates
  order by metres asc
  limit 25;
end;
$$;

create or replace function public.send_connection_request(p_recipient_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sender_id uuid := auth.uid();
  v_connection_id uuid;
begin
  if v_sender_id is null then
    raise exception 'Authentication required';
  end if;
  if p_recipient_id = v_sender_id then
    raise exception 'Cannot connect to yourself';
  end if;
  if not exists (select 1 from public.profiles where id = p_recipient_id) then
    raise exception 'User not found';
  end if;
  if exists (
    select 1 from public.blocks b
    where (b.blocker_id = v_sender_id and b.blocked_id = p_recipient_id)
       or (b.blocker_id = p_recipient_id and b.blocked_id = v_sender_id)
  ) then
    raise exception 'Connection unavailable';
  end if;

  insert into public.connections (sender_id, recipient_id, state, created_at, responded_at, closed_at)
  values (v_sender_id, p_recipient_id, 'pending', now(), null, null)
  on conflict (sender_id, recipient_id) do update
  set state = 'pending', created_at = now(), responded_at = null, closed_at = null
  returning id into v_connection_id;

  return v_connection_id;
end;
$$;

create or replace function public.respond_to_connection(p_connection_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  update public.connections
  set state = case when p_accept then 'accepted'::public.connection_state else 'declined'::public.connection_state end,
      responded_at = now()
  where id = p_connection_id
    and recipient_id = v_user_id
    and state = 'pending';

  if not found then
    raise exception 'Pending request not found';
  end if;
end;
$$;

create or replace function public.close_connection(p_connection_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  update public.connections
  set state = 'closed', closed_at = now()
  where id = p_connection_id
    and v_user_id in (sender_id, recipient_id)
    and state in ('pending', 'accepted');

  if not found then
    raise exception 'Active connection not found';
  end if;
end;
$$;

revoke all on function public.set_my_presence(double precision, double precision, integer, text, boolean) from public;
revoke all on function public.nearby_active_people() from public;
revoke all on function public.send_connection_request(uuid) from public;
revoke all on function public.respond_to_connection(uuid, boolean) from public;
revoke all on function public.close_connection(uuid) from public;

grant execute on function public.set_my_presence(double precision, double precision, integer, text, boolean) to authenticated;
grant execute on function public.nearby_active_people() to authenticated;
grant execute on function public.send_connection_request(uuid) to authenticated;
grant execute on function public.respond_to_connection(uuid, boolean) to authenticated;
grant execute on function public.close_connection(uuid) to authenticated;

-- Explicit Data API grants for projects created after the April 2026 change.
grant usage on schema public to authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select on public.presences to authenticated;
grant select on public.connections to authenticated;
grant select, insert on public.messages to authenticated;
grant select, insert, delete on public.blocks to authenticated;
grant insert on public.reports to authenticated;

-- Realtime notifications for requests and messages.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'connections'
  ) then
    alter publication supabase_realtime add table public.connections;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;
