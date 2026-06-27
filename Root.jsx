import React, { useEffect, useState } from "react";
import App from "./App";
// --- LOGIN DESACTIVADO (uso personal: la app no se comparte) ---
// El código sigue aquí para no perderlo. Para volver a activar el login
// multiusuario + pantalla "Mis viajes": descomenta estas dos líneas y
// restaura los bloques marcados con «[LOGIN]» más abajo.
// import Login from "./Login";
// import Trips from "./Trips";
import { listTrips, createTrip } from "./tripsApi";
import { supabase, isConfigured } from "./supabase";

// Entrada automática sin pantalla de login. Estas credenciales se ponen en
// .env.local (archivo privado, NO se sube a git). Si se dejan vacías, se usa
// la sesión que ya esté guardada en el navegador de una vez anterior.
const AUTO_EMAIL = import.meta.env.VITE_AUTH_EMAIL;
const AUTO_PASSWORD = import.meta.env.VITE_AUTH_PASSWORD;
// Nombre del viaje que se abre directamente al entrar.
const TRIP_NAME = "China";

const C = { ink: "#26211C", sub: "#6F6358", paper: "#F5F1EA", card: "#FFFFFF", red: "#C0392B", line: "#E5DCCF", jade: "#2E7D6B" };
const center = { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui, sans-serif", color: C.sub, background: C.paper };

/* Pantalla para fijar una nueva contraseña tras pulsar el enlace de recuperación. */
function ResetPassword({ onDone }) {
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const save = async () => {
    if (password.length < 6) { setErr("La contraseña debe tener al menos 6 caracteres."); return; }
    setLoading(true); setErr("");
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) setErr(error.message);
    else onDone();
  };
  return (
    <div style={{ minHeight: "100vh", background: C.paper, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif" }}>
      <div style={{ width: "100%", maxWidth: 360 }}>
        <div style={{ fontSize: 28, fontWeight: 800, color: C.ink }}>Nueva contraseña</div>
        <div style={{ color: C.sub, fontSize: 14, marginTop: 6, marginBottom: 20 }}>Escribe tu nueva contraseña para entrar.</div>
        <input value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") save(); }} type="password" placeholder="Nueva contraseña" autoComplete="new-password"
          style={{ width: "100%", background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: "12px 14px", fontSize: 15, color: C.ink, outline: "none" }} />
        {err && <div style={{ color: C.red, fontSize: 12.5, marginTop: 10 }}>{err}</div>}
        <button onClick={save} disabled={loading} style={{ width: "100%", marginTop: 14, background: C.red, color: "#fff", border: "none", borderRadius: 12, padding: "12px 14px", fontSize: 15, fontWeight: 700, cursor: "pointer", opacity: loading ? 0.7 : 1 }}>
          {loading ? "Guardando…" : "Guardar contraseña"}
        </button>
      </div>
    </div>
  );
}

export default function Root() {
  // Modo local (sin credenciales Supabase): se salta el login y abre un viaje local.
  if (!isConfigured) return <App tripId="local" tripName={TRIP_NAME} onBack={null} />;

  const [ready, setReady] = useState(false);
  const [session, setSession] = useState(null);
  const [trip, setTrip] = useState(null); // { id, name }
  const [error, setError] = useState("");

  // 1) Conseguir sesión: reutiliza la guardada en el navegador y, si no hay,
  //    entra automáticamente con las credenciales de .env.local.
  useEffect(() => {
    let cancel = false;
    (async () => {
      let { data } = await supabase.auth.getSession();
      let s = data.session;
      if (!s && AUTO_EMAIL && AUTO_PASSWORD) {
        const r = await supabase.auth.signInWithPassword({ email: AUTO_EMAIL, password: AUTO_PASSWORD });
        if (r.error && !cancel) setError("No se pudo entrar automáticamente: " + r.error.message);
        s = (r.data && r.data.session) || null;
      }
      if (!cancel) { setSession(s); setReady(true); }
    })();
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === "SIGNED_OUT") setTrip(null);
    });
    return () => { cancel = true; sub && sub.subscription && sub.subscription.unsubscribe(); };
  }, []);

  // 2) Con sesión activa, abrir directamente el viaje de China (sin pasar por
  //    "Mis viajes"). Si la cuenta no tuviera ninguno, se crea uno.
  useEffect(() => {
    if (!session || trip) return;
    let cancel = false;
    (async () => {
      try {
        const list = await listTrips();
        let t = list.find((x) => (x.name || "").trim().toLowerCase() === TRIP_NAME.toLowerCase()) || list[0];
        if (!t) t = await createTrip(TRIP_NAME);
        if (!cancel) setTrip({ id: t.id, name: t.name });
      } catch (e) {
        if (!cancel) setError((e && e.message) || String(e));
      }
    })();
    return () => { cancel = true; };
  }, [session, trip]);

  if (!ready) return <div style={center}>Cargando…</div>;

  // [LOGIN] Flujo original (desactivado). Para reactivar el login multiusuario,
  //         descomenta esto (y los imports de arriba) y borra el bloque de
  //         "sin sesión" que viene justo después:
  //   if (recovery) return <ResetPassword onDone={() => setRecovery(false)} />;
  //   if (!session) return <Login />;
  //   if (!trip) return <Trips session={session} onOpen={(id, name) => setTrip({ id, name })} />;
  //   return <App key={trip.id} tripId={trip.id} tripName={trip.name} onBack={() => setTrip(null)} />;

  if (!session) {
    return (
      <div style={center}>
        <div style={{ textAlign: "center", maxWidth: 440, padding: 24 }}>
          <div style={{ fontWeight: 700, color: C.ink, marginBottom: 8 }}>Entrada automática no configurada</div>
          <div>Añade <code>VITE_AUTH_EMAIL</code> y <code>VITE_AUTH_PASSWORD</code> en el archivo <code>.env.local</code> con tu cuenta de Supabase y reinicia el servidor.</div>
          {error && <div style={{ color: C.red, fontSize: 13, marginTop: 12 }}>{error}</div>}
        </div>
      </div>
    );
  }
  if (!trip) return <div style={center}>Abriendo tu viaje de {TRIP_NAME}…</div>;
  // Sin botón "volver": ya no existe la pantalla de "Mis viajes".
  return <App key={trip.id} tripId={trip.id} tripName={trip.name} onBack={null} />;
}
