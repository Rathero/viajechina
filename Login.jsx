import React, { useState } from "react";
import { supabase } from "./supabase";

const C = { ink: "#26211C", sub: "#6F6358", paper: "#F5F1EA", card: "#FFFFFF", red: "#C0392B", line: "#E5DCCF" };

export default function Login() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const send = async () => {
    if (!email.trim()) return;
    setLoading(true); setErr("");
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: window.location.origin },
    });
    setLoading(false);
    if (error) setErr(error.message); else setSent(true);
  };

  return (
    <div style={{ minHeight: "100vh", background: C.paper, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif" }}>
      <div style={{ width: "100%", maxWidth: 360 }}>
        <div style={{ fontSize: 40, fontWeight: 800, color: C.ink, letterSpacing: -1, lineHeight: 1 }}>Mi viaje</div>
        <div style={{ color: C.sub, fontSize: 14, marginTop: 6, marginBottom: 24 }}>Entra con tu correo para guardar y sincronizar tu viaje.</div>

        {sent ? (
          <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, padding: 20 }}>
            <div style={{ fontWeight: 700, color: C.ink, fontSize: 15 }}>Revisa tu correo</div>
            <div style={{ color: C.sub, fontSize: 13, marginTop: 6 }}>Te hemos enviado un enlace de acceso a <b>{email}</b>. Ábrelo en este dispositivo para entrar.</div>
            <button onClick={() => setSent(false)} style={{ marginTop: 14, color: C.sub, fontSize: 13 }}>Usar otro correo</button>
          </div>
        ) : (
          <div>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") send(); }}
              type="email"
              placeholder="tu@correo.com"
              style={{ width: "100%", background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: "12px 14px", fontSize: 15, color: C.ink, outline: "none" }}
            />
            {err && <div style={{ color: C.red, fontSize: 12.5, marginTop: 8 }}>{err}</div>}
            <button onClick={send} disabled={loading} style={{ width: "100%", marginTop: 12, background: C.red, color: "#fff", border: "none", borderRadius: 12, padding: "12px 14px", fontSize: 15, fontWeight: 700, cursor: "pointer", opacity: loading ? 0.7 : 1 }}>
              {loading ? "Enviando…" : "Enviar enlace de acceso"}
            </button>
            <div style={{ color: C.sub, fontSize: 11.5, marginTop: 12, textAlign: "center" }}>Sin contraseña. Recibirás un enlace mágico por email.</div>
          </div>
        )}
      </div>
    </div>
  );
}
