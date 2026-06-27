-- ============================================================
--  Asignar el viaje "China" a un usuario concreto.
--  Pegalo en Supabase -> SQL Editor -> Run.
--
--  REQUISITO: el usuario destino debe haber iniciado sesion al
--  menos una vez en la app (para existir en auth.users).
--
--  Cubre los dos casos automaticamente:
--   A) Ya hay una fila de viaje "China" en la tabla trips -> la reasigna.
--   B) Aun esta como dato antiguo "viaje_china_v3" en kv      -> lo migra.
-- ============================================================
do $$
declare
  target_email text := 'fatimahermida16@gmail.com';  -- <-- usuario destino
  uid   uuid;
  tid   uuid;
  newid uuid := gen_random_uuid();
begin
  select id into uid from auth.users where email = target_email;
  if uid is null then
    raise exception 'El usuario % no existe en auth.users. Que inicie sesion una vez en la app y reejecuta.', target_email;
  end if;

  -- Caso A: ya existe un viaje llamado "China" en trips -> reasignar dueno.
  select id into tid
    from public.trips
    where lower(trim(name)) = 'china'
    order by created_at asc
    limit 1;

  if tid is not null then
    update public.trips set user_id = uid where id = tid;
    update public.kv set user_id = uid
      where key = 'trip_' || tid
         or key like 'trip_' || tid || '_att_%';
    raise notice 'OK: viaje "China" (trip %) reasignado a %', tid, target_email;
    return;
  end if;

  -- Caso B: todavia esta como dato antiguo de un solo usuario en kv.
  if exists (select 1 from public.kv where key = 'viaje_china_v3') then
    insert into public.trips (id, user_id, name) values (newid, uid, 'China');

    update public.kv set user_id = uid, key = 'trip_' || newid
      where key = 'viaje_china_v3';

    update public.kv set user_id = uid,
        key = 'trip_' || newid || '_att_' || substring(key from length('viaje_china_v3_att_') + 1)
      where key like 'viaje_china_v3_att_%';

    raise notice 'OK: viaje "China" migrado (nuevo trip %) a %', newid, target_email;
    return;
  end if;

  raise notice 'No encontre ningun viaje "China" (ni en trips ni como viaje_china_v3). Nada que asignar.';
end $$;

-- Comprueba el resultado:
-- select t.id, t.name, u.email
--   from public.trips t join auth.users u on u.id = t.user_id
--   where lower(trim(t.name)) = 'china';
