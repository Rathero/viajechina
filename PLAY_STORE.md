# Publicar Waynode en Google Play

Guía completa, de un repositorio recién clonado a la app publicada.

---

## Cómo se empaqueta: TWA

La app **no se reescribe** en Kotlin ni se mete en un WebView. Se publica como
**Trusted Web Activity (TWA)**: un contenedor Android mínimo que abre la web ya
desplegada usando el motor de Chrome del teléfono, a pantalla completa y sin
barra de URL. Para el usuario es una app normal; para ti sigue siendo la misma
web en Vercel.

Se ha elegido esto y no Capacitor/Cordova por una razón concreta: **el acceso con
Google dejaría de funcionar**. Google bloquea OAuth dentro de WebViews embebidos
(error `disallowed_useragent`), que es justo lo que usan Capacitor y Cordova. Un
TWA se ejecuta en Chrome de verdad, así que `signInWithOAuth` sigue funcionando
sin tocar una línea. Además:

- Publicas una corrección en Vercel y llega al instante, **sin pasar por revisión
  de Play** (mientras no cambies la parte Android).
- El `.aab` pesa unos pocos cientos de KB.
- La misma base de código sirve para web, Android y, en su día, iOS.

A cambio: **la app necesita conexión** (ya era así — todo vive en Supabase), y
depende de que el dominio esté disponible.

---

## Requisitos previos

