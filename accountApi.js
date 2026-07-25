import { supabase } from "./supabase";

/* Borrado de cuenta (obligatorio en Google Play para apps con registro).

   El borrado del usuario necesita permisos de administrador, que no pueden
   estar en el navegador. Por eso llama a la Edge Function `delete-account`,
   que comprueba la sesión y borra viajes, adjuntos, invitaciones y usuario. */

export async function deleteAccount() {
  const { data: s } = await supabase.auth.getSession();
  const token = s && s.session ? s.session.access_token : null;
  if (!token) throw new Error("Tu sesión ha caducado. Vuelve a entrar e inténtalo de nuevo.");

  const { data, error } = await supabase.functions.invoke("delete-account", {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (error) {
    throw new Error("No se ha podido eliminar la cuenta. Inténtalo de nuevo o escríbenos.");
  }
  if (data && data.error) throw new Error(data.error);

  // La sesión ya no vale: limpiamos el estado local del navegador.
  try { await supabase.auth.signOut(); } catch (e) {}
  return true;
}
