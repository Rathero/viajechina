/* Genera los archivos que necesita Google Play a partir de una sola configuración.

   Entrada:
     twa.config.json            → lo específico de Android (dominio, packageId, versión, huellas)
     public/manifest.webmanifest → la marca (nombre, colores, iconos, orientación)
     package.json               → el número de versión visible (versionName)

   Salida (generados, no editar a mano):
     android/twa-manifest.json          → lo lee Bubblewrap para construir el .aab
     public/.well-known/assetlinks.json → Digital Asset Links; quita la barra de URL de Chrome

   Uso:
     node scripts/twa-sync.mjs                       regenera ambos
     node scripts/twa-sync.mjs --host miviaje.app    fija el dominio y regenera
     node scripts/twa-sync.mjs --fingerprint AA:BB:… añade una huella SHA-256 y regenera
     node scripts/twa-sync.mjs --bump                sube versionCode en 1 y regenera
     node scripts/twa-sync.mjs --check               no escribe: solo valida (para CI/preflight)

   Sin dependencias externas a propósito: esto tiene que funcionar en un clon recién bajado. */

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const CONFIG = path.join(ROOT, "twa.config.json");
const WEB_MANIFEST = path.join(ROOT, "public", "manifest.webmanifest");
const PKG = path.join(ROOT, "package.json");
const OUT_TWA = path.join(ROOT, "android", "twa-manifest.json");
const OUT_LINKS = path.join(ROOT, "public", ".well-known", "assetlinks.json");

/* La clave de firma vive en la raíz del repositorio (ignorada por git) mientras
   que Bubblewrap trabaja dentro de android/. Se escribe la ruta absoluta para
   que no dependa del directorio desde el que se lance cada comando. Con barras
   normales: keytool y apksigner las aceptan también en Windows. */
const KEYSTORE = path.join(ROOT, "android.keystore").replace(/\\/g, "/");

/* ---------- utilidades de consola ---------- */
const ok = (m) => console.log(`  \x1b[32m✓\x1b[0m ${m}`);
const warn = (m) => console.log(`  \x1b[33m!\x1b[0m ${m}`);
const die = (m, hint) => {
  console.error(`\n  \x1b[31m✗ ${m}\x1b[0m`);
  if (hint) console.error(`    ${hint}`);
  console.error("");
  process.exit(1);
};

const readJson = (file, label) => {
  if (!fs.existsSync(file)) die(`No existe ${label} (${path.relative(ROOT, file)}).`);
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    die(`${label} no es JSON válido.`, e.message);
  }
};

/* ---------- argumentos ---------- */
const argv = process.argv.slice(2);
const flag = (name) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? null : argv[i + 1] ?? "";
};
const has = (name) => argv.includes(`--${name}`);

/* ---------- 1. cargar configuración ---------- */
const cfg = readJson(CONFIG, "twa.config.json");
const manifest = readJson(WEB_MANIFEST, "el manifest de la PWA");
const pkg = readJson(PKG, "package.json");

/* ---------- 2. mutaciones pedidas por línea de comandos ---------- */
let mutated = false;

const hostArg = flag("host");
if (hostArg !== null) {
  // Se acepta pegado tal cual del navegador; nos quedamos solo con el dominio.
  const clean = hostArg
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .replace(/\.$/, "")
    .toLowerCase();
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(clean)) {
    die(`"${hostArg}" no parece un dominio válido.`, "Ejemplo: npm run twa:host -- miviaje.app");
  }
  cfg.host = clean;
  mutated = true;
  ok(`Dominio fijado: ${clean}`);
}

const fpArg = flag("fingerprint");
if (fpArg !== null) {
  const fp = fpArg.trim().toUpperCase().replace(/\s/g, "");
  // 32 bytes en hexadecimal separados por ":" — lo que imprime keytool y lo que muestra Play Console.
  if (!/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/.test(fp)) {
    die(
      "La huella no tiene el formato SHA-256 esperado.",
      "Deben ser 32 pares hexadecimales separados por ':' — p. ej. A1:B2:C3:…  (64 caracteres + separadores)"
    );
  }
  if (!Array.isArray(cfg.signingKeyFingerprints)) cfg.signingKeyFingerprints = [];
  if (cfg.signingKeyFingerprints.includes(fp)) {
    warn("Esa huella ya estaba registrada.");
  } else {
    cfg.signingKeyFingerprints.push(fp);
    mutated = true;
    ok(`Huella añadida (${cfg.signingKeyFingerprints.length} en total).`);
  }
}

if (has("bump")) {
  cfg.versionCode = Number(cfg.versionCode || 0) + 1;
  mutated = true;
  ok(`versionCode → ${cfg.versionCode}`);
}

if (mutated) {
  fs.writeFileSync(CONFIG, JSON.stringify(cfg, null, 2) + "\n");
  ok("twa.config.json actualizado.");
}

/* ---------- 3. validación ---------- */
const problems = [];

if (!cfg.host) {
  problems.push({
    what: "Falta el dominio de producción (host).",
    fix: "npm run twa:host -- tu-dominio.com",
  });
}
if (!cfg.applicationId || !/^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/.test(cfg.applicationId)) {
  problems.push({
    what: `applicationId inválido: "${cfg.applicationId}".`,
    fix: "Debe ser tipo com.miviaje.app: minúsculas, al menos un punto, sin guiones.",
  });
}
if (!Number.isInteger(cfg.versionCode) || cfg.versionCode < 1) {
  problems.push({ what: "versionCode debe ser un entero ≥ 1.", fix: "npm run twa:bump" });
}

