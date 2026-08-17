# Waynode — Vercel + Supabase

App de planificación de viaje (React + Vite). Sin servidor propio: los datos se guardan en
**Supabase** (Postgres gestionado) y se publica en **Vercel**.

```
  Navegador (React en Vercel)  ──>  Supabase (Auth + Postgres)
        Root → Login → Trips → App      tablas trips + kv (JSONB), RLS por usuario
```

## Dos sitios en un mismo dominio

| URL | Qué es | Archivo |
|---|---|---|
| `/` | **Landing pública**: HTML y CSS a pelo, sin React ni fuentes externas. Es lo que ve quien llega desde Google o desde la ficha de Play. | `index.html` |
| `/app` | **La aplicación** (React). Es a donde apunta la app de Android y adonde vuelven los inicios de sesión. | `app.html` + `main.jsx` |
| `/privacidad`, `/terminos`, `/eliminar-cuenta` | Páginas legales estáticas. Google Play las exige y las revisa. | `public/*.html` |

Las URL van **sin `.html`**: lo resuelve `cleanUrls` en `vercel.json`, y un plugin
pequeño de `vite.config.js` hace lo mismo en `npm run dev` para que local y
producción se comporten igual.

> Si mueves la app de `/app`, hay que tocar cuatro sitios a la vez: `vercel.json`,
> `public/manifest.webmanifest` (`start_url`), `APP_URL()` en `Login.jsx` y los
> *Redirect URLs* de Supabase.

App **multiusuario**: cada persona inicia sesión (Google o email+contraseña), ve sus viajes en
"Mis viajes" y al abrir uno entra al planificador. Cada usuario solo ve y edita **sus** datos
(RLS de Supabase). El frontend habla con Supabase directamente; no hay backend propio.

---

## 1. Crear el proyecto en Supabase (gratis)

1. Entra en https://supabase.com y crea un proyecto nuevo.
2. Ve a **Project Settings → API** y copia:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public key** → `VITE_SUPABASE_ANON_KEY`
3. **Auth → URL Configuration**: pon *Site URL* = `https://tu-dominio.com/app` y añade en
   *Redirect URLs* esa misma URL, `https://tu-dominio.com/**` y `http://localhost:5173/app`
   (lo usan Google y los enlaces de recuperación de contraseña).
   **El `/app` importa**: la raíz del dominio es la landing, no la aplicación.
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

## 4. Publicar en Google Play

La app se empaqueta como **TWA**: un contenedor Android que abre esta misma web
con el motor de Chrome, sin barra de URL. No hay una segunda base de código, y
las correcciones que despliegues en Vercel llegan al móvil sin pasar por Play.

```bash
npm run android:setup                  # JDK 17 + Android SDK (una vez por equipo)
npm run twa:host -- tu-dominio.com     # dominio de producción
npm run android:keystore               # clave de firma (elige tú la contraseña)
npm run android:fingerprint            # registra su huella en assetlinks.json
npm run android:build                  # genera android/app-release-bundle.aab
```

El proceso completo — ficha de Play, formulario de seguridad de los datos,
huellas SHA-256 y actualizaciones posteriores — está en **[PLAY_STORE.md](PLAY_STORE.md)**.

## Cuentas y viajes

Cada usuario inicia sesión con **Google** o **email + contraseña**. En "Mis viajes" puede crear,
renombrar, abrir y borrar sus viajes; cada viaje es **privado de su dueño** (RLS de Supabase).

## Compartir un viaje (viajes en grupo)

Desde "Mis viajes", el botón **Compartir** (icono de persona+) de cada viaje propio permite
**invitar por email**. La otra persona, al iniciar sesión con ese correo, ve la invitación
arriba en "Mis viajes" y puede **Aceptar** o **Rechazar**. Si la acepta, el viaje aparece en
la sección **Viajes en grupo** y lo abre y edita **como si fuera suyo**: la ruta, días,
actividades, reservas, gastos, etc. son **una sola copia compartida** (no hay duplicados),
así que los cambios de cualquier miembro los ven todos.

- El **dueño** puede invitar a más gente, ver el estado de cada invitación (pendiente /
  aceptada / rechazada) y **quitar el acceso** en cualquier momento.
- Un **miembro** puede **salir** del viaje (deja de verlo; el viaje no se borra).
- Borrar el viaje completo sigue siendo solo del **dueño**.

