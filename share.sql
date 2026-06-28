-- ============================================================
--  COMPARTIR VIAJES (invitaciones + "Viajes en grupo")
--  ------------------------------------------------------------
--  Ejecuta este archivo COMPLETO en Supabase -> SQL Editor -> Run.
--
--  IMPORTANTE: copia el contenido del ARCHIVO (texto crudo), NO un
--  "diff" de git. Si ves lineas como `@@ -92,3 +92,141 @@` o lineas
--  que empiezan por `+` o `-`, estas copiando un diff: abre el archivo
--  en crudo (boton "Raw" en GitHub) y copia desde ahi.
--
--  Es idempotente (puedes reejecutarlo) y NO borra datos: solo crea la
--  tabla `trip_shares`, unas funciones y las politicas de permisos.
--  Requiere que ya existan las tablas `trips` y `kv` (las de tu app).
--
--  El dueno de un viaje invita por email. La persona invitada ve la
--  invitacion al iniciar sesion con ese email y, si la acepta, el viaje
--  le aparece en "Viajes en grupo" y puede editarlo igual que el dueno
--  (todo el contenido es compartido: una sola copia).
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

-- F) Refresca la cache de esquema de la API (PostgREST).
notify pgrst, 'reload schema';
