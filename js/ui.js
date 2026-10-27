/* ===========================================================================
   Utilidades de interfaz: construcción de nodos, formatos y gráficas en SVG.
   Sin dependencias externas para que la aplicación cargue igual de rápido
   desde GitHub Pages que desde un servidor propio.
   =========================================================================== */

const SVG_NS = "http://www.w3.org/2000/svg";

export function h(tag, props = {}, ...kids) {
  const svg = /^(svg|g|path|circle|line|rect|text|polygon|polyline|tspan)$/.test(tag);
  const el = svg ? document.createElementNS(SVG_NS, tag) : document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === "class") el.setAttribute("class", v);
    else if (k === "html") el.innerHTML = v;
    else if (k === "text") el.textContent = v;
    else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else if (!svg && (k in el) && k !== "list" && typeof v !== "object") el[k] = v;
    else el.setAttribute(k, v);
  }
  for (const kid of kids.flat(3)) {
    if (kid === null || kid === undefined || kid === false) continue;
    el.appendChild(typeof kid === "object" ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

/* Nombre legible de cada rol. Vive aquí y no en app.js porque lo usan
   varias vistas, y traerlo desde app.js crearía una importación circular. */
export const etiquetaRol = (r) =>
  r === "admin" ? "Administrador"
    : r === "mentor" ? "Mentor"
      : r === "lector" ? "Solo lectura"
        : r === "colaborador" ? "Colaborador en desarrollo"
          : "Sin acceso";

export const vaciar = (el) => { while (el.firstChild) el.removeChild(el.firstChild); return el; };
export const uid = () => Math.random().toString(36).slice(2, 10);
export const cls = (...xs) => xs.filter(Boolean).join(" ");

/* ---------------------------------------------------------------- TEMA ---
   Claro u oscuro. Si la persona no ha elegido, se respeta la preferencia
   del sistema operativo y se sigue cualquier cambio que haga ahí.
   -------------------------------------------------------------------------- */

const LLAVE_TEMA = "isel_pdc_tema";

const almacen = {
  leer() { try { return localStorage.getItem(LLAVE_TEMA); } catch { return null; } },
  guardar(v) { try { localStorage.setItem(LLAVE_TEMA, v); } catch { /* modo privado */ } },
};

const prefiereOscuro = () =>
  window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;

export const temaActual = () => document.documentElement.dataset.tema || "claro";

export function aplicarTema(tema) {
  document.documentElement.dataset.tema = tema;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = tema === "oscuro" ? "#0D1317" : "#22303B";
}

export function iniciarTema() {
  const elegido = almacen.leer();
  aplicarTema(elegido || (prefiereOscuro() ? "oscuro" : "claro"));
  // Sin elección explícita, la interfaz sigue al sistema
  if (!elegido && window.matchMedia) {
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
      if (!almacen.leer()) aplicarTema(e.matches ? "oscuro" : "claro");
    });
  }
}

export function alternarTema() {
  const nuevo = temaActual() === "oscuro" ? "claro" : "oscuro";
  aplicarTema(nuevo);
  almacen.guardar(nuevo);
  return nuevo;
}

/* Botón de sol y luna. Se redibuja solo al cambiar el tema. */
export function botonTema() {
  const btn = h("button", { class: "btn-tema", type: "button" });
  const pintar = () => {
    const oscuro = temaActual() === "oscuro";
    btn.title = oscuro ? "Cambiar a modo claro" : "Cambiar a modo oscuro";
    btn.setAttribute("aria-label", btn.title);
    vaciar(btn).append(oscuro ? iconoSol() : iconoLuna(),
      h("span", { text: oscuro ? "Modo claro" : "Modo oscuro" }));
  };
  btn.addEventListener("click", () => { alternarTema(); pintar(); });
  pintar();
  return btn;
}

