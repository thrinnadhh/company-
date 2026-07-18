-- CompanyNow multi-user MVP hardening

alter table public.connections
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists last_message_at timestamptz;

create unique index if not exists connections_canonical_pair_uidx
  on public.connections ((least(sender_id, recipient_id)), (greatest(sender_id, recipient_id)));

create table if not exists public.connection_reads (
  connection_id uuid not null references public.connections(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (connection_id, user_id)
);

create index if not exists connection_reads_user_idx
  on public.connection_reads (user_id, last_read_at desc);

alter table public.connection_reads enable row level security;

drop policy if exists "users read own connection reads" on public.connection_reads;
create policy "users read own connection reads"
on public.connection_reads for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "users create own connection reads" on public.connection_reads;
create policy "users create own connection reads"
on public.connection_reads for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1 from public.connections c
    where c.id = connection_id
      and (select auth.uid()) in (c.sender_id, c.recipient_id)
  )
);

drop policy if exists "users update own connection reads" on public.connection_reads;
create policy "users update own connection reads"
on public.connection_reads for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

grant select, insert, update on public.connection_reads to authenticated;

drop policy if exists "authenticated users read minimal profiles" on public.profiles;
drop policy if exists "users read own profile" on public.profiles;
create policy "users read own profile"
on public.profiles for select to authenticated
using ((select auth.uid()) = id);

create or replace function public.enforce_connection_transition()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if new.sender_id <> old.sender_id or new.recipient_id <> old.recipient_id then
    raise exception 'Connection participants cannot change';
  end if;

  new.updated_at := now();

  if new.state = old.state
     and new.created_at = old.created_at
     and new.responded_at is not distinct from old.responded_at
     and new.closed_at is not distinct from old.closed_at
     and v_user_id in (old.sender_id, old.recipient_id) then
    return new;
  end if;

  if old.state = 'pending'
     and new.state in ('accepted', 'declined')
     and v_user_id = old.recipient_id then
    new.responded_at := coalesce(new.responded_at, now());
    return new;
  end if;

  if old.state in ('pending', 'accepted')
     and new.state = 'closed'
     and v_user_id in (old.sender_id, old.recipient_id) then
    new.closed_at := coalesce(new.closed_at, now());
    return new;
  end if;

  raise exception 'Invalid connection state transition';
end;
$$;

create or replace function public.guard_message_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_state public.connection_state;
begin
  if v_user_id is null or new.sender_id <> v_user_id then
    raise exception 'Authentication required';
  end if;

  select c.state into v_state
  from public.connections c
  where c.id = new.connection_id
    and v_user_id in (c.sender_id, c.recipient_id);

  if v_state is distinct from 'accepted'::public.connection_state then
    raise exception 'Connection is not open for chat';
  end if;

  if (
    select count(*)
    from public.messages m
    where m.sender_id = v_user_id
      and m.created_at > now() - interval '1 minute'
  ) >= 30 then
    raise exception 'Message rate limit reached. Try again shortly.';
  end if;

  new.body := trim(new.body);
  if char_length(new.body) = 0 then
    raise exception 'Message cannot be empty';
  end if;

  return new;
end;
$$;

drop trigger if exists guard_message_before_insert on public.messages;
create trigger guard_message_before_insert
before insert on public.messages
for each row execute function public.guard_message_insert();

create or replace function public.touch_connection_after_message()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.connections
  set last_message_at = new.created_at
  where id = new.connection_id;

  insert into public.connection_reads (connection_id, user_id, last_read_at)
  values (new.connection_id, new.sender_id, new.created_at)
  on conflict (connection_id, user_id)
  do update set last_read_at = excluded.last_read_at;

  return new;
end;
$$;

