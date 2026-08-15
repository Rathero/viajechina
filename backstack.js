/* Botón Atrás de Android.

   La app navega por estado de React, no por URL. En el navegador eso da igual,
   pero empaquetada como app (TWA) el botón Atrás del sistema opera sobre el
   historial: sin esto, estando dentro de un viaje o con un panel abierto, Atrás
   cerraría la aplicación entera de golpe. Google Play lo considera un fallo de
   calidad, y además es lo primero que hace cualquiera para cerrar un diálogo.

   Idea: cada "capa" que se abre (un viaje, un panel, una confirmación, el visor
   de fotos) añade una entrada al historial. Atrás consume esa entrada y cierra
   la capa de arriba. Cuando ya no queda ninguna, Atrás sale de la app, que es
   justo lo que se espera desde la pantalla inicial.

   Se usa con el hook useBackLayer(abierta, cerrar) — ver ejemplos en App.jsx. */

import { useEffect, useRef } from "react";

const layers = []; // LIFO de funciones de cierre; la última es la capa visible
let owned = 0; // entradas de historial añadidas por nosotros
let selfPop = 0; // popstate provocados por nuestro propio history.back()
let installed = false;

function install() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  window.addEventListener("popstate", () => {
    // Atrás disparado por nosotros al cerrar una capa desde la interfaz: ya está gestionado.
    if (selfPop > 0) {
      selfPop--;
      return;
    }

    if (owned > 0) owned--;

    const close = layers.pop();
    if (close) {
      close();
      return;
    }

    /* Entrada huérfana: una capa se cerró estando por debajo de otra, así que
       sobra una entrada de historial. La saltamos aquí para que el usuario no
       tenga que pulsar Atrás dos veces. Si el historial ya está al principio,
       history.back() no hace nada y la cadena se corta sola. */
    if (owned > 0) window.history.back();
  });
}

/** Abre una capa: añade una entrada de historial que Atrás consumirá. */
export function pushLayer(close) {
  install();
  layers.push(close);
  owned++;
  window.history.pushState({ layer: layers.length }, "");
}

/** Cierra una capa desde la interfaz (botón X, tocar el fondo, guardar…). */
export function popLayer(close) {
  const i = layers.lastIndexOf(close);
  if (i === -1) return; // ya la había cerrado el botón Atrás
  layers.splice(i, 1);

  // Solo devolvemos la entrada de historial si era la de arriba; si no, queda
  // huérfana y la absorbe el popstate de install().
  if (i === layers.length) {
    owned--;
    selfPop++;
    window.history.back();
  }
}

/**
 * Engancha una capa de interfaz al botón Atrás.
 *
 * @param {boolean}  active  si la capa está abierta ahora mismo
 * @param {Function} onClose cómo cerrarla; lo llama el botón Atrás
 *
 * Ejemplo:  useBackLayer(drawerOpen, () => setDrawerOpen(false));
 */
export function useBackLayer(active, onClose) {
  // Guardamos el callback en una ref para que redefinirlo en cada render no
  // reabra la capa (y no descuadre la pila).
  const ref = useRef(onClose);
  ref.current = onClose;

  useEffect(() => {
    if (!active) return;
    const close = () => ref.current && ref.current();
    pushLayer(close);
    return () => popLayer(close);
  }, [active]);
}