const iconoSol = () => h("svg", { viewBox: "0 0 24 24", class: "icono", "aria-hidden": "true" },
  h("circle", { cx: 12, cy: 12, r: 4.6, fill: "currentColor" }),
  ...[0, 45, 90, 135, 180, 225, 270, 315].map((g) => {
    const r = (g * Math.PI) / 180;
    return h("line", {
      x1: 12 + 7.4 * Math.cos(r), y1: 12 + 7.4 * Math.sin(r),
      x2: 12 + 10 * Math.cos(r), y2: 12 + 10 * Math.sin(r),
      stroke: "currentColor", "stroke-width": 1.9, "stroke-linecap": "round",
    });
  }));

const iconoLuna = () => h("svg", { viewBox: "0 0 24 24", class: "icono", "aria-hidden": "true" },
  h("path", {
    d: "M20.3 14.6A8.6 8.6 0 0 1 9.4 3.7a8.6 8.6 0 1 0 10.9 10.9z",
    fill: "currentColor",
  }));


/* -------------------------------------------------------------- FORMATOS -- */

export function dinero(n) {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 1000000) return "$" + (v / 1000000).toFixed(2) + " M";
  if (Math.abs(v) >= 1000) return "$" + Math.round(v / 1000) + " k";
  return "$" + Math.round(v);
}
export const numero = (n) => new Intl.NumberFormat("es-MX").format(Number(n) || 0);
export const pct = (a, b) => (Number(b) > 0 ? Math.round((Number(a) / Number(b)) * 100) : 0);
/* Formato de fecha de la casa: dd/mm/aaaa.
   Acepta una cadena "aaaa-mm-dd" o un objeto de fecha. Se usa el mediodía
   para que el huso horario no corra el día. */
