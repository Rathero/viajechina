/* Genera el .aab que se sube a Google Play.

   Encadena lo que hay que hacer en orden y con comprobaciones antes, porque
   Bubblewrap falla tarde y con mensajes poco claros si algo no está listo:

     1. regenera android/twa-manifest.json desde twa.config.json
     2. valida que hay dominio y huellas SHA-256
     3. `bubblewrap update` → genera el proyecto Android dentro de android/
     4. `bubblewrap build`  → compila y firma; pide la contraseña del keystore

   Uso:
     node scripts/android.mjs build        el flujo completo
     node scripts/android.mjs update       solo regenerar el proyecto Android
     node scripts/android.mjs doctor       comprobar JDK y Android SDK
     node scripts/android.mjs keystore     crear la clave de firma
     node scripts/android.mjs fingerprint  leer su huella SHA-256 y registrarla

   El paso 3 descarga el icono desde el dominio de producción, así que la web
   tiene que estar desplegada antes de compilar. */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = process.cwd();
const ANDROID_DIR = path.join(ROOT, "android");
const MANIFEST = path.join(ANDROID_DIR, "twa-manifest.json");
const KEYSTORE = path.join(ROOT, "android.keystore");

const cmd = process.argv[2] || "build";
const step = (m) => console.log(`\n\x1b[1m▸ ${m}\x1b[0m`);
const die = (m, hint) => {
  console.error(`\n  \x1b[31m✗ ${m}\x1b[0m`);
  if (hint) console.error(`    ${hint}`);
  console.error("");
  process.exit(1);
};

/* Ejecuta un comando heredando la consola, para que los prompts de contraseña
   funcionen. Hace falta shell:true por los .cmd de Windows, y entonces la ruta
   del ejecutable la parte el shell por los espacios ("C:\Program Files\…"),
   así que se entrecomilla siempre. */
const quote = (s) => (/\s/.test(s) && !s.startsWith('"') ? `"${s}"` : s);

function run(bin, args, opts = {}) {
  const res = spawnSync(quote(bin), args, { stdio: "inherit", shell: true, cwd: ROOT, ...opts });
  if (res.status !== 0) die(`Falló: ${bin} ${args.join(" ")}`);
}

const bubblewrap = path.join(
  ROOT,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "bubblewrap.cmd" : "bubblewrap"
);

if (!fs.existsSync(bubblewrap)) die("Falta Bubblewrap.", "npm install");

/* ---------- doctor ---------- */
if (cmd === "doctor") {
  run(bubblewrap, ["doctor"]);
  process.exit(0);
}

/* ---------- keytool: crear la clave y leer su huella ---------- */
/* keytool viene con el JDK que instala scripts/android-toolchain.mjs. */
function keytoolPath() {
  const cfgFile = path.join(os.homedir(), ".bubblewrap", "config.json");
  if (!fs.existsSync(cfgFile)) die("Falta el toolchain de Android.", "npm run android:setup");
  const { jdkPath } = JSON.parse(fs.readFileSync(cfgFile, "utf8"));
  const bin = path.join(jdkPath, "bin", process.platform === "win32" ? "keytool.exe" : "keytool");
  if (!fs.existsSync(bin)) die(`No se encuentra keytool en ${bin}.`, "npm run android:setup");
  return bin;
}

if (cmd === "keystore") {
  if (fs.existsSync(KEYSTORE)) {
    die(
      "Ya existe android.keystore.",
      "NO lo sobrescribas: si esta app ya está en Play, perderías la clave con la que se firma."
    );
  }
  console.log("\n\x1b[1m▸ Crear la clave de firma\x1b[0m");
  console.log("  keytool te va a pedir una contraseña y algunos datos (nombre, organización,");
  console.log("  país…). Los datos dan igual para Play; la contraseña NO: guárdala en tu");
  console.log("  gestor de contraseñas junto con una copia de android.keystore.\n");

  // 10000 días ≈ 27 años. Play exige que la clave caduque después de 2033.
  run(keytoolPath(), [
    "-genkeypair", "-v",
    "-keystore", `"${KEYSTORE}"`,
    "-alias", "android",
    "-keyalg", "RSA",
    "-keysize", "2048",
    "-validity", "10000",
  ]);

  console.log("\n\x1b[32m✓ Clave creada:\x1b[0m android.keystore (ignorada por git)");
  console.log("  \x1b[33mHaz una copia de seguridad FUERA del repositorio ahora mismo.\x1b[0m");
  console.log("  Siguiente:  npm run android:fingerprint\n");
  process.exit(0);
}

