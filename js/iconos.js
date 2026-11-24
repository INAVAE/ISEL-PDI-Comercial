/* ===========================================================================
   Iconos del menú

   Dibujados a trazo y no a relleno: a 18 píxeles sobre el riel oscuro, una
   silueta rellena se empasta y deja de distinguirse de la de al lado. Todos
   comparten la misma caja de 24 y el mismo grosor para que ninguno se vea
   más pesado que sus vecinos, que es lo que delata un juego de iconos
   tomado de dos lados distintos.

   Van aquí y no en ui.js porque son datos, no comportamiento: una tabla de
   trazos que crece cada vez que se agrega un módulo.
   =========================================================================== */

const TRAZOS = {
  /* Gestión */
  resumen: ["M3.5 20.5h17", "M6.5 20.5v-7", "M12 20.5V5.5", "M17.5 20.5v-10"],
  colaboradores: [
    "M9.2 11.4a3.3 3.3 0 1 0 0-6.6 3.3 3.3 0 0 0 0 6.6",
    "M2.6 20c0-3.4 3-5.6 6.6-5.6s6.6 2.2 6.6 5.6",
    "M16.4 5.4a3 3 0 0 1 0 5.9",
    "M18.2 14.7c2 .7 3.2 2.3 3.2 4.4",
  ],

  /* Desarrollo */
  panel: ["M3.4 18.5a9 9 0 1 1 17.2 0", "M12 18.5l4.2-5.3", "M12 18.5h.01"],
  ruta: [
    "M9.5 6.5h10", "M9.5 12h10", "M9.5 17.5h10",
    "M4 6.3l1.2 1.3L7.6 5", "M4 11.8l1.2 1.3L7.6 10.5", "M4 17.3l1.2 1.3L7.6 16",
  ],
  visitas: [
    "M12 21.2s6.8-5.8 6.8-10.9a6.8 6.8 0 1 0-13.6 0C5.2 15.4 12 21.2 12 21.2z",
    "M12 12.4a2 2 0 1 0 0-4 2 2 0 0 0 0 4",
  ],
  pipeline: ["M3 4.8h18l-6.9 8v6.6l-4.2 2v-8.6z"],
  cuentas: ["M4 20.8h16", "M6.2 20.8V5.6L12 3.2l5.8 2.4v15.2", "M10 10h4", "M10 14.2h4"],
  kpis: ["M3.2 16.8l5.6-5.6 3.8 3.8 7-7", "M15.4 8h4.2v4.2"],
  competencias: [
    "M12 20.8a8.8 8.8 0 1 0 0-17.6 8.8 8.8 0 0 0 0 17.6",
    "M12 16.4a4.4 4.4 0 1 0 0-8.8 4.4 4.4 0 0 0 0 8.8",
    "M12 13.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3",
  ],
  riesgos: ["M12 3.6 2.9 19.8h18.2z", "M12 9.8v4.3", "M12 17.2h.01"],
  coaching: ["M20.8 14.6a3 3 0 0 1-3 3H8.4l-5.2 3.1V6.4a3 3 0 0 1 3-3h11.6a3 3 0 0 1 3 3z"],
  graduacion: [
    "M2.6 8.8 12 4.3l9.4 4.5L12 13.3z",
    "M6.6 10.7v5.1c0 1.6 2.4 2.9 5.4 2.9s5.4-1.3 5.4-2.9v-5.1",
    "M21.4 8.8v5",
  ],

  /* Administración */
  configuracion: ["M4 8.4h16", "M4 15.6h16", "M9.2 5.8v5.2", "M15 13v5.2"],
  plantilla: ["M6.2 3.2h7l4.8 4.8v12.8H6.2z", "M13.2 3.2v4.8H18", "M9.4 13h5.4", "M9.4 16.8h5.4"],
  usuarios: [
    "M12 3.2l7 2.9v5.4c0 4.2-2.9 7.8-7 9.3-4.1-1.5-7-5.1-7-9.3V6.1z",
    "M9.4 11.9l1.9 1.9 3.5-3.7",
  ],
  recordatorios: ["M18.2 9.4a6.2 6.2 0 1 0-12.4 0c0 5-2 6.6-2 6.6h16.4s-2-1.6-2-6.6", "M13.8 19.6a2 2 0 0 1-3.6 0"],
  cuenta: [
    "M12 20.8a8.8 8.8 0 1 0 0-17.6 8.8 8.8 0 0 0 0 17.6",
    "M12 12.6a3 3 0 1 0 0-6 3 3 0 0 0 0 6",
    "M6.3 18.9c1.1-2.1 3.2-3.4 5.7-3.4s4.6 1.3 5.7 3.4",
  ],

  /* Controles del riel */
  plegar: ["M4.2 4.8h15.6v14.4H4.2z", "M10 4.8v14.4", "M15.6 9.6 13.4 12l2.2 2.4"],
  desplegar: ["M4.2 4.8h15.6v14.4H4.2z", "M10 4.8v14.4", "M13.4 9.6 15.6 12l-2.2 2.4"],
  salir: ["M14.6 4.4h3.2a2 2 0 0 1 2 2v11.2a2 2 0 0 1-2 2h-3.2", "M9.4 15.8 5.6 12l3.8-3.8", "M5.6 12h9.2"],
};

export function icono(nombre, tam = 18) {
  const trazos = TRAZOS[nombre];
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", tam);
  svg.setAttribute("height", tam);
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.8");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("aria-hidden", "true");
  for (const d of trazos || []) {
    const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p.setAttribute("d", d);
    svg.appendChild(p);
  }
  return svg;
}

export const hayIcono = (nombre) => Object.prototype.hasOwnProperty.call(TRAZOS, nombre);