export function fecha(f) {
  if (!f) return "—";
  const d = f instanceof Date ? f : new Date(String(f).slice(0, 10) + "T12:00:00");
  if (Number.isNaN(d.getTime())) return "—";
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getFullYear()}`;
}

export function valorSegunUnidad(v, unidad) {
  return unidad === "dinero" ? dinero(v) : numero(v);
}

/* ------------------------------------------------------------ ELEMENTOS --- */

export const lampara = (estado, texto) =>
  h("span", { class: "lamp lamp-" + estado }, h("i", {}), texto);

export const barra = (valor, meta, color) =>
  h("div", { class: "barra" },
    h("div", { class: "barra-fill", style: { width: Math.min(100, pct(valor, meta)) + "%", background: color || "var(--steel)" } }));

export function campo(label, control, ancho) {
  return h("label", { class: cls("campo", ancho === "full" && "campo-full") }, h("span", { text: label }), control);
}

export function entrada(valor, onInput, opts = {}) {
  const el = h("input", { type: opts.type || "text", value: valor ?? "", placeholder: opts.placeholder || "", disabled: !!opts.disabled });
  if (opts.min !== undefined) el.min = opts.min;
  if (opts.max !== undefined) el.max = opts.max;
  if (opts.step !== undefined) el.step = opts.step;
  el.addEventListener("change", () => onInput(opts.type === "number" ? Number(el.value) : el.value));
  return el;
}

export function area(valor, onInput, filas = 3, opts = {}) {
  const el = h("textarea", { rows: filas, placeholder: opts.placeholder || "", disabled: !!opts.disabled });
  el.value = valor ?? "";
  el.addEventListener("change", () => onInput(el.value));
  return el;
}

export function seleccion(valor, opciones, onChange, opts = {}) {
  const el = h("select", { disabled: !!opts.disabled },
    ...opciones.map((o) => h("option", { value: o.id, selected: String(o.id) === String(valor) }, o.nombre)));
  el.addEventListener("change", () => onChange(el.value));
  return el;
}

export function boton(texto, onClick, variante) {
  return h("button", { class: cls("btn", variante && "btn-" + variante), onclick: onClick }, texto);
}

export function vacio(titulo, texto, accion) {
  return h("div", { class: "vacio" }, h("strong", { text: titulo }), h("p", { text: texto }), accion);
}

/* ------------------------------------------------------------- FILTROS ---
   Barra de filtros reutilizable. Cada campo avisa al cambiar y la vista se
   vuelve a dibujar con el estado nuevo.

   Los campos de texto filtran mientras se escribe, con una pequeña pausa.
   Como al redibujar se reemplaza el cuadro de texto, se recuerda cuál tenía
   el foco para devolvérselo con el cursor al final, y así poder seguir
   escribiendo sin interrupción.
   -------------------------------------------------------------------------- */

let filtroEnfocado = null;

export function barraFiltros(campos, resumen, alLimpiar) {
  const barra = h("div", { class: "filtros" });
  campos.filter(Boolean).forEach((c, i) => {
    if (c.tipo === "check") {
      const chk = h("input", { type: "checkbox", checked: !!c.valor });
      chk.addEventListener("change", () => c.onChange(chk.checked));
      barra.appendChild(h("label", { class: "check-inline filtro-check" }, chk, c.label));
    } else if (c.tipo === "texto") {
      const id = c.id || "texto-" + i;
      const inp = h("input", { type: "text", value: c.valor ?? "", placeholder: c.placeholder || "" });
      let temporizador;
      inp.addEventListener("input", () => {
        filtroEnfocado = id;
        clearTimeout(temporizador);
        temporizador = setTimeout(() => c.onChange(inp.value), 250);
      });
      barra.appendChild(h("label", { class: "filtro" }, h("span", { text: c.label }), inp));
      if (filtroEnfocado === id) {
        setTimeout(() => {
          inp.focus();
          const n = inp.value.length;
          try { inp.setSelectionRange(n, n); } catch { /* algunos tipos no lo permiten */ }
        }, 0);
      }
    } else {
      barra.appendChild(h("label", { class: "filtro" }, h("span", { text: c.label }),
        seleccion(c.valor, c.opciones, (v) => { filtroEnfocado = null; c.onChange(v); })));
    }
  });
  if (alLimpiar) barra.appendChild(boton("Limpiar", () => { filtroEnfocado = null; alLimpiar(); }, "ghost"));
  if (resumen) barra.appendChild(h("span", { class: "filtros-cuenta", text: resumen }));
  return barra;
}

/* Lista de valores distintos de un campo, para llenar un desplegable */
export function opcionesDe(lista, campo, etiquetaTodos) {
  const vistos = [...new Set(lista.map((x) => x[campo]).filter((v) => v !== null && v !== undefined && v !== ""))].sort();
  return [{ id: "", nombre: etiquetaTodos }, ...vistos.map((v) => ({ id: String(v), nombre: String(v) }))];
}

/* Encabezado de tabla que ordena al hacer clic */
export function encabezadoOrdenable(texto, clave, orden, alOrdenar, num) {
  const activo = orden.clave === clave;
  return h("th", {
    class: cls("ordenable", num && "num", activo && (orden.asc ? "orden-asc" : "orden-desc")),
    onclick: () => alOrdenar(activo ? { clave, asc: !orden.asc } : { clave, asc: false }),
  }, texto);
}

export function ordenar(lista, orden) {
  if (!orden || !orden.clave) return lista;
  const v = (x) => {
    const r = typeof orden.obtener === "function" ? orden.obtener(x) : x[orden.clave];
    return r === null || r === undefined ? "" : r;
  };
  return [...lista].sort((a, b) => {
    const x = v(a), y = v(b);
    const cmp = typeof x === "number" && typeof y === "number"
      ? x - y
      : String(x).localeCompare(String(y), "es", { numeric: true });
    return orden.asc ? cmp : -cmp;
  });
}

export function tarjeta(titulo, valor, meta, porcentaje) {
  const color = porcentaje >= 100 ? "var(--run)" : porcentaje >= 60 ? "var(--signal)" : "var(--fault)";
  return h("div", { class: "tarjeta" },
    h("span", { class: "tarjeta-tit", text: titulo }),
    h("strong", { class: "tarjeta-val", text: String(valor) }),
    barra(porcentaje, 100, color),
    h("span", { class: "tarjeta-meta", text: meta }));
}

/* Tarjeta para conteos simples: sin barra, porque no hay avance que medir */
export function tarjetaConteo(titulo, valor, nota) {
  return h("div", { class: "tarjeta tarjeta-conteo" },
    h("span", { class: "tarjeta-tit", text: titulo }),
    h("strong", { class: "tarjeta-val", text: String(valor) }),
    h("span", { class: "tarjeta-meta", text: nota }));
}

/* Línea de tiempo del programa: hasta dónde debería ir por calendario y
   dónde está en realidad. Lo que importa es la distancia entre ambas marcas.
   Se dibuja a tamaño fijo para que las etiquetas no se deformen al estirarse. */
export function lineaTiempo(cal) {
  const W = 720, H = 82, m = 12, iw = W - m * 2, y = 42;
  const px = (semana) => m + ((semana - 0.5) / cal.semanas) * iw;
  const xEsperada = m + Math.max(0, Math.min(1, cal.avanceCalendario)) * iw;
  const xReal = px(cal.declarada);
  const atrasado = cal.desviacion < 0;
  const colorReal = atrasado ? "var(--c-falla)" : "var(--c-exito)";

  const marca = (x, color, etiqueta, arriba) => {
    const sx = Math.max(44, Math.min(W - 44, x));
    return h("g", {},
      h("line", { x1: x, y1: arriba ? y - 22 : y + 22, x2: x, y2: arriba ? y - 7 : y + 7,
        stroke: color, "stroke-width": 2 }),
      h("circle", { cx: x, cy: arriba ? y - 24 : y + 24, r: 3.5, fill: color }),
      h("text", { x: sx, y: arriba ? y - 31 : y + 38, "text-anchor": "middle",
        class: "tiempo-lab", fill: color, text: etiqueta }));
  };

  const separadores = [];
  for (let s = 4; s < cal.semanas; s += 4) {
    const x = m + (s / cal.semanas) * iw;
    separadores.push(h("line", { x1: x, y1: y - 6, x2: x, y2: y + 6, stroke: "var(--panel)", "stroke-width": 2 }));
  }

  return h("div", { class: "grafica" },
    h("svg", { viewBox: `0 0 ${W} ${H}`, class: "svg-chart svg-tiempo", role: "img",
      "aria-label": `Semana ${cal.declarada} de ${cal.semanas}. ${cal.veredicto}.` },
      h("rect", { x: m, y: y - 6, width: iw, height: 12, rx: 6, fill: "var(--g-pista)" }),
      h("rect", { x: m, y: y - 6, width: Math.max(0, xEsperada - m), height: 12, rx: 6,
        fill: "var(--c-acero2)", opacity: .5 }),
      Math.abs(xReal - xEsperada) > 1 && h("rect", {
        x: Math.min(xReal, xEsperada), y: y - 6, width: Math.abs(xReal - xEsperada), height: 12,
        fill: colorReal, opacity: .4 }),
      ...separadores,
      marca(xEsperada, "var(--graphite)", "debería ir aquí", true),
      marca(xReal, colorReal, "semana " + cal.declarada, false)));
}

export function panel(titulo, subtitulo, ...contenido) {
  return h("section", { class: "panel-card" },
    titulo && h("h3", { text: titulo }),
    subtitulo && h("p", { class: "sub", text: subtitulo }),
    ...contenido);
}

export function tabla(encabezados, filas, opts = {}) {
  return h("div", { class: opts.scroll ? "tabla-scroll" : "" },
    h("table", { class: "tabla" },
      h("thead", {}, h("tr", {}, ...encabezados.map((e) =>
        h("th", { class: typeof e === "object" && e.num ? "num" : "" }, typeof e === "object" ? e.t : e)))),
      h("tbody", {}, ...filas)));
}

/* ---------------------------------------------------------------- MODAL --- */

let modalActual = null;

export function modal(titulo, contenido, pie, ancho) {
  cerrarModal();
  const caja = h("div", { class: cls("modal", ancho === "ancho" && "modal-ancho") },
    h("header", { class: "modal-head" }, h("h3", { text: titulo }), boton("Cerrar", cerrarModal, "ghost")),
    h("div", { class: "modal-body" }, contenido, pie && h("div", { class: "modal-pie" }, ...pie)));
  const fondo = h("div", { class: "modal-bg", onclick: (e) => { if (e.target === fondo) cerrarModal(); } }, caja);
  document.body.appendChild(fondo);
  modalActual = fondo;
  document.addEventListener("keydown", escModal);
  return fondo;
}
const escModal = (e) => { if (e.key === "Escape") cerrarModal(); };
export function cerrarModal() {
  if (modalActual) { modalActual.remove(); modalActual = null; document.removeEventListener("keydown", escModal); }
}

export function aviso(texto, tipo = "ok") {
  const t = h("div", { class: "toast toast-" + tipo, text: texto });
  document.body.appendChild(t);
  setTimeout(() => { t.classList.add("sale"); setTimeout(() => t.remove(), 300); }, 2600);
}

export function confirmar(texto, alAceptar) {
  modal("Confirmar", h("p", { class: "texto", text: texto }), [
    boton("Cancelar", cerrarModal, "ghost"),
    boton("Sí, continuar", () => { cerrarModal(); alAceptar(); }, "peligro"),
  ]);
}

/* =========================================================== GRÁFICAS ===== */

const PALETA = ["var(--c-tinta)", "var(--c-exito)", "var(--c-aviso)", "var(--c-acero2)", "var(--c-falla)", "var(--c-acero3)", "var(--c-violeta)", "var(--c-arena)"];
export const color = (i) => PALETA[i % PALETA.length];

/* Indicador de aguja para los puntos de graduación */
/* ---------------------------------------------------------- TACÓMETRO ---
   Carátula con aguja y zonas de color. La usan el indicador de graduación y
   el de cumplimiento de tareas, para que ambos se lean igual.

   zonas:  [{ hasta, color }]  tramos sucesivos desde 0 hasta `max`
   marca:  valor donde se dibuja una referencia destacada (por ejemplo, la meta)
   -------------------------------------------------------------------------- */

export function tacometro({ valor, max = 100, zonas, centro, etiqueta, marca, marcaTexto, aguja, descripcion, progreso = true }) {
  const v = Math.max(0, Math.min(max, valor));
  const cx = 130, cy = 122, r = 92, ini = -220, barrido = 260;
  const ang = (x) => ini + (x / max) * barrido;
  const pol = (a, rad) => [cx + rad * Math.cos((a * Math.PI) / 180), cy + rad * Math.sin((a * Math.PI) / 180)];
  const arco = (a1, a2, rad) => {
    const [x1, y1] = pol(a1, rad), [x2, y2] = pol(a2, rad);
    return `M ${x1} ${y1} A ${rad} ${rad} 0 ${Math.abs(a2 - a1) > 180 ? 1 : 0} 1 ${x2} ${y2}`;
  };

  const tramos = [];
  let desde = 0;
  (zonas || []).forEach((z) => {
    tramos.push(h("path", { d: arco(ang(desde), ang(z.hasta), r), stroke: z.color,
      "stroke-width": 14, fill: "none", opacity: 0.5 }));
    desde = z.hasta;
  });

  const ticks = [];
  for (let i = 0; i <= 10; i++) {
    const a = ini + i * (barrido / 10);
    const [x1, y1] = pol(a, i % 5 === 0 ? 70 : 78), [x2, y2] = pol(a, 86);
    ticks.push(h("line", { x1, y1, x2, y2,
      stroke: i % 5 === 0 ? "var(--c-tinta)" : "var(--c-apagado)", "stroke-width": i % 5 === 0 ? 2 : 1 }));
  }

  /* Referencia destacada: la meta */
  let referencia = null;
  if (marca !== undefined && marca <= max) {
    const a = ang(marca);
    const [x1, y1] = pol(a, 66), [x2, y2] = pol(a, 100);
    const [tx, ty] = pol(a, 110);
    referencia = h("g", {},
      h("line", { x1, y1, x2, y2, stroke: "var(--graphite)", "stroke-width": 2, "stroke-dasharray": "3 2" }),
      marcaTexto ? h("text", { x: tx, y: ty, "text-anchor": "middle", class: "dial-marca", text: marcaTexto }) : null);
  }

  const [ax, ay] = pol(ang(v), 74);
  const colorAguja = aguja || "var(--c-falla)";

  return h("svg", { viewBox: "0 0 260 234", class: "dial", role: "img",
    "aria-label": descripcion || `${Math.round(v)} de ${max}` },
    h("path", { d: arco(ini, ini + barrido, r), stroke: "var(--g-arco)", "stroke-width": 14, fill: "none", "stroke-linecap": "round" }),
    ...tramos,
    progreso && v > 0 && h("path", { d: arco(ini, ang(v), r), stroke: "var(--c-tinta)", "stroke-width": 14, fill: "none", "stroke-linecap": "round" }),
    ...ticks,
    referencia,
    h("line", { x1: cx, y1: cy, x2: ax, y2: ay, stroke: colorAguja, "stroke-width": 3.5, "stroke-linecap": "round" }),
    h("circle", { cx, cy, r: 9, fill: "var(--c-tinta)" }),
    h("circle", { cx, cy, r: 3.5, fill: "var(--g-centro)" }),
    /* La lectura va bajo el arco: dentro, la aguja le pasaba por encima */
    h("text", { x: cx, y: cy + 76, "text-anchor": "middle", class: "dial-num", text: centro }),
    h("text", { x: cx, y: cy + 95, "text-anchor": "middle", class: "dial-lab", text: etiqueta }));
}

/* Puntos de graduación */
export function dial(valor, etiqueta = "de 100 puntos de graduación") {
  const v = Math.max(0, Math.min(100, Math.round(valor)));
  return tacometro({
    valor: v, max: 100, centro: String(v), etiqueta,
    descripcion: `${v} de 100 puntos de graduación`,
    zonas: [
      { hasta: 60, color: "var(--c-falla)" },
      { hasta: 85, color: "var(--c-aviso)" },
      { hasta: 100, color: "var(--c-exito)" },
    ],
  });
}

/* Cumplimiento de tareas contra las que ya deberían estar hechas.
   La escala llega a 150 % para que ir por delante también se vea. */
export function tacometroTareas(hechas, esperadas) {
  const pctCumplido = esperadas > 0 ? (hechas / esperadas) * 100 : 100;
  const v = Math.max(0, Math.min(100, Math.round(pctCumplido)));
  const color = v >= 95 ? "var(--c-exito)" : v >= 70 ? "var(--c-aviso)" : "var(--c-falla)";
  return tacometro({
    valor: v, max: 100, aguja: color, progreso: false,
    centro: v + "%", etiqueta: `${hechas} de ${esperadas} tareas`,
    descripcion: `${hechas} de ${esperadas} tareas que ya deberían estar hechas, ${v} por ciento`,
    zonas: [
      { hasta: 70, color: "var(--c-falla)" },
      { hasta: 95, color: "var(--c-aviso)" },
      { hasta: 100, color: "var(--c-exito)" },
    ],
  });
}

/* Radar de competencias. series: [{nombre, color, valores:[]}], ejes: [] */
export function radar(ejes, series, max = 5) {
  const W = 520, H = 360, cx = W / 2, cy = H / 2 - 4, R = 108;
  const n = ejes.length;
  const punto = (i, v) => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2;
    const rad = (Math.max(0, Math.min(max, v)) / max) * R;
    return [cx + rad * Math.cos(a), cy + rad * Math.sin(a)];
  };
  const anillos = [1, 2, 3, 4, 5].map((k) => {
    const pts = ejes.map((_, i) => punto(i, (max * k) / 5).join(",")).join(" ");
    return h("polygon", { points: pts, fill: "none", stroke: "var(--g-anillo)", "stroke-width": k === 5 ? 1.4 : 0.8 });
  });
  const radios = ejes.map((_, i) => {
    const [x, y] = punto(i, max);
    return h("line", { x1: cx, y1: cy, x2: x, y2: y, stroke: "var(--g-radio)" });
  });
  const capas = series.map((s) =>
    h("polygon", {
      points: s.valores.map((v, i) => punto(i, v).join(",")).join(" "),
      fill: s.color, "fill-opacity": s.relleno ?? 0.22, stroke: s.color, "stroke-width": 2,
    }));
  /* Las etiquetas se parten en dos renglones para que no se encimen */
  const etiquetas = ejes.map((e, i) => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2;
    const x = cx + (R + 22) * Math.cos(a), y = cy + (R + 18) * Math.sin(a);
    const anchor = Math.abs(Math.cos(a)) < 0.25 ? "middle" : Math.cos(a) > 0 ? "start" : "end";
    const palabras = String(e).split(" ");
    const renglones = [];
    let linea = "";
    palabras.forEach((p) => {
      if ((linea + " " + p).trim().length > 14) { if (linea) renglones.push(linea); linea = p; }
      else linea = (linea + " " + p).trim();
    });
    if (linea) renglones.push(linea);
    const dy0 = Math.sin(a) < -0.5 ? -(renglones.length - 1) * 11 : 0;
    return h("text", { x, y: y + dy0, "text-anchor": anchor, class: "eje" },
      ...renglones.map((t, j) => h("tspan", { x, dy: j === 0 ? 0 : 11 }, t)));
  });
  return h("div", { class: "grafica" },
    h("svg", { viewBox: `0 0 ${W} ${H}`, class: "svg-chart" }, ...anillos, ...radios, ...capas, ...etiquetas),
    leyenda(series));
}

/* Barras verticales. series: [{nombre,color,valores:[]}] */
export function barras(categorias, series, opts = {}) {
  const W = 520, H = opts.alto || 260, ml = opts.ml || 48, mb = 34, mt = 12, mr = 10;
  const iw = W - ml - mr, ih = H - mt - mb;
  const apilado = !!opts.apilado;
  const totales = categorias.map((_, i) => apilado
    ? series.reduce((a, s) => a + (s.valores[i] || 0), 0)
    : Math.max(...series.map((s) => s.valores[i] || 0)));
  const max = Math.max(1, ...totales, opts.min || 0);
  const esc = (v) => (v / max) * ih;
  const bw = iw / categorias.length;
  const grupos = [];
  categorias.forEach((c, i) => {
    if (apilado) {
      let acum = 0;
      series.forEach((s) => {
        const v = s.valores[i] || 0, alto = esc(v);
        grupos.push(h("rect", { x: ml + i * bw + bw * 0.22, y: mt + ih - esc(acum) - alto, width: bw * 0.56, height: Math.max(0, alto), fill: s.color },
          h("title", { text: `${c} · ${s.nombre}: ${opts.formato ? opts.formato(v) : v}` })));
        acum += v;
      });
    } else {
      const sw = (bw * 0.7) / series.length;
      series.forEach((s, j) => {
        const v = s.valores[i] || 0, alto = esc(v);
        grupos.push(h("rect", { x: ml + i * bw + bw * 0.15 + j * sw, y: mt + ih - alto, width: sw - 2, height: Math.max(0, alto), fill: s.color, rx: 2 },
          h("title", { text: `${c} · ${s.nombre}: ${opts.formato ? opts.formato(v) : v}` })));
      });
    }
  });
  const lineas = [0, 0.25, 0.5, 0.75, 1].map((f) => {
    const y = mt + ih - ih * f;
    return h("g", {},
      h("line", { x1: ml, y1: y, x2: W - mr, y2: y, stroke: "var(--g-reja)" }),
      h("text", { x: ml - 7, y: y + 4, "text-anchor": "end", class: "tick", text: opts.formato ? opts.formato(max * f) : Math.round(max * f) }));
  });
  const ejeX = categorias.map((c, i) =>
    h("text", { x: ml + i * bw + bw / 2, y: H - 12, "text-anchor": "middle", class: "tick", text: c }));
  return h("div", { class: "grafica" },
    h("svg", { viewBox: `0 0 ${W} ${H}`, class: "svg-chart" }, ...lineas, ...grupos, ...ejeX),
    leyenda(series));
}

/* Barras horizontales, útiles para el embudo y para comparativos por persona */
export function barrasH(categorias, valores, opts = {}) {
  const W = 520, filaAlto = opts.filaAlto || 30, ml = opts.ml || 150, mr = 56;
  const H = categorias.length * filaAlto + 12;
  const max = Math.max(1, ...valores, opts.min || 0);
  const iw = W - ml - mr;
  const filas = categorias.map((c, i) => {
    const v = valores[i] || 0, ancho = (v / max) * iw;
    const col = opts.colores ? opts.colores[i] : color(i);
    return h("g", {},
      h("text", { x: ml - 10, y: i * filaAlto + 20, "text-anchor": "end", class: "tick", text: c }),
      h("rect", { x: ml, y: i * filaAlto + 7, width: iw, height: filaAlto - 14, fill: "var(--g-pista)", rx: 2 }),
      h("rect", { x: ml, y: i * filaAlto + 7, width: Math.max(0, ancho), height: filaAlto - 14, fill: col, rx: 2 },
        h("title", { text: `${c}: ${opts.formato ? opts.formato(v) : v}` })),
      h("text", { x: ml + Math.max(ancho, 0) + 7, y: i * filaAlto + 20, class: "tick", text: opts.formato ? opts.formato(v) : v }));
  });
  return h("div", { class: "grafica" }, h("svg", { viewBox: `0 0 ${W} ${H}`, class: "svg-chart" }, ...filas));
}

/* Líneas. series: [{nombre,color,valores:[]}] con null para huecos */
export function lineas(categorias, series, opts = {}) {
  const W = 520, H = opts.alto || 250, ml = 44, mb = 32, mt = 12, mr = 12;
  const iw = W - ml - mr, ih = H - mt - mb;
  const todos = series.flatMap((s) => s.valores.filter((v) => v !== null && v !== undefined));
  const max = Math.max(1, ...todos, opts.max || 0);
  const x = (i) => ml + (categorias.length > 1 ? (i / (categorias.length - 1)) * iw : iw / 2);
  const y = (v) => mt + ih - (v / max) * ih;
  const capas = series.map((s) => {
    const pts = s.valores.map((v, i) => (v === null || v === undefined ? null : [x(i), y(v)])).filter(Boolean);
    if (!pts.length) return null;
    const d = pts.map((p, i) => (i ? "L" : "M") + p[0] + " " + p[1]).join(" ");
    return h("g", {},
      h("path", { d, fill: "none", stroke: s.color, "stroke-width": 2.5, "stroke-linejoin": "round" }),
      ...pts.map((p) => h("circle", { cx: p[0], cy: p[1], r: 4, fill: s.color })));
  });
  const ref = opts.referencia !== undefined
    ? h("g", {}, h("line", { x1: ml, y1: y(opts.referencia), x2: W - mr, y2: y(opts.referencia), stroke: "var(--c-falla)", "stroke-dasharray": "5 4", "stroke-width": 1.4 }),
      h("text", { x: W - mr, y: y(opts.referencia) - 6, "text-anchor": "end", class: "tick", text: opts.refTexto || "" }))
    : null;
  const guias = [0, 0.25, 0.5, 0.75, 1].map((f) => {
    const yy = mt + ih - ih * f;
    return h("g", {}, h("line", { x1: ml, y1: yy, x2: W - mr, y2: yy, stroke: "var(--g-reja)" }),
      h("text", { x: ml - 7, y: yy + 4, "text-anchor": "end", class: "tick", text: opts.formato ? opts.formato(max * f) : Math.round(max * f * 10) / 10 }));
  });
  const ejeX = categorias.map((c, i) => h("text", { x: x(i), y: H - 10, "text-anchor": "middle", class: "tick", text: c }));
  return h("div", { class: "grafica" },
    h("svg", { viewBox: `0 0 ${W} ${H}`, class: "svg-chart" }, ...guias, ref, ...capas, ...ejeX),
    leyenda(series));
}

function leyenda(series) {
  const conNombre = series.filter((s) => s.nombre);
  if (!conNombre.length) return null;
  return h("div", { class: "leyenda" }, ...conNombre.map((s) =>
    h("span", {}, h("i", { style: { background: s.color } }), s.nombre)));
}
