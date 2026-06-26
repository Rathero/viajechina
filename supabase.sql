-- Pega esto en el SQL Editor de Supabase y pulsa Run.
-- Tabla clave-valor con seguridad por usuario (cada cuenta ve solo sus datos).

create table if not exists public.kv (
  user_id    uuid        not null references auth.users(id) on delete cascade,
  key        text        not null,
  data       jsonb       not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table public.kv enable row level security;

-- Cada usuario solo puede leer/escribir sus propias filas.
create policy "kv_owner_all" on public.kv
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
