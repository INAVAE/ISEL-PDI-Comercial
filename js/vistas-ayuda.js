/* ===========================================================================
   CENTRO DE AYUDA

   Manual consultable sin salir de la herramienta, preguntas frecuentes,
   diagnóstico de fallas y el buzón por donde el equipo reporta errores o
   pide cambios. Cualquier rol entra aquí; la bandeja de observaciones
   recibidas la ve solo el administrador.
   =========================================================================== */

import { sugerencias as dbSug, SIN_BUZON } from "./db.js";
import { AYUDA, SUG_TIPO, SUG_PISTA, SUG_ESTADO } from "./ayuda.js";
import {
  h, panel, boton, campo, entrada, area, seleccion, aviso, lampara, vacio,
  tabla, fecha, cls, etiquetaRol,
} from "./ui.js";

const TABS = [
  ["guia", "Guía paso a paso"],
  ["faq", "Preguntas frecuentes"],
  ["fallas", "Si algo falla"],
  ["buzon", "Enviar una observación"],
];

export function vistaAyuda(ctx) {
  const { estado, permisos } = ctx;
  const esAdmin = permisos.esAdmin;
  const ui = estado.ui;
  if (!ui.ayudaTab) ui.ayudaTab = "guia";

  const cont = h("div", { class: "vista vista-ayuda" });

  const pintar = () => {
    cont.replaceChildren();
    const tab = ui.ayudaTab;
    const pendientes = estado.sugPendientes || 0;
    const pestanas = TABS.concat(esAdmin
      ? [["bandeja", "Observaciones recibidas" + (pendientes ? ` (${pendientes})` : "")]]
      : []);

    cont.appendChild(h("div", { class: "ayuda-enc" },
      h("div", {},
        h("h2", { text: "Ayuda" }),
        h("p", { class: "sub", text: "Manual, preguntas frecuentes y buzón de observaciones" }))));

    cont.appendChild(h("div", { class: "tabs" }, ...pestanas.map(([k, t]) =>
      h("button", {
        class: cls("tab", tab === k && "activo"),
        onclick: () => { ui.ayudaTab = k; pintar(); },
      }, t))));

    cont.appendChild(
      tab === "faq" ? seccionFaq(ui, pintar)
        : tab === "fallas" ? seccionFallas()
          : tab === "buzon" ? seccionBuzon(ctx, pintar)
            : tab === "bandeja" ? seccionBandeja(ctx, pintar)
              : seccionGuia(ui, pintar));
  };

  pintar();
  return cont;
}

/* ------------------------------------------------------------- GUÍA ------ */

function seccionGuia(ui, pintar) {
  const abierto = ui.ayudaCap;
  return panel(null, `${AYUDA.guia.length} capítulos, del primer ingreso a la administración del programa. Pulsa uno para abrirlo.`,
    ...AYUDA.guia.map((c) => acordeon({
      abierto: abierto === c.id,
      titulo: c.titulo,
      nota: c.para,
      alPulsar: () => { ui.ayudaCap = abierto === c.id ? null : c.id; pintar(); },
      cuerpo: () => h("div", {},
        h("ol", { class: "ay-pasos" }, ...c.pasos.map(([t, d]) =>
          h("li", {}, h("b", { text: t + ". " }), d))),
        c.ojo ? h("div", { class: "ay-ojo" }, h("b", { text: "Ten en cuenta. " }), c.ojo) : null),
    })));
}

/* -------------------------------------------- PREGUNTAS FRECUENTES ------- */

function seccionFaq(ui, pintar) {
  return panel(null, "Lo que más se pregunta. Si lo tuyo no está aquí, mándalo por el buzón y lo agregamos.",
    ...AYUDA.faq.map(([q, r], i) => acordeon({
      abierto: ui.ayudaFaq === i,
      titulo: q,
      alPulsar: () => { ui.ayudaFaq = ui.ayudaFaq === i ? null : i; pintar(); },
      cuerpo: () => h("p", { text: r }),
    })));
}

/* --------------------------------------------------- SI ALGO FALLA ------- */

function seccionFallas() {
  return panel(null, "Qué hacer cuando algo no responde como debería. Busca el síntoma, no la causa: la causa viene explicada.",
    tabla(["Qué ves", "Por qué pasa", "Cómo se arregla"],
      AYUDA.fallas.map(([s, c, a]) => h("tr", {},
        h("td", {}, h("b", { text: s })),
        h("td", { class: "gris", text: c }),
        h("td", { text: a })))),
    h("div", { class: "ay-ojo" },
      h("b", { text: "Si nada de esto lo resuelve. " }),
      "Mándalo por el buzón con el mayor detalle que puedas: en qué pantalla estabas, qué pulsaste y qué apareció. El sistema adjunta solo el navegador y el tamaño de la ventana."));
}

