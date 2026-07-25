import React from "react";
import { createRoot } from "react-dom/client";
import Root from "./Root";
import "./index.css";

createRoot(document.getElementById("root")).render(<Root />);

/* Service worker: arranque rápido y tolerante a cortes de red.
   Solo en producción, para no cachear nada mientras se desarrolla. */
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}
