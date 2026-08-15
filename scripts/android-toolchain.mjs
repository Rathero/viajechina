/* Instala lo necesario para compilar el .aab: JDK 17 + Android SDK.

   Bubblewrap sabe instalarlos, pero solo preguntando por consola, lo que impide
   automatizarlo y repetirlo en otra máquina. Esto hace lo mismo sin preguntar y
   deja la configuración donde Bubblewrap la busca (~/.bubblewrap/config.json),
   así que después `bubblewrap` funciona sin más.

   Uso:
     node scripts/android-toolchain.mjs          instala lo que falte
     node scripts/android-toolchain.mjs --force  reinstala aunque ya esté

   Ocupa algo menos de 1 GB y se instala FUERA del repositorio, en
   ~/.bubblewrap/. Solo hay que ejecutarlo una vez por equipo. */

import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync } from "node:child_process";
import { util } from "@bubblewrap/core";

/* Versiones: las mismas que da por buenas Bubblewrap. build-tools y la
   plataforma salen de su plantilla de Gradle (compileSdk 36). */
const JDK_VERSION = "17.0.11+9";
const BUILD_TOOLS = "36.1.0";
const PLATFORM = "android-36";

const HOME = os.homedir();
const BASE = path.join(HOME, ".bubblewrap");
const JDK_ROOT = path.join(BASE, "jdk");
const JDK_PATH = path.join(JDK_ROOT, `jdk-${JDK_VERSION}`);
const SDK_PATH = path.join(BASE, "android_sdk");
const CONFIG = path.join(BASE, "config.json");

const force = process.argv.includes("--force");
const say = (m) => console.log(`  ${m}`);
const step = (m) => console.log(`\n\x1b[1m▸ ${m}\x1b[0m`);

/* ---------- descarga con barra de progreso ---------- */
async function download(url, dest) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} al descargar ${url}`);

  const total = Number(res.headers.get("content-length") || 0);
  const out = fs.createWriteStream(dest);
  let done = 0;
  let lastShown = 0;

  for await (const chunk of res.body) {
    done += chunk.length;
    if (!out.write(chunk)) await new Promise((r) => out.once("drain", r));
    // Un aviso por cada 10 MB: suficiente para ver que avanza, sin inundar el log.
    if (done - lastShown > 10 * 1024 * 1024) {
      lastShown = done;
      const mb = (done / 1048576).toFixed(0);
      say(total ? `  ${mb} MB / ${(total / 1048576).toFixed(0)} MB` : `  ${mb} MB`);
    }
  }
  await new Promise((r) => out.end(r));
  return dest;
}

/** Devuelve la primera URL de la lista que exista (para versiones que cambian con el tiempo). */
async function firstAvailable(urls) {
  for (const url of urls) {
    try {
      const res = await fetch(url, { method: "HEAD", redirect: "follow" });
      if (res.ok) return url;
    } catch (_) {
      /* probamos la siguiente */
    }
  }
  return null;
}

/* ---------- 1. JDK 17 ---------- */
async function installJdk() {
  // El archivo "release" es justo lo que Bubblewrap mira para validar un JDK.
  if (!force && fs.existsSync(path.join(JDK_PATH, "release"))) {
    say(`Ya instalado en ${JDK_PATH}`);
    return JDK_PATH;
  }

  const tag = `jdk-${encodeURIComponent(JDK_VERSION)}`;
  const v = JDK_VERSION.replace("+", "_");
  const plat = process.platform;
  const arch = process.arch;

  /* Bubblewrap descarga el JDK de 32 bits en Windows; usamos el de 64 porque
     Gradle se queda sin memoria con la JVM de 32 bits en proyectos reales. */
  const file =
    plat === "win32"
      ? `OpenJDK17U-jdk_x64_windows_hotspot_${v}.zip`
      : plat === "darwin"
        ? `OpenJDK17U-jdk_${arch === "arm64" ? "aarch64" : "x64"}_mac_hotspot_${v}.tar.gz`
        : `OpenJDK17U-jdk_x64_linux_hotspot_${v}.tar.gz`;

  const url = `https://github.com/adoptium/temurin17-binaries/releases/download/${tag}/${file}`;
  const local = path.join(JDK_ROOT, file);

  say(`Descargando ${file} (~190 MB)…`);
  await download(url, local);
  say("Descomprimiendo…");
  fs.mkdirSync(JDK_ROOT, { recursive: true });
  await (file.endsWith(".zip") ? util.unzipFile : util.untar)(local, JDK_ROOT, true);

  if (!fs.existsSync(path.join(JDK_PATH, "release"))) {
    throw new Error(`El JDK no quedó donde se esperaba: ${JDK_PATH}`);
  }
  say(`Instalado en ${JDK_PATH}`);
  return JDK_PATH;
}

