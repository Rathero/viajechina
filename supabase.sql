-- ============================================================
--  Esquema MULTIUSUARIO (Login + "Mis viajes")
--  Pegalo en el SQL Editor de Supabase y pulsa Run.
--
--  Funciona tanto en un proyecto NUEVO como en uno antiguo.
--  Es seguro reejecutarlo (idempotente) y NO aborta aunque dejes
--  el email de ejemplo sin tocar: la migracion del viaje "China"
--  es opcional y se salta sin error si no aplica.
--
--  (OPCIONAL) Si vienes de la version vieja de un solo viaje y
--  quieres conservar "China": registrate una vez en la app y pon
--  tu email en la variable `target_email` de mas abajo.
-- ============================================================

-- 0) Tabla de viajes (uno o varios por usuario)
create table if not exists public.trips (
  id         uuid        primary key default gen_random_uuid(),
  user_id    uuid        not null references auth.users(id) on delete cascade,
  name       text        not null default 'Mi viaje',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.trips enable row level security;
drop policy if exists "trips_owner_all" on public.trips;
create policy "trips_owner_all" on public.trips
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 1) Tabla kv (contenido de cada viaje). Se crea si no existe.
--    En un proyecto nuevo nace ya con el esquema final (clave por usuario).
create table if not exists public.kv (
  user_id uuid not null references auth.users(id) on delete cascade,
  key     text not null,
  data    jsonb,
  primary key (user_id, key)
);
-- Compatibilidad con la version vieja de kv (sin columna user_id):
alter table public.kv add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.kv enable row level security;

-- 2) (OPCIONAL, no aborta) Migrar el viaje "China" de la version antigua
--    de un solo usuario. Si no hay datos antiguos o el email no existe,
--    simplemente no hace nada.
do $$
declare
  target_email text := 'TU_EMAIL_AQUI';  -- <-- pon tu email solo si migras "China"
  uid   uuid;
  newid uuid := gen_random_uuid();
begin
  select id into uid from auth.users where email = target_email;

  if uid is not null and exists (select 1 from public.kv where key = 'viaje_china_v3') then
    insert into public.trips (id, user_id, name) values (newid, uid, 'China');

    -- blob principal:  viaje_china_v3 -> trip_<newid>
    update public.kv
      set user_id = uid, key = 'trip_' || newid
      where key = 'viaje_china_v3';

    -- adjuntos:  viaje_china_v3_att_X -> trip_<newid>_att_X
    update public.kv
      set user_id = uid,
          key = 'trip_' || newid || '_att_' || substring(key from length('viaje_china_v3_att_') + 1)
      where key like 'viaje_china_v3_att_%';

    raise notice 'Viaje "China" migrado a la cuenta %', target_email;
  else
    raise notice 'Sin migracion de "China" (email no encontrado o no hay datos antiguos). Se omite.';
  end if;

  -- Limpia filas viejas sin dueno (de la version publica anterior).
  delete from public.kv where user_id is null;

  -- Normaliza la clave primaria de kv a (user_id, key) por si venia de la
  -- version vieja con PK solo en `key`. Idempotente.
  begin
    alter table public.kv alter column user_id set not null;
    alter table public.kv drop constraint if exists kv_pkey;
    alter table public.kv add primary key (user_id, key);
  exception when others then
    null;  -- si ya estaba asi, seguimos sin abortar
  end;
end $$;

-- 3) RLS dueno-only en kv: cada usuario solo ve/edita sus propias filas.
drop policy if exists "kv_public_all" on public.kv;
drop policy if exists "kv_owner_all" on public.kv;
create policy "kv_owner_all" on public.kv
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 4) Refresca la cache de esquema de la API (PostgREST) para que las tablas
--    nuevas aparezcan de inmediato sin esperar.
notify pgrst, 'reload schema';
