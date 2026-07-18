-- Reduce externally callable SECURITY DEFINER functions.

create policy "participants read relevant profiles"
on public.profiles for select to authenticated
using (
  (select auth.uid()) = id
  or exists (
    select 1 from public.connections c
    where c.state in ('pending', 'accepted')
      and (select auth.uid()) in (c.sender_id, c.recipient_id)
      and id in (c.sender_id, c.recipient_id)
  )
);

drop policy if exists "participants delete reusable connections" on public.connections;
create policy "participants delete reusable connections"
on public.connections for delete to authenticated
using (
  (select auth.uid()) in (sender_id, recipient_id)
  and state in ('declined', 'closed')
  and created_at <= now() - interval '5 minutes'
);

create or replace function public.guard_connection_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_sender_presence public.presences%rowtype;
  v_recipient_presence public.presences%rowtype;
begin
  if v_user_id is null or new.sender_id <> v_user_id or new.state <> 'pending' then
    raise exception 'Invalid connection request';
  end if;
  if new.recipient_id = v_user_id then
    raise exception 'Cannot connect to yourself';
  end if;

  select * into v_sender_presence
  from public.presences
  where user_id = v_user_id
    and is_active = true
    and updated_at > now() - interval '2 minutes';

  select * into v_recipient_presence
  from public.presences
  where user_id = new.recipient_id
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
    where (b.blocker_id = v_user_id and b.blocked_id = new.recipient_id)
       or (b.blocker_id = new.recipient_id and b.blocked_id = v_user_id)
  ) then
    raise exception 'Connection unavailable';
  end if;

  if (select count(*) from public.connections c
      where c.sender_id = v_user_id and c.state = 'pending') >= 5 then
    raise exception 'You already have five pending requests';
  end if;

  if (select count(*) from public.connections c
      where c.sender_id = v_user_id
        and c.created_at > now() - interval '1 hour') >= 20 then
    raise exception 'Request rate limit reached. Try again later.';
  end if;

  new.created_at := now();
  new.updated_at := now();
  new.responded_at := null;
  new.closed_at := null;
  return new;
end;
$$;

drop trigger if exists guard_connection_before_insert on public.connections;
create trigger guard_connection_before_insert
before insert on public.connections
for each row execute function public.guard_connection_insert();

revoke all on function public.guard_connection_insert() from public, anon, authenticated;

create or replace function public.send_connection_request(p_recipient_id uuid)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_sender_id uuid := auth.uid();
  v_connection public.connections%rowtype;
begin
  if v_sender_id is null then
    raise exception 'Authentication required';
  end if;
  if p_recipient_id = v_sender_id then
    raise exception 'Cannot connect to yourself';
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

  insert into public.connections (sender_id, recipient_id, state)
  values (v_sender_id, p_recipient_id, 'pending')
  returning * into v_connection;

  return v_connection.id;
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
    p.id,
    p.display_name,
    p.languages,
    lm.body,
    lm.created_at,
    (
      select count(*)::integer
      from public.messages um
      where um.connection_id = c.id
        and um.sender_id <> v_user_id
        and um.created_at > coalesce(cr.last_read_at, 'epoch'::timestamptz)
    )
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
  set state = 'closed', closed_at = now()
  where ((sender_id = v_user_id and recipient_id = p_blocked_id)
      or (sender_id = p_blocked_id and recipient_id = v_user_id))
    and state in ('pending', 'accepted');
end;
$$;

revoke all on function public.send_connection_request(uuid) from public, anon;
revoke all on function public.my_connection_summaries() from public, anon;
revoke all on function public.block_user(uuid) from public, anon;
grant execute on function public.send_connection_request(uuid) to authenticated;
grant execute on function public.my_connection_summaries() to authenticated;
grant execute on function public.block_user(uuid) to authenticated;