/* ---------- 2. Android SDK (command line tools) ---------- */
async function installSdkTools() {
  /* Bubblewrap busca sdkmanager en <sdk>/bin o en <sdk>/tools/bin, así que el
     contenido de cmdline-tools va directo a la raíz del SDK. Bubblewrap siempre
     le pasa --sdk_root, que es lo que sdkmanager necesita para saber dónde
     instalar los paquetes desde esa ubicación. */
  const bin = path.join(SDK_PATH, "bin");
  if (!force && fs.existsSync(bin)) {
    say(`Ya instalado en ${SDK_PATH}`);
    return SDK_PATH;
  }

  const suffix = process.platform === "win32" ? "win" : process.platform === "darwin" ? "mac" : "linux";
  /* El número es el build de las herramientas y cambia cada pocos meses; probamos
     de más nueva a más antigua y nos quedamos con la primera que siga publicada. */
  const builds = ["13114758", "12266719", "11076708", "10406996", "9477386"];
  const url = await firstAvailable(
    builds.map((b) => `https://dl.google.com/android/repository/commandlinetools-${suffix}-${b}_latest.zip`)
  );
  if (!url) throw new Error("No se ha podido localizar ninguna versión de las Android command line tools.");

  const local = path.join(BASE, path.basename(url));
  say(`Descargando ${path.basename(url)} (~130 MB)…`);
  await download(url, local);

  say("Descomprimiendo…");
  const tmp = path.join(BASE, "_cmdline_tmp");
  fs.rmSync(tmp, { recursive: true, force: true });
  await util.unzipFile(local, tmp, true);

  // El zip trae una carpeta cmdline-tools/ con bin/ y lib/ dentro.
  const inner = path.join(tmp, "cmdline-tools");
  const src = fs.existsSync(inner) ? inner : tmp;
  fs.mkdirSync(SDK_PATH, { recursive: true });
  for (const entry of fs.readdirSync(src)) {
    fs.cpSync(path.join(src, entry), path.join(SDK_PATH, entry), { recursive: true, force: true });
  }
  fs.rmSync(tmp, { recursive: true, force: true });

  say(`Instalado en ${SDK_PATH}`);
  return SDK_PATH;
}

/* ---------- 3. licencias ---------- */
function acceptLicenses() {
  /* sdkmanager pide aceptar las licencias por consola. Aceptarlas equivale a
     dejar estos ficheros con el hash de cada una; es la forma estándar de
     hacerlo en integración continua. Son las licencias públicas del SDK de
     Android, las mismas que muestra `sdkmanager --licenses`. */
  const dir = path.join(SDK_PATH, "licenses");
  fs.mkdirSync(dir, { recursive: true });
  const licenses = {
    "android-sdk-license": [
      "8933bad161af4178b1185d1a37fbf41ea5269c55",
      "d56f5187479451eabf01fb78af6dfcb131a6481e",
      "24333f8a63b6825ea9c5514f83c2829b004d1fee",
    ],
    "android-sdk-preview-license": ["84831b9409646a918e30573bab4c9c91346d8abd"],
    "android-sdk-arm-dbt-license": ["859f317696f67ef3d7f30a50a5560e7834b43903"],
  };
  for (const [name, hashes] of Object.entries(licenses)) {
    fs.writeFileSync(path.join(dir, name), "\n" + hashes.join("\n") + "\n");
  }
  say(`Licencias del SDK aceptadas (${Object.keys(licenses).length} ficheros).`);
}

/* ---------- 4. paquetes ---------- */
function installPackages(jdkPath) {
  const sdkmanager = path.join(SDK_PATH, "bin", process.platform === "win32" ? "sdkmanager.bat" : "sdkmanager");
  if (!fs.existsSync(sdkmanager)) throw new Error(`No se encuentra sdkmanager en ${sdkmanager}`);

  const pkgs = ["platform-tools", `platforms;${PLATFORM}`, `build-tools;${BUILD_TOOLS}`];
  say(`Instalando: ${pkgs.join(", ")} (~400 MB)…`);

  // Entrecomillado porque con shell:true el intérprete parte la ruta por los espacios.
  execFileSync(`"${sdkmanager}"`, [`"--sdk_root=${SDK_PATH}"`, ...pkgs], {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, JAVA_HOME: jdkPath, ANDROID_HOME: SDK_PATH, ANDROID_SDK_ROOT: SDK_PATH },
  });
}

/* ---------- 5. dejarlo apuntado donde Bubblewrap lo busca ---------- */
function writeConfig(jdkPath) {
  fs.mkdirSync(BASE, { recursive: true });
  fs.writeFileSync(CONFIG, JSON.stringify({ jdkPath, androidSdkPath: SDK_PATH }, null, 2) + "\n");
  say(`Escrito ${CONFIG}`);
}

/* ---------- orquestación ---------- */
try {
  step("JDK 17 (Temurin)");
  const jdkPath = await installJdk();

  step("Android SDK — command line tools");
  await installSdkTools();

  step("Licencias del SDK");
  acceptLicenses();

  step(`Paquetes del SDK (build-tools ${BUILD_TOOLS}, ${PLATFORM})`);
  installPackages(jdkPath);

  step("Configuración de Bubblewrap");
  writeConfig(jdkPath);

  console.log("\n\x1b[32m✓ Toolchain de Android listo.\x1b[0m");
  console.log("  Comprobación:  npx bubblewrap doctor\n");
} catch (e) {
  console.error(`\n\x1b[31m✗ ${e.message}\x1b[0m\n`);
  process.exit(1);
}