if (cmd === "fingerprint") {
  if (!fs.existsSync(KEYSTORE)) die("No existe android.keystore.", "npm run android:keystore");

  console.log("\n\x1b[1m▸ Huella SHA-256 de la clave de subida\x1b[0m");
  console.log("  Escribe la contraseña del keystore y pulsa Enter.");
  console.log("  (No se verá mientras la tecleas; es lo normal.)\n");

  const res = spawnSync(quote(keytoolPath()), ["-list", "-v", "-keystore", `"${KEYSTORE}"`, "-alias", "android"], {
    // stdin heredado para poder teclear la contraseña; stdout capturado para leer la huella.
    stdio: ["inherit", "pipe", "inherit"],
    shell: true,
    encoding: "utf8",
  });

  const match = /SHA256:\s*([0-9A-Fa-f:]{95})/.exec(res.stdout || "");
  if (!match) {
    console.error("\n  \x1b[31m✗ No se ha podido leer la huella.\x1b[0m");
    console.error("    Ejecuta el comando a mano, copia la línea SHA256 y regístrala con:");
    console.error("      npm run twa:fingerprint -- AA:BB:CC:…\n");
    process.exit(1);
  }

  console.log(`\n  SHA-256: ${match[1]}`);
  run(process.execPath, ["scripts/twa-sync.mjs", "--fingerprint", match[1]]);
  console.log("  Falta la segunda huella, la de Google, tras subir el primer .aab.");
  console.log("  Ver PLAY_STORE.md, paso 5.\n");
  process.exit(0);
}

/* ---------- 1 y 2: configuración ---------- */
step("Configuración");
run(process.execPath, ["scripts/twa-sync.mjs"]);
run(process.execPath, ["scripts/twa-sync.mjs", "--check"]);

/* ---------- 3: proyecto Android ---------- */
step("Proyecto Android");
fs.mkdirSync(ANDROID_DIR, { recursive: true });
if (!fs.existsSync(MANIFEST)) die("No se ha generado android/twa-manifest.json.");

// --skipVersionUpgrade: la versión la manda twa.config.json (npm run twa:bump),
// no Bubblewrap, para que sea un dato del repositorio y no del estado local.
run(bubblewrap, [
  "update",
  "--directory", "android",
  "--manifest", "android/twa-manifest.json",
  "--skipVersionUpgrade",
]);

if (cmd === "update") {
  console.log("\n\x1b[32m✓ Proyecto Android regenerado.\x1b[0m\n");
  process.exit(0);
}

/* ---------- 4: compilar y firmar ---------- */
if (!fs.existsSync(KEYSTORE)) {
  die(
    "No existe la clave de firma (android.keystore).",
    "Créala tú — lleva contraseña y no debe pasar por aquí. Ver PLAY_STORE.md, paso 2."
  );
}

step("Compilar y firmar");
console.log("  Bubblewrap pedirá la contraseña del keystore y la de la clave.\n");
run(bubblewrap, ["build", "--directory", "android", "--manifest", "android/twa-manifest.json"]);

const aab = path.join(ANDROID_DIR, "app-release-bundle.aab");
console.log("");
if (fs.existsSync(aab)) {
  const mb = (fs.statSync(aab).size / 1048576).toFixed(1);
  console.log(`\x1b[32m✓ Listo para subir:\x1b[0m android/app-release-bundle.aab (${mb} MB)`);
  console.log("  Play Console → Producción → Crear versión → subir el .aab\n");
} else {
  console.log("\x1b[33m! Bubblewrap terminó pero no se encuentra el .aab. Revisa la salida.\x1b[0m\n");
}
