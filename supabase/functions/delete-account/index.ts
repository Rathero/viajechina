/* Borrado de cuenta — obligatorio en Google Play para apps con registro.
   La invoca accountApi.js desde "Mis viajes → Tu cuenta → Eliminar mi cuenta".

   Borrar un usuario de auth.users necesita la clave de servicio, que no puede
   estar en el navegador (quien la tenga puede leer y borrar los datos de
   cualquiera). Por eso vive aquí: esta función se ejecuta en Supabase, y lo
   único que acepta es la sesión de quien llama, así que solo puede borrarse
   uno a sí mismo.

   Desplegar:
     npx supabase functions deploy delete-account

   No hay que configurar ningún secreto: SUPABASE_URL, SUPABASE_ANON_KEY y
   SUPABASE_SERVICE_ROLE_KEY ya están disponibles en el entorno de la función. */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método no permitido." }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) return json({ error: "Falta la sesión." }, 401);

  /* Quién llama. Se resuelve con la clave anónima y el token de quien llama:
     nunca se acepta un id de usuario que venga en el cuerpo de la petición. */
  const caller = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });

  const { data: userData, error: userErr } = await caller.auth.getUser();
  const user = userData?.user;
  if (userErr || !user) return json({ error: "Tu sesión ha caducado. Vuelve a entrar." }, 401);

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  /* Las invitaciones que otros le enviaron a este correo y nunca llegó a
     aceptar guardan su email pero no su id, así que no las alcanza el borrado
     en cascada. Se limpian a mano para no dejar el correo suelto en la base. */
  if (user.email) {
    const { error } = await admin.from("trip_shares").delete().eq("invited_email", user.email);
    if (error) console.error("No se pudieron borrar las invitaciones recibidas:", error.message);
  }

  /* trips, kv y trip_shares referencian auth.users(id) con ON DELETE CASCADE
     (ver supabase.sql), así que borrar el usuario se lleva por delante sus
     viajes, el contenido, los adjuntos y las invitaciones que envió. */
  const { error: delErr } = await admin.auth.admin.deleteUser(user.id);
  if (delErr) {
    console.error("Error al borrar el usuario:", delErr.message);
    return json({ error: "No se ha podido eliminar la cuenta. Inténtalo de nuevo." }, 500);
  }

  return json({ ok: true });
});