/* --------------------------------------------------------- BUZÓN --------- */

function seccionBuzon(ctx, pintar) {
  const { estado } = ctx;
  const f = estado.ui.sugForm || (estado.ui.sugForm = { tipo: "mejora", pantalla: "", titulo: "", detalle: "" });
  const mias = (estado.sugerencias || []).filter((x) => x.user_id === estado.perfil.id);

  const error = h("p", { class: "login-error" });
  const btn = boton("Enviar la observación", async () => {
    error.textContent = "";
    if (!f.titulo.trim()) { error.textContent = "Escribe en una línea qué pasa."; return; }
    if (!f.detalle.trim()) { error.textContent = "Cuéntalo con detalle: sin eso es difícil resolverlo."; return; }
    btn.disabled = true; btn.textContent = "Enviando…";
    try {
      await dbSug.crear(estado.perfil, f);
      estado.ui.sugForm = { tipo: "mejora", pantalla: "", titulo: "", detalle: "" };
      await recargarSugerencias(ctx);
      aviso("Gracias. Tu observación ya le llegó al administrador");
      ctx.repintar();
    } catch (e) {
      error.textContent = e.message === SIN_BUZON
        ? "El buzón todavía no está instalado en la base de datos. Avísale al administrador."
        : e.message;
      btn.disabled = false; btn.textContent = "Enviar la observación";
    }
  }, "principal");

  return h("div", { class: "grid-2 ayuda-buzon" },
    panel("Reportar algo o pedir un cambio",
      "Llega firmado con tu nombre, para poder preguntarte si algo no queda claro. Solo tú y el administrador lo verán.",
      h("div", { class: "campos" },
        campo("De qué se trata", (() => {
          const s = seleccion(f.tipo, Object.keys(SUG_TIPO).map((k) => ({ id: k, nombre: SUG_TIPO[k] })),
            (v) => { f.tipo = v; pintar(); });
          return s;
        })()),
        campo("En qué pantalla", entrada(f.pantalla, (v) => { f.pantalla = v; },
          { placeholder: "Panel, Ruta de 20 semanas, KPIs…" }))),
      h("p", { class: "tiny", text: SUG_PISTA[f.tipo] || "" }),
      campo("En una línea, qué pasa", entrada(f.titulo, (v) => { f.titulo = v; },
        { placeholder: "El botón de evidencia no abre nada", maxlength: 140 }), "full"),
      campo("Cuéntalo con detalle", area(f.detalle, (v) => { f.detalle = v; }, 6,
        { placeholder: "Qué hiciste, qué esperabas que pasara y qué pasó en realidad." }), "full"),
      h("p", { class: "tiny", text: "Entre más concreto, más rápido se resuelve. Si fue un error, di qué pulsaste justo antes." }),
      error,
      h("div", { class: "acciones-fila" }, btn)),

    panel("Lo que has mandado",
      mias.length ? `${mias.length} ${mias.length === 1 ? "observación" : "observaciones"}. Aquí verás si ya la atendieron.` : null,
      mias.length
        ? h("div", {}, ...mias.map((x) => tarjetaSug(x, false)))
        : vacio("Todavía no has mandado ninguna", "Cuando mandes una, aparecerá aquí con su estado.")));
}

/* ------------------------------------------- BANDEJA DEL ADMINISTRADOR --- */

