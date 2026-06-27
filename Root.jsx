import React, { useEffect, useState } from "react";
import App from "./App";
import Login from "./Login";
import Trips from "./Trips";
import { supabase, isConfigured } from "./supabase";

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
  // Sin credenciales de Supabase no se arranca: todos los datos viven en la BBDD,
  // no hay almacenamiento local. Mostramos cómo configurarlo.
  if (!isConfigured) return (
    <div style={center}>
      <div style={{ textAlign: "center", maxWidth: 440, padding: 24 }}>
        <div style={{ fontWeight: 700, color: C.ink, marginBottom: 8 }}>Falta configurar Supabase</div>
        <div>Define <code>VITE_SUPABASE_URL</code> y <code>VITE_SUPABASE_ANON_KEY</code> en <code>.env.local</code> (y en Vercel) y reinicia. Todos los datos se guardan en la base de datos.</div>
      </div>
    </div>
  );

  const [ready, setReady] = useState(false);
  const [session, setSession] = useState(null);
  const [trip, setTrip] = useState(null); // { id, name }
  const [recovery, setRecovery] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
      if (event === "SIGNED_OUT") { setTrip(null); setRecovery(false); }
    });
    return () => sub && sub.subscription && sub.subscription.unsubscribe();
  }, []);

  if (!ready) return <div style={center}>Cargando…</div>;
  if (recovery) return <ResetPassword onDone={() => setRecovery(false)} />;
  if (!session) return <Login />;
  if (!trip) return <Trips session={session} onOpen={(id, name) => setTrip({ id, name })} />;
  return <App key={trip.id} tripId={trip.id} tripName={trip.name} onBack={() => setTrip(null)} />;
}