drop trigger if exists touch_connection_after_message_insert on public.messages;
create trigger touch_connection_after_message_insert
after insert on public.messages
for each row execute function public.touch_connection_after_message();

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
      and not exists (
        select 1 from public.connections c
        where ((c.sender_id = v_user_id and c.recipient_id = pr.user_id)
            or (c.sender_id = pr.user_id and c.recipient_id = v_user_id))
          and c.state in ('pending', 'accepted')
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
  limit 50;
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
  v_connection public.connections%rowtype;
  v_sender_presence public.presences%rowtype;
  v_recipient_presence public.presences%rowtype;
begin
  if v_sender_id is null then
    raise exception 'Authentication required';
  end if;
  if p_recipient_id = v_sender_id then
    raise exception 'Cannot connect to yourself';
  end if;

  select * into v_sender_presence
  from public.presences
  where user_id = v_sender_id
    and is_active = true
    and updated_at > now() - interval '2 minutes';

  select * into v_recipient_presence
  from public.presences
  where user_id = p_recipient_id
    and is_active = true
    and updated_at > now() - interval '2 minutes';

  if v_sender_presence.user_id is null or v_recipient_presence.user_id is null then
    raise exception 'This person is no longer active nearby';
  end if;

  if not extensions.st_dwithin(
    v_sender_presence.location,
    v_recipient_presence.location,
    least(v_sender_presence.radius_m, v_recipient_presence.radius_m)
  ) then
    raise exception 'This person is outside the mutual radius';
  end if;

  if exists (
    select 1 from public.blocks b
    where (b.blocker_id = v_sender_id and b.blocked_id = p_recipient_id)
       or (b.blocker_id = p_recipient_id and b.blocked_id = v_sender_id)
  ) then
    raise exception 'Connection unavailable';
  end if;

  if (select count(*) from public.connections c
      where c.sender_id = v_sender_id
        and c.state = 'pending') >= 5 then
    raise exception 'You already have five pending requests';
  end if;

  if (select count(*) from public.connections c
      where c.sender_id = v_sender_id
        and c.created_at > now() - interval '1 hour') >= 20 then
    raise exception 'Request rate limit reached. Try again later.';
  end if;

  select * into v_connection
  from public.connections c
  where (c.sender_id = v_sender_id and c.recipient_id = p_recipient_id)
     or (c.sender_id = p_recipient_id and c.recipient_id = v_sender_id)
  limit 1;

  if v_connection.id is not null then
    if v_connection.state in ('pending', 'accepted') then
      return v_connection.id;
    end if;
    if v_connection.created_at > now() - interval '5 minutes' then
      raise exception 'Please wait before requesting this person again';
    end if;
    delete from public.connections where id = v_connection.id;
  end if;

  insert into public.connections (
    sender_id, recipient_id, state, created_at, updated_at, responded_at, closed_at
  ) values (
    v_sender_id, p_recipient_id, 'pending', now(), now(), null, null
  )
  returning * into v_connection;

  return v_connection.id;
end;
$$;

create or replace function public.mark_connection_read(p_connection_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if not exists (
    select 1 from public.connections c
    where c.id = p_connection_id
      and v_user_id in (c.sender_id, c.recipient_id)
  ) then
    raise exception 'Connection not found';
  end if;

  insert into public.connection_reads (connection_id, user_id, last_read_at)
  values (p_connection_id, v_user_id, now())
  on conflict (connection_id, user_id)
  do update set last_read_at = excluded.last_read_at;
end;
$$;

create or replace function public.my_connection_summaries()
returns table (
  id uuid,
  sender_id uuid,
  recipient_id uuid,
  state public.connection_state,
  created_at timestamptz,
  other_user_id uuid,
  other_display_name text,
  other_languages text[],
  last_message_body text,
  last_message_at timestamptz,
  unread_count integer
)
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

  return query
  select
    c.id,
    c.sender_id,
    c.recipient_id,
    c.state,
    c.created_at,
    p.id as other_user_id,
    p.display_name as other_display_name,
    p.languages as other_languages,
    lm.body as last_message_body,
    lm.created_at as last_message_at,
    (
      select count(*)::integer
      from public.messages um
      where um.connection_id = c.id
        and um.sender_id <> v_user_id
        and um.created_at > coalesce(cr.last_read_at, 'epoch'::timestamptz)
    ) as unread_count
  from public.connections c
  join public.profiles p
    on p.id = case when c.sender_id = v_user_id then c.recipient_id else c.sender_id end
  left join public.connection_reads cr
    on cr.connection_id = c.id and cr.user_id = v_user_id
  left join lateral (
    select m.body, m.created_at
    from public.messages m
    where m.connection_id = c.id
    order by m.created_at desc
    limit 1
  ) lm on true
  where v_user_id in (c.sender_id, c.recipient_id)
    and c.state in ('pending', 'accepted')
  order by coalesce(lm.created_at, c.created_at) desc;
end;
$$;

create or replace function public.block_user(p_blocked_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null or p_blocked_id = v_user_id then
    raise exception 'Invalid block request';
  end if;

  insert into public.blocks (blocker_id, blocked_id)
  values (v_user_id, p_blocked_id)
  on conflict do nothing;

  update public.connections
  set state = 'closed', closed_at = now(), updated_at = now()
  where ((sender_id = v_user_id and recipient_id = p_blocked_id)
      or (sender_id = p_blocked_id and recipient_id = v_user_id))
    and state in ('pending', 'accepted');
end;
$$;

create or replace function public.report_user(
  p_reported_id uuid,
  p_connection_id uuid,
  p_reason text,
  p_details text default null
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_report_id uuid;
begin
  if p_reported_id = v_user_id then
    raise exception 'Invalid report';
  end if;
  if p_reason not in ('harassment', 'spam', 'unsafe', 'fake_profile', 'other') then
    raise exception 'Invalid report reason';
  end if;
  if p_connection_id is not null and not exists (
    select 1 from public.connections c
    where c.id = p_connection_id
      and v_user_id in (c.sender_id, c.recipient_id)
      and p_reported_id in (c.sender_id, c.recipient_id)
  ) then
    raise exception 'Connection not found';
  end if;

  insert into public.reports (reporter_id, reported_id, connection_id, reason, details)
  values (v_user_id, p_reported_id, p_connection_id, p_reason, nullif(trim(p_details), ''))
  returning id into v_report_id;

  return v_report_id;
end;
$$;

revoke all on function public.send_connection_request(uuid) from public, anon;
revoke all on function public.nearby_active_people() from public, anon;
revoke all on function public.my_connection_summaries() from public, anon;
revoke all on function public.mark_connection_read(uuid) from public, anon;
revoke all on function public.block_user(uuid) from public, anon;
revoke all on function public.report_user(uuid, uuid, text, text) from public, anon;

grant execute on function public.send_connection_request(uuid) to authenticated;
grant execute on function public.nearby_active_people() to authenticated;
grant execute on function public.my_connection_summaries() to authenticated;
grant execute on function public.mark_connection_read(uuid) to authenticated;
grant execute on function public.block_user(uuid) to authenticated;
grant execute on function public.report_user(uuid, uuid, text, text) to authenticated;
