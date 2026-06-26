import React, { useEffect, useState } from "react";
import App from "./App";
import Login from "./Login";
import { supabase, isConfigured } from "./supabase";

export default function Root() {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState(null);

  useEffect(() => {
    if (!isConfigured) { setReady(true); return; }
    let sub;
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    sub = supabase.auth.onAuthStateChange((_e, s) => setSession(s)).data.subscription;
    return () => sub && sub.unsubscribe();
  }, []);

  const center = { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui, sans-serif", color: "#6F6358", background: "#F5F1EA" };
  if (!ready) return <div style={center}>Cargando…</div>;
  if (isConfigured && !session) return <Login />;
  return <App />;
}
