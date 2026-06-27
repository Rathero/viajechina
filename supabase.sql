-- ============================================================
--  Migración a MULTIUSUARIO (Login + "Mis viajes")
--  Pégalo en el SQL Editor de Supabase y pulsa Run.
--
--  ANTES de ejecutar:
--   1) Regístrate UNA vez en la app (con email+contraseña o con Google).
--   2) Sustituye 'TU_EMAIL_AQUI' (más abajo) por ese mismo email.
--
--  Es seguro reejecutarlo. Si el email no existe todavía, no cambia nada.
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

-- Asegura RLS en kv y añade la propiedad por usuario SIN borrar datos.
alter table public.kv enable row level security;
alter table public.kv add column if not exists user_id uuid references auth.users(id) on delete cascade;

-- 1) Migración del viaje "China" + bloqueo de kv por usuario.
--    Todo en un bloque atómico: si el email no existe, lanza error y NO cambia nada.
do $$
declare
  uid   uuid;
  newid uuid := gen_random_uuid();
begin
  select id into uid from auth.users where email = 'TU_EMAIL_AQUI';
  if uid is null then
    raise exception 'No encontré ese email en auth.users. Regístrate primero en la app y vuelve a ejecutar.';
  end if;

  -- Conserva el viaje actual: lo asigna a tu cuenta y re-clava su contenido por viaje.
  if exists (select 1 from public.kv where key = 'viaje_china_v3') then
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
  end if;

  -- Quita cualquier fila pública sin dueño que quedara.
  delete from public.kv where user_id is null;

  -- Bloquea kv por usuario (idempotente).
  alter table public.kv alter column user_id set not null;
  alter table public.kv drop constraint if exists kv_pkey;
  alter table public.kv add primary key (user_id, key);
end $$;

-- 2) RLS dueño-only en kv: cada usuario solo ve/edita sus propias filas.
drop policy if exists "kv_public_all" on public.kv;
drop policy if exists "kv_owner_all" on public.kv;
create policy "kv_owner_all" on public.kv
  for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