Cómo funciona por dentro: el contenido (tabla `kv`) sigue perteneciendo al **dueño**; los
miembros aceptados leen y escriben esas mismas filas gracias a las políticas RLS. La tabla
nueva `trip_shares` guarda cada invitación/membresía. Todo esto se crea al ejecutar
`supabase.sql` (es idempotente).

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

## La landing (`index.html`)

Un solo archivo, sin dependencias, sin fuentes externas y sin nada que rastree al
visitante. Usa la misma paleta que la app (la constante `C` de `App.jsx`), definida
arriba del `<style>` como variables CSS.

Para tocar textos, busca la sección por su comentario (`<!-- ===== HERO ===== -->`,
`FUNCIONES`, `VIAJES EN GRUPO`, `PANTALLAS`, `PRIVACIDAD`, `DESCARGA`, `FAQ`).

### Sustituir las maquetas por capturas reales

Los móviles de la landing son **recreaciones en HTML/CSS** de las pantallas de la
app, no capturas: se ven nítidas en cualquier pantalla y pesan cero. Si prefieres
capturas de verdad (las vas a necesitar igualmente para Play):

1. Guarda los PNG en `public/capturas/` (por ejemplo `resumen.png`, `ruta.png`).
2. En `index.html`, sustituye el bloque `<div class="phone">…</div>` entero por:

   ```html
   <div class="phone"><img src="/capturas/resumen.png" alt="Pantalla Resumen de Waynode" /></div>
   ```

3. Añade al `<style>`: `.phone img{border-radius:30px;display:block}`.

### Cuando publiques en Google Play

En la sección «Descarga» de `index.html` hay un botón desactivado con el texto
*Próximamente en Google Play*. Justo encima tiene un comentario con el enlace real
que hay que poner: cambia el `<span class="play-badge">` por un `<a>` a
`https://play.google.com/store/apps/details?id=com.waynodeapp.app`.

## Páginas legales

`public/privacidad.html`, `public/terminos.html` y `public/eliminar-cuenta.html`.
Son HTML sueltos, sin build. El responsable declarado es **Fátima Hermida
Rodríguez** y el contacto **waynodeapp@gmail.com**; si cambia alguno:

```bash
grep -rn "waynodeapp@gmail.com\|Fátima Hermida" index.html public/
```

Google Play comprueba que estos enlaces funcionen y que el borrado de cuenta sea
real, así que despliega la Edge Function `delete-account` antes de enviar la app
(ver [PLAY_STORE.md](PLAY_STORE.md)).

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
├── index.html            # LANDING pública (/) — HTML+CSS estáticos, sin React
├── app.html              # entrada de la APLICACIÓN (/app)
├── package.json
├── vite.config.js        # dos entradas + URLs sin .html en desarrollo
├── vercel.json           # cleanUrls, rewrite de /app y cabeceras
├── .env.example
├── supabase.sql          # tablas trips + kv + trip_shares con RLS (pegar en Supabase)
├── main.jsx              # arranque
├── Root.jsx             # orquesta login / mis viajes / app
├── Login.jsx            # acceso (Google, email+contraseña)
├── Trips.jsx            # pantalla "Mis viajes" + viajes en grupo + invitaciones
├── supabase.js          # cliente Supabase
├── store.js             # capa de datos clave-valor (escribe en la copia del dueño)
├── tripsApi.js          # CRUD de viajes (tabla trips)
├── sharingApi.js        # invitaciones y membresías (tabla trip_shares)
├── backstack.js         # botón Atrás de Android: cierra capas en vez de salir
├── App.jsx              # el planificador de un viaje
│
├── public/
│   ├── privacidad.html       # política de privacidad (obligatoria en Play)
│   ├── terminos.html         # términos de uso
│   ├── eliminar-cuenta.html  # cómo borrar la cuenta (obligatoria en Play)
│   ├── robots.txt            # indexa la landing, no la app
│   └── sitemap.xml
├── brand/
│   ├── og.svg                    # imagen de compartir enlaces (1200×630)
│   └── play-feature-graphic.svg  # gráfico destacado de Play (1024×500)
│
├── PLAY_STORE.md         # guía de publicación en Google Play
├── twa.config.json       # config de la app Android (dominio, id, versión, huellas)
├── supabase/functions/
│   └── delete-account/   # borrado de cuenta (obligatorio en Play); desplegar aparte
└── scripts/
    ├── generate-icons.mjs    # iconos de la PWA y de Play
    ├── twa-sync.mjs          # genera twa-manifest.json y assetlinks.json
    ├── android.mjs           # keystore, huella, build del .aab
    └── android-toolchain.mjs # instala JDK 17 + Android SDK
```
