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

export const vaciar = (el) => { while (el.firstChild) el.removeChild(el.firstChild); return el; };
export const uid = () => Math.random().toString(36).slice(2, 10);
export const cls = (...xs) => xs.filter(Boolean).join(" ");

/* -------------------------------------------------------------- FORMATOS -- */

export function dinero(n) {
  const v = Number(n) || 0;
  if (Math.abs(v) >= 1000000) return "$" + (v / 1000000).toFixed(2) + " M";
  if (Math.abs(v) >= 1000) return "$" + Math.round(v / 1000) + " k";
  return "$" + Math.round(v);
}
export const numero = (n) => new Intl.NumberFormat("es-MX").format(Number(n) || 0);
export const pct = (a, b) => (Number(b) > 0 ? Math.round((Number(a) / Number(b)) * 100) : 0);
export const fecha = (f) => (f ? new Date(f + "T12:00:00").toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" }) : "—");

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

export function tarjeta(titulo, valor, meta, porcentaje) {
  const color = porcentaje >= 100 ? "var(--run)" : porcentaje >= 60 ? "var(--signal)" : "var(--fault)";
  return h("div", { class: "tarjeta" },
    h("span", { class: "tarjeta-tit", text: titulo }),
    h("strong", { class: "tarjeta-val", text: String(valor) }),
    barra(porcentaje, 100, color),
    h("span", { class: "tarjeta-meta", text: meta }));
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

const PALETA = ["#22303B", "#1D8A5F", "#F0A500", "#8FA0AC", "#C0392B", "#5E7382", "#7D6BA8", "#C98A3A"];
export const color = (i) => PALETA[i % PALETA.length];

/* Indicador de aguja para los puntos de graduación */
export function dial(valor, etiqueta = "de 100 puntos de graduación") {
  const v = Math.max(0, Math.min(100, Math.round(valor)));
  const cx = 130, cy = 122, r = 92, ini = -220, barrido = 260;
  const ang = ini + (v / 100) * barrido;
  const pol = (a, rad) => [cx + rad * Math.cos((a * Math.PI) / 180), cy + rad * Math.sin((a * Math.PI) / 180)];
  const arco = (a1, a2, rad) => {
    const [x1, y1] = pol(a1, rad), [x2, y2] = pol(a2, rad);
    return `M ${x1} ${y1} A ${rad} ${rad} 0 ${Math.abs(a2 - a1) > 180 ? 1 : 0} 1 ${x2} ${y2}`;
  };
  const ticks = [];
  for (let i = 0; i <= 10; i++) {
    const a = ini + i * (barrido / 10);
    const [x1, y1] = pol(a, i % 5 === 0 ? 70 : 78), [x2, y2] = pol(a, 86);
    ticks.push(h("line", { x1, y1, x2, y2, stroke: i % 5 === 0 ? "#22303B" : "#A9B0AB", "stroke-width": i % 5 === 0 ? 2 : 1 }));
  }
  const [ax, ay] = pol(ang, 74);
  return h("svg", { viewBox: "0 0 260 208", class: "dial", role: "img", "aria-label": `${v} de 100 puntos` },
    h("path", { d: arco(ini, ini + barrido, r), stroke: "#DDE0DA", "stroke-width": 14, fill: "none", "stroke-linecap": "round" }),
    h("path", { d: arco(ini, ini + 0.6 * barrido, r), stroke: "#C0392B", "stroke-width": 14, fill: "none", opacity: 0.22 }),
    h("path", { d: arco(ini + 0.6 * barrido, ini + 0.85 * barrido, r), stroke: "#F0A500", "stroke-width": 14, fill: "none", opacity: 0.28 }),
    h("path", { d: arco(ini + 0.85 * barrido, ini + barrido, r), stroke: "#1D8A5F", "stroke-width": 14, fill: "none", opacity: 0.3 }),
    v > 0 && h("path", { d: arco(ini, ang, r), stroke: "#22303B", "stroke-width": 14, fill: "none", "stroke-linecap": "round" }),
    ...ticks,
    h("line", { x1: cx, y1: cy, x2: ax, y2: ay, stroke: "#C0392B", "stroke-width": 3.5, "stroke-linecap": "round" }),
    h("circle", { cx, cy, r: 9, fill: "#22303B" }),
    h("circle", { cx, cy, r: 3.5, fill: "#E6E7E2" }),
    h("text", { x: cx, y: cy + 52, "text-anchor": "middle", class: "dial-num", text: String(v) }),
    h("text", { x: cx, y: cy + 69, "text-anchor": "middle", class: "dial-lab", text: etiqueta }));
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
    return h("polygon", { points: pts, fill: "none", stroke: "#D2D5CE", "stroke-width": k === 5 ? 1.4 : 0.8 });
  });
  const radios = ejes.map((_, i) => {
    const [x, y] = punto(i, max);
    return h("line", { x1: cx, y1: cy, x2: x, y2: y, stroke: "#E0E2DC" });
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
      h("line", { x1: ml, y1: y, x2: W - mr, y2: y, stroke: "#E4E6E0" }),
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
      h("rect", { x: ml, y: i * filaAlto + 7, width: iw, height: filaAlto - 14, fill: "#F0F1ED", rx: 2 }),
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
    ? h("g", {}, h("line", { x1: ml, y1: y(opts.referencia), x2: W - mr, y2: y(opts.referencia), stroke: "#C0392B", "stroke-dasharray": "5 4", "stroke-width": 1.4 }),
      h("text", { x: W - mr, y: y(opts.referencia) - 6, "text-anchor": "end", class: "tick", text: opts.refTexto || "" }))
    : null;
  const guias = [0, 0.25, 0.5, 0.75, 1].map((f) => {
    const yy = mt + ih - ih * f;
    return h("g", {}, h("line", { x1: ml, y1: yy, x2: W - mr, y2: yy, stroke: "#E4E6E0" }),
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