function seccionBandeja(ctx, pintar) {
  const { estado } = ctx;
  const todas = estado.sugerencias || [];
  const filtro = estado.ui.sugFiltro || "";
  const lista = filtro ? todas.filter((x) => x.estado === filtro) : todas;
  const cuenta = (k) => todas.filter((x) => x.estado === k).length;

  const cambiar = async (x, campos) => {
    try {
      await dbSug.actualizar(x.id, campos, estado.perfil.id);
      await recargarSugerencias(ctx);
      aviso("Observación actualizada");
      ctx.repintar();
    } catch (e) { aviso(e.message, "error"); }
  };

  return panel("Lo que ha mandado el equipo",
    "Cambiar el estado le avisa a quien la escribió: la verá en su propia pestaña del buzón, con tu respuesta si la escribes.",
    h("div", { class: "campos" },
      campo("Estado", seleccion(filtro,
        [{ id: "", nombre: `Todas (${todas.length})` },
          ...Object.keys(SUG_ESTADO).map((k) => ({ id: k, nombre: `${SUG_ESTADO[k].k} (${cuenta(k)})` }))],
        (v) => { estado.ui.sugFiltro = v; pintar(); }))),

    lista.length
      ? h("div", {}, ...lista.map((x) => {
        const resp = h("textarea", {
          class: "ay-resp", rows: 2, placeholder: "Escribe una respuesta para quien la mandó…",
        });
        resp.value = x.respuesta || "";
        return h("div", { class: "ay-sug" },
          tarjetaSug(x, true, true),
          resp,
          h("div", { class: "acciones-fila ay-sug-acciones" },
            ...Object.keys(SUG_ESTADO).filter((k) => k !== x.estado).map((k) =>
              boton(SUG_ESTADO[k].k, () => cambiar(x, { estado: k, respuesta: resp.value.trim() || null }), "ghost")),
            boton("Guardar la respuesta", () => cambiar(x, { respuesta: resp.value.trim() || null }), "ghost")));
      }))
      : vacio(filtro ? "Sin observaciones en ese estado" : "Sin observaciones todavía",
        "Cuando alguien mande una desde el buzón, aparecerá aquí."));
}

/* ------------------------------------------------------------ PIEZAS ----- */

function tarjetaSug(x, conAutor, desnudo) {
  const e = SUG_ESTADO[x.estado] || SUG_ESTADO.nueva;
  const ctxDato = x.contexto || {};
  const cuerpo = [
    h("div", { class: "ay-sug-h" },
      lampara(e.estado, e.k),
      h("span", { class: "tiny", text: (SUG_TIPO[x.tipo] || x.tipo) + (x.pantalla ? " · " + x.pantalla : "") }),
      h("span", { class: "tiny ay-sug-fecha", text: x.creado_en ? fecha(String(x.creado_en).slice(0, 10)) : "" })),
    h("div", { class: "ay-sug-t", text: x.titulo }),
    conAutor ? h("div", { class: "tiny" },
      "de ", h("b", { text: x.autor || "" }),
      x.rol ? " · " + etiquetaRol(x.rol) : "",
      x.autor_email ? " · " + x.autor_email : "") : null,
    h("div", { class: "ay-sug-d", text: x.detalle }),
    ctxDato.navegador ? h("div", { class: "tiny ay-sug-ctx", text: navegadorCorto(ctxDato.navegador) }) : null,
    x.respuesta ? h("div", { class: "ay-sug-r" },
      h("b", { text: "Respuesta del administrador. " }), x.respuesta) : null,
  ];
  return desnudo ? h("div", {}, ...cuerpo) : h("div", { class: "ay-sug" }, ...cuerpo);
}

/* El user agent completo es ilegible; interesa el navegador y el sistema. */
function navegadorCorto(ua) {
  const nav = /Edg\//.test(ua) ? "Edge"
    : /OPR\//.test(ua) ? "Opera"
      : /Chrome\//.test(ua) ? "Chrome"
        : /Firefox\//.test(ua) ? "Firefox"
          : /Safari\//.test(ua) ? "Safari" : "Navegador desconocido";
  const so = /Windows/.test(ua) ? "Windows"
    : /Android/.test(ua) ? "Android"
      : /iPhone|iPad/.test(ua) ? "iOS"
        : /Mac OS X/.test(ua) ? "macOS"
          : /Linux/.test(ua) ? "Linux" : "";
  return [nav, so].filter(Boolean).join(" · ");
}

function acordeon({ abierto, titulo, nota, alPulsar, cuerpo }) {
  return h("div", { class: cls("ay-cap", abierto && "abierto") },
    h("button", { class: "ay-cap-h", onclick: alPulsar },
      h("span", { class: "ay-cap-t" },
        h("span", { class: "ay-n", text: titulo }),
        nota ? h("span", { class: "tiny", text: nota }) : null),
      h("span", { class: "ay-mas", text: abierto ? "−" : "+" })),
    abierto ? h("div", { class: "ay-cap-b" }, cuerpo()) : null);
}

/* Se exporta para que el arranque y el envío compartan una sola forma de
   recargar: así el contador del botón de ayuda nunca queda desfasado. */
export async function recargarSugerencias(ctx) {
  const { estado, permisos } = ctx;
  try {
    estado.sugerencias = await dbSug.listar();
    estado.sugPendientes = permisos.esAdmin
      ? estado.sugerencias.filter((x) => x.estado === "nueva").length
      : 0;
  } catch (e) {
    estado.sugerencias = [];
    estado.sugPendientes = 0;
    if (e.message !== SIN_BUZON) console.error(e);
  }
}
