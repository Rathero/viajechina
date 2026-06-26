-- Pega esto en el SQL Editor de Supabase y pulsa Run.
-- Tabla clave-valor PÚBLICA: un único viaje compartido, sin login.
-- Cualquiera con la URL de la app puede leer y escribir.

-- OJO: esto borra la tabla anterior (la que tenía user_id) y la recrea.
-- Si tenías datos importantes guardados, haz una copia antes.
drop table if exists public.kv;

create table public.kv (
  key        text        primary key,
  data       jsonb       not null,
  updated_at timestamptz not null default now()
);

alter table public.kv enable row level security;

-- Acceso público: el rol anónimo (anon) puede leer y escribir todo.
create policy "kv_public_all" on public.kv
  for all
  to anon, authenticated
  using (true)
  with check (true);
