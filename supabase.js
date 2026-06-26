import { createClient } from "@supabase/supabase-js";

// Estas variables se configuran en .env.local (local) y en Vercel (producción).
const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Si no hay credenciales, la app funciona en modo local (sin nube).
export const isConfigured = Boolean(url && anon);
export const supabase = isConfigured ? createClient(url, anon) : null;
