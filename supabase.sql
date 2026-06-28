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

-- ============================================================
--  COMPARTIR VIAJES (invitaciones + "Viajes en grupo")
--  ------------------------------------------------------------
--  El dueno de un viaje invita por email. La persona invitada ve
--  la invitacion al iniciar sesion con ese email y, si la acepta,
--  el viaje le aparece en "Viajes en grupo" y puede editarlo igual
--  que el dueno (todo el contenido es compartido: una sola copia).
--
--  Idea clave: el contenido del viaje (tabla kv) sigue perteneciendo
--  al DUENO. Los miembros aceptados leen/escriben esas mismas filas
--  gracias a las politicas RLS de abajo, asi que no hay copias
--  divergentes: todos editan el mismo viaje.
-- ============================================================

-- A) Tabla de invitaciones / membresias de cada viaje.
--    Una fila por (viaje, email invitado). status: pending|accepted|rejected.
create table if not exists public.trip_shares (
  id               uuid        primary key default gen_random_uuid(),
  trip_id          uuid        not null references public.trips(id) on delete cascade,
  owner_id         uuid        not null references auth.users(id) on delete cascade,
  trip_name        text        not null default 'Mi viaje',  -- copia para mostrar la invitacion sin acceso al viaje
  invited_by_email text,                                      -- email del dueno (para mostrarlo)
  email            text        not null,                      -- email invitado, en minusculas
  user_id          uuid        references auth.users(id) on delete cascade,  -- se rellena al aceptar
  status           text        not null default 'pending',
  role             text        not null default 'editor',
  created_at       timestamptz not null default now(),
  unique (trip_id, email)
);
alter table public.trip_shares enable row level security;

-- B) Funciones de ayuda (SECURITY DEFINER: saltan RLS por dentro, evitando
--    recursion entre politicas de tablas que se referencian entre si).

-- Email del usuario actual, en minusculas.
create or replace function public.current_email()
returns text language sql stable as $$
  select lower(coalesce(auth.jwt() ->> 'email', ''));
$$;

-- ¿El usuario actual es el dueno de este viaje?
create or replace function public.is_trip_owner(p_trip_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.trips t
    where t.id = p_trip_id and t.user_id = auth.uid()
  );
$$;

-- ¿El usuario actual es miembro aceptado de este viaje?
create or replace function public.is_trip_member(p_trip_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.trip_shares s
    where s.trip_id = p_trip_id and s.user_id = auth.uid() and s.status = 'accepted'
  );
$$;

-- Extrae el uuid del viaje de una clave kv ('trip_<uuid>' o 'trip_<uuid>_att_..').
create or replace function public.kv_trip_id(p_key text)
returns uuid language plpgsql immutable as $$
declare c text;
begin
  if p_key is null or left(p_key, 5) <> 'trip_' then return null; end if;
  c := substring(p_key from 6 for 36);
  return c::uuid;
exception when others then
  return null;
end $$;

-- ¿Puede el usuario actual acceder a la clave kv (por ser dueno o miembro del viaje)?
create or replace function public.kv_can_access(p_key text)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare tid uuid;
begin
  tid := public.kv_trip_id(p_key);
  if tid is null then return false; end if;
  return public.is_trip_owner(tid) or public.is_trip_member(tid);
end $$;

-- C) Politicas de la tabla trips: el dueno manda; los miembros solo LEEN la
--    fila (para ver el nombre). Renombrar/borrar el viaje queda para el dueno.
drop policy if exists "trips_owner_all" on public.trips;
drop policy if exists "trips_select" on public.trips;
drop policy if exists "trips_insert" on public.trips;
drop policy if exists "trips_update" on public.trips;
drop policy if exists "trips_delete" on public.trips;
create policy "trips_select" on public.trips for select to authenticated
  using (user_id = auth.uid() or public.is_trip_member(id));
create policy "trips_insert" on public.trips for insert to authenticated
  with check (user_id = auth.uid());
create policy "trips_update" on public.trips for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "trips_delete" on public.trips for delete to authenticated
  using (user_id = auth.uid());

-- D) Politicas de la tabla kv: dueno O miembro aceptado del viaje al que
--    pertenece la clave. Asi los miembros editan el mismo contenido.
drop policy if exists "kv_owner_all" on public.kv;
drop policy if exists "kv_select" on public.kv;
drop policy if exists "kv_insert" on public.kv;
drop policy if exists "kv_update" on public.kv;
drop policy if exists "kv_delete" on public.kv;
create policy "kv_select" on public.kv for select to authenticated
  using (user_id = auth.uid() or public.kv_can_access(key));
create policy "kv_insert" on public.kv for insert to authenticated
  with check (user_id = auth.uid() or public.kv_can_access(key));
create policy "kv_update" on public.kv for update to authenticated
  using (user_id = auth.uid() or public.kv_can_access(key))
  with check (user_id = auth.uid() or public.kv_can_access(key));
create policy "kv_delete" on public.kv for delete to authenticated
  using (user_id = auth.uid() or public.kv_can_access(key));

-- E) Politicas de trip_shares:
--    - SELECT: el dueno del viaje, el email invitado o el miembro ya aceptado.
--    - INSERT: solo el dueno puede invitar a su propio viaje.
--    - UPDATE: el dueno gestiona; el invitado puede aceptar/rechazar lo suyo.
--    - DELETE: el dueno revoca; el invitado declina o abandona.
drop policy if exists "shares_select" on public.trip_shares;
drop policy if exists "shares_insert" on public.trip_shares;
drop policy if exists "shares_update" on public.trip_shares;
drop policy if exists "shares_delete" on public.trip_shares;
create policy "shares_select" on public.trip_shares for select to authenticated
  using (owner_id = auth.uid() or lower(email) = public.current_email() or user_id = auth.uid());
create policy "shares_insert" on public.trip_shares for insert to authenticated
  with check (owner_id = auth.uid() and public.is_trip_owner(trip_id));
create policy "shares_update" on public.trip_shares for update to authenticated
  using (owner_id = auth.uid() or lower(email) = public.current_email() or user_id = auth.uid())
  with check (
    owner_id = auth.uid()
    or (lower(email) = public.current_email() and (user_id is null or user_id = auth.uid()))
  );
create policy "shares_delete" on public.trip_shares for delete to authenticated
  using (owner_id = auth.uid() or lower(email) = public.current_email() or user_id = auth.uid());

-- F) Refresca de nuevo la cache de esquema (tabla y funciones nuevas).
notify pgrst, 'reload schema';
