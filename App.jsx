import React, { useState, useEffect, useRef } from "react";
import {
  Plane, Train, Calendar, Wallet, Luggage, FileText, MapPin, Check, Plus,
  Trash2, ChevronDown, ChevronRight, ChevronLeft, Building2, Sparkles, AlertCircle,
  CreditCard, Wifi, Globe, RotateCcw, Paperclip, Download, StickyNote, X,
  Pencil, Bus, Car, Ship, ListChecks, ClipboardList, Image as ImageIcon, GripVertical,
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { store } from "./store";

/* ============ paleta y constantes ============ */
const C = {
  ink: "#26211C", sub: "#6F6358", paper: "#F5F1EA", card: "#FFFFFF",
  red: "#C0392B", redDeep: "#7E2A20", jade: "#2E7D6B", line: "#E5DCCF",
};
const TYPE = {
  historia: { c: "#9A6A2F", l: "Historia" },
  cultura: { c: "#2E7D6B", l: "Cultura" },
  naturaleza: { c: "#4F7A3A", l: "Naturaleza" },
  tech: { c: "#3D5A98", l: "Tech" },
  comida: { c: "#C0392B", l: "Comida" },
  traslado: { c: "#8A8079", l: "Traslado" },
  logistica: { c: "#A99F93", l: "Logística" },
};
const PALETTE = ["#C0392B", "#9A6A2F", "#4F7A3A", "#2E7D6B", "#3D5A98", "#7E5BA6", "#B0703A", "#3F7E8C", "#A23E5C", "#6B7A3A"];
const TRANSPORTS = ["Vuelo", "Tren", "Bus", "Coche", "Barco"];
const TR_ICON = { Vuelo: Plane, Tren: Train, Bus: Bus, Coche: Car, Barco: Ship };
const DOW = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];
const MON = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const MONTHS_FULL = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const dparts = (iso) => {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return { dow: DOW[dt.getUTCDay()], dd: d, mmm: MON[m - 1] };
};
const eur = (n) => "€" + (Math.round((n || 0) * 100) / 100).toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const todayISO = () => {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
};
const addDaysISO = (iso, n) => {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
};
const rangeISO = (a, b) => {
  if (!a) return [];
  if (!b || b < a) return [a];
  const out = []; let cur = a, guard = 0;
  while (cur <= b && guard < 400) { out.push(cur); cur = addDaysISO(cur, 1); guard++; }
  return out;
};
const monthsBetween = (minISO, maxISO) => {
  const res = []; let y = Number(minISO.slice(0, 4)), m = Number(minISO.slice(5, 7)) - 1;
  const ey = Number(maxISO.slice(0, 4)), em = Number(maxISO.slice(5, 7)) - 1; let guard = 0;
  while ((y < ey || (y === ey && m <= em)) && guard < 24) { res.push({ year: y, mIdx: m }); m++; if (m > 11) { m = 0; y++; } guard++; }
  return res;
};
const fileToDataURL = (f) => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(r.result);
  r.onerror = rej;
  r.readAsDataURL(f);
});

// Las claves de almacenamiento se derivan del viaje (ver dentro de App).
const mono = { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" };
const inp = { width: "100%", background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, padding: "10px 12px", fontSize: 14, color: C.ink, outline: "none" };



/* maleta: plantilla útil de partida (editable) */
const DEFAULT_PACKING = [
  ["Documentos", ["Pasaporte (+6 meses de validez)", "Seguro de viaje", "Copias de documentos", "Tarjeta para Alipay / WeChat"]],
  ["Ropa", ["Capas / jersey", "Chaqueta cortavientos", "Calzado cómodo para caminar", "Paraguas plegable"]],
  ["Electrónica", ["Adaptador de enchufe China (tipo A/I)", "Power bank", "Cargadores", "eSIM o VPN configurado"]],
  ["Aseo y salud", ["Medicación personal + receta", "Botiquín básico", "Protección solar"]],
  ["Otros", ["Mochila de día", "Botella reutilizable", "Algo de efectivo en CNY"]],
].flatMap(([cat, items], ci) => items.map((it, i) => ({ id: `k${ci}-${i}`, cat, item: it, done: false })));

/* checklist: gestiones (organización) y experiencias (qué quiero vivir) — plantilla editable */
const DEFAULT_TASKS = [
  "Comprar el seguro de viaje",
  "Comprar la tarjeta SIM / eSIM",
  "Pedir dinero en efectivo (CNY)",
  "Vincular tarjeta a Alipay / WeChat Pay",
  "Configurar la VPN antes de salir",
  "Descargar mapas y traductor offline",
].map((t, i) => ({ id: `t${i}`, text: t, done: false, notes: "", att: [] }));

const DEFAULT_EXPERIENCES = [
  "Probar un coche totalmente autónomo (robotaxi)",
  "Subir al tren maglev de Shanghái",
  "Cenar en un mercado nocturno local",
  "Ver un espectáculo de la Ópera de Pekín",
].map((t, i) => ({ id: `x${i}`, text: t, done: false, notes: "", att: [] }));

const DOCS = [
  { id: "doc1", label: "Pasaporte con validez mínima de 6 meses y 2 páginas libres" },
  { id: "doc2", label: "Sin visado: estancias de hasta 30 días para españoles, vigente hasta 31/12/2026" },
  { id: "doc3", label: "E-Arrival Card (declaración electrónica de entrada): obligatoria aunque no haga falta visado" },
  { id: "doc4", label: "Seguro médico de viaje contratado" },
  { id: "doc5", label: "Billete de salida con fecha (pueden pedirlo en frontera)" },
  { id: "doc6", label: "Reservas de hotel y vuelos guardadas en PDF / captura" },
  { id: "doc7", label: "Registro policial en 24h solo si NO te alojas en hotel (el hotel lo hace por ti)" },
  { id: "doc8", label: "Vacunas: ninguna obligatoria (consultar recomendaciones generales)" },
];
const TIPS = [
  { icon: CreditCard, t: "Pagos", x: "Alipay y WeChat Pay son imprescindibles; vincula tu Visa o Mastercard antes de salir. El efectivo casi no se usa." },
  { icon: Wifi, t: "Internet", x: "Google, WhatsApp, Instagram y Gmail están bloqueados. Lleva una eSIM internacional (enruta fuera de China) o instala una VPN ANTES de viajar." },
  { icon: Train, t: "Transporte", x: "Tren de alta velocidad para las distancias largas: compra con antelación y lleva el pasaporte. Metro con QR y Didi (tipo Uber) para taxis." },
  { icon: Globe, t: "Idioma", x: "Poca gente habla inglés. Descarga un traductor offline (Google Translate / Pleco) y guarda las direcciones en chino." },
  { icon: AlertCircle, t: "Clima oct–nov", x: "Norte (Pekín, Xi'an) fresco, 5–16°C. Centro y sur templado, 12–22°C. Lleva capas y una chaqueta ligera." },
  { icon: Building2, t: "Registro policial", x: "Si te alojas en hotel te registran al hacer check-in. En Shanghái, si hace falta, puede hacerse online." },
];
const EXP_CATS = ["Vuelos", "Alojamiento", "Transporte", "Comida", "Actividades", "Compras", "Otros"];
const EXP_COLORS = { Vuelos: "#3D5A98", Alojamiento: "#C0392B", Transporte: "#9A6A2F", Comida: "#E0883B", Actividades: "#2E7D6B", Compras: "#7E5BA6", Otros: "#8A8079" };
const PACK_CATS = ["Documentos", "Ropa", "Electrónica", "Aseo y salud", "Otros"];
const TYPE_TO_CAT = { comida: "Comida", traslado: "Transporte", logistica: "Otros", historia: "Actividades", cultura: "Actividades", naturaleza: "Actividades", tech: "Actividades" };
/* Personas que comparten gastos: Fa (yo) y Rubén */
const PAYERS = ["fa", "ruben"];
const PAYER_LABEL = { fa: "Fa", ruben: "Rubén" };
const PAYER_COLOR = { fa: "#C0392B", ruben: "#3D5A98" };

/* ============ componentes estables ============ */
const Card = ({ children, style }) => (
  <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, ...style }}>{children}</div>
);
const CheckBox = ({ on, color = C.jade, size = 20, onClick }) => (
  <button onClick={onClick} className="flex items-center justify-center rounded-md"
    style={{ width: size, height: size, flexShrink: 0, border: `1.5px solid ${on ? color : C.line}`, background: on ? color : "transparent" }}>
    {on && <Check size={Math.round(size * 0.62)} color="#fff" strokeWidth={3} />}
  </button>
);
const Field = ({ label, hint, children }) => (
  <div className="mb-3">
    <div style={{ fontSize: 11.5, fontWeight: 700, color: C.sub, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.6 }}>{label}</div>
    {children}
    {hint && <div style={{ fontSize: 11.5, color: C.sub, marginTop: 5 }}>{hint}</div>}
  </div>
);
const NavBtn = ({ active, onClick, icon: Ic, label }) => (
  <button onClick={onClick} style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 4, flex: "1 1 0%", minWidth: 0, padding: "8px 2px", color: active ? C.red : C.sub }}>
    <Ic size={19} strokeWidth={active ? 2.4 : 1.8} />
    <span style={{ fontSize: 10, fontWeight: active ? 700 : 500, whiteSpace: "nowrap" }}>{label}</span>
  </button>
);
const Empty = ({ icon: Ic, title, text }) => (
  <div className="flex flex-col items-center text-center px-6 py-10">
    <div className="flex items-center justify-center rounded-2xl mb-3" style={{ width: 56, height: 56, background: C.card, border: `1px solid ${C.line}` }}>
      <Ic size={26} color={C.red} />
    </div>
    <div style={{ fontWeight: 700, color: C.ink, fontSize: 15 }}>{title}</div>
    <div style={{ color: C.sub, fontSize: 13, marginTop: 4, maxWidth: 280 }}>{text}</div>
  </div>
);

