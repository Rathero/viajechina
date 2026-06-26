import { supabase, isConfigured } from "./supabase";

/* Mismo contrato sencillo en todos los modos: get / set / list / delete.
   value siempre es un string JSON (igual que el almacenamiento local del navegador). */

// --- Fallbacks locales (cuando no hay Supabase configurado) ---
const memoryKV = (() => {
  const m = new Map();
  return {
    async get(k) { return m.has(k) ? { key: k, value: m.get(k) } : null; },
    async set(k, v) { m.set(k, v); return { key: k, value: v }; },
    async list(p) { return { keys: [...m.keys()].filter((k) => k.startsWith(p || "")) }; },
    async delete(k) { m.delete(k); return { key: k, deleted: true }; },
  };
})();

const lsStore = {
  async get(k) { const v = localStorage.getItem(k); return v == null ? null : { key: k, value: v }; },
  async set(k, v) { localStorage.setItem(k, v); return { key: k, value: v }; },
  async list(p) {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) { const key = localStorage.key(i); if (key && key.startsWith(p || "")) keys.push(key); }
    return { keys };
  },
  async delete(k) { localStorage.removeItem(k); return { key: k, deleted: true }; },
};

const localStore =
  (typeof window !== "undefined" && window.storage) ? window.storage
  : (typeof localStorage !== "undefined" ? lsStore : memoryKV);

// --- Supabase (Postgres) ---
const supabaseStore = {
  async get(key) {
    const { data, error } = await supabase.from("kv").select("data").eq("key", key).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return { key, value: JSON.stringify(data.data) };
  },
  async set(key, value) {
    const { data: u } = await supabase.auth.getUser();
    const user_id = u && u.user ? u.user.id : undefined;
    const { error } = await supabase.from("kv").upsert({ user_id, key, data: JSON.parse(value) }, { onConflict: "user_id,key" });
    if (error) throw error;
    return { key, value };
  },
  async list(prefix) {
    // RLS limita las filas al usuario actual, así que basta con traer las claves y filtrar.
    const { data, error } = await supabase.from("kv").select("key");
    if (error) throw error;
    const p = prefix || "";
    return { keys: (data || []).map((r) => r.key).filter((k) => k.startsWith(p)) };
  },
  async delete(key) {
    const { error } = await supabase.from("kv").delete().eq("key", key);
    if (error) throw error;
    return { key, deleted: true };
  },
};

export const store = isConfigured ? supabaseStore : localStore;
