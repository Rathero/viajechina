import { supabase } from "./supabase";
import { store } from "./store";

/* CRUD de viajes sobre la tabla `trips`. Cada viaje pertenece a un usuario (RLS).
   El contenido de cada viaje vive en la tabla `kv` con claves namespaced:
   - blob principal:  trip_<id>
   - adjuntos:        trip_<id>_att_<attId>  */

export async function listTrips() {
  const { data, error } = await supabase
    .from("trips")
    .select("id, name, created_at, updated_at")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function createTrip(name) {
  const { data: u } = await supabase.auth.getUser();
  const user_id = u && u.user ? u.user.id : undefined;
  const { data, error } = await supabase
    .from("trips")
    .insert({ user_id, name: (name || "Mi viaje").trim() || "Mi viaje" })
    .select("id, name, created_at, updated_at")
    .single();
  if (error) throw error;
  return data;
}

export async function renameTrip(id, name) {
  const { error } = await supabase
    .from("trips")
    .update({ name: (name || "").trim() || "Mi viaje", updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteTrip(id) {
  // Primero borramos el contenido (blob + adjuntos) y luego la fila del viaje.
  try {
    const lst = await store.list(`trip_${id}`);
    const keys = (lst && lst.keys) || [];
    for (const k of keys) {
      const key = typeof k === "string" ? k : k.key;
      try { await store.delete(key); } catch (e) {}
    }
  } catch (e) {}
  const { error } = await supabase.from("trips").delete().eq("id", id);
  if (error) throw error;
}
