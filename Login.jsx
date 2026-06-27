import React, { useState } from "react";
import { supabase } from "./supabase";

const C = { ink: "#26211C", sub: "#6F6358", paper: "#F5F1EA", card: "#FFFFFF", red: "#C0392B", redDeep: "#7E2A20", jade: "#2E7D6B", line: "#E5DCCF" };

// Apple Sign-In: requiere cuenta de Apple Developer (de pago) + config en Supabase.
// Cuando esté listo, pon esto a true y se mostrará el botón.
const APPLE_ENABLED = false;

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
    <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z" />
    <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z" />
    <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33Z" />
    <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.47.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58Z" />
  </svg>
);

export default function Login() {
  const [mode, setMode] = useState("login"); // "login" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  const oauth = async (provider) => {
    setErr(""); setInfo("");
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin },
    });
    if (error) setErr(error.message);
  };

  const submit = async () => {
    if (!email.trim() || !password) { setErr("Escribe tu email y contraseña."); return; }
    setLoading(true); setErr(""); setInfo("");
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        // Si la confirmación de email está activada, no hay sesión todavía.
        if (!data.session) setInfo("Te hemos enviado un correo para confirmar tu cuenta. Ábrelo y vuelve a entrar.");
        // Si está desactivada, onAuthStateChange (en Root) detectará la sesión.
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      }
    } catch (e) {
      setErr(e.message || "No se pudo completar la operación.");
    } finally {
      setLoading(false);
    }
  };

  const forgot = async () => {
    if (!email.trim()) { setErr("Escribe tu email arriba para enviarte el enlace de recuperación."); return; }
    setErr(""); setInfo("");
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: window.location.origin });
    if (error) setErr(error.message);
    else setInfo("Te hemos enviado un enlace para restablecer tu contraseña.");
  };

  const btnGhost = { width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 10, background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: "11px 14px", fontSize: 14.5, fontWeight: 600, color: C.ink, cursor: "pointer" };

  return (
    <div style={{ minHeight: "100vh", background: C.paper, display: "flex", alignItems: "center", justifyContent: "center", padding: 24, fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif" }}>
      <div style={{ width: "100%", maxWidth: 360 }}>
        <div style={{ fontSize: 40, fontWeight: 800, color: C.ink, letterSpacing: -1, lineHeight: 1 }}>Mi viaje</div>
        <div style={{ color: C.sub, fontSize: 14, marginTop: 6, marginBottom: 24 }}>
          {mode === "signup" ? "Crea tu cuenta para planificar y guardar tus viajes." : "Entra para ver y gestionar tus viajes."}
        </div>

        <button onClick={() => oauth("google")} style={btnGhost}>
          <GoogleIcon /> Continuar con Google
        </button>
        {APPLE_ENABLED && (
          <button onClick={() => oauth("apple")} style={{ ...btnGhost, marginTop: 10 }}>
             Continuar con Apple
          </button>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "18px 0" }}>
          <div style={{ flex: 1, height: 1, background: C.line }} />
          <div style={{ color: C.sub, fontSize: 12 }}>o con tu email</div>
          <div style={{ flex: 1, height: 1, background: C.line }} />
        </div>

        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          placeholder="tu@correo.com"
          autoComplete="email"
          style={{ width: "100%", background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: "12px 14px", fontSize: 15, color: C.ink, outline: "none" }}
        />
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
          type="password"
          placeholder="Contraseña"
          autoComplete={mode === "signup" ? "new-password" : "current-password"}
          style={{ width: "100%", marginTop: 10, background: C.card, border: `1px solid ${C.line}`, borderRadius: 12, padding: "12px 14px", fontSize: 15, color: C.ink, outline: "none" }}
        />

        {err && <div style={{ color: C.red, fontSize: 12.5, marginTop: 10 }}>{err}</div>}
        {info && <div style={{ color: C.jade, fontSize: 12.5, marginTop: 10 }}>{info}</div>}

        <button onClick={submit} disabled={loading} style={{ width: "100%", marginTop: 14, background: C.red, color: "#fff", border: "none", borderRadius: 12, padding: "12px 14px", fontSize: 15, fontWeight: 700, cursor: "pointer", opacity: loading ? 0.7 : 1 }}>
          {loading ? "Un momento…" : mode === "signup" ? "Crear cuenta" : "Entrar"}
        </button>

        {mode === "login" && (
          <button onClick={forgot} style={{ width: "100%", marginTop: 10, color: C.sub, fontSize: 12.5, background: "transparent", border: "none", cursor: "pointer" }}>¿Olvidaste tu contraseña?</button>
        )}

        <div style={{ textAlign: "center", marginTop: 16, color: C.sub, fontSize: 13 }}>
          {mode === "signup" ? "¿Ya tienes cuenta? " : "¿No tienes cuenta? "}
          <button onClick={() => { setMode(mode === "signup" ? "login" : "signup"); setErr(""); setInfo(""); }} style={{ color: C.red, fontWeight: 700, fontSize: 13, background: "transparent", border: "none", cursor: "pointer", padding: 0 }}>
            {mode === "signup" ? "Inicia sesión" : "Regístrate"}
          </button>
        </div>
      </div>
    </div>
  );
}