| Qué | Dónde | Notas |
|---|---|---|
| Cuenta de desarrollador de Play | [play.google.com/console](https://play.google.com/console) | 25 USD, pago único |
| Dominio HTTPS con la web desplegada | Vercel | Vale el `*.vercel.app`; un dominio propio da mejor imagen |
| JDK 17 + Android SDK | local | `npm run android:setup` (~1 GB, una vez por equipo) |

> **Cuentas personales creadas después del 13/11/2023:** antes de poder publicar
> en producción, Google obliga a una **prueba cerrada con 12 probadores como
> mínimo, activos 14 días seguidos**. No es opcional y marca el calendario: si
> tienes prisa, empieza por ahí. Las cuentas de organización están exentas.

---

## Paso 1 — Desplegar la web y fijar el dominio

Todo lo demás cuelga del dominio: el `.aab` apunta a él y la verificación de
propiedad se hace contra él.

1. Despliega en Vercel con las variables `VITE_SUPABASE_URL` y
   `VITE_SUPABASE_ANON_KEY` (ver README).
2. Registra el dominio en el proyecto:

   ```bash
   npm run twa:host -- tu-dominio.com
   ```

3. En **Supabase → Authentication → URL Configuration**:
   - *Site URL* = `https://tu-dominio.com/app`
   - *Redirect URLs* = `https://tu-dominio.com/app`, `https://tu-dominio.com/**`
     y `http://localhost:5173/app` (para desarrollo).

   Ojo con el `/app`: la raíz del dominio es la **landing pública** y la
   aplicación vive en `/app`. Si dejas los redirects apuntando a la raíz, entrar
   con Google te devuelve a la web comercial en vez de a tus viajes.

**Comprobaciones:**

- `https://tu-dominio.com/manifest.webmanifest` debe abrirse y mostrar JSON, no
  descargarse como archivo. Dentro, `start_url` tiene que ser `/app`.
- `https://tu-dominio.com/` debe mostrar la landing y `https://tu-dominio.com/app`
  la pantalla de acceso.

---

## Paso 2 — Crear la clave de firma

```bash
npm run android:keystore
```

Te pedirá una contraseña y algunos datos (nombre, organización, país). Los datos
dan igual para Play; **la contraseña no**.

> ### Esto es lo único irrecuperable de todo el proceso
>
> `android.keystore` está ignorado por git a propósito: una clave de firma no se
> versiona nunca. **Copia el archivo y la contraseña a tu gestor de contraseñas
> ahora**, antes de seguir. Si los pierdes tendrás que pedirle a Google que
> reinicie la clave de subida, y hasta que lo hagan no puedes publicar
> actualizaciones.

---

## Paso 3 — Registrar la huella de tu clave

```bash
npm run android:fingerprint
```

Lee la huella SHA-256 del keystore y la escribe en
`public/.well-known/assetlinks.json`. Ese archivo es lo que le demuestra a
Chrome que la web y la app son tuyas; sin él **la app se abre con la barra de
URL de Chrome encima** y deja de parecer nativa.

Todavía falta una segunda huella, la que genera Google — paso 5.

---

## Paso 4 — Generar el `.aab`

```bash
npm run android:build
```

Encadena: regenerar la configuración → validarla → generar el proyecto Android
en `android/` → compilar y firmar. Te pedirá la contraseña del keystore dos
veces (una para el almacén y otra para la clave).

Sale **`android/app-release-bundle.aab`**, que es lo que se sube.

> Este paso descarga los iconos desde tu dominio, así que la web tiene que estar
> desplegada. Si falla, empieza por `npm run android:doctor`.

---

## Paso 5 — Primera subida y la segunda huella

1. Play Console → **Crear app**. Nombre, idioma, tipo *App*, gratuita.
2. Sube el `.aab` en **Prueba interna** (más rápido que producción y sirve para
   verificar que todo funciona en un móvil real).
3. Ve a **Prueba y versión → Firma de aplicaciones**. Google firma la app con
   **su propia clave**, distinta de la tuya, y muestra su huella SHA-256.
   Regístrala también:

   ```bash
   npm run twa:fingerprint -- <la huella que muestra Play Console>
   ```

4. **Vuelve a desplegar en Vercel** para publicar el `assetlinks.json`
   actualizado, ahora con las dos huellas.

**Comprobación:** instala la app desde la prueba interna. Si se abre sin barra
de URL, la verificación funciona. Si aparece la barra, revisa que
`https://tu-dominio.com/.well-known/assetlinks.json` devuelva las dos huellas
(puede tardar unos minutos en propagarse).

---

## Paso 6 — Rellenar la ficha de Play

### Los huecos legales ya están rellenos

Las tres páginas legales están publicadas y sin marcadores pendientes:

| Página | URL | Contenido |
|---|---|---|
| Privacidad | `/privacidad` | Responsable, datos recogidos, encargados, derechos RGPD |
| Términos de uso | `/terminos` | Cuenta, contenido, viajes compartidos, responsabilidad |
| Eliminar cuenta | `/eliminar-cuenta` | Los dos caminos de borrado y qué se borra |

Responsable declarado: **Fátima Hermida Rodríguez**. Contacto: **waynodeapp@gmail.com**.
Si cambia cualquiera de los dos, hay que tocarlos en los tres HTML y en el pie de
`index.html`:

```bash
grep -rn "waynodeapp@gmail.com\|Fátima Hermida" index.html public/
```

> El correo de contacto tiene que estar **operativo**: los revisores de Play
> escriben a esa dirección para comprobar el flujo de borrado de cuenta.

### El borrado de cuenta tiene que funcionar de verdad

Los revisores de Play prueban este flujo. La pantalla existe (*Mis viajes → Tu
cuenta → Eliminar mi cuenta*) y llama a una Edge Function de Supabase, porque
borrar un usuario requiere la clave de servicio y esa no puede vivir en el
navegador. **Despliégala antes de enviar la app:**

```bash
npx supabase functions deploy delete-account
```

Compruébalo con una cuenta de prueba: si sale «No se ha podido eliminar la
cuenta», la función no está desplegada y la app será rechazada.

### Enlaces que pide Play

| Campo | Valor |
|---|---|
| Sitio web | `https://waynodeapp.com` |
| Política de privacidad | `https://waynodeapp.com/privacidad` |
| Eliminación de cuenta | `https://waynodeapp.com/eliminar-cuenta` |
| Email de asistencia | `waynodeapp@gmail.com` |

### Recursos gráficos

| Recurso | Formato | Estado |
|---|---|---|
| Icono | 512×512 PNG | ✅ `public/icons/icon-512.png` |
| Gráfico destacado | 1024×500 PNG | 🟡 fuente lista en `brand/play-feature-graphic.svg`, falta exportar |
| Capturas de teléfono | mín. 2, entre 320 y 3840 px | ⬜ pendiente |

Para exportar el gráfico destacado (y de paso la imagen de compartir enlaces):

```bash
npx svgexport brand/play-feature-graphic.svg brand/play-feature-graphic.png 1024:500
```

Las **capturas** tienen que ser reales, no maquetas. Abre la app en Chrome, entra
con tu cuenta, activa el emulador de móvil (F12 → icono de dispositivo, por
ejemplo *Pixel 7*) y captura **Resumen, Ruta, Gastos y Reservas** con un viaje
que tenga contenido de verdad. Súbelas a Play y, si quieres, ponlas también en la
landing (ver «Sustituir las maquetas por capturas» en el README).

Si cambias el icono, pon el tuyo en `brand/icon-source.png` y ejecuta
`npm run icons`: regenera todos los tamaños, incluidos los *maskable*.

### Seguridad de los datos (*Data safety*)

Es un formulario largo y con responsabilidad legal. Lo que hace esta app:

- **Se recogen**: correo electrónico (para la cuenta) y el contenido que crea el
  usuario (viajes, gastos, fotos y documentos adjuntos, diario).
- **Se transmiten cifrados**: sí, todo va por HTTPS.
- **Se pueden borrar**: sí, desde *Mis viajes → Tu cuenta → Eliminar mi cuenta*.
- **Se comparten con terceros**: no. Solo con las personas a las que el propio
  usuario invita a un viaje.
- **Publicidad y analítica**: ninguna.

### Resto de declaraciones

Clasificación de contenido (cuestionario), público objetivo, anuncios (**no**),
app de noticias (**no**), COVID (**no**), finanzas (**no**).

---

## Paso 7 — Producción

Prueba interna → prueba cerrada (las 12 personas / 14 días, si te aplica) →
producción. La primera revisión suele tardar entre unos días y dos semanas.

---

## Actualizaciones posteriores

**Si solo cambias la web** (lo habitual: textos, pantallas, correcciones):
despliegas en Vercel y ya está. Los usuarios lo ven al abrir la app. **No hay
que subir nada a Play.**

**Si cambias algo de la parte Android** (nombre, iconos, colores, orientación,
permisos):

```bash
npm run twa:bump        # sube versionCode; Play rechaza repetirlo
npm run android:build
```

y subes el `.aab` nuevo.

---

## Estructura de la parte Android

```
twa.config.json            ← lo único que se edita a mano (dominio, id, versión, huellas)
public/manifest.webmanifest  ← marca: nombre, colores, iconos, orientación
scripts/
  twa-sync.mjs             genera android/twa-manifest.json y assetlinks.json
  android.mjs              keystore, huella, update, build, doctor
  android-toolchain.mjs    instala JDK 17 + Android SDK
android/                   proyecto Android generado — ignorado por git, desechable
android.keystore           clave de firma — ignorada por git, IRREEMPLAZABLE
```

Nada de `android/` se versiona: se reconstruye entero desde `twa.config.json` y
el manifest web, así que no hay dos sitios donde el nombre o los colores puedan
desincronizarse.

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run android:setup` | Instala JDK 17 + Android SDK (una vez por equipo) |
| `npm run android:doctor` | Comprueba que el toolchain está bien |
| `npm run twa:host -- dominio.com` | Fija el dominio de producción |
| `npm run android:keystore` | Crea la clave de firma |
| `npm run android:fingerprint` | Lee su huella y la registra |
| `npm run twa:fingerprint -- AA:BB:…` | Registra una huella a mano (la de Google) |
| `npm run twa:bump` | Sube el `versionCode` |
| `npm run android:build` | Genera el `.aab` firmado |
| `npm run icons` | Regenera los iconos desde `brand/icon-source.png` |
