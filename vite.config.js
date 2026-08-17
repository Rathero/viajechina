import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

const here = (f) => fileURLToPath(new URL(f, import.meta.url));

/* Dos páginas, no una:
     index.html  → landing pública (HTML estático, sin React). Se sirve en  /
     app.html    → la aplicación (React).  Se sirve en  /app  (ver vercel.json)

   Así quien entra en el dominio ve la web comercial —indexable y de carga
   instantánea, sin descargar el bundle— y la app vive en su propia ruta. */

/* En producción Vercel sirve /app y /privacidad sin el .html (cleanUrls, ver
   vercel.json). El servidor de desarrollo de Vite no hace eso, así que en local
   los enlaces de la landing romperían. Este plugin replica el comportamiento
   para que lo que se prueba en `npm run dev` sea lo que se despliega. */
const cleanUrlsEnDev = {
  name: "waynode-clean-urls-dev",
  apply: "serve",
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      const [path, query = ""] = req.url.split("?");
      const suffix = query ? "?" + query : "";
      const PAGINAS = ["/privacidad", "/terminos", "/eliminar-cuenta"];
      if (path === "/app" || path.startsWith("/app/")) req.url = "/app.html" + suffix;
      else if (PAGINAS.includes(path)) req.url = path + ".html" + suffix;
      next();
    });
  },
};

export default defineConfig({
  plugins: [react(), cleanUrlsEnDev],
  build: {
    rollupOptions: {
      input: {
        landing: here("index.html"),
        app: here("app.html"),
      },
    },
  },
});
