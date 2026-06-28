import { supabase } from "./supabase";

/* Compartir viajes: invitaciones por email + "Viajes en grupo".

   Modelo: tabla `trip_shares`, una fila por (viaje, email invitado).
   - El dueno invita -> fila status 'pending'.
   - El invitado (al iniciar sesion con ese email) ve la invitacion y la
     acepta (status 'accepted', user_id = el suyo) o la rechaza.
   - Al aceptar, el viaje aparece en "Viajes en grupo" y se abre como uno
     propio: el contenido (kv) es compartido y editable por todos.

   Las politicas RLS (ver supabase.sql) garantizan que cada quien solo ve y
   toca lo que le corresponde. */

const lc = (s) => (s || "").trim().toLowerCase();

async function me() {
  const { data } = await supabase.auth.getUser();
  return data && data.user ? data.user : null;
}

/* ---------- Lado del DUENO ---------- */

// Invita (o reenvia la invitacion) a un email para un viaje propio.
export async function inviteToTrip(tripId, tripName, email) {
  const u = await me();
  const e = lc(email);
  if (!e) throw new Error("Escribe un email.");
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) throw new Error("Ese email no es valido.");
  if (e === lc(u && u.email)) throw new Error("Ese eres tu.");
  const { data, error } = await supabase
    .from("trip_shares")
    .upsert(
      {
        trip_id: tripId,
        owner_id: u.id,
        trip_name: (tripName || "Mi viaje"),
        invited_by_email: lc(u.email),
        email: e,
        status: "pending",
        user_id: null,
      },
      { onConflict: "trip_id,email" }
    )
    .select("id, email, status, created_at, user_id")
    .single();
  if (error) throw error;
  return data;
}

// Lista las invitaciones/membresias de un viaje propio (para gestionarlas).
export async function listTripShares(tripId) {
  const { data, error } = await supabase
    .from("trip_shares")
    .select("id, email, status, created_at, user_id")
    .eq("trip_id", tripId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

// Revoca/elimina una invitacion o membresia (la persona pierde el acceso).
export async function revokeShare(id) {
  const { error } = await supabase.from("trip_shares").delete().eq("id", id);
  if (error) throw error;
}

/* ---------- Lado del INVITADO ---------- */

// Invitaciones pendientes dirigidas a mi email.
export async function listIncomingInvites() {
  const u = await me();
  const { data, error } = await supabase
    .from("trip_shares")
    .select("id, trip_id, trip_name, invited_by_email, created_at")
    .eq("email", lc(u && u.email))
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function acceptInvite(id) {
  const u = await me();
  const { error } = await supabase
    .from("trip_shares")
    .update({ status: "accepted", user_id: u.id })
    .eq("id", id);
  if (error) throw error;
}

export async function rejectInvite(id) {
  const { error } = await supabase
    .from("trip_shares")
    .update({ status: "rejected" })
    .eq("id", id);
  if (error) throw error;
}

// Viajes que me han compartido y he aceptado (no son mios).
export async function listSharedTrips() {
  const u = await me();
  const { data: shares, error } = await supabase
    .from("trip_shares")
    .select("trip_id, trip_name")
    .eq("user_id", u.id)
    .eq("status", "accepted");
  if (error) throw error;
  const ids = (shares || []).map((s) => s.trip_id);
  if (ids.length === 0) return [];
  const { data: trips, error: e2 } = await supabase
    .from("trips")
    .select("id, name, created_at, updated_at")
    .in("id", ids);
  if (e2) throw e2;
  const byId = Object.fromEntries((trips || []).map((t) => [t.id, t]));
  // Usa el nombre vivo del viaje; si no hay acceso, cae al nombre guardado.
  return (shares || []).map((s) => {
    const t = byId[s.trip_id];
    return t
      ? { ...t, shared: true }
      : { id: s.trip_id, name: s.trip_name, created_at: null, updated_at: null, shared: true };
  });
}

// Abandonar un viaje compartido (borra mi membresia; el viaje no se toca).
export async function leaveSharedTrip(tripId) {
  const u = await me();
  const { error } = await supabase
    .from("trip_shares")
    .delete()
    .eq("trip_id", tripId)
    .eq("user_id", u.id);
  if (error) throw error;
}
