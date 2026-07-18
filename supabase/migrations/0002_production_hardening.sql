-- Remove unauthenticated RPC execution inherited from project defaults.
revoke execute on function public.set_my_presence(double precision, double precision, integer, text, boolean) from anon;
revoke execute on function public.nearby_active_people() from anon;
revoke execute on function public.send_connection_request(uuid) from anon;
revoke execute on function public.respond_to_connection(uuid, boolean) from anon;
revoke execute on function public.close_connection(uuid) from anon;

-- Mutations execute under the signed-in caller and are constrained by RLS.
create policy "users create own presence"
on public.presences for insert to authenticated
with check ((select auth.uid()) = user_id);

create policy "users update own presence"
on public.presences for update to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "senders create pending connections"
on public.connections for insert to authenticated
with check ((select auth.uid()) = sender_id and state = 'pending');

create policy "participants update valid connections"
on public.connections for update to authenticated
using ((select auth.uid()) in (sender_id, recipient_id))
with check ((select auth.uid()) in (sender_id, recipient_id));

grant insert, update on public.presences to authenticated;
grant insert, update on public.connections to authenticated;

alter function public.set_my_presence(double precision, double precision, integer, text, boolean) security invoker;
alter function public.send_connection_request(uuid) security invoker;
alter function public.respond_to_connection(uuid, boolean) security invoker;
alter function public.close_connection(uuid) security invoker;

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

  if new.state = old.state and new.state = 'pending' and v_user_id = old.sender_id then
    return new;
  end if;

  if old.state = 'pending'
     and new.state in ('accepted', 'declined')
     and v_user_id = old.recipient_id then
    return new;
  end if;

  if old.state in ('pending', 'accepted')
     and new.state = 'closed'
     and v_user_id in (old.sender_id, old.recipient_id) then
    return new;
  end if;

  raise exception 'Invalid connection state transition';
end;
$$;

create trigger enforce_connection_transition_before_update
before update on public.connections
for each row execute function public.enforce_connection_transition();

create index blocks_blocked_id_idx on public.blocks (blocked_id);
create index messages_sender_id_idx on public.messages (sender_id);
create index reports_connection_id_idx on public.reports (connection_id);
create index reports_reported_id_idx on public.reports (reported_id);
create index reports_reporter_id_idx on public.reports (reporter_id);
