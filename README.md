# Mi viaje — Vercel + Supabase

App de planificación de viaje (React + Vite). Sin servidor propio: los datos se guardan en
**Supabase** (Postgres gestionado) y se publica en **Vercel**.

```
  Navegador (React en Vercel)  ──>  Supabase (Auth + Postgres)
        Root → Login → Trips → App      tablas trips + kv (JSONB), RLS por usuario
```

App **multiusuario**: cada persona inicia sesión (Google o email+contraseña), ve sus viajes en
"Mis viajes" y al abrir uno entra al planificador. Cada usuario solo ve y edita **sus** datos
(RLS de Supabase). El frontend habla con Supabase directamente; no hay backend propio.

---

## 1. Crear el proyecto en Supabase (gratis)

1. Entra en https://supabase.com y crea un proyecto nuevo.
2. Ve a **Project Settings → API** y copia:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public key** → `VITE_SUPABASE_ANON_KEY`
3. **Auth → URL Configuration**: pon *Site URL* = tu URL de producción (Vercel) y añade en
   *Redirect URLs* esa misma URL y `http://localhost:5173` (lo usan Google y los enlaces de
   recuperación de contraseña).
4. **Auth → Providers → Email**: ya está activo. (Opcional: desactiva "Confirm email" para que el
   registro entre directo sin confirmar por correo.)
5. **Auth → Providers → Google**: pega el Client ID/Secret de un OAuth client de Google Cloud.
6. Pega `supabase.sql` en el **SQL Editor → Run**. Crea las tablas `trips` + `kv` con RLS.
   Funciona en un proyecto nuevo y es idempotente (puedes reejecutarlo).
   *(Opcional)* Si vienes de la versión antigua de un solo viaje y quieres conservar "China",
   regístrate una vez en la app y pon tu email en la variable `target_email` del script.

> Apple Sign-In está preparado en el código (flag `APPLE_ENABLED` en `Login.jsx`); requiere una
> cuenta de Apple Developer de pago para activarlo.

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

## Cuentas y viajes

Cada usuario inicia sesión con **Google** o **email + contraseña**. En "Mis viajes" puede crear,
renombrar, abrir y borrar sus viajes; cada viaje es **privado de su dueño** (RLS de Supabase).
(Compartir un viaje entre varias personas queda como mejora futura.)

## Cómo se guardan los datos

- Tabla **`trips`**: metadatos de cada viaje (id, dueño, nombre, fechas).
- Tabla **`kv`**: el contenido, con claves por viaje — el **viaje completo** (ruta, días,
  actividades, reservas, gastos, maleta, checklists, ajustes) en `trip_<id>` y cada **adjunto** en
  `trip_<id>_att_<id>`. Ambas tablas con RLS: cada usuario solo accede a sus filas.

## Todo en la base de datos (sin localStorage)

Toda la información (viajes, contenido y adjuntos) se guarda **exclusivamente en Supabase**.
La app **no** usa `localStorage` para los datos. Por eso las variables de entorno son
obligatorias: sin `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` la app no arranca y muestra
un aviso para configurarlas. (Lo único que Supabase guarda en el navegador es el token de
sesión para mantenerte logueado entre recargas.)

## Notas

- **Adjuntos**: ahora se guardan como dataURL dentro de la BD. Para mucho volumen, súbelos a
  **Supabase Storage** y guarda solo la ruta. (Cambio acotado en `store.js`.)
- **¿Firebase en lugar de Supabase?** El mismo `store.js` se puede reescribir contra Firestore
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
├── supabase.sql          # tablas trips + kv con RLS (pegar en Supabase)
├── main.jsx              # arranque
├── Root.jsx             # orquesta login / mis viajes / app
├── Login.jsx            # acceso (Google, email+contraseña)
├── Trips.jsx            # pantalla "Mis viajes"
├── supabase.js          # cliente Supabase
├── store.js             # capa de datos clave-valor (Supabase o local)
├── tripsApi.js          # CRUD de viajes (tabla trips)
└── App.jsx              # el planificador de un viaje
```