/* ============ app ============ */
export default function App({ tripId, tripName, onBack }) {
  const STORAGE_KEY = `trip_${tripId}`;
  const ATT_PREFIX = `trip_${tripId}_att_`;
  const [tab, setTab] = useState("resumen");
  const [tripTitle, setTripTitle] = useState(tripName || "Mi viaje");
  const [itin, setItin] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [packing, setPacking] = useState(DEFAULT_PACKING);
  const [expenses, setExpenses] = useState([]);
  const [docsChk, setDocsChk] = useState({});
  const [rate, setRate] = useState(7.7);
  const [budget, setBudget] = useState(0);
  const [openCity, setOpenCity] = useState({});
  const [attMap, setAttMap] = useState({});
  const [editing, setEditing] = useState(null);
  const [attErr, setAttErr] = useState("");
  const [lightbox, setLightbox] = useState(null);
  const [hydrated, setHydrated] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  // formularios
  const [nc, setNc] = useState({ name: "", start: "", end: "", mode: "" });
  const [showAddCity, setShowAddCity] = useState(false);
  const [ne, setNe] = useState({ cat: "Comida", desc: "", amount: "", cur: "EUR", date: todayISO(), paidBy: "fa" });
  const [nb, setNb] = useState({ type: "Hotel", title: "", date: todayISO(), detail: "" });
  const [showAddB, setShowAddB] = useState(false);
  const [np, setNp] = useState({ cat: "Otros", item: "" });
  const [na, setNa] = useState({ t: "12:00", x: "", type: "cultura" });
  const [addActFor, setAddActFor] = useState(null);
  const [tasks, setTasks] = useState(DEFAULT_TASKS);
  const [experiences, setExperiences] = useState(DEFAULT_EXPERIENCES);
  const [ntask, setNtask] = useState("");
  const [nexp, setNexp] = useState("");
  const [confirmDel, setConfirmDel] = useState(null);
  const [drag, setDrag] = useState(null); // arrastrar actividades entre días
  const dragSess = useRef(null);
  const dragPos = useRef({ x: 0, y: 0 });
  const saveT = useRef(null);

  /* cargar */
  useEffect(() => {
    (async () => {
      try {
        const r = await store.get(STORAGE_KEY);
        if (r && r.value) {
          const d = JSON.parse(r.value);
          if (typeof d.tripTitle === "string") setTripTitle(d.tripTitle);
          if (Array.isArray(d.itin)) {
            const it = d.itin.map((c) => ({ into: null, color: PALETTE[0], days: [], ...c, days: (c.days || []).map((dd) => ({ title: "", items: [], ...dd, items: (dd.items || []).map((a) => ({ booked: false, notes: "", price: null, cur: "EUR", att: [], tEnd: "", paidBy: "", ...a })) })) }));
            setItin(it);
            setOpenCity(Object.fromEntries(it.map((c) => [c.id, true])));
          }
          if (Array.isArray(d.bookings)) setBookings(d.bookings.map((b) => ({ ref: "", notes: "", att: [], status: "pendiente", ...b })));
          if (Array.isArray(d.packing)) setPacking(d.packing);
          if (Array.isArray(d.expenses)) setExpenses(d.expenses.map((e) => ({ paidBy: "fa", ...e })));
          if (d.docsChk) setDocsChk(d.docsChk);
          if (Array.isArray(d.tasks)) setTasks(d.tasks.map((t) => ({ notes: "", att: [], ...t })));
          if (Array.isArray(d.experiences)) setExperiences(d.experiences.map((t) => ({ notes: "", att: [], ...t })));
          if (typeof d.rate === "number") setRate(d.rate);
          if (typeof d.budget === "number") setBudget(d.budget);
        }
      } catch (e) {}
      try {
        const lst = await store.list(ATT_PREFIX);
        const keys = (lst && lst.keys) || [];
        const m = {};
        for (const k of keys) {
          const key = typeof k === "string" ? k : k.key;
          try { const r = await store.get(key); if (r && r.value) m[key.slice(ATT_PREFIX.length)] = JSON.parse(r.value); } catch (e) {}
        }
        setAttMap(m);
      } catch (e) {}
      setHydrated(true);
    })();
  }, []);

  /* guardar */
  useEffect(() => {
    if (!hydrated) return;
    if (saveT.current) clearTimeout(saveT.current);
    saveT.current = setTimeout(async () => {
      try { await store.set(STORAGE_KEY, JSON.stringify({ tripTitle, itin, bookings, packing, expenses, docsChk, rate, budget, tasks, experiences })); } catch (e) {}
    }, 400);
  }, [tripTitle, itin, bookings, packing, expenses, docsChk, rate, budget, tasks, experiences, hydrated]);

  /* ---- adjuntos ---- */
  const purgeAtt = (attId) => {
    setAttMap((m) => { const n = { ...m }; delete n[attId]; return n; });
    try { store.delete(ATT_PREFIX + attId); } catch (e) {}
  };
  const attachToCurrent = (attId) => {
    if (!editing) return;
    if (editing.kind === "act") setItin((prev) => prev.map((c) => c.id !== editing.cityId ? c : { ...c, days: c.days.map((d) => d.id !== editing.dayId ? d : { ...d, items: d.items.map((a) => a.id !== editing.actId ? a : { ...a, att: [...a.att, attId] }) }) }));
    else if (editing.kind === "booking") setBookings((prev) => prev.map((b) => b.id !== editing.id ? b : { ...b, att: [...(b.att || []), attId] }));
    else if (editing.kind === "check") (editing.listType === "tasks" ? setTasks : setExperiences)((prev) => prev.map((it) => it.id !== editing.id ? it : { ...it, att: [...(it.att || []), attId] }));
  };
  const detachFromCurrent = (attId) => {
    if (editing.kind === "act") setItin((prev) => prev.map((c) => c.id !== editing.cityId ? c : { ...c, days: c.days.map((d) => d.id !== editing.dayId ? d : { ...d, items: d.items.map((a) => a.id !== editing.actId ? a : { ...a, att: a.att.filter((x) => x !== attId) }) }) }));
    else if (editing.kind === "booking") setBookings((prev) => prev.map((b) => b.id !== editing.id ? b : { ...b, att: (b.att || []).filter((x) => x !== attId) }));
    else if (editing.kind === "check") (editing.listType === "tasks" ? setTasks : setExperiences)((prev) => prev.map((it) => it.id !== editing.id ? it : { ...it, att: (it.att || []).filter((x) => x !== attId) }));
    purgeAtt(attId);
  };
  const handleFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    for (const f of files) {
      if (f.size > 4.5 * 1024 * 1024) { setAttErr(`"${f.name}" supera 4,5 MB y no se puede guardar.`); continue; }
      try {
        const data = await fileToDataURL(f);
        const id = "a" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
        const obj = { name: f.name, type: f.type || "application/octet-stream", size: f.size, data };
        setAttMap((m) => ({ ...m, [id]: obj }));
        attachToCurrent(id);
        try { await store.set(ATT_PREFIX + id, JSON.stringify(obj)); } catch (e) {}
      } catch (e) { setAttErr("No se pudo leer el archivo."); }
    }
  };

  /* ---- ciudades ---- */
  const addCity = () => {
    if (!nc.name.trim()) return;
    const id = "c" + Date.now().toString(36);
    const color = PALETTE[itin.length % PALETTE.length];
    const days = rangeISO(nc.start, nc.end).map((dt, i) => ({ id: `${id}-d${i}`, date: dt, title: "", items: [] }));
    const into = nc.mode ? { mode: nc.mode, detail: "" } : null;
    setItin((prev) => [...prev, { id, city: nc.name.trim(), color, into, days }]);
    setOpenCity((o) => ({ ...o, [id]: true }));
    setNc({ name: "", start: "", end: "", mode: "" });
    setShowAddCity(false);
  };
  const patchCityById = (cityId, patch) => setItin((prev) => prev.map((c) => c.id !== cityId ? c : { ...c, ...patch }));
  const deleteCity = (cityId) => {
    const c = itin.find((x) => x.id === cityId);
    if (c) c.days.forEach((d) => d.items.forEach((a) => (a.att || []).forEach(purgeAtt)));
    setItin((prev) => prev.filter((x) => x.id !== cityId));
    setEditing(null);
  };

  /* ---- días ---- */
  const addDay = (cityId) => {
    const c = itin.find((x) => x.id === cityId);
    const last = c && c.days.length ? c.days[c.days.length - 1].date : "";
    const date = last ? addDaysISO(last, 1) : "";
    const id = cityId + "-d" + Math.random().toString(36).slice(2, 6);
    setItin((prev) => prev.map((x) => x.id !== cityId ? x : { ...x, days: [...x.days, { id, date, title: "", items: [] }] }));
    setEditing({ kind: "day", cityId, dayId: id });
  };
  const patchDayById = (cityId, dayId, patch) => setItin((prev) => prev.map((c) => c.id !== cityId ? c : { ...c, days: c.days.map((d) => d.id !== dayId ? d : { ...d, ...patch }) }));
  const deleteDay = (cityId, dayId) => {
    const c = itin.find((x) => x.id === cityId);
    const d = c && c.days.find((y) => y.id === dayId);
    if (d) d.items.forEach((a) => (a.att || []).forEach(purgeAtt));
    setItin((prev) => prev.map((x) => x.id !== cityId ? x : { ...x, days: x.days.filter((y) => y.id !== dayId) }));
    setEditing(null);
  };

  /* ---- actividades ---- */
  const patchActById = (cityId, dayId, actId, patch) =>
    setItin((prev) => prev.map((c) => c.id !== cityId ? c : { ...c, days: c.days.map((d) => d.id !== dayId ? d : { ...d, items: d.items.map((a) => a.id !== actId ? a : { ...a, ...patch }) }) }));
  const patchAct = (patch) => editing && patchActById(editing.cityId, editing.dayId, editing.actId, patch);
  const openAddActivity = (dayId) => {
    setAddActFor((cur) => (cur === dayId ? null : dayId));
    setNa({ t: "12:00", x: "", type: "cultura" });
  };
  const addActivity = (cityId, dayId) => {
    if (!na.x.trim()) return;
    const id = dayId + "-a" + Math.random().toString(36).slice(2, 7);
    setItin((prev) => prev.map((c) => c.id !== cityId ? c : { ...c, days: c.days.map((d) => d.id !== dayId ? d : { ...d, items: [...d.items, { id, t: na.t || "12:00", tEnd: "", x: na.x.trim(), type: na.type, booked: false, notes: "", price: null, cur: "EUR", paidBy: "", att: [] }] }) }));
    setNa({ t: "12:00", x: "", type: "cultura" });
    setAddActFor(null);
  };
  const deleteActivity = () => {
    const a = curAct();
    if (a) a.att.forEach(purgeAtt);
    setItin((prev) => prev.map((c) => c.id !== editing.cityId ? c : { ...c, days: c.days.map((d) => d.id !== editing.dayId ? d : { ...d, items: d.items.filter((x) => x.id !== editing.actId) }) }));
    setEditing(null);
  };

  /* ---- arrastrar actividades entre días ---- */
  const computeDropTarget = (x, y) => {
    const el = document.elementFromPoint(x, y);
    const dayEl = el && el.closest("[data-day]");
    if (!dayEl) return null;
    const cityId = dayEl.getAttribute("data-city");
    const dayId = dayEl.getAttribute("data-day");
    const draggedId = dragSess.current ? dragSess.current.item.id : null;
    const rows = Array.from(dayEl.querySelectorAll("[data-act-id]"));
    let beforeId = null;
    for (const r of rows) {
      if (r.getAttribute("data-act-id") === draggedId) continue;
      const rect = r.getBoundingClientRect();
      if (y < rect.top + rect.height / 2) { beforeId = r.getAttribute("data-act-id"); break; }
    }
    return { cityId, dayId, beforeId };
  };
  const onActPointerDown = (e, cityId, dayId, item) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    e.preventDefault(); e.stopPropagation();
    dragSess.current = { item, fromCityId: cityId, fromDayId: dayId, target: null };
    dragPos.current = { x: e.clientX, y: e.clientY };
    setDrag({ item, x: e.clientX, y: e.clientY, target: null });
  };
  const commitMove = (s) => {
    const t = s.target;
    if (!t) return;
    setItin((prev) => {
      let moved = null;
      const removed = prev.map((c) => c.id !== s.fromCityId ? c : { ...c, days: c.days.map((d) => d.id !== s.fromDayId ? d : { ...d, items: d.items.filter((a) => { if (a.id === s.item.id) { moved = a; return false; } return true; }) }) });
      if (!moved) return prev;
      return removed.map((c) => c.id !== t.cityId ? c : { ...c, days: c.days.map((d) => {
        if (d.id !== t.dayId) return d;
        const items = [...d.items];
        const idx = t.beforeId ? items.findIndex((a) => a.id === t.beforeId) : -1;
        if (idx < 0) items.push(moved); else items.splice(idx, 0, moved);
        return { ...d, items };
      }) });
    });
  };
  useEffect(() => {
    if (!drag) return;
    const move = (e) => {
      e.preventDefault();
      dragPos.current = { x: e.clientX, y: e.clientY };
      const t = computeDropTarget(e.clientX, e.clientY);
      if (dragSess.current) dragSess.current.target = t;
      setDrag((d) => d ? { ...d, x: e.clientX, y: e.clientY, target: t } : d);
    };
    const end = () => { if (dragSess.current) commitMove(dragSess.current); dragSess.current = null; setDrag(null); };
    let raf;
    const loop = () => {
      const { y } = dragPos.current; const h = window.innerHeight;
      if (y < 88) window.scrollBy(0, -11); else if (y > h - 104) window.scrollBy(0, 11);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
      window.removeEventListener("pointercancel", end);
    };
  }, [!!drag]);

  /* ---- reservas ---- */
  const patchBkById = (id, patch) => setBookings((prev) => prev.map((b) => b.id !== id ? b : { ...b, ...patch }));
  const patchBk = (patch) => editing && patchBkById(editing.id, patch);
  const deleteBooking = () => {
    const b = curBk();
    if (b) (b.att || []).forEach(purgeAtt);
    setBookings((prev) => prev.filter((x) => x.id !== editing.id));
    setEditing(null);
  };
  const addBooking = () => {
    if (!nb.title.trim()) return;
    setBookings((x) => [...x, { id: "b" + Date.now(), ...nb, status: "pendiente", ref: "", notes: "", att: [] }]);
    setNb({ type: nb.type, title: "", date: nb.date, detail: "" });
    setShowAddB(false);
  };

  /* ---- gastos / maleta ---- */
  const addExpense = () => {
    const amt = parseFloat(String(ne.amount).replace(",", "."));
    if (!amt || amt <= 0) return;
    setExpenses((x) => [{ id: "e" + Date.now(), ...ne, amount: amt }, ...x]);
    setNe({ cat: ne.cat, desc: "", amount: "", cur: ne.cur, date: ne.date, paidBy: ne.paidBy });
  };
  const addPack = () => {
    if (!np.item.trim()) return;
    setPacking((x) => [...x, { id: "k" + Date.now(), cat: np.cat, item: np.item, done: false }]);
    setNp({ cat: np.cat, item: "" });
  };
  const addTask = () => {
    if (!ntask.trim()) return;
    setTasks((x) => [...x, { id: "t" + Date.now(), text: ntask.trim(), done: false, notes: "", att: [] }]);
    setNtask("");
  };
  const addExp = () => {
    if (!nexp.trim()) return;
    setExperiences((x) => [...x, { id: "x" + Date.now(), text: nexp.trim(), done: false, notes: "", att: [] }]);
    setNexp("");
  };

  /* ---- lookups modal ---- */
  const curAct = () => {
    if (!editing || editing.kind !== "act") return null;
    const c = itin.find((x) => x.id === editing.cityId);
    const d = c && c.days.find((y) => y.id === editing.dayId);
    return (d && d.items.find((z) => z.id === editing.actId)) || null;
  };
  const curDayForAct = () => {
    if (!editing || editing.kind !== "act") return null;
    const c = itin.find((x) => x.id === editing.cityId);
    return (c && c.days.find((y) => y.id === editing.dayId)) || null;
  };
  const curCity = () => (editing && (editing.kind === "city" || editing.kind === "day") ? itin.find((c) => c.id === editing.cityId) : null) || null;
  const curDayObj = () => {
    if (!editing || editing.kind !== "day") return null;
    const c = itin.find((x) => x.id === editing.cityId);
    return (c && c.days.find((y) => y.id === editing.dayId)) || null;
  };
  const curBk = () => (editing && editing.kind === "booking" ? bookings.find((b) => b.id === editing.id) : null) || null;
  const curCheck = () => {
    if (!editing || editing.kind !== "check") return null;
    const arr = editing.listType === "tasks" ? tasks : experiences;
    return arr.find((i) => i.id === editing.id) || null;
  };
  const patchCheckById = (listType, id, patch) => (listType === "tasks" ? setTasks : setExperiences)((x) => x.map((y) => y.id === id ? { ...y, ...patch } : y));
  const patchCheck = (patch) => editing && patchCheckById(editing.listType, editing.id, patch);
  const deleteCheck = () => {
    const c = curCheck();
    if (c) (c.att || []).forEach(purgeAtt);
    (editing.listType === "tasks" ? setTasks : setExperiences)((prev) => prev.filter((x) => x.id !== editing.id));
    setEditing(null);
  };
  const curExpense = () => (editing && editing.kind === "expense" ? expenses.find((e) => e.id === editing.id) : null) || null;
  const patchExpenseById = (id, patch) => setExpenses((prev) => prev.map((e) => e.id !== id ? e : { ...e, ...patch }));
  const patchExpense = (patch) => editing && patchExpenseById(editing.id, patch);
  const deleteExpense = () => { setExpenses((prev) => prev.filter((e) => e.id !== editing.id)); setEditing(null); };

  const resetAll = async () => {
    Object.keys(attMap).forEach((id) => { try { store.delete(ATT_PREFIX + id); } catch (e) {} });
    setItin([]); setBookings([]); setOpenCity({}); setPacking(DEFAULT_PACKING);
    setExpenses([]); setDocsChk({}); setRate(7.7); setBudget(0); setAttMap({}); setTripTitle("China");
    setTasks(DEFAULT_TASKS); setExperiences(DEFAULT_EXPERIENCES); setConfirmReset(false);
    try { await store.delete(STORAGE_KEY); } catch (e) {}
  };

  /* selector de quién pagó (segmentado) */
  const renderPayerPicker = (value, onChange, allowNone) => {
    const choices = allowNone ? [["", "Sin pagar"], ["fa", "Fa"], ["ruben", "Rubén"]] : [["fa", "Fa"], ["ruben", "Rubén"]];
    return (
      <div className="flex gap-1.5">
        {choices.map(([v, l]) => {
          const on = value === v;
          const col = v ? PAYER_COLOR[v] : C.sub;
          return (
            <button key={v || "none"} onClick={() => onChange(v)} className="flex-1 rounded-lg py-2" style={{ fontSize: 13, fontWeight: 700, border: `1.5px solid ${on ? col : C.line}`, background: on ? col + "1A" : C.card, color: on ? col : C.sub }}>{l}</button>
          );
        })}
      </div>
    );
  };

  /* ---- derivados ---- */
  const eurOf = (amount, cur) => { const n = parseFloat(String(amount).replace(",", ".")) || 0; return cur === "CNY" ? n / (rate || 1) : n; };
  const allDays = itin.flatMap((c) => c.days);
  const allActs = itin.flatMap((c) => c.days.flatMap((d) => d.items));
  const actsBooked = allActs.filter((a) => a.booked).length;
  const dates = allDays.filter((d) => d.date).map((d) => d.date).sort();
  const minDate = dates[0] || null, maxDate = dates[dates.length - 1] || null;
  const routeExpenses = itin.flatMap((c) => c.days.flatMap((d) => d.items.filter((a) => a.price && a.price > 0).map((a) => ({ id: a.id, cityId: c.id, dayId: d.id, name: a.x || c.city, city: c.city, date: d.date, cat: TYPE_TO_CAT[a.type] || "Actividades", amount: a.price, cur: a.cur || "EUR", paidBy: a.paidBy || "" }))));
  const manualTotal = expenses.reduce((s, e) => s + eurOf(e.amount, e.cur), 0);
  const routeTotal = routeExpenses.reduce((s, e) => s + eurOf(e.amount, e.cur), 0);
  const totalSpent = manualTotal + routeTotal;
  const catTotals = {};
  [...expenses.map((e) => ({ cat: e.cat, v: eurOf(e.amount, e.cur) })), ...routeExpenses.map((e) => ({ cat: e.cat, v: eurOf(e.amount, e.cur) }))].forEach(({ cat, v }) => { catTotals[cat] = (catTotals[cat] || 0) + v; });
  const pieData = EXP_CATS.map((c) => ({ name: c, value: catTotals[c] || 0 })).filter((d) => d.value > 0);
  /* balance entre Fa y Rubén: reparto 50/50 de todo lo que tenga pagador asignado */
  const paidBy = { fa: 0, ruben: 0 };
  let unassignedPaid = 0;
  [...expenses.map((e) => ({ who: e.paidBy, v: eurOf(e.amount, e.cur) })), ...routeExpenses.map((e) => ({ who: e.paidBy, v: eurOf(e.amount, e.cur) }))].forEach(({ who, v }) => {
    if (who === "fa" || who === "ruben") paidBy[who] += v; else unassignedPaid += v;
  });
  const sharedTotal = paidBy.fa + paidBy.ruben;
  const balanceNet = (paidBy.fa - paidBy.ruben) / 2; // >0: Rubén debe a Fa; <0: Fa debe a Rubén
  const balanceDebtor = balanceNet > 0 ? "ruben" : "fa";
  const balanceCreditor = balanceNet > 0 ? "fa" : "ruben";
  const balanceAmount = Math.abs(balanceNet);
  const bookConfirmed = bookings.filter((b) => b.status === "confirmado").length;
  const packDone = packing.filter((p) => p.done).length;
  const dateColor = {}, dateCityId = {};
  itin.forEach((c) => c.days.forEach((d) => { if (d.date) { dateColor[d.date] = c.color; dateCityId[d.date] = c.id; } }));
  const months = minDate && maxDate ? monthsBetween(minDate, maxDate) : [];

  const countdown = (() => {
    if (!minDate) return { label: "Fechas", value: "—", unit: "añádelas" };
    const t = todayISO();
    if (t < minDate) { const diff = Math.round((new Date(minDate) - new Date(t)) / 86400000); return { label: "Faltan", value: diff, unit: diff === 1 ? "día" : "días" }; }
    if (maxDate && t > maxDate) return { label: "Viaje", value: "✓", unit: "completado" };
    const n = Math.round((new Date(t) - new Date(minDate)) / 86400000) + 1;
    return { label: "Día", value: n, unit: `de ${dates.length}` };
  })();

  const goToCity = (cityId) => {
    setOpenCity((o) => ({ ...o, [cityId]: true }));
    setTab("itinerario");
    setTimeout(() => { const el = document.getElementById("city-" + cityId); if (el) el.scrollIntoView({ behavior: "smooth", block: "start" }); }, 70);
  };

  /* ============ calendario ============ */
  const renderMonth = (year, mIdx) => {
    const off = (new Date(Date.UTC(year, mIdx, 1)).getUTCDay() + 6) % 7;
    const ndays = new Date(Date.UTC(year, mIdx + 1, 0)).getUTCDate();
    const cells = [];
    for (let i = 0; i < off; i++) cells.push(<div key={"e" + i} />);
    for (let d = 1; d <= ndays; d++) {
      const iso = `${year}-${String(mIdx + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const col = dateColor[iso], cid = dateCityId[iso];
      cells.push(
        <button key={iso} onClick={col ? () => goToCity(cid) : undefined} disabled={!col}
          style={{ height: 34, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12.5, fontWeight: col ? 700 : 500, background: col || "transparent", color: col ? "#fff" : "#C9BCA9", cursor: col ? "pointer" : "default", border: "none" }}>{d}</button>
      );
    }
    return (
      <div className="mb-4" key={`${year}-${mIdx}`}>
        <div style={{ fontWeight: 800, color: C.ink, fontSize: 14, marginBottom: 8 }}>{MONTHS_FULL[mIdx]} {year}</div>
        <div className="grid grid-cols-7 gap-1 mb-1">
          {["L", "M", "X", "J", "V", "S", "D"].map((w, i) => <div key={i} style={{ textAlign: "center", fontSize: 10, fontWeight: 700, color: C.sub }}>{w}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">{cells}</div>
      </div>
    );
  };

  /* ============ resumen ============ */
  const renderResumen = () => (
    <div className="px-5 pb-6">
      <div className="rounded-2xl px-5 pt-6 pb-5 mb-4" style={{ background: C.ink, color: "#F5F1EA" }}>
        <div className="flex items-center gap-2 mb-1" style={{ color: "#D9A441", ...mono, fontSize: 12, letterSpacing: 2 }}>
          <Plane size={13} /> MI VIAJE
        </div>
        <input value={tripTitle} onChange={(e) => setTripTitle(e.target.value)} placeholder="Nombre del viaje"
          style={{ fontSize: 42, fontWeight: 800, lineHeight: 1.05, letterSpacing: -1, background: "transparent", border: "none", outline: "none", color: "#F5F1EA", width: "100%", padding: 0 }} />
        <div className="mt-1" style={{ color: "#C9BFB2", fontSize: 15, fontWeight: 600 }}>
          {itin.length ? `${itin[0].city} → ${itin[itin.length - 1].city}` : "Añade tu primera parada"}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-4" style={{ ...mono, fontSize: 13, color: "#C9BFB2" }}>
          <span>{minDate && maxDate ? `${dparts(minDate).dd} ${dparts(minDate).mmm} – ${dparts(maxDate).dd} ${dparts(maxDate).mmm}` : "Sin fechas aún"}</span>
          <span style={{ color: "#5C534A" }}>|</span>
          <span>{dates.length} día{dates.length === 1 ? "" : "s"} · {itin.length} {itin.length === 1 ? "parada" : "paradas"}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mb-4">
        <Card style={{ padding: 16 }}>
          <div style={{ color: C.sub, fontSize: 12, fontWeight: 600 }}>{countdown.label}</div>
          <div className="flex items-end gap-1">
            <span style={{ fontSize: 38, fontWeight: 800, color: C.red, lineHeight: 1 }}>{countdown.value}</span>
            <span style={{ color: C.sub, fontSize: 13, marginBottom: 6 }}>{countdown.unit}</span>
          </div>
        </Card>
        <Card style={{ padding: 16 }}>
          <div style={{ color: C.sub, fontSize: 12, fontWeight: 600 }}>Gastado</div>
          <div style={{ fontSize: 26, fontWeight: 800, color: C.ink, lineHeight: 1.1 }}>{eur(totalSpent)}</div>
          <div style={{ color: C.sub, fontSize: 11 }}>{expenses.length + routeExpenses.length} gasto{expenses.length + routeExpenses.length === 1 ? "" : "s"}</div>
        </Card>
      </div>

      <Card style={{ padding: 18, marginBottom: 16 }}>
        <div className="flex items-center gap-2 mb-4" style={{ color: C.ink, fontWeight: 700, fontSize: 14 }}>
          <Calendar size={16} style={{ color: C.red }} /> Calendario
        </div>
        {months.length === 0 ? (
          <div style={{ textAlign: "center", color: C.sub, fontSize: 13, padding: "8px 0 4px" }}>
            Añade paradas con fechas y aquí verás en qué ciudad estarás cada día.
          </div>
        ) : (
          <>
            {months.map((m) => renderMonth(m.year, m.mIdx))}
            <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-1 pt-3" style={{ borderTop: `1px solid ${C.line}` }}>
              {itin.map((c) => (
                <button key={c.id} onClick={() => goToCity(c.id)} className="flex items-center gap-1.5" style={{ fontSize: 11.5, color: C.sub }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: c.color }} />{c.city}
                </button>
              ))}
            </div>
          </>
        )}
      </Card>

      <div className="grid grid-cols-3 gap-3">
        {[
          { l: "Reservas", v: `${bookConfirmed}/${bookings.length}`, sub: "confirmadas" },
          { l: "Equipaje", v: `${packDone}/${packing.length}`, sub: "preparado" },
          { l: "Ruta", v: `${actsBooked}/${allActs.length}`, sub: "reservado" },
        ].map((s) => (
          <Card key={s.l} style={{ padding: 14, textAlign: "center" }}>
            <div style={{ fontSize: 19, fontWeight: 800, color: C.ink }}>{s.v}</div>
            <div style={{ color: C.sub, fontSize: 11, fontWeight: 600 }}>{s.l}</div>
            <div style={{ color: C.sub, fontSize: 10 }}>{s.sub}</div>
          </Card>
        ))}
      </div>

      <div style={{ textAlign: "center", marginTop: 18 }}>
        {!confirmReset ? (
          <button onClick={() => setConfirmReset(true)} className="inline-flex items-center gap-1.5" style={{ color: C.sub, fontSize: 12 }}>
            <RotateCcw size={13} /> Reiniciar datos guardados
          </button>
        ) : (
          <div className="inline-flex items-center gap-3">
            <span style={{ color: C.sub, fontSize: 12 }}>¿Borrar todo?</span>
            <button onClick={resetAll} style={{ color: C.red, fontSize: 12, fontWeight: 700 }}>Sí, reiniciar</button>
            <button onClick={() => setConfirmReset(false)} style={{ color: C.sub, fontSize: 12 }}>Cancelar</button>
          </div>
        )}
      </div>
    </div>
  );

  /* ============ ruta ============ */
  const renderRuta = () => (
    <div className="px-4 pb-6">
      <div className="px-1 pt-1 pb-3 flex items-end justify-between">
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: C.ink }}>Ruta</div>
          <div style={{ color: C.sub, fontSize: 13 }}>Añade paradas, días y actividades a tu ritmo.</div>
        </div>
        <button onClick={() => setShowAddCity((v) => !v)} className="flex items-center gap-1 rounded-lg px-3 py-2" style={{ background: C.red, color: "#fff", fontSize: 13, fontWeight: 600 }}>
          <Plus size={16} /> Parada
        </button>
      </div>

      {showAddCity && (
        <Card style={{ padding: 14, marginBottom: 14 }}>
          <input value={nc.name} onChange={(e) => setNc({ ...nc, name: e.target.value })} placeholder="Nombre de la parada (p. ej. Pekín)" style={{ ...inp, marginBottom: 8 }} />
          <div className="flex gap-2 mb-2">
            <div className="flex-1">
              <div style={{ fontSize: 11, color: C.sub, marginBottom: 4 }}>Primer día</div>
              <input type="date" value={nc.start} onChange={(e) => setNc({ ...nc, start: e.target.value })} style={{ ...inp, ...mono, fontSize: 12 }} />
            </div>
            <div className="flex-1">
              <div style={{ fontSize: 11, color: C.sub, marginBottom: 4 }}>Último día</div>
              <input type="date" value={nc.end} onChange={(e) => setNc({ ...nc, end: e.target.value })} style={{ ...inp, ...mono, fontSize: 12 }} />
            </div>
          </div>
          <div className="flex gap-2">
            <select value={nc.mode} onChange={(e) => setNc({ ...nc, mode: e.target.value })} style={{ ...inp, flex: 1 }}>
              <option value="">Cómo llegas (opcional)</option>
              {TRANSPORTS.map((t) => <option key={t}>{t}</option>)}
            </select>
            <button onClick={addCity} className="rounded-lg px-5" style={{ background: C.ink, color: "#fff", fontSize: 13, fontWeight: 600 }}>Crear</button>
          </div>
          <div style={{ fontSize: 11, color: C.sub, marginTop: 8 }}>Si pones primer y último día, se crean los días automáticamente. Podrás editarlos después.</div>
        </Card>
      )}

      {itin.length === 0 ? (
        <Empty icon={MapPin} title="Aún no hay paradas" text="Pulsa «Parada» para añadir tu primera ciudad y empezar a construir la ruta." />
      ) : itin.map((s, si) => {
        const open = openCity[s.id];
        const TrI = s.into ? (TR_ICON[s.into.mode] || MapPin) : null;
        const cityDates = s.days.filter((d) => d.date).map((d) => d.date).sort();
        const fmtDay = (iso) => { const p = dparts(iso); return `${p.dd} ${p.mmm}`; };
        const arrIso = cityDates[0], depIso = cityDates[cityDates.length - 1];
        const dateRange = arrIso ? (depIso && depIso !== arrIso ? `${fmtDay(arrIso)} – ${fmtDay(depIso)}` : fmtDay(arrIso)) : null;
        return (
          <div key={s.id} className="flex gap-3">
            <div className="flex flex-col items-center" style={{ width: 18 }}>
              <div style={{ width: 14, height: 14, borderRadius: 99, background: s.color, marginTop: 18, boxShadow: `0 0 0 3px ${C.paper}` }} />
              {si < itin.length - 1 && <div style={{ width: 2, flex: 1, background: C.line, marginTop: 2 }} />}
            </div>
            <div className="flex-1 pb-3">
              <div id={"city-" + s.id} className="w-full flex items-center justify-between rounded-xl px-4 py-3 mb-2" style={{ background: C.card, border: `1px solid ${C.line}` }}>
                <button onClick={() => setOpenCity((o) => ({ ...o, [s.id]: !o[s.id] }))} className="flex-1 text-left">
                  <div className="flex items-baseline gap-2" style={{ flexWrap: "wrap" }}>
                    <span style={{ fontWeight: 800, color: C.ink, fontSize: 16 }}>{s.city}</span>
                    {dateRange && <span style={{ ...mono, fontSize: 11.5, fontWeight: 700, color: s.color }}>{dateRange}</span>}
                  </div>
                  {s.into && s.into.mode && (
                    <div className="flex items-center gap-1.5 mt-0.5" style={{ color: s.color, fontSize: 11, fontWeight: 600 }}>
                      {TrI && <TrI size={11} />} {s.into.mode}{s.into.detail ? ` · ${s.into.detail}` : ""}
                    </div>
                  )}
                </button>
                <div className="flex items-center gap-2">
                  <button onClick={() => setEditing({ kind: "city", cityId: s.id })} className="p-1"><Pencil size={15} color={C.sub} /></button>
                  <span style={{ ...mono, fontSize: 11, color: C.sub }}>{s.days.length}d</span>
                  <button onClick={() => setOpenCity((o) => ({ ...o, [s.id]: !o[s.id] }))}>{open ? <ChevronDown size={18} color={C.sub} /> : <ChevronRight size={18} color={C.sub} />}</button>
                </div>
              </div>

              {open && (
                <>
                  {s.days.map((d) => {
                    const p = d.date ? dparts(d.date) : null;
                    return (
                      <div key={d.id} data-day={d.id} data-city={s.id} className="rounded-xl mb-2" style={{ background: C.card, border: `1px solid ${drag && drag.target && drag.target.dayId === d.id ? s.color : C.line}`, boxShadow: drag && drag.target && drag.target.dayId === d.id ? `0 0 0 2px ${s.color}55` : "none", transition: "box-shadow 0.1s" }}>
                        <div className="flex items-center gap-3 px-4 pt-3">
                          <div className="flex flex-col items-center justify-center rounded-lg" style={{ background: C.paper, width: 44, height: 44, flexShrink: 0 }}>
                            <span style={{ ...mono, fontSize: p ? 16 : 18, fontWeight: 800, color: p ? C.ink : C.sub, lineHeight: 1 }}>{p ? p.dd : "—"}</span>
                            {p && <span style={{ fontSize: 9.5, color: C.sub, textTransform: "uppercase" }}>{p.mmm}</span>}
                          </div>
                          <button onClick={() => setEditing({ kind: "day", cityId: s.id, dayId: d.id })} className="flex-1 text-left">
                            <div style={{ fontSize: 10.5, color: C.sub, textTransform: "uppercase", letterSpacing: 1, fontWeight: 600 }}>{p ? p.dow : "Sin fecha"}</div>
                            <div style={{ fontWeight: 700, color: d.title ? C.ink : C.sub, fontSize: 15 }}>{d.title || "Sin título"}</div>
                          </button>
                          <button onClick={() => setEditing({ kind: "day", cityId: s.id, dayId: d.id })} className="p-1"><Pencil size={14} color={C.sub} /></button>
                        </div>
                        <div className="px-4 py-3 flex flex-col gap-2.5">
                          {d.items.map((a) => {
                            const ty = TYPE[a.type];
                            const showLine = drag && drag.target && drag.target.dayId === d.id && drag.target.beforeId === a.id;
                            return (
                              <React.Fragment key={a.id}>
                                {showLine && <div style={{ height: 2, borderRadius: 2, background: s.color }} />}
                                <div data-act-id={a.id} className="flex items-start gap-2.5" style={{ opacity: drag && drag.item.id === a.id ? 0.4 : 1 }}>
                                  <div style={{ marginTop: 1 }}>
                                    <CheckBox on={a.booked} onClick={() => patchActById(s.id, d.id, a.id, { booked: !a.booked })} />
                                  </div>
                                  <button onClick={() => { setAttErr(""); setEditing({ kind: "act", cityId: s.id, dayId: d.id, actId: a.id }); }} className="flex-1 text-left flex items-start gap-2">
                                    <div style={{ ...mono, fontSize: 12, color: a.t ? C.sub : C.line, width: 48, flexShrink: 0, marginTop: 1, lineHeight: 1.2 }}>
                                      <div>{a.t || "—"}</div>
                                      {a.t && a.tEnd && <div style={{ fontSize: 10, color: C.sub, opacity: 0.65 }}>{a.tEnd}</div>}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div>
                                        <span style={{ fontSize: 13.5, color: a.x ? C.ink : C.sub }}>{a.x || "(sin título)"}</span>
                                        <span className="ml-2 inline-block rounded px-1.5" style={{ fontSize: 9.5, fontWeight: 700, color: ty.c, background: ty.c + "1A", textTransform: "uppercase", letterSpacing: 0.4, verticalAlign: "middle" }}>{ty.l}</span>
                                      </div>
                                      {(a.price > 0 || (a.att && a.att.length) || a.notes || a.paidBy) && (
                                        <div className="flex items-center gap-2.5 mt-1">
                                          {a.price > 0 && <span style={{ ...mono, fontSize: 11, color: C.redDeep, fontWeight: 700 }}>{a.cur === "CNY" ? `¥${a.price}` : eur(a.price)}</span>}
                                          {a.paidBy && <span style={{ fontSize: 10.5, fontWeight: 700, color: PAYER_COLOR[a.paidBy] }}>{PAYER_LABEL[a.paidBy]}</span>}
                                          {a.att && a.att.length > 0 && <span className="flex items-center gap-0.5" style={{ fontSize: 11, color: C.sub }}><Paperclip size={11} />{a.att.length}</span>}
                                          {a.notes && <StickyNote size={12} color={C.sub} />}
                                        </div>
                                      )}
                                    </div>
                                  </button>
                                  <button onPointerDown={(e) => onActPointerDown(e, s.id, d.id, a)} className="p-1" style={{ touchAction: "none", cursor: "grab", color: C.sub, alignSelf: "center", flexShrink: 0 }} aria-label="Arrastrar para mover de día"><GripVertical size={18} /></button>
                                </div>
                              </React.Fragment>
                            );
                          })}
                          {drag && drag.target && drag.target.dayId === d.id && !drag.target.beforeId && (
                            <div style={{ height: 2, borderRadius: 2, background: s.color }} />
                          )}
                          {addActFor === d.id ? (
                            <div className="rounded-xl mt-0.5" style={{ background: C.paper, border: `1px solid ${C.line}`, padding: 12 }}>
                              <div className="flex gap-2 mb-2">
                                <input type="time" value={na.t} onChange={(e) => setNa({ ...na, t: e.target.value })} disabled={!na.t} style={{ ...inp, width: 120, ...mono, opacity: na.t ? 1 : 0.45 }} />
                                <select value={na.type} onChange={(e) => setNa({ ...na, type: e.target.value })} style={{ ...inp, flex: 1 }}>
                                  {Object.keys(TYPE).map((key) => <option key={key} value={key}>{TYPE[key].l}</option>)}
                                </select>
                              </div>
                              <div className="flex items-center gap-2 mb-2">
                                <CheckBox size={18} on={!na.t} onClick={() => setNa({ ...na, t: na.t ? "" : "12:00" })} />
                                <button onClick={() => setNa({ ...na, t: na.t ? "" : "12:00" })} style={{ fontSize: 13, color: C.sub }}>Sin hora definida</button>
                              </div>
                              <input value={na.x} onChange={(e) => setNa({ ...na, x: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") addActivity(s.id, d.id); }} placeholder="¿Qué vais a hacer?" style={{ ...inp, marginBottom: 8 }} autoFocus />
                              <div className="flex gap-2">
                                <button onClick={() => { setAddActFor(null); setNa({ t: "12:00", x: "", type: "cultura" }); }} className="flex-1 rounded-lg py-2" style={{ border: `1px solid ${C.line}`, background: C.card, color: C.sub, fontSize: 13, fontWeight: 600 }}>Cancelar</button>
                                <button onClick={() => addActivity(s.id, d.id)} disabled={!na.x.trim()} className="flex-1 rounded-lg py-2" style={{ background: C.red, color: "#fff", fontSize: 13, fontWeight: 700, opacity: na.x.trim() ? 1 : 0.5 }}>Guardar</button>
                              </div>
                            </div>
                          ) : (
                            <button onClick={() => openAddActivity(d.id)} className="flex items-center gap-1.5 mt-0.5 ml-0.5" style={{ color: C.red, fontSize: 12.5, fontWeight: 600 }}>
                              <Plus size={14} /> Añadir actividad
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  <button onClick={() => addDay(s.id)} className="w-full flex items-center justify-center gap-1.5 rounded-xl py-2.5 mb-1" style={{ border: `1.5px dashed ${C.line}`, color: C.sub, fontSize: 13, fontWeight: 600 }}>
                    <Plus size={15} /> Añadir día
                  </button>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );

  /* ============ gastos ============ */
  const renderGastos = () => (
    <div className="px-5 pb-6">
      <div className="pt-1 pb-3">
        <div style={{ fontSize: 22, fontWeight: 800, color: C.ink }}>Gastos</div>
        <div style={{ color: C.sub, fontSize: 13 }}>Incluye los precios de las actividades de la ruta. Cambio: 1 € ≈ {rate} ¥</div>
      </div>

      <Card style={{ padding: 18, marginBottom: 14 }}>
        <div className="flex justify-between items-end mb-3">
          <div>
            <div style={{ color: C.sub, fontSize: 12, fontWeight: 600 }}>Total</div>
            <div style={{ fontSize: 34, fontWeight: 800, color: C.ink }}>{eur(totalSpent)}</div>
            <div style={{ color: C.sub, fontSize: 11 }}>Ruta {eur(routeTotal)} · Manual {eur(manualTotal)}</div>
          </div>
          {budget > 0 && (
            <div style={{ textAlign: "right" }}>
              <div style={{ color: C.sub, fontSize: 11 }}>de {eur(budget)}</div>
              <div style={{ color: totalSpent > budget ? C.red : C.jade, fontSize: 13, fontWeight: 700 }}>{totalSpent > budget ? "+" : ""}{eur(Math.abs(budget - totalSpent))}</div>
            </div>
          )}
        </div>
        {budget > 0 && (
          <div style={{ height: 8, borderRadius: 99, background: C.line, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${Math.min(100, (totalSpent / budget) * 100)}%`, background: totalSpent > budget ? C.red : C.jade }} />
          </div>
        )}
        {pieData.length > 0 && (
          <div style={{ height: 170, marginTop: 8 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={42} outerRadius={70} paddingAngle={2}>
                  {pieData.map((d) => <Cell key={d.name} fill={EXP_COLORS[d.name]} />)}
                </Pie>
                <Tooltip formatter={(v) => eur(v)} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
        {pieData.length > 0 && (
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 justify-center">
            {pieData.map((d) => (
              <div key={d.name} className="flex items-center gap-1.5" style={{ fontSize: 11, color: C.sub }}>
                <span style={{ width: 9, height: 9, borderRadius: 99, background: EXP_COLORS[d.name] }} /> {d.name} {eur(d.value)}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card style={{ padding: 16, marginBottom: 14 }}>
        <div className="flex items-center gap-2 mb-3" style={{ color: C.ink, fontWeight: 700, fontSize: 14 }}>
          <Wallet size={16} style={{ color: C.red }} /> Balance Fa · Rubén
        </div>
        <div className="flex gap-3 mb-3">
          {PAYERS.map((p) => (
            <div key={p} className="flex-1 rounded-xl px-3 py-2.5" style={{ background: PAYER_COLOR[p] + "12", border: `1px solid ${PAYER_COLOR[p]}33` }}>
              <div style={{ fontSize: 11, color: C.sub, fontWeight: 600 }}>{PAYER_LABEL[p]} ha pagado</div>
              <div style={{ ...mono, fontSize: 17, fontWeight: 800, color: PAYER_COLOR[p] }}>{eur(paidBy[p])}</div>
            </div>
          ))}
        </div>
        <div className="rounded-xl px-4 py-3 text-center" style={{ background: C.ink, color: "#F5F1EA" }}>
          {sharedTotal <= 0 ? (
            <span style={{ fontSize: 13, color: "#C9BFB2" }}>Aún no hay gastos con pagador asignado.</span>
          ) : balanceAmount < 0.005 ? (
            <span style={{ fontSize: 14, fontWeight: 700 }}>Estáis en paz 🎉</span>
          ) : (
            <div>
              <span style={{ fontSize: 13, color: "#C9BFB2" }}><b style={{ color: "#fff" }}>{PAYER_LABEL[balanceDebtor]}</b> debe a <b style={{ color: "#fff" }}>{PAYER_LABEL[balanceCreditor]}</b></span>
              <div style={{ ...mono, fontSize: 26, fontWeight: 800, color: "#fff", lineHeight: 1.1 }}>{eur(balanceAmount)}</div>
            </div>
          )}
        </div>
        {unassignedPaid > 0.005 && (
          <div style={{ fontSize: 11, color: C.sub, marginTop: 8, textAlign: "center" }}>{eur(unassignedPaid)} sin asignar a una persona (no cuentan en el balance).</div>
        )}
      </Card>

      <Card style={{ padding: 14, marginBottom: 14 }}>
        <div style={{ fontWeight: 700, color: C.ink, fontSize: 14, marginBottom: 10 }}>Añadir gasto manual</div>
        <div className="flex gap-2 mb-2">
          <select value={ne.cat} onChange={(e) => setNe({ ...ne, cat: e.target.value })} style={{ ...inp, flex: 1, padding: "8px 8px" }}>
            {EXP_CATS.map((c) => <option key={c}>{c}</option>)}
          </select>
          <input type="date" value={ne.date} onChange={(e) => setNe({ ...ne, date: e.target.value })} style={{ ...inp, width: "auto", ...mono, fontSize: 12, padding: "8px 8px" }} />
        </div>
        <input value={ne.desc} onChange={(e) => setNe({ ...ne, desc: e.target.value })} placeholder="Descripción" style={{ ...inp, marginBottom: 8 }} />
        <div className="mb-2">
          <div style={{ fontSize: 11, color: C.sub, marginBottom: 4 }}>¿Quién paga?</div>
          {renderPayerPicker(ne.paidBy, (v) => setNe({ ...ne, paidBy: v }), false)}
        </div>
        <div className="flex gap-2">
          <input value={ne.amount} onChange={(e) => setNe({ ...ne, amount: e.target.value })} placeholder="0,00" inputMode="decimal" style={{ ...inp, flex: 1, ...mono }} />
          <select value={ne.cur} onChange={(e) => setNe({ ...ne, cur: e.target.value })} style={{ ...inp, width: "auto" }}>
            <option value="EUR">€ EUR</option><option value="CNY">¥ CNY</option>
          </select>
          <button onClick={addExpense} className="rounded-lg px-4 flex items-center justify-center" style={{ background: C.red, color: "#fff" }}><Plus size={20} /></button>
        </div>
      </Card>

      {expenses.length > 0 && (
        <div className="flex flex-col gap-2 mb-4">
          {expenses.map((e) => (
            <div key={e.id} className="flex items-center gap-3 rounded-xl px-4 py-3" style={{ background: C.card, border: `1px solid ${C.line}` }}>
              <button onClick={() => setEditing({ kind: "expense", id: e.id })} className="flex items-center gap-3 flex-1 min-w-0 text-left">
                <span style={{ width: 8, height: 8, borderRadius: 99, background: EXP_COLORS[e.cat], flexShrink: 0 }} />
                <div className="flex-1 min-w-0">
                  <div style={{ fontSize: 14, color: C.ink, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.desc || e.cat}</div>
                  <div style={{ fontSize: 11, color: C.sub }}>{e.cat} · {dparts(e.date).dd} {dparts(e.date).mmm}{e.paidBy ? <> · <b style={{ color: PAYER_COLOR[e.paidBy] }}>{PAYER_LABEL[e.paidBy]}</b></> : ""}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ ...mono, fontSize: 14, fontWeight: 700, color: C.ink }}>{eur(eurOf(e.amount, e.cur))}</div>
                  {e.cur === "CNY" && <div style={{ ...mono, fontSize: 10, color: C.sub }}>¥{e.amount}</div>}
                </div>
                <ChevronRight size={16} color={C.line} style={{ flexShrink: 0 }} />
              </button>
              <button onClick={() => setConfirmDel({ name: e.desc || e.cat, where: "de los gastos", onConfirm: () => setExpenses((x) => x.filter((y) => y.id !== e.id)) })}><Trash2 size={16} color={C.sub} /></button>
            </div>
          ))}
        </div>
      )}

      {routeExpenses.length > 0 && (
        <div className="mb-4">
          <div className="px-1 mb-2 flex items-center gap-1.5" style={{ color: C.sub, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>
            <MapPin size={13} /> Gastos de la ruta
          </div>
          <div className="flex flex-col gap-2">
            {routeExpenses.map((e) => (
              <button key={e.id} onClick={() => { setAttErr(""); setEditing({ kind: "act", cityId: e.cityId, dayId: e.dayId, actId: e.id }); }}
                className="flex items-center gap-3 rounded-xl px-4 py-3 text-left" style={{ background: C.card, border: `1px solid ${C.line}` }}>
                <span style={{ width: 8, height: 8, borderRadius: 99, background: EXP_COLORS[e.cat], flexShrink: 0 }} />
                <div className="flex-1 min-w-0">
                  <div style={{ fontSize: 14, color: C.ink, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{e.name}</div>
                  <div style={{ fontSize: 11, color: C.sub }}>{e.city}{e.date ? ` · ${dparts(e.date).dd} ${dparts(e.date).mmm}` : ""}{e.paidBy ? <> · <b style={{ color: PAYER_COLOR[e.paidBy] }}>{PAYER_LABEL[e.paidBy]}</b></> : ""}</div>
                </div>
                <div style={{ ...mono, fontSize: 14, fontWeight: 700, color: C.ink }}>{eur(eurOf(e.amount, e.cur))}</div>
                <ChevronRight size={15} color={C.line} />
              </button>
            ))}
          </div>
        </div>
      )}

      <Card style={{ padding: 14 }}>
        <div className="flex items-center justify-between">
          <span style={{ fontSize: 13, color: C.sub }}>Presupuesto objetivo (€)</span>
          <input value={budget || ""} onChange={(e) => setBudget(parseFloat(e.target.value) || 0)} placeholder="0" inputMode="decimal" style={{ ...inp, width: 110, textAlign: "right", ...mono, padding: "6px 12px" }} />
        </div>
        <div className="flex items-center justify-between mt-2">
          <span style={{ fontSize: 13, color: C.sub }}>Cambio 1 € = ¥</span>
          <input value={rate} onChange={(e) => setRate(parseFloat(String(e.target.value).replace(",", ".")) || 0)} inputMode="decimal" style={{ ...inp, width: 110, textAlign: "right", ...mono, padding: "6px 12px" }} />
        </div>
      </Card>
    </div>
  );

  /* ============ reservas ============ */
  const bIcon = { Vuelo: Plane, Tren: Train, Hotel: Building2, Actividad: Sparkles };
  const renderReservas = () => {
    const groups = ["Vuelo", "Tren", "Hotel", "Actividad"].map((t) => [t, bookings.filter((b) => b.type === t)]).filter(([, a]) => a.length);
    return (
      <div className="px-5 pb-6">
        <div className="pt-1 pb-3 flex items-end justify-between">
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: C.ink }}>Reservas</div>
            <div style={{ color: C.sub, fontSize: 13 }}>{bookings.length ? `${bookConfirmed} de ${bookings.length} confirmadas` : "Vuelos, trenes y hoteles"}</div>
          </div>
          <button onClick={() => setShowAddB((v) => !v)} className="flex items-center gap-1 rounded-lg px-3 py-2" style={{ background: C.red, color: "#fff", fontSize: 13, fontWeight: 600 }}>
            <Plus size={16} /> Añadir
          </button>
        </div>

        {showAddB && (
          <Card style={{ padding: 14, marginBottom: 14 }}>
            <div className="flex gap-2 mb-2">
              <select value={nb.type} onChange={(e) => setNb({ ...nb, type: e.target.value })} style={{ ...inp, flex: 1, padding: "8px 8px" }}>
                {["Vuelo", "Tren", "Hotel", "Actividad"].map((t) => <option key={t}>{t}</option>)}
              </select>
              <input type="date" value={nb.date} onChange={(e) => setNb({ ...nb, date: e.target.value })} style={{ ...inp, width: "auto", ...mono, fontSize: 12, padding: "8px 8px" }} />
            </div>
            <input value={nb.title} onChange={(e) => setNb({ ...nb, title: e.target.value })} placeholder="Título (p. ej. Hotel en Pekín)" style={{ ...inp, marginBottom: 8 }} />
            <div className="flex gap-2">
              <input value={nb.detail} onChange={(e) => setNb({ ...nb, detail: e.target.value })} placeholder="Detalle" style={{ ...inp, flex: 1 }} />
              <button onClick={addBooking} className="rounded-lg px-4" style={{ background: C.ink, color: "#fff", fontSize: 13, fontWeight: 600 }}>Guardar</button>
            </div>
          </Card>
        )}

        {bookings.length === 0 ? (
          <Empty icon={FileText} title="Aún no hay reservas" text="Pulsa «Añadir» para guardar tus vuelos, trenes y hoteles con su localizador, notas y documentos." />
        ) : groups.map(([type, arr]) => {
          const Ic = bIcon[type];
          return (
            <div key={type} className="mb-4">
              <div className="flex items-center gap-2 mb-2 px-1" style={{ color: C.sub, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>
                <Ic size={14} /> {type === "Actividad" ? "Actividades" : type + "s"}
              </div>
              <div className="flex flex-col gap-2">
                {arr.map((b) => {
                  const conf = b.status === "confirmado";
                  return (
                    <div key={b.id} className="flex items-center gap-3 rounded-xl px-4 py-3" style={{ background: C.card, border: `1px solid ${conf ? C.jade + "66" : C.line}` }}>
                      <CheckBox on={conf} onClick={() => patchBkById(b.id, { status: conf ? "pendiente" : "confirmado" })} />
                      <button onClick={() => { setAttErr(""); setEditing({ kind: "booking", id: b.id }); }} className="flex-1 text-left min-w-0">
                        <div style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>{b.title}</div>
                        <div style={{ fontSize: 11.5, color: C.sub }}>{b.date ? `${dparts(b.date).dd} ${dparts(b.date).mmm} · ` : ""}{b.detail}</div>
                        {(b.ref || (b.att && b.att.length) || b.notes) && (
                          <div className="flex items-center gap-2.5 mt-1">
                            {b.ref && <span style={{ ...mono, fontSize: 11, color: C.redDeep, fontWeight: 700 }}>{b.ref}</span>}
                            {b.att && b.att.length > 0 && <span className="flex items-center gap-0.5" style={{ fontSize: 11, color: C.sub }}><Paperclip size={11} />{b.att.length}</span>}
                            {b.notes && <StickyNote size={12} color={C.sub} />}
                          </div>
                        )}
                      </button>
                      <ChevronRight size={16} color={C.line} />
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  /* ============ maleta ============ */
  const renderMaleta = () => (
    <div className="px-5 pb-6">
      <div className="pt-1 pb-3">
        <div style={{ fontSize: 22, fontWeight: 800, color: C.ink }}>Maleta</div>
        <div style={{ color: C.sub, fontSize: 13 }}>{packDone} de {packing.length} listos</div>
      </div>
      <div style={{ height: 8, borderRadius: 99, background: C.line, overflow: "hidden", marginBottom: 16 }}>
        <div style={{ height: "100%", width: `${packing.length ? (packDone / packing.length) * 100 : 0}%`, background: C.jade }} />
      </div>
      <Card style={{ padding: 12, marginBottom: 16 }}>
        <div className="flex gap-2">
          <select value={np.cat} onChange={(e) => setNp({ ...np, cat: e.target.value })} style={{ ...inp, width: "auto", padding: "8px 8px" }}>
            {PACK_CATS.map((c) => <option key={c}>{c}</option>)}
          </select>
          <input value={np.item} onChange={(e) => setNp({ ...np, item: e.target.value })} placeholder="Añadir objeto" style={{ ...inp, flex: 1 }} />
          <button onClick={addPack} className="rounded-lg px-4" style={{ background: C.red, color: "#fff" }}><Plus size={20} /></button>
        </div>
      </Card>
      {PACK_CATS.map((cat) => {
        const arr = packing.filter((p) => p.cat === cat);
        if (!arr.length) return null;
        return (
          <div key={cat} className="mb-4">
            <div className="px-1 mb-2" style={{ color: C.sub, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>{cat}</div>
            <Card style={{ overflow: "hidden" }}>
              {arr.map((p, i) => (
                <div key={p.id} className="flex items-center gap-3 px-4 py-3" style={{ borderTop: i ? `1px solid ${C.line}` : "none" }}>
                  <CheckBox on={p.done} onClick={() => setPacking((x) => x.map((y) => y.id === p.id ? { ...y, done: !y.done } : y))} />
                  <span className="flex-1" style={{ fontSize: 14, color: p.done ? C.sub : C.ink, textDecoration: p.done ? "line-through" : "none" }}>{p.item}</span>
                  <button onClick={() => setConfirmDel({ name: p.item, where: "de la maleta", onConfirm: () => setPacking((x) => x.filter((y) => y.id !== p.id)) })}><Trash2 size={15} color={C.sub} /></button>
                </div>
              ))}
            </Card>
          </div>
        );
      })}
    </div>
  );

  /* ============ info ============ */
  const renderInfo = () => (
    <div className="px-5 pb-6">
      <div className="pt-1 pb-3">
        <div style={{ fontSize: 22, fontWeight: 800, color: C.ink }}>Documentos y consejos</div>
        <div style={{ color: C.sub, fontSize: 13 }}>Lo que necesitas para entrar y moverte sin sustos.</div>
      </div>
      <div className="rounded-xl px-4 py-3 mb-4 flex gap-3" style={{ background: "#EAF3EF", border: `1px solid ${C.jade}44` }}>
        <Check size={18} color={C.jade} style={{ marginTop: 1, flexShrink: 0 }} />
        <div style={{ fontSize: 13, color: "#2A5A4F" }}><b>Sin visado.</b> España tiene exención hasta el 31/12/2026 para estancias de máximo 30 días consecutivos.</div>
      </div>
      <div className="px-1 mb-2" style={{ color: C.sub, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>Antes de salir</div>
      <Card style={{ overflow: "hidden", marginBottom: 16 }}>
        {DOCS.map((d, i) => {
          const ok = !!docsChk[d.id];
          return (
            <button key={d.id} onClick={() => setDocsChk((o) => ({ ...o, [d.id]: !o[d.id] }))} className="w-full flex items-start gap-3 px-4 py-3 text-left" style={{ borderTop: i ? `1px solid ${C.line}` : "none" }}>
              <CheckBox on={ok} />
              <span style={{ fontSize: 13.5, color: ok ? C.sub : C.ink, textDecoration: ok ? "line-through" : "none" }}>{d.label}</span>
            </button>
          );
        })}
      </Card>
      <div className="px-1 mb-2" style={{ color: C.sub, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>Consejos prácticos</div>
      <div className="flex flex-col gap-2.5">
        {TIPS.map((t) => (
          <Card key={t.t} style={{ padding: 14 }}>
            <div className="flex gap-3">
              <div className="flex items-center justify-center rounded-lg" style={{ background: C.paper, width: 38, height: 38, flexShrink: 0 }}>
                <t.icon size={18} color={C.red} />
              </div>
              <div>
                <div style={{ fontWeight: 700, color: C.ink, fontSize: 14 }}>{t.t}</div>
                <div style={{ color: C.sub, fontSize: 12.5, lineHeight: 1.45 }}>{t.x}</div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );

  /* ============ checklist ============ */
  const renderCheckGroup = ({ icon: Ic, title, subtitle, accent, items, setItems, draft, setDraft, add, placeholder, listType }) => {
    const done = items.filter((i) => i.done).length;
    return (
      <div className="mb-6">
        <div className="flex items-center gap-2 px-1">
          <div className="flex items-center justify-center rounded-lg" style={{ background: `${accent}1A`, width: 32, height: 32, flexShrink: 0 }}>
            <Ic size={18} color={accent} />
          </div>
          <div className="flex-1 min-w-0">
            <div style={{ fontWeight: 800, color: C.ink, fontSize: 15 }}>{title}</div>
            <div style={{ color: C.sub, fontSize: 12 }}>{subtitle}</div>
          </div>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: accent }}>{done}/{items.length}</div>
        </div>
        <div style={{ height: 6, borderRadius: 99, background: C.line, overflow: "hidden", margin: "10px 4px 12px" }}>
          <div style={{ height: "100%", width: `${items.length ? (done / items.length) * 100 : 0}%`, background: accent }} />
        </div>
        <Card style={{ padding: 12, marginBottom: 12 }}>
          <div className="flex gap-2">
            <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(); }} placeholder={placeholder} style={{ ...inp, flex: 1 }} />
            <button onClick={add} className="rounded-lg px-4" style={{ background: accent, color: "#fff" }}><Plus size={20} /></button>
          </div>
        </Card>
        {items.length === 0 ? (
          <Empty icon={Ic} title="Lista vacía" text="Añade lo que necesites en el campo de arriba." />
        ) : (
          <Card style={{ overflow: "hidden" }}>
            {items.map((it, i) => (
              <div key={it.id} className="flex items-center gap-3 px-4 py-3" style={{ borderTop: i ? `1px solid ${C.line}` : "none" }}>
                <CheckBox on={it.done} color={accent} onClick={() => setItems((x) => x.map((y) => y.id === it.id ? { ...y, done: !y.done } : y))} />
                <button onClick={() => { setAttErr(""); setEditing({ kind: "check", listType, id: it.id }); }} className="flex-1 text-left min-w-0">
                  <span style={{ fontSize: 14, color: it.done ? C.sub : C.ink, textDecoration: it.done ? "line-through" : "none" }}>{it.text}</span>
                  {((it.att && it.att.length) || it.notes) && (
                    <div className="flex items-center gap-2.5 mt-1">
                      {it.att && it.att.length > 0 && <span className="flex items-center gap-0.5" style={{ fontSize: 11, color: C.sub }}><Paperclip size={11} />{it.att.length}</span>}
                      {it.notes && <StickyNote size={12} color={C.sub} />}
                    </div>
                  )}
                </button>
                <ChevronRight size={16} color={C.line} style={{ flexShrink: 0 }} />
                <button onClick={() => setConfirmDel({ name: it.text, where: "de la checklist", onConfirm: () => { (it.att || []).forEach(purgeAtt); setItems((x) => x.filter((y) => y.id !== it.id)); } })}><Trash2 size={15} color={C.sub} /></button>
              </div>
            ))}
          </Card>
        )}
      </div>
    );
  };

  const renderChecklist = () => (
    <div className="px-5 pb-6">
      <div className="pt-1 pb-3">
        <div style={{ fontSize: 22, fontWeight: 800, color: C.ink }}>Checklist</div>
        <div style={{ color: C.sub, fontSize: 13 }}>Gestiones por resolver y experiencias que quieres vivir.</div>
      </div>
      {renderCheckGroup({ icon: ClipboardList, title: "Gestiones", subtitle: "Cosas que organizar antes y durante el viaje", accent: C.red, items: tasks, setItems: setTasks, draft: ntask, setDraft: setNtask, add: addTask, placeholder: "Ej. Comprar el seguro de viaje", listType: "tasks" })}
      {renderCheckGroup({ icon: Sparkles, title: "Experiencias", subtitle: "Momentos que no te quieres perder", accent: C.jade, items: experiences, setItems: setExperiences, draft: nexp, setDraft: setNexp, add: addExp, placeholder: "Ej. Probar un coche autónomo", listType: "experiences" })}
    </div>
  );

  /* ============ adjuntos (compartido) ============ */
  const renderAttachments = (attList) => (
    <Field label="Archivos adjuntos">
      <div className="flex flex-col gap-2">
        {attList.map((id) => {
          const a = attMap[id];
          if (!a) return null;
          const img = a.type.startsWith("image/");
          return (
            <div key={id} className="flex items-center gap-3 rounded-lg p-2" style={{ background: C.card, border: `1px solid ${C.line}` }}>
              {img ? (
                <img src={a.data} onClick={() => setLightbox(a.data)} alt="" style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 8, cursor: "pointer", flexShrink: 0 }} />
              ) : (
                <div style={{ width: 44, height: 44, borderRadius: 8, background: C.paper, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><FileText size={20} color={C.sub} /></div>
              )}
              <div className="flex-1 min-w-0">
                <div style={{ fontSize: 13, color: C.ink, fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{a.name}</div>
                <div style={{ fontSize: 11, color: C.sub }}>{(a.size / 1024).toFixed(0)} KB</div>
              </div>
              <a href={a.data} download={a.name} style={{ color: C.sub }}><Download size={16} /></a>
              <button onClick={() => detachFromCurrent(id)}><Trash2 size={16} color={C.sub} /></button>
            </div>
          );
        })}
        <div className="flex gap-2">
          <label className="flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5" style={{ border: `1.5px dashed ${C.line}`, color: C.red, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            <ImageIcon size={16} /> Subir imagen
            <input type="file" multiple accept="image/*" style={{ display: "none" }} onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }} />
          </label>
          <label className="flex-1 flex items-center justify-center gap-2 rounded-lg py-2.5" style={{ border: `1.5px dashed ${C.line}`, color: C.red, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            <FileText size={16} /> Subir documento
            <input type="file" multiple accept="application/pdf,.doc,.docx,.txt,.xls,.xlsx,.ppt,.pptx" style={{ display: "none" }} onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }} />
          </label>
        </div>
        {attErr && <div style={{ fontSize: 12, color: C.red }}>{attErr}</div>}
        <div style={{ fontSize: 11, color: C.sub }}>Hasta 4,5 MB por archivo. Se guardan en este dispositivo.</div>
      </div>
    </Field>
  );

  /* ============ modal ============ */
  const renderModal = () => {
    if (!editing) return null;
    const k = editing.kind;
    let title = "", subtitle = "", attList = [];
    let act = null, bk = null, city = null, day = null, chk = null, exp = null;
    if (k === "act") { act = curAct(); if (!act) return null; const dd = curDayForAct(); subtitle = dd ? `${dd.date ? `${dparts(dd.date).dow} ${dparts(dd.date).dd} ${dparts(dd.date).mmm} · ` : ""}${dd.title || "Día"}` : ""; title = "Detalle de actividad"; attList = act.att || []; }
    else if (k === "booking") { bk = curBk(); if (!bk) return null; subtitle = `Reserva · ${bk.type}`; title = "Detalle de reserva"; attList = bk.att || []; }
    else if (k === "city") { city = curCity(); if (!city) return null; subtitle = "Parada"; title = "Editar parada"; }
    else if (k === "day") { city = curCity(); day = curDayObj(); if (!day) return null; subtitle = city ? city.city : "Día"; title = "Editar día"; }
    else if (k === "check") { chk = curCheck(); if (!chk) return null; subtitle = editing.listType === "tasks" ? "Gestión" : "Experiencia"; title = "Detalle"; attList = chk.att || []; }
    else if (k === "expense") { exp = curExpense(); if (!exp) return null; subtitle = "Gasto manual"; title = "Editar gasto"; }

    const overlay = { position: "fixed", inset: 0, background: "rgba(20,16,12,0.45)", zIndex: 50, display: "flex", alignItems: "flex-end", justifyContent: "center" };
    const sheet = { background: C.paper, width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto", borderTopLeftRadius: 20, borderTopRightRadius: 20 };

    return (
      <div onClick={() => { setEditing(null); setAttErr(""); }} style={overlay}>
        <div onClick={(e) => e.stopPropagation()} style={sheet}>
          <div className="flex items-center justify-between px-5 py-4 sticky top-0" style={{ background: C.paper, borderBottom: `1px solid ${C.line}`, zIndex: 1 }}>
            <div>
              <div style={{ fontSize: 11, color: C.sub, fontWeight: 600, textTransform: "uppercase", letterSpacing: 1 }}>{subtitle}</div>
              <div style={{ fontSize: 18, fontWeight: 800, color: C.ink }}>{title}</div>
            </div>
            <button onClick={() => { setEditing(null); setAttErr(""); }} className="rounded-full p-1.5" style={{ background: C.card, border: `1px solid ${C.line}` }}><X size={18} color={C.sub} /></button>
          </div>

          <div className="px-5 py-4">
            {k === "act" && (
              <>
                <Field label="Hora" hint="Inicio y fin aproximado de la actividad.">
                  <div className="flex items-center gap-2 flex-wrap">
                    <input type="time" value={act.t || ""} onChange={(e) => patchAct({ t: e.target.value })} disabled={!act.t} style={{ ...inp, ...mono, width: 118, opacity: act.t ? 1 : 0.45 }} />
                    <span style={{ color: C.sub, fontWeight: 700 }}>→</span>
                    <input type="time" value={act.tEnd || ""} onChange={(e) => patchAct({ tEnd: e.target.value })} disabled={!act.t} style={{ ...inp, ...mono, width: 118, opacity: act.t ? 1 : 0.45 }} />
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <CheckBox size={18} on={!act.t} onClick={() => patchAct({ t: act.t ? "" : "12:00", tEnd: act.t ? "" : act.tEnd })} />
                    <button onClick={() => patchAct({ t: act.t ? "" : "12:00", tEnd: act.t ? "" : act.tEnd })} style={{ fontSize: 13, color: C.sub }}>Sin hora definida</button>
                  </div>
                </Field>
                <Field label="Tipo"><select value={act.type} onChange={(e) => patchAct({ type: e.target.value })} style={inp}>{Object.keys(TYPE).map((key) => <option key={key} value={key}>{TYPE[key].l}</option>)}</select></Field>
                <Field label="Actividad"><input value={act.x} onChange={(e) => patchAct({ x: e.target.value })} placeholder="¿Qué vais a hacer?" style={inp} /></Field>
                <Field label="Precio" hint="Se suma automáticamente a tus gastos.">
                  <div className="flex gap-2">
                    <input value={act.price == null ? "" : act.price} onChange={(e) => { const v = e.target.value.replace(",", "."); patchAct({ price: v === "" ? null : (parseFloat(v) || 0) }); }} placeholder="0,00" inputMode="decimal" style={{ ...inp, flex: 1, ...mono }} />
                    <select value={act.cur} onChange={(e) => patchAct({ cur: e.target.value })} style={{ ...inp, width: "auto" }}><option value="EUR">€ EUR</option><option value="CNY">¥ CNY</option></select>
                  </div>
                </Field>
                <button onClick={() => patchAct({ booked: !act.booked })} className="w-full flex items-center gap-3 rounded-xl px-4 py-3 mb-3" style={{ background: C.card, border: `1px solid ${act.booked ? C.jade + "66" : C.line}` }}>
                  <CheckBox on={act.booked} /><span style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>Comprado / reservado</span>
                </button>
                <Field label="¿Quién la pagó?" hint="Se usa para el balance de gastos entre Fa y Rubén.">
                  {renderPayerPicker(act.paidBy || "", (v) => patchAct({ paidBy: v }), true)}
                </Field>
                <Field label="Notas"><textarea value={act.notes} onChange={(e) => patchAct({ notes: e.target.value })} rows={3} placeholder="Entradas, horarios, direcciones, ideas…" style={{ ...inp, resize: "none" }} /></Field>
                {renderAttachments(attList)}
                <button onClick={() => setConfirmDel({ name: act.x || "esta actividad", where: "de la ruta", onConfirm: deleteActivity })} className="w-full flex items-center justify-center gap-2 rounded-xl py-3 mt-2" style={{ color: C.red, border: `1px solid ${C.line}`, fontSize: 13, fontWeight: 600 }}><Trash2 size={15} /> Eliminar actividad</button>
              </>
            )}

            {k === "booking" && (
              <>
                <div className="flex gap-2">
                  <div className="flex-1"><Field label="Tipo"><select value={bk.type} onChange={(e) => patchBk({ type: e.target.value })} style={inp}>{["Vuelo", "Tren", "Hotel", "Actividad"].map((t) => <option key={t}>{t}</option>)}</select></Field></div>
                  <div style={{ width: 140 }}><Field label="Fecha"><input type="date" value={bk.date} onChange={(e) => patchBk({ date: e.target.value })} style={{ ...inp, ...mono, fontSize: 12 }} /></Field></div>
                </div>
                <Field label="Título"><input value={bk.title} onChange={(e) => patchBk({ title: e.target.value })} style={inp} /></Field>
                <Field label="Detalle"><input value={bk.detail} onChange={(e) => patchBk({ detail: e.target.value })} placeholder="Horario, nº de noches, etc." style={inp} /></Field>
                <button onClick={() => patchBk({ status: bk.status === "confirmado" ? "pendiente" : "confirmado" })} className="w-full flex items-center gap-3 rounded-xl px-4 py-3 mb-3" style={{ background: C.card, border: `1px solid ${bk.status === "confirmado" ? C.jade + "66" : C.line}` }}>
                  <CheckBox on={bk.status === "confirmado"} /><span style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>Confirmada</span>
                </button>
                <Field label="Localizador / referencia"><input value={bk.ref || ""} onChange={(e) => patchBk({ ref: e.target.value })} placeholder="Código de reserva" style={{ ...inp, ...mono }} /></Field>
                <Field label="Notas"><textarea value={bk.notes || ""} onChange={(e) => patchBk({ notes: e.target.value })} rows={3} placeholder="Detalles de la reserva…" style={{ ...inp, resize: "none" }} /></Field>
                {renderAttachments(attList)}
                <button onClick={() => setConfirmDel({ name: bk.title || "esta reserva", where: "de las reservas", onConfirm: deleteBooking })} className="w-full flex items-center justify-center gap-2 rounded-xl py-3 mt-2" style={{ color: C.red, border: `1px solid ${C.line}`, fontSize: 13, fontWeight: 600 }}><Trash2 size={15} /> Eliminar reserva</button>
              </>
            )}

            {k === "city" && (
              <>
                <Field label="Nombre de la parada"><input value={city.city} onChange={(e) => patchCityById(editing.cityId, { city: e.target.value })} style={inp} /></Field>
                <Field label="Color">
                  <div className="flex flex-wrap gap-2">
                    {PALETTE.map((col) => <button key={col} onClick={() => patchCityById(editing.cityId, { color: col })} style={{ width: 30, height: 30, borderRadius: 8, background: col, border: city.color === col ? `2px solid ${C.ink}` : "2px solid transparent" }} />)}
                  </div>
                </Field>
                <Field label="Transporte de llegada (opcional)">
                  <div className="flex gap-2">
                    <select value={city.into ? city.into.mode : ""} onChange={(e) => { const m = e.target.value; patchCityById(editing.cityId, { into: m ? { mode: m, detail: (city.into && city.into.detail) || "" } : null }); }} style={{ ...inp, width: "auto" }}>
                      <option value="">—</option>{TRANSPORTS.map((t) => <option key={t}>{t}</option>)}
                    </select>
                    {city.into && <input value={city.into.detail || ""} onChange={(e) => patchCityById(editing.cityId, { into: { ...city.into, detail: e.target.value } })} placeholder="Detalle (p. ej. ~5h)" style={{ ...inp, flex: 1 }} />}
                  </div>
                </Field>
                <div style={{ fontSize: 12, color: C.sub, marginBottom: 12 }}>Los días y actividades de esta parada se gestionan en la pantalla de Ruta.</div>
                <button onClick={() => setConfirmDel({ name: city.city || "esta parada", where: "y todos sus días de la ruta", onConfirm: () => deleteCity(editing.cityId) })} className="w-full flex items-center justify-center gap-2 rounded-xl py-3" style={{ color: C.red, border: `1px solid ${C.line}`, fontSize: 13, fontWeight: 600 }}><Trash2 size={15} /> Eliminar parada y sus días</button>
              </>
            )}

            {k === "day" && (
              <>
                <Field label="Fecha"><input type="date" value={day.date || ""} onChange={(e) => patchDayById(editing.cityId, editing.dayId, { date: e.target.value })} style={{ ...inp, ...mono }} /></Field>
                <Field label="Título del día"><input value={day.title || ""} onChange={(e) => patchDayById(editing.cityId, editing.dayId, { title: e.target.value })} placeholder="P. ej. Llegada y centro histórico" style={inp} /></Field>
                <button onClick={() => setConfirmDel({ name: day.title || (day.date ? `el día ${dparts(day.date).dd} ${dparts(day.date).mmm}` : "este día"), where: "de la ruta", onConfirm: () => deleteDay(editing.cityId, editing.dayId) })} className="w-full flex items-center justify-center gap-2 rounded-xl py-3 mt-1" style={{ color: C.red, border: `1px solid ${C.line}`, fontSize: 13, fontWeight: 600 }}><Trash2 size={15} /> Eliminar día</button>
              </>
            )}

            {k === "check" && (
              <>
                <Field label={editing.listType === "tasks" ? "Gestión" : "Experiencia"}>
                  <input value={chk.text} onChange={(e) => patchCheck({ text: e.target.value })} style={inp} />
                </Field>
                <button onClick={() => patchCheck({ done: !chk.done })} className="w-full flex items-center gap-3 rounded-xl px-4 py-3 mb-3" style={{ background: C.card, border: `1px solid ${chk.done ? C.jade + "66" : C.line}` }}>
                  <CheckBox on={chk.done} /><span style={{ fontSize: 14, fontWeight: 600, color: C.ink }}>{editing.listType === "tasks" ? "Hecho" : "Vivido"}</span>
                </button>
                <Field label="Notas"><textarea value={chk.notes || ""} onChange={(e) => patchCheck({ notes: e.target.value })} rows={3} placeholder="Detalles, enlaces, recordatorios…" style={{ ...inp, resize: "none" }} /></Field>
                {renderAttachments(attList)}
                <button onClick={() => setConfirmDel({ name: chk.text || "este elemento", where: editing.listType === "tasks" ? "de la checklist" : "de las experiencias", onConfirm: deleteCheck })} className="w-full flex items-center justify-center gap-2 rounded-xl py-3 mt-2" style={{ color: C.red, border: `1px solid ${C.line}`, fontSize: 13, fontWeight: 600 }}><Trash2 size={15} /> Eliminar</button>
              </>
            )}

            {k === "expense" && (
              <>
                <div className="flex gap-2">
                  <div className="flex-1"><Field label="Categoría"><select value={exp.cat} onChange={(e) => patchExpense({ cat: e.target.value })} style={inp}>{EXP_CATS.map((c) => <option key={c}>{c}</option>)}</select></Field></div>
                  <div style={{ width: 140 }}><Field label="Fecha"><input type="date" value={exp.date || ""} onChange={(e) => patchExpense({ date: e.target.value })} style={{ ...inp, ...mono, fontSize: 12 }} /></Field></div>
                </div>
                <Field label="Descripción"><input value={exp.desc || ""} onChange={(e) => patchExpense({ desc: e.target.value })} placeholder="Descripción" style={inp} /></Field>
                <Field label="Importe">
                  <div className="flex gap-2">
                    <input value={exp.amount} onChange={(e) => patchExpense({ amount: e.target.value })} placeholder="0,00" inputMode="decimal" style={{ ...inp, flex: 1, ...mono }} />
                    <select value={exp.cur} onChange={(e) => patchExpense({ cur: e.target.value })} style={{ ...inp, width: "auto" }}><option value="EUR">€ EUR</option><option value="CNY">¥ CNY</option></select>
                  </div>
                </Field>
                <Field label="¿Quién paga?" hint="Se usa para el balance de gastos entre Fa y Rubén.">
                  {renderPayerPicker(exp.paidBy || "", (v) => patchExpense({ paidBy: v }), false)}
                </Field>
                <button onClick={() => setConfirmDel({ name: exp.desc || exp.cat, where: "de los gastos", onConfirm: deleteExpense })} className="w-full flex items-center justify-center gap-2 rounded-xl py-3 mt-2" style={{ color: C.red, border: `1px solid ${C.line}`, fontSize: 13, fontWeight: 600 }}><Trash2 size={15} /> Eliminar gasto</button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  /* ============ shell ============ */
  if (!hydrated) {
    return <div style={{ background: C.paper, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", color: C.sub }}>Cargando tu viaje…</div>;
  }
  const TABS = [
    { id: "resumen", icon: Calendar, label: "Resumen", render: renderResumen },
    { id: "itinerario", icon: MapPin, label: "Ruta", render: renderRuta },
    { id: "presupuesto", icon: Wallet, label: "Gastos", render: renderGastos },
    { id: "reservas", icon: FileText, label: "Reservas", render: renderReservas },
    { id: "equipaje", icon: Luggage, label: "Maleta", render: renderMaleta },
    { id: "checklist", icon: ListChecks, label: "Listas", render: renderChecklist },
    { id: "docs", icon: AlertCircle, label: "Info", render: renderInfo },
  ];
  const active = TABS.find((t) => t.id === tab);

  return (
    <div style={{ background: C.paper, minHeight: "100vh", maxWidth: 480, margin: "0 auto", fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif", color: C.ink }}>
      {onBack && (
        <div style={{ padding: "12px 16px 0" }}>
          <button onClick={onBack} style={{ display: "flex", alignItems: "center", gap: 4, color: C.sub, fontSize: 13, fontWeight: 600 }}>
            <ChevronLeft size={18} /> Mis viajes
          </button>
        </div>
      )}
      <div style={{ paddingTop: onBack ? 8 : 16, paddingBottom: 76 }}>{active.render()}</div>
      <div style={{ position: "fixed", left: 0, right: 0, bottom: 0, maxWidth: 480, margin: "0 auto", background: "rgba(245,241,234,0.92)", backdropFilter: "blur(8px)", borderTop: `1px solid ${C.line}`, zIndex: 40 }}>
        <div style={{ display: "flex", flexWrap: "nowrap" }}>
          {TABS.map((t) => <NavBtn key={t.id} active={tab === t.id} onClick={() => setTab(t.id)} icon={t.icon} label={t.label} />)}
        </div>
      </div>
      {renderModal()}
      {lightbox && (
        <div onClick={() => setLightbox(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <img src={lightbox} alt="" style={{ maxWidth: "100%", maxHeight: "100%", borderRadius: 8 }} />
        </div>
      )}
      {drag && (
        <div style={{ position: "fixed", left: drag.x + 14, top: drag.y - 14, zIndex: 80, pointerEvents: "none", background: C.card, border: `1px solid ${C.line}`, borderRadius: 10, boxShadow: "0 10px 28px rgba(20,16,12,0.22)", padding: "8px 12px", maxWidth: 260 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{drag.item.x || "(sin título)"}</div>
          <div style={{ ...mono, fontSize: 11, color: C.sub }}>{drag.item.t || "Sin hora"}</div>
        </div>
      )}
      {confirmDel && (
        <div onClick={() => setConfirmDel(null)} style={{ position: "fixed", inset: 0, background: "rgba(20,16,12,0.55)", zIndex: 70, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: C.paper, width: "100%", maxWidth: 360, borderRadius: 16, padding: 20, border: `1px solid ${C.line}` }}>
            <div className="flex items-center gap-2 mb-2" style={{ color: C.red, fontWeight: 800, fontSize: 16 }}><Trash2 size={18} /> Eliminar</div>
            <div style={{ fontSize: 14, color: C.sub, lineHeight: 1.5, marginBottom: 20 }}>
              ¿Seguro que quieres eliminar <b style={{ color: C.ink }}>{confirmDel.name}</b>{confirmDel.where ? ` ${confirmDel.where}` : ""}?
            </div>
            <div className="flex gap-2">
              <button onClick={() => setConfirmDel(null)} className="flex-1 rounded-lg py-2.5" style={{ border: `1px solid ${C.line}`, background: C.card, color: C.sub, fontSize: 14, fontWeight: 600 }}>Cancelar</button>
              <button onClick={() => { const fn = confirmDel.onConfirm; setConfirmDel(null); fn && fn(); }} className="flex-1 rounded-lg py-2.5" style={{ background: C.red, color: "#fff", fontSize: 14, fontWeight: 700 }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
