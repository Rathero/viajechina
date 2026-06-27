import React, { useEffect, useState } from "react";
import { Plus, Trash2, Pencil, MapPin, LogOut, ChevronRight, Check, X } from "lucide-react";
import { supabase } from "./supabase";
import { listTrips, createTrip, renameTrip, deleteTrip } from "./tripsApi";

const C = { ink: "#26211C", sub: "#6F6358", paper: "#F5F1EA", card: "#FFFFFF", red: "#C0392B", redDeep: "#7E2A20", jade: "#2E7D6B", line: "#E5DCCF" };
const Card = ({ children, style }) => (
  <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, ...style }}>{children}</div>
);
const inp = { width: "100%", background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: "10px 12px", fontSize: 14, color: C.ink, outline: "none" };
const row = { display: "flex", alignItems: "center" };
// Reset de botón (no dependemos del preflight de Tailwind).
const btn = { background: "transparent", border: "none", cursor: "pointer", padding: 0, font: "inherit", color: "inherit" };
const iconBtn = { ...btn, display: "flex", alignItems: "center", justifyContent: "center", padding: 8 };
const fmtDate = (s) => { try { return new Date(s).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" }); } catch (e) { return ""; } };

export default function Trips({ session, onOpen }) {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [confirmDel, setConfirmDel] = useState(null);

  const email = session?.user?.email || "";

  const refresh = async () => {
    setLoading(true); setErr("");
    try { setTrips(await listTrips()); }
    catch (e) { setErr(e.message || "No se pudieron cargar tus viajes."); }
    finally { setLoading(false); }
  };
  useEffect(() => { refresh(); }, []);

  const add = async () => {
    if (!newName.trim() || busy) return;
    setBusy(true); setErr("");
    try { const t = await createTrip(newName); setNewName(""); setTrips((x) => [...x, t]); }
    catch (e) { setErr(e.message || "No se pudo crear el viaje."); }
    finally { setBusy(false); }
  };

  const saveRename = async (id) => {
    const name = editName.trim();
    setEditingId(null);
    if (!name) return;
    setTrips((x) => x.map((t) => (t.id === id ? { ...t, name } : t)));
    try { await renameTrip(id, name); } catch (e) { setErr(e.message || "No se pudo renombrar."); refresh(); }
  };

  const doDelete = async (id) => {
    setConfirmDel(null);
    setTrips((x) => x.filter((t) => t.id !== id));
    try { await deleteTrip(id); } catch (e) { setErr(e.message || "No se pudo borrar el viaje."); refresh(); }
  };

  return (
    <div style={{ background: C.paper, minHeight: "100vh", maxWidth: 480, margin: "0 auto", fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif", color: C.ink }}>
      <div style={{ padding: "20px 20px 24px" }}>
        <div style={{ ...row, justifyContent: "space-between" }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 26, fontWeight: 800, color: C.ink, letterSpacing: -0.5 }}>Mis viajes</div>
            {email && <div style={{ color: C.sub, fontSize: 12.5, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{email}</div>}
          </div>
          <button onClick={() => supabase.auth.signOut()} title="Cerrar sesión" style={{ ...btn, display: "flex", alignItems: "center", gap: 6, color: C.sub, fontSize: 12.5, flexShrink: 0, marginLeft: 12 }}>
            <LogOut size={16} /> Salir
          </button>
        </div>

        <Card style={{ padding: 12, marginTop: 18, marginBottom: 18 }}>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }} placeholder="Nombre del nuevo viaje (ej. Japón 2026)" style={{ ...inp, flex: 1, minWidth: 0 }} />
            <button onClick={add} disabled={busy} style={{ ...btn, background: C.red, color: "#fff", borderRadius: 10, padding: "0 16px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, opacity: busy ? 0.7 : 1 }}><Plus size={20} /></button>
          </div>
        </Card>

        {err && <div style={{ color: C.red, fontSize: 12.5, marginBottom: 12 }}>{err}</div>}

        {loading ? (
          <div style={{ color: C.sub, fontSize: 14, textAlign: "center", padding: "30px 0" }}>Cargando tus viajes…</div>
        ) : trips.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "40px 24px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 16, marginBottom: 12, width: 56, height: 56, background: C.card, border: `1px solid ${C.line}` }}>
              <MapPin size={26} color={C.red} />
            </div>
            <div style={{ fontWeight: 700, color: C.ink, fontSize: 15 }}>Aún no tienes viajes</div>
            <div style={{ color: C.sub, fontSize: 13, marginTop: 4, maxWidth: 280 }}>Crea tu primer viaje con el campo de arriba para empezar a planificar.</div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {trips.map((t) => (
              <Card key={t.id} style={{ padding: 0, overflow: "hidden" }}>
                {editingId === t.id ? (
                  <div style={{ ...row, gap: 8, padding: "12px" }}>
                    <input value={editName} autoFocus onChange={(e) => setEditName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") saveRename(t.id); if (e.key === "Escape") setEditingId(null); }} style={{ ...inp, flex: 1, minWidth: 0 }} />
                    <button onClick={() => saveRename(t.id)} style={{ ...btn, background: C.jade, color: "#fff", borderRadius: 10, padding: "8px 12px", display: "flex", flexShrink: 0 }}><Check size={16} /></button>
                    <button onClick={() => setEditingId(null)} style={{ ...iconBtn, color: C.sub, flexShrink: 0 }}><X size={16} /></button>
                  </div>
                ) : confirmDel === t.id ? (
                  <div style={{ ...row, justifyContent: "space-between", gap: 10, padding: "14px 16px" }}>
                    <div style={{ fontSize: 13, color: C.ink, minWidth: 0 }}>¿Borrar <b>{t.name}</b> y todo su contenido?</div>
                    <div style={{ display: "flex", gap: 14, flexShrink: 0 }}>
                      <button onClick={() => doDelete(t.id)} style={{ ...btn, color: C.red, fontSize: 12.5, fontWeight: 700 }}>Borrar</button>
                      <button onClick={() => setConfirmDel(null)} style={{ ...btn, color: C.sub, fontSize: 12.5 }}>Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <div style={row}>
                    <button onClick={() => onOpen(t.id, t.name)} style={{ ...btn, display: "flex", alignItems: "center", gap: 12, flex: "1 1 0%", minWidth: 0, textAlign: "left", padding: "12px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 12, width: 42, height: 42, background: C.paper, border: `1px solid ${C.line}`, flexShrink: 0 }}>
                        <MapPin size={20} color={C.red} />
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, color: C.ink, fontSize: 15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.name}</div>
                        <div style={{ color: C.sub, fontSize: 12 }}>Creado el {fmtDate(t.created_at)}</div>
                      </div>
                    </button>
                    <div style={{ display: "flex", alignItems: "center", gap: 2, paddingRight: 8, flexShrink: 0 }}>
                      <button onClick={() => { setEditingId(t.id); setEditName(t.name); }} style={iconBtn} title="Renombrar"><Pencil size={15} color={C.sub} /></button>
                      <button onClick={() => setConfirmDel(t.id)} style={iconBtn} title="Borrar"><Trash2 size={15} color={C.sub} /></button>
                      <button onClick={() => onOpen(t.id, t.name)} style={{ ...iconBtn, padding: 4 }} title="Abrir"><ChevronRight size={20} color={C.sub} /></button>
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
