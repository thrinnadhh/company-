-- Add privacy-safe approximate coordinates for the map UI.
-- The client never receives another user's stored GPS point. Instead, the
-- server projects a stable daily marker from the viewer's own location using
-- quantized direction and distance buckets with small deterministic jitter.

drop function if exists public.nearby_active_people();

create function public.nearby_active_people()
returns table (
  user_id uuid,
  display_name text,
  languages text[],
  status_text text,
  distance_m integer,
  distance_label text,
  approximate_latitude double precision,
  approximate_longitude double precision
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
  with raw_candidates as (
    select
      p.id as candidate_id,
      p.display_name as candidate_name,
      p.languages as candidate_languages,
      pr.status_text as candidate_status,
      round(extensions.st_distance(pr.location, v_me.location))::integer as metres,
      extensions.st_azimuth(v_me.location, pr.location) as exact_bearing
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
  ), map_positions as (
    select
      candidate_id,
      candidate_name,
      candidate_languages,
      candidate_status,
      metres,
      greatest(
        40::double precision,
        case
          when metres < 100 then 70
          when metres < 300 then 220
          when metres < 700 then 500
          when metres < 1500 then 1000
          else 1750
        end::double precision
        + (abs(pg_catalog.hashtextextended(v_user_id::text || candidate_id::text || current_date::text, 1) % 81)::double precision - 40)
      ) as projected_distance,
      round(exact_bearing / (pi() / 6)) * (pi() / 6)
        + ((abs(pg_catalog.hashtextextended(candidate_id::text || v_user_id::text || current_date::text, 2) % 13)::double precision - 6) * pi() / 180) as projected_bearing
    from raw_candidates
  ), mapped as (
    select
      candidate_id,
      candidate_name,
      candidate_languages,
      candidate_status,
      metres,
      extensions.st_project(v_me.location, projected_distance, projected_bearing) as approximate_location
    from map_positions
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
    end,
    extensions.st_y(approximate_location::extensions.geometry),
    extensions.st_x(approximate_location::extensions.geometry)
  from mapped
  order by metres asc
  limit 50;
end;
$$;

revoke all on function public.nearby_active_people() from public, anon;
grant execute on function public.nearby_active_people() to authenticated, service_role;