const fingerprints = Array.isArray(cfg.signingKeyFingerprints) ? cfg.signingKeyFingerprints : [];

/* Comprobamos que el manifest web tiene lo que Bubblewrap da por hecho. */
const iconOf = (purpose) =>
  (manifest.icons || []).find(
    (i) => String(i.purpose || "any").includes(purpose) && String(i.sizes || "").includes("512")
  );
const icon = iconOf("any");
const maskable = iconOf("maskable");
if (!icon) {
  problems.push({
    what: "El manifest no tiene un icono de 512x512 con purpose 'any'.",
    fix: "npm run icons",
  });
}

if (problems.length) {
  console.error("\n  \x1b[31mNo se puede generar la configuración de Android:\x1b[0m\n");
  for (const p of problems) console.error(`   ✗ ${p.what}\n     → ${p.fix}\n`);
  process.exit(1);
}

const origin = `https://${cfg.host}`;

/* ---------- 4. twa-manifest.json (lo consume Bubblewrap) ---------- */
const twaManifest = {
  packageId: cfg.applicationId,
  host: cfg.host,
  name: manifest.name,
  launcherName: manifest.short_name || manifest.name,
  display: manifest.display || "standalone",
  orientation: manifest.orientation || "portrait",
  themeColor: manifest.theme_color || "#FFFFFF",
  themeColorDark: manifest.theme_color || "#000000",
  backgroundColor: manifest.background_color || "#FFFFFF",
  // Barra de navegación del sistema en claro, a juego con el fondo de la app.
  navigationColor: manifest.background_color || "#FFFFFF",
  navigationColorDark: manifest.theme_color || "#000000",
  navigationDividerColor: manifest.background_color || "#FFFFFF",
  navigationDividerColorDark: manifest.theme_color || "#000000",
  startUrl: manifest.start_url || "/",
  iconUrl: `${origin}${icon.src}`,
  maskableIconUrl: maskable ? `${origin}${maskable.src}` : undefined,
  webManifestUrl: `${origin}/manifest.webmanifest`,
  fullScopeUrl: `${origin}${manifest.scope || "/"}`,
  appVersionName: pkg.version,
  appVersionCode: cfg.versionCode,
  minSdkVersion: cfg.minSdkVersion || 23,
  // El .aab se firma con esta clave. La crea el usuario (lleva contraseña) y NO se versiona.
  signingKey: { path: KEYSTORE, alias: "android" },
  splashScreenFadeOutDuration: 300,
  enableNotifications: false,
  // Atajo "Configuración del sitio" en el menú largo del icono: lo exige la política de Play
  // para que el usuario pueda gestionar los permisos web que concede la app.
  enableSiteSettingsShortcut: true,
  // Si no se puede verificar el dominio, abrir en Custom Tabs (con barra) en vez de fallar.
  fallbackType: "customtabs",
  isChromeOSOnly: false,
  isMetaQuest: false,
  shortcuts: (cfg.shortcuts || []).map((s) => ({
    name: s.name,
    short_name: s.shortName || s.name,
    url: s.url,
    icons: [{ sizes: "192x192", src: `${origin}${s.icon}` }],
  })),
  generatorApp: "twa-sync (scripts/twa-sync.mjs)",
  features: {},
  alphaDependencies: { enabled: false },
};

// Quitamos las claves sin valor para no ensuciar el archivo.
for (const k of Object.keys(twaManifest)) if (twaManifest[k] === undefined) delete twaManifest[k];

/* ---------- 5. assetlinks.json (Digital Asset Links) ---------- */
const assetLinks = [
  {
    relation: ["delegate_permission/common.handle_all_urls"],
    target: {
      namespace: "android_app",
      package_name: cfg.applicationId,
      sha256_cert_fingerprints: fingerprints,
    },
  },
];

/* ---------- 6. escribir (o solo validar) ---------- */
if (has("check")) {
  if (!fingerprints.length) {
    die(
      "No hay ninguna huella SHA-256 registrada.",
      "La app se abriría con la barra de URL de Chrome. Ver PLAY_STORE.md, paso 3."
    );
  }
  ok(`Configuración válida — ${cfg.applicationId} v${pkg.version} (${cfg.versionCode}) en ${origin}`);
  process.exit(0);
}

fs.mkdirSync(path.dirname(OUT_LINKS), { recursive: true });
fs.mkdirSync(path.dirname(OUT_TWA), { recursive: true });
fs.writeFileSync(OUT_TWA, JSON.stringify(twaManifest, null, 2) + "\n");
fs.writeFileSync(OUT_LINKS, JSON.stringify(assetLinks, null, 2) + "\n");

ok(`android/twa-manifest.json → ${cfg.applicationId} v${pkg.version} (versionCode ${cfg.versionCode})`);
ok(`public/.well-known/assetlinks.json → ${fingerprints.length} huella(s)`);

if (!fingerprints.length) {
  console.log("");
  warn("Sin huellas SHA-256 todavía: la app se abrirá con la barra de URL de Chrome encima.");
  warn("Se añaden en dos momentos (ver PLAY_STORE.md, paso 3):");
  warn("  1) al crear el keystore   → keytool -list -v -keystore android.keystore -alias android");
  warn("  2) tras subir el primer .aab → Play Console → Firma de aplicaciones");
}
console.log("");
