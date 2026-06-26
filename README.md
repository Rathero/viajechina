# Mi viaje — Vercel + Supabase

App de planificación de viaje (React + Vite). Sin servidor propio: los datos se guardan en
**Supabase** (Postgres gestionado) y se publica en **Vercel**.

```
  Navegador (React en Vercel)  ──>  Supabase (Postgres)
        store.js                     tabla kv (JSONB), pública
```

No hay backend ni login que mantener. La app es **pública**: un único viaje compartido que se
ve y se edita desde cualquier dispositivo con la URL. El frontend habla con Supabase directamente.

---

## 1. Crear el proyecto en Supabase (gratis)

1. Entra en https://supabase.com y crea un proyecto nuevo.
2. Ve a **SQL Editor**, pega el contenido de `supabase.sql` y pulsa **Run**.
3. Ve a **Project Settings → API** y copia:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public key** → `VITE_SUPABASE_ANON_KEY`

> No hace falta configurar login ni *Redirect URLs*: la app es pública y no usa autenticación.

## 2. Probar en local

```bash
npm install
cp .env.example .env.local      # pega tu URL y anon key
npm run dev                     # http://localhost:5173
```

## 3. Publicar en Vercel

1. Sube el proyecto a un repo de GitHub.
2. En https://vercel.com → **Add New → Project** → importa el repo.
   Vercel detecta Vite automáticamente (no hace falta configurar build).
3. En **Settings → Environment Variables** añade:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. **Deploy**. Listo.

## Compartir el viaje

Es un único viaje **público compartido**: cualquiera con la URL ve y edita los mismos datos,
desde el móvil o el ordenador, sin cuentas ni contraseñas.

## Cómo se guardan los datos

La app guarda su estado a través de una interfaz clave-valor (`store.js`), que sobre Supabase
usa una tabla `kv (key, data JSONB)`:

- El **viaje completo** (ruta, días, actividades, reservas, gastos, maleta, ajustes) va en una clave.
- Cada **adjunto** va en su propia clave.

JSONB permite además inspeccionar/consultar el contenido en Supabase si lo necesitas.

## Modo local (sin Supabase)

Si no defines las variables de entorno, la app funciona igual pero guarda en el navegador
(`localStorage`). Útil para probar el diseño sin nube. No hay login en este modo.

## Notas

- **Adjuntos**: ahora se guardan como dataURL dentro de la BD. Para mucho volumen, súbelos a
  **Supabase Storage** y guarda solo la ruta. (Cambio acotado en `src/store.js`.)
- **¿Firebase en lugar de Supabase?** El mismo `src/store.js` se puede reescribir contra Firestore
  (un documento por clave). El resto de la app no cambia. Supabase encaja mejor si quieres SQL.
- **Tailwind**: se carga por CDN en `index.html` para cero configuración. Se puede pasar a Tailwind
  compilado cuando quieras.

## Estructura

```
.
├── index.html            # carga Tailwind (CDN) y la app
├── package.json
├── vite.config.js
├── .env.example
├── supabase.sql          # tabla kv pública (pegar en Supabase)
├── main.jsx              # arranque
├── Root.jsx             # monta la app (sin login)
├── supabase.js          # cliente Supabase
├── store.js             # capa de datos (Supabase o local)
└── App.jsx              # la app
```
