import { supabase, isConfigured } from "./supabase";

/* Persistencia 100% en Supabase (Postgres). No se usa localStorage para los
   datos de la app: si no hay credenciales configuradas, cada operación falla
   con un mensaje claro en vez de guardar nada en el navegador.

   Contrato sencillo: get / set / list / delete.
   `value` siempre es un string JSON. */

function ensureConfigured() {
  if (!isConfigured) {
    throw new Error(
      "Supabase no está configurado. Define VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY (.env.local / Vercel)."
    );
  }
}

async function currentUserId() {
  const { data } = await supabase.auth.getUser();
  return data && data.user ? data.user.id : undefined;
}

/* Para viajes compartidos, el contenido (filas kv) pertenece SIEMPRE al dueno
   del viaje, no a quien escribe. Asi todos los miembros editan la misma copia.
   Resolvemos el dueno a partir del id que viaja embebido en la clave kv
   ('trip_<uuid>' / 'trip_<uuid>_att_..') consultando la tabla `trips`. */
const ownerCache = new Map();

function tripIdFromKey(key) {
  const m = /^trip_([0-9a-fA-F-]{36})/.exec(key || "");
  return m ? m[1] : null;
}

async function ownerForKey(key) {
  const tripId = tripIdFromKey(key);
  if (!tripId) return currentUserId(); // claves sin viaje: dueno = usuario actual
  if (ownerCache.has(tripId)) return ownerCache.get(tripId);
  const { data } = await supabase.from("trips").select("user_id").eq("id", tripId).maybeSingle();
  const owner = data && data.user_id ? data.user_id : await currentUserId();
  ownerCache.set(tripId, owner);
  return owner;
}

export const store = {
  async get(key) {
    ensureConfigured();
    const { data, error } = await supabase.from("kv").select("data").eq("key", key).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return { key, value: JSON.stringify(data.data) };
  },
  async set(key, value) {
    ensureConfigured();
    // El dueno del viaje es el propietario de la fila (no quien escribe), para
    // que la edicion compartida actualice una unica copia canonica.
    const user_id = await ownerForKey(key);
    const { error } = await supabase
      .from("kv")
      .upsert({ user_id, key, data: JSON.parse(value) }, { onConflict: "user_id,key" });
    if (error) throw error;
    return { key, value };
  },
  async list(prefix) {
    ensureConfigured();
    // RLS limita las filas al usuario actual; traemos sus claves y filtramos por prefijo.
    const { data, error } = await supabase.from("kv").select("key");
    if (error) throw error;
    const p = prefix || "";
    return { keys: (data || []).map((r) => r.key).filter((k) => k.startsWith(p)) };
  },
  async delete(key) {
    ensureConfigured();
    const { error } = await supabase.from("kv").delete().eq("key", key);
    if (error) throw error;
    return { key, deleted: true };
  },
};
