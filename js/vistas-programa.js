/* ===========================================================================
   Vistas del programa: panel, ruta, competencias, KPIs, graduación, riesgos
   y el editor de configuración del plan de cada colaborador.
   =========================================================================== */

import { colaboradores as dbCol, avance as dbAvance, evaluaciones, kpiResultados } from "./db.js";
import { NIVELES, CORTES, MADUREZ, FUENTES_CRITERIO } from "./plantilla.js";
import { clave } from "./metricas.js";
import {
  h, panel, tabla, boton, campo, entrada, area, seleccion, modal, cerrarModal, aviso, confirmar,
  lampara, barra, dinero, numero, pct, vacio, radar, barras, barrasH, lineas, dial, color, cls, tarjeta, uid,
} from "./ui.js";

/* ============================================================== PANEL ===== */

export function vistaPanel(ctx) {
  const { col, m } = ctx.estado;
  const prog = m.prog;
  const idx = Math.max(0, Math.min(prog.plan.length - 1, (col.semana_actual || 1) - 1));
  const semana = prog.plan[idx];

  const hechasSemana = semana ? (semana.tasks || []).filter((t) => m.tareaHecha(semana.id, t.id)).length : 0;

  const ejes = prog.grupos.map((g) => g.nombre.replace("Competencias ", ""));
  const req = prog.grupos.map((g) => {
    const cs = prog.competencias.filter((c) => c.grupo === g.id);
    return cs.length ? Number((cs.reduce((a, c) => a + c.req, 0) / cs.length).toFixed(2)) : 0;
  });

  const embudo = prog.etapas.filter((e) => e.id !== "perdida");
  const cortesNom = CORTES.map((c) => c.nombre);

  return h("div", { class: "vista" },
    h("section", { class: "hero" },
      h("div", { class: "hero-dial" }, dial(m.puntos), lampara(m.estado, m.dictamen)),
      h("div", { class: "hero-texto" },
        semana ? h("h2", { text: `Semana ${idx + 1}: ${semana.titulo}` }) : h("h2", { text: "Plan sin semanas configuradas" }),
        h("p", { text: semana ? semana.objetivo : "Agrega semanas desde Configurar programa." }),
        h("div", { class: "hero-cifras" },
          cifra(semana ? `${hechasSemana}/${(semana.tasks || []).length}` : "—", "tareas de la semana"),
          cifra(m.visitas.length, "visitas acumuladas"),
          cifra(dinero(m.pipeline), "pipeline abierto"),
          cifra(m.cuentas.length, "cuentas mapeadas")),
        boton("Abrir la semana", () => ctx.ir("ruta")))),

    h("div", { class: "grid-4" },
      tarjeta("Pipeline calificado", dinero(m.pipelineCal), "Meta de graduación: " + dinero(metaDe(prog, "pipeline_cal")), pct(m.pipelineCal, metaDe(prog, "pipeline_cal"))),
      tarjeta("Ventas cerradas", dinero(m.ventas), `Tasa de cierre ${m.tasaCierre}%`, pct(m.ganadas.length, Math.max(1, metaDe(prog, "ganadas")))),
      tarjeta("Visitas lideradas solo", m.visitasSolo, "Meta de graduación: " + metaDe(prog, "visitas_solo"), pct(m.visitasSolo, metaDe(prog, "visitas_solo"))),
      tarjeta("Account Plans aprobados", m.planesAprobados, "Meta de graduación: " + metaDe(prog, "planes"), pct(m.planesAprobados, metaDe(prog, "planes")))),

    h("div", { class: "grid-2" },
      panel("Competencias por grupo", "Línea base, corte más reciente y nivel requerido.",
        radar(ejes, [
          { nombre: "Inicial", color: "#A9B0AB", valores: prog.grupos.map((g) => Number(m.promedioGrupo(g.id, "ini").toFixed(2))) },
          { nombre: "Requerido", color: "#F0A500", valores: req, relleno: 0.1 },
          { nombre: "Actual", color: "#22303B", valores: prog.grupos.map((g) => Number(m.promedioGrupo(g.id, m.ultimoCorte).toFixed(2))) },
        ])),

      panel("Visitas por mes", "Plan del programa contra ejecución real.",
        barras(prog.planVisitas.map((p) => "Mes " + p.mes), [
          { nombre: "Plan", color: "#C8CCC5", valores: prog.planVisitas.map((p) => p.observa + p.acompanado + p.lidera + p.autonoma) },
          { nombre: "Real", color: "#22303B", valores: prog.planVisitas.map((p) => m.visitas.filter((v) => Number(v.mes) === p.mes).length) },
          { nombre: "Lideradas solo", color: "#1D8A5F", valores: prog.planVisitas.map((p) => m.visitas.filter((v) => Number(v.mes) === p.mes && v.tipo === "autonoma").length) },
        ])),

      panel("Embudo comercial", "Oportunidades registradas por etapa.",
        embudo.length ? barrasH(embudo.map((e) => e.nombre), embudo.map((e) => m.opps.filter((o) => o.etapa === e.id).length),
          { colores: embudo.map((e, i) => (e.id === "ganada" ? "#1D8A5F" : ["#9FB0BB", "#7C8F9C", "#5A707F", "#3A4E5C"][Math.min(i, 3)])) })
          : vacio("Sin etapas configuradas", "Defínelas en Configurar programa.")),

      panel("Evolución del scorecard", "Promedio ponderado en cada corte. La referencia de graduación es " + m.umbrales.scoreApto.toFixed(1) + ".",
        lineas(cortesNom, [{ nombre: "Scorecard", color: "#C0392B", valores: CORTES.map((c) => m.scoreCorte(c.id) || null) }],
          { max: 5, referencia: m.umbrales.scoreApto, refTexto: "graduación" }))),

    panel("Alertas del programa", null, h("ul", { class: "alertas" }, ...alertas(m))));
}

const cifra = (valor, texto) => h("div", {}, h("b", { text: String(valor) }), h("span", { text: texto }));

function metaDe(prog, fuente) {
  const c = prog.criterios.find((x) => x.fuente === fuente);
  return c ? Number(c.meta) : 0;
}

function alertas(m) {
  const out = [];
  if (m.criticasBajas.length)
    out.push(h("li", {}, lampara("signal", `${m.criticasBajas.length} competencias críticas por debajo del nivel requerido: ${m.criticasBajas.slice(0, 3).map((c) => c.nombre).join(", ")}${m.criticasBajas.length > 3 ? "…" : ""}`)));
  if (m.sinProxima)
    out.push(h("li", {}, lampara("fault", `${m.sinProxima} oportunidades abiertas sin próxima acción definida`)));
  if (m.opps.length > 4 && m.opps.filter((o) => o.etapa === "nueva").length > m.opps.length / 2)
    out.push(h("li", {}, lampara("signal", "Más de la mitad del pipeline sigue en etapa nueva: falta calificar")));
  if (m.visitas.length > 4 && m.visitasNuevas / m.visitas.length < 0.25)
    out.push(h("li", {}, lampara("signal", "Menos del 25 % de las visitas son a cuentas nuevas")));
  if (m.opps.length > 4 && m.creadas / m.opps.length < 0.5)
    out.push(h("li", {}, lampara("signal", "Menos de la mitad de las oportunidades fueron creadas por el vendedor; el resto son solicitudes del cliente")));
  if (m.criticasSinEvaluar.length && m.ultimoCorte !== "ini")
    out.push(h("li", {}, lampara("off", `${m.criticasSinEvaluar.length} competencias críticas sin calificar en el corte ${CORTES.find((c) => c.id === m.ultimoCorte).nombre}`)));
  if (!out.length) out.push(h("li", {}, lampara("run", "Sin alertas activas. La ejecución va conforme al plan.")));
  return out;
}

/* =============================================================== RUTA ===== */

export function vistaRuta(ctx) {
  const { col, m } = ctx.estado;
  const prog = m.prog;
  const puedeMarcar = ctx.permisos.captura(col);
  const meses = [...new Set(prog.plan.map((s) => s.mes))].sort((a, b) => a - b);
  const mesesInfo = (col.juicio && col.juicio.meses) || [];
  const recordado = ctx.estado.ui.mesRuta;
  let mesAbierto = meses.includes(recordado) ? recordado
    : (prog.plan[Math.max(0, (col.semana_actual || 1) - 1)] || {}).mes || meses[0];

  const cont = h("div", { class: "vista" });

  const pintar = () => {
    cont.replaceChildren();

    cont.appendChild(panel("Roadmap de los cinco meses", null,
      tabla(["Mes", "Objetivo", "Resultado esperado", { t: "Avance", num: true }],
        meses.map((n) => {
          const sem = prog.plan.filter((s) => s.mes === n);
          const tot = sem.reduce((a, s) => a + (s.tasks || []).length, 0);
          const hec = sem.reduce((a, s) => a + (s.tasks || []).filter((t) => m.tareaHecha(s.id, t.id)).length, 0);
          const info = mesesInfo.find((x) => x.n === n) || {};
          return h("tr", {
            class: cls("fila-click", mesAbierto === n && "fila-activa"),
            onclick: () => { mesAbierto = n; ctx.estado.ui.mesRuta = n; pintar(); },
          },
            h("td", {}, h("b", { text: "Mes " + n }), h("br"), h("span", { class: "gris", text: info.nombre || "" })),
            h("td", { text: info.objetivo || "—" }),
            h("td", { text: info.resultado || "—" }),
            h("td", { class: "num" }, pct(hec, tot) + "%", barra(hec, tot || 1)));
        }))));

    cont.appendChild(h("div", { class: "tabs" }, ...meses.map((n) =>
      h("button", { class: cls("tab", mesAbierto === n && "activo"), onclick: () => { mesAbierto = n; ctx.estado.ui.mesRuta = n; pintar(); } }, "Mes " + n))));

    const lista = h("div", { class: "semanas" });
    prog.plan.filter((s) => s.mes === mesAbierto).forEach((s) => {
      const nSemana = prog.plan.indexOf(s) + 1;
      const tareas = s.tasks || [];
      const hechas = tareas.filter((t) => m.tareaHecha(s.id, t.id)).length;
      const estado = tareas.length && hechas === tareas.length ? "run" : hechas ? "signal" : "off";
      const abierta = nSemana === (col.semana_actual || 1);

      const cuerpo = h("div", { class: "semana-cuerpo", style: { display: abierta ? "" : "none" } });
      const art = h("article", { class: "semana" },
        h("header", {
          onclick: () => { cuerpo.style.display = cuerpo.style.display === "none" ? "" : "none"; },
        },
          h("div", {}, h("span", { class: "semana-id", text: "Semana " + nSemana }), h("h4", { text: s.titulo })),
          h("div", { class: "semana-meta" }, lampara(estado, `${hechas} de ${tareas.length}`), h("span", { class: "chev", text: "▾" }))),
        cuerpo);

      cuerpo.appendChild(h("p", { class: "objetivo", text: s.objetivo || "" }));
      cuerpo.appendChild(h("div", { class: "bloques" },
        bloque("Tema", s.tema), bloque("Capacitación", s.cap), bloque("Práctica y role play", s.practica),
        bloque("Actividad comercial real", s.real), bloque("Indicador de la semana", s.kpi),
        bloque("Evidencia esperada", s.evidencia), bloque("Responsable", s.resp)));

      cuerpo.appendChild(h("h5", { text: "Lista de verificación" }));
      const ul = h("ul", { class: "check" });
      tareas.forEach((t) => {
        const registro = (ctx.estado.exp.avance || []).find((a) => a.tarea_id === clave(s.id, t.id)) || {};
        const chk = h("input", { type: "checkbox", checked: m.tareaHecha(s.id, t.id), disabled: !puedeMarcar });
        chk.addEventListener("change", async () => {
          try {
            await dbAvance.marcar(col.id, s.id, clave(s.id, t.id), chk.checked);
            await ctx.refrescar();
          } catch (e) { aviso(e.message, "error"); chk.checked = !chk.checked; }
        });
        const detalle = h("div", { class: "check-detalle", style: { display: "none" } },
          campo("Evidencia entregada", entrada(registro.evidencia || "", async (v) => {
            await dbAvance.anotar(col.id, s.id, clave(s.id, t.id), { evidencia: v, hecho: chk.checked }); aviso("Evidencia guardada");
          }, { disabled: !puedeMarcar, placeholder: "Liga, archivo o descripción" }), "full"),
          campo("Nota", entrada(registro.nota || "", async (v) => {
            await dbAvance.anotar(col.id, s.id, clave(s.id, t.id), { nota: v, hecho: chk.checked }); aviso("Nota guardada");
          }, { disabled: !puedeMarcar }), "full"));
        ul.appendChild(h("li", {},
          h("label", {}, chk, h("span", { text: t.texto }),
            h("button", {
              class: "link-mini", onclick: (e) => { e.preventDefault(); detalle.style.display = detalle.style.display === "none" ? "" : "none"; },
            }, registro.evidencia || registro.nota ? "Ver evidencia" : "Agregar evidencia")),
          detalle));
      });
      cuerpo.appendChild(ul);
      lista.appendChild(art);
    });
    cont.appendChild(lista);

    if (ctx.permisos.editaPrograma(col))
      cont.appendChild(h("div", { class: "acciones-fila" },
        boton("Editar las semanas y las tareas", () => ctx.ir("configuracion"), "ghost")));
  };

  pintar();
  return cont;
}

const bloque = (titulo, texto) => texto ? h("div", {}, h("h5", { text: titulo }), h("p", { text: texto })) : null;

/* ======================================================= COMPETENCIAS ===== */

export function vistaCompetencias(ctx) {
  const { col, m } = ctx.estado;
  const prog = m.prog;
  const puedeEvaluar = ctx.permisos.evalua(col);
  let corte = ctx.estado.ui.corteCompetencias || m.ultimoCorte;

  const cont = h("div", { class: "vista" });

  const pintar = () => {
    cont.replaceChildren();

    cont.appendChild(panel("Escala de evaluación", null,
      h("div", { class: "niveles" }, ...NIVELES.map((n) =>
        h("div", { class: "nivel" }, h("b", { text: String(n.n) },),
          h("div", {}, h("strong", { text: n.etiqueta }), h("p", { text: n.conducta })))))));

    const encabezado = h("div", { class: "head-flex" },
      h("div", {}, h("h3", { text: "Scorecard de competencias" }),
        h("p", { class: "sub", text: puedeEvaluar ? "Califica cada competencia en el corte seleccionado. Deja en cero lo que aún no evalúas." : "Consulta de solo lectura. Las calificaciones las registra tu mentor." })),
      h("div", { class: "cortes" }, ...CORTES.map((c) =>
        h("button", { class: cls("tab", corte === c.id && "activo"), onclick: () => { corte = c.id; ctx.estado.ui.corteCompetencias = c.id; pintar(); } }, c.nombre))));

    const chips = h("div", { class: "resumen-grupos" },
      ...prog.grupos.map((g) => {
        const comps = prog.competencias.filter((c) => c.grupo === g.id);
        const avg = m.promedioGrupo(g.id, corte);
        const req = comps.length ? comps.reduce((a, c) => a + c.req, 0) / comps.length : 0;
        return h("div", { class: "grupo-chip" },
          h("span", { text: g.nombre }),
          h("b", { class: avg >= req ? "ok" : avg > 0 ? "warn" : "off", text: avg ? avg.toFixed(1) : "—" }),
          h("em", { text: `peso ${g.peso}%` }),
          barra(avg, 5, avg >= req ? "var(--run)" : "var(--signal)"));
      }),
      h("div", { class: "grupo-chip total" },
        h("span", { text: "Promedio ponderado" }),
        h("b", { text: m.scoreCorte(corte) ? m.scoreCorte(corte).toFixed(2) : "—" }),
        h("em", { text: `mínimo para graduar: ${m.umbrales.scoreApto.toFixed(2)}` })));

    const filas = prog.competencias.map((c) => {
      const v = m.nivel(c.id, corte);
      const escala = h("div", { class: "escala" }, ...[1, 2, 3, 4, 5].map((n) =>
        h("button", {
          class: cls("punto", v >= n && (v >= c.req ? "punto-ok" : "punto-warn")),
          title: NIVELES[n - 1].etiqueta, disabled: !puedeEvaluar,
          onclick: async () => {
            try {
              await evaluaciones.guardar(col.id, c.id, corte, v === n ? 0 : n, ctx.estado.perfil.id, null);
              await ctx.refrescar(); pintar();
            } catch (e) { aviso(e.message, "error"); }
          },
        }, String(n))));
      return h("tr", {},
        h("td", {}, h("b", { text: c.nombre })),
        h("td", { class: "gris", text: (prog.grupos.find((g) => g.id === c.grupo) || {}).nombre || "" }),
        h("td", { class: "num", text: String(c.ini) }),
        h("td", { class: "num", text: String(c.req) }),
        h("td", {}, h("span", { class: cls("badge", c.imp === "Crítica" && "badge-alta"), text: c.imp })),
        h("td", { class: "gris", text: c.evalua }),
        h("td", {}, escala));
    });

    cont.appendChild(panel(null, null, encabezado, chips,
      tabla(["Competencia", "Grupo", { t: "Inicial esperado", num: true }, { t: "Requerido", num: true }, "Importancia", "Cómo se evalúa", "Calificación"],
        filas, { scroll: true })));

    if (ctx.permisos.editaPrograma(col))
      cont.appendChild(h("div", { class: "acciones-fila" },
        boton("Agregar o modificar competencias", () => ctx.ir("configuracion"), "ghost")));
  };

  pintar();
  return cont;
}

/* =============================================================== KPIs ===== */

export function vistaKpis(ctx) {
  const { col, m } = ctx.estado;
  const prog = m.prog;
  const puedeCapturar = ctx.permisos.captura(col);
  const puedeValidar = ctx.permisos.evalua(col);
  const meses = [1, 2, 3, 4, 5];

  const real = (mes, kid) => {
    const r = (ctx.estado.exp.kpis || []).find((x) => x.kpi_id === kid && Number(x.mes) === mes);
    return r ? Number(r.valor) : 0;
  };
  const validado = (mes, kid) => {
    const r = (ctx.estado.exp.kpis || []).find((x) => x.kpi_id === kid && Number(x.mes) === mes);
    return r ? !!r.validado : false;
  };

  const filas = prog.kpis.map((k) => {
    const celdas = meses.map((n) => {
      const meta = Number((k.metas || [])[n - 1]) || 0;
      const v = real(n, k.id);
      const ok = meta === 0 ? v > 0 : v >= meta;
      const inp = h("input", { type: "number", value: v || "", placeholder: "0", disabled: !puedeCapturar, class: v > 0 ? (ok ? "ok-in" : "warn-in") : "" });
      inp.addEventListener("change", async () => {
        try { await kpiResultados.guardar(col.id, k.id, n, Number(inp.value) || 0); await ctx.refrescar(); aviso("Resultado guardado"); }
        catch (e) { aviso(e.message, "error"); }
      });
      const chk = puedeValidar ? (() => {
        const c = h("input", { type: "checkbox", checked: validado(n, k.id), title: "Validado por el mentor" });
        c.addEventListener("change", async () => {
          try { await kpiResultados.validar(col.id, k.id, n, c.checked, ctx.estado.perfil.id); await ctx.refrescar(); }
          catch (e) { aviso(e.message, "error"); c.checked = !c.checked; }
        });
        return h("label", { class: "chk-mini" }, c, "validado");
      })() : (validado(n, k.id) ? h("span", { class: "verde", text: "validado" }) : null);

      return h("td", { class: "celda-kpi" }, inp,
        h("span", { class: "gris mono", text: "meta " + (k.unidad === "dinero" ? dinero(meta) : numero(meta)) }),
        barra(v, meta || 1, ok ? "var(--run)" : "var(--signal)"), chk);
    });
    return h("tr", {},
      h("td", {}, h("b", { text: k.nombre })),
      h("td", {}, h("span", { class: cls("badge", k.tipo === "Lagging" && "badge-alta"), text: k.tipo })),
      ...celdas,
      h("td", { class: "gris", text: k.logica || "" }));
  });

  const serie = (kid) => meses.map((n) => real(n, kid));
  const buscar = (frag) => prog.kpis.find((k) => k.nombre.toLowerCase().includes(frag));
  const kVis = buscar("visita"), kOpp = buscar("oportunidades detectadas"), kCal = buscar("calificadas"), kCon = buscar("contactos");
  const kPip = buscar("pipeline generado"), kPipC = buscar("pipeline calificado"), kVen = buscar("ventas");

  return h("div", { class: "vista" },
    panel("Indicadores del programa",
      puedeCapturar
        ? "Captura el resultado real de cada mes. Las metas las define el mentor desde Configurar programa."
        : "Metas y resultados definidos por tu mentor.",
      tabla(["Indicador", "Tipo", ...meses.map((n) => ({ t: "Mes " + n, num: true })), "Lógica de la meta"], filas, { scroll: true })),

    h("div", { class: "grid-2" },
      panel("Actividad comercial", null,
        lineas(meses.map((n) => "Mes " + n), [
          kVis && { nombre: kVis.nombre, color: color(0), valores: serie(kVis.id) },
          kCon && { nombre: kCon.nombre, color: color(3), valores: serie(kCon.id) },
          kOpp && { nombre: kOpp.nombre, color: color(2), valores: serie(kOpp.id) },
          kCal && { nombre: kCal.nombre, color: color(1), valores: serie(kCal.id) },
        ].filter(Boolean))),
      panel("Pipeline y ventas", null,
        barras(meses.map((n) => "Mes " + n), [
          kPip && { nombre: kPip.nombre, color: "#C8CCC5", valores: serie(kPip.id) },
          kPipC && { nombre: kPipC.nombre, color: "#3D5464", valores: serie(kPipC.id) },
          kVen && { nombre: kVen.nombre, color: "#1D8A5F", valores: serie(kVen.id) },
        ].filter(Boolean), { formato: dinero, ml: 62 }))),

    panel("Plan de campo: de observar a liderar",
      "Las columnas grises son el plan y los números en negro lo ejecutado.",
      tabla(["Mes", ...["Observa", "Acompañado", "Lidera acompañado", "Lidera solo"].map((t) => ({ t, num: true })), { t: "Total plan", num: true }, { t: "Total real", num: true }],
        prog.planVisitas.map((p) => {
          const r = m.visitas.filter((v) => Number(v.mes) === p.mes);
          const total = p.observa + p.acompanado + p.lidera + p.autonoma;
          const celda = (tipo, meta) => h("td", { class: "num" },
            String(r.filter((v) => v.tipo === tipo).length), h("span", { class: "gris", text: " / " + meta }));
          return h("tr", {}, h("td", {}, h("b", { text: "Mes " + p.mes })),
            celda("observa", p.observa), celda("acompanado", p.acompanado),
            celda("lidera", p.lidera), celda("autonoma", p.autonoma),
            h("td", { class: "num gris", text: String(total) }),
            h("td", { class: "num" }, h("b", { text: String(r.length) }), barra(r.length, total || 1, r.length >= total ? "var(--run)" : "var(--signal)")));
        }))));
}

/* ========================================================= GRADUACIÓN ===== */

export function vistaGraduacion(ctx) {
  const { col, m } = ctx.estado;
  const prog = m.prog;
  const puedeEditar = ctx.permisos.evalua(col);
  const juicio = col.juicio || {};
  const calif = juicio.calificaciones || {};
  const plan90 = juicio.plan90 || [];

  const guardarJuicio = async (campos) => {
    const nuevo = { ...juicio, ...campos };
    await dbCol.actualizar(col.id, { juicio: nuevo });
    await ctx.refrescar();
  };

  const formato = (c) => {
    const f = (FUENTES_CRITERIO.find((x) => x.id === c.fuente) || {}).formato;
    if (f === "dinero") return dinero(c.real) + " de " + dinero(c.meta);
    if (f === "decimal") return (Number(c.real) || 0).toFixed(2) + " de " + Number(c.meta).toFixed(2);
    if (f === "menor") return `${c.real} por debajo (máximo ${c.meta})`;
    if (f === "manual") return c.real ? "Verificado" : "Sin verificar";
    return `${numero(c.real)} de ${numero(c.meta)}`;
  };

  return h("div", { class: "vista" },
    h("section", { class: "panel-card dictamen" },
      h("div", {},
        h("h3", { text: "Dictamen" }),
        h("p", { class: "sub", text: "Se calcula con la evidencia cargada. Los criterios y sus pesos se editan en Configurar programa." }),
        h("div", { class: "dictamen-caja d-" + m.estado },
          h("strong", { text: m.dictamen }),
          h("span", { text: `${m.puntos} de 100 puntos de graduación` })),
        h("ul", { class: "reglas" },
          h("li", {}, h("b", { text: "APTO: " }), `${m.umbrales.apto} puntos o más, scorecard igual o mayor a ${m.umbrales.scoreApto} y ninguna competencia crítica por debajo de su nivel requerido.`),
          h("li", {}, h("b", { text: "APTO CON PLAN DE DESARROLLO: " }), `entre ${m.umbrales.aptoPlan} y ${m.umbrales.apto - 1} puntos con scorecard igual o mayor a ${m.umbrales.scorePlan}.`),
          h("li", {}, h("b", { text: "NO APTO AÚN: " }), `menos de ${m.umbrales.aptoPlan} puntos. Se extiende el programa o se replantea la posición.`))),
      dial(m.puntos)),

    panel("Criterios de graduación", null,
      tabla(["Criterio", "Estado actual", { t: "Puntos", num: true }, "Cumple"],
        m.criterios.map((c) => h("tr", {},
          h("td", {}, h("b", { text: c.nombre })),
          h("td", { class: "mono" }, formato(c),
            c.fuente === "manual" && puedeEditar ? (() => {
              const chk = h("input", { type: "checkbox", checked: !!c.real });
              chk.addEventListener("change", () => guardarJuicio({ manuales: { ...(juicio.manuales || {}), [c.id]: chk.checked } }));
              return h("label", { class: "chk-mini" }, chk, "verificado");
            })() : null),
          h("td", { class: "num", text: String(c.puntos) }),
          h("td", {}, lampara(c.cumple ? "run" : "fault", c.cumple ? "Cumple" : "Pendiente")))))),

    h("div", { class: "grid-2" },
      panel("Evaluación final", "Califica de 0 a 100 cada componente. El resultado se pondera automáticamente.",
        tabla(["Componente", { t: "Peso", num: true }, { t: "Calificación", num: true }],
          [...prog.examen.map((e) => h("tr", {},
            h("td", { text: e.nombre }),
            h("td", { class: "num gris", text: e.peso + "%" }),
            h("td", { class: "num" }, entrada(calif[e.id] ?? "", (v) =>
              guardarJuicio({ calificaciones: { ...calif, [e.id]: Number(v) } }),
              { type: "number", min: 0, max: 100, disabled: !puedeEditar })))),
          h("tr", { class: "fila-total" },
            h("td", {}, h("b", { text: "Calificación final" })),
            h("td", { class: "num", text: prog.examen.reduce((a, e) => a + e.peso, 0) + "%" }),
            h("td", { class: "num mono" }, h("b", { text: m.examenTotal.toFixed(1) })))]),
        h("div", { class: "form-grid sep" },
          campo("Promedio de role plays (1 a 5)", entrada(juicio.rolePlays ?? "", (v) => guardarJuicio({ rolePlays: Number(v) }), { type: "number", step: "0.1", min: 0, max: 5, disabled: !puedeEditar })),
          campo("Evaluación del gerente (1 a 5)", entrada(juicio.evalGerente ?? "", (v) => guardarJuicio({ evalGerente: Number(v) }), { type: "number", step: "0.1", min: 0, max: 5, disabled: !puedeEditar })),
          campo("Comentario del dictamen", area(juicio.notas || "", (v) => guardarJuicio({ notas: v }), 3, { disabled: !puedeEditar }), "full"))),

      panel("Primeros 90 días después de graduar",
        "La transición no termina con el dictamen: aquí se consolida o se pierde lo aprendido.",
        h("div", { class: "bloques-90" }, ...plan90.map((b) =>
          h("div", { class: "bloque90" },
            h("header", {}, h("b", { text: b.bloque }), h("span", { text: b.foco })),
            h("ul", {}, ...(b.acciones || []).map((a) => h("li", { text: a })))))))));
}

/* ============================================================ RIESGOS ===== */

export function vistaRiesgos(ctx) {
  const { col, m } = ctx.estado;
  const puedeEditar = ctx.permisos.editaPrograma(col);
  const juicio = col.juicio || {};
  const marcas = juicio.riesgos || {};

  const set = async (id, campos) => {
    const nuevo = { ...marcas, [id]: { ...(marcas[id] || {}), ...campos } };
    await dbCol.actualizar(col.id, { juicio: { ...juicio, riesgos: nuevo } });
    await ctx.refrescar();
  };

  return h("div", { class: "vista" },
    panel("Por qué fracasa esta transición",
      "Marca el riesgo cuando aparezca la señal. La acción preventiva es responsabilidad del mentor y del gerente, no del participante.",
      h("div", { class: "riesgos" }, ...m.prog.riesgos.map((r, i) => {
        const est = marcas[r.id] || {};
        const chk = h("input", { type: "checkbox", checked: !!est.activo, disabled: !puedeEditar });
        chk.addEventListener("change", () => set(r.id, { activo: chk.checked }));
        return h("article", { class: cls("riesgo", est.activo && "riesgo-activo") },
          h("header", {},
            h("span", { class: "riesgo-n", text: String(i + 1) }),
            h("h4", { text: r.riesgo }),
            h("label", { class: "check-inline" }, chk, "Señal presente")),
          h("p", { class: "senal" }, h("b", { text: "Cómo se detecta: " }), r.senal),
          h("p", {}, h("b", { text: "Acción preventiva: " }), r.accion),
          entrada(est.nota || "", (v) => set(r.id, { nota: v }), { placeholder: "Nota de seguimiento", disabled: !puedeEditar }));
      }))),

    panel("Cadencia de acompañamiento", null,
      tabla(["Actividad", "Frecuencia", "Vigencia"],
        ((col.juicio && col.juicio.cadencia) || []).map((c) =>
          h("tr", {}, h("td", {}, h("b", { text: c.actividad })), h("td", { text: c.frecuencia }), h("td", { class: "gris", text: c.mes }))))));
}

/* ====================================================== CONFIGURACIÓN ===== */

export function vistaConfiguracion(ctx) {
  const { col } = ctx.estado;
  const prog = ctx.estado.m.prog;
  if (!ctx.permisos.editaPrograma(col))
    return panel("Sin permiso para editar", "Solo el administrador o el mentor asignado pueden modificar este plan.");

  const cont = h("div", { class: "vista" });
  const ui = ctx.estado.ui;
  if (!ui.pestanaConfig) ui.pestanaConfig = "plan";

  const guardar = async (campos, mensaje) => {
    await dbCol.actualizar(col.id, campos);
    aviso(mensaje || "Cambios guardados");
    await ctx.refrescar();
  };

  const pestanas = [
    { id: "plan", nombre: "Semanas y tareas" },
    { id: "competencias", nombre: "Competencias" },
    { id: "kpis", nombre: "Indicadores y metas" },
    { id: "criterios", nombre: "Criterios de graduación" },
    { id: "visitas", nombre: "Plan de campo" },
    { id: "etapas", nombre: "Etapas del embudo" },
    { id: "examen", nombre: "Examen final" },
    { id: "riesgos", nombre: "Riesgos" },
  ];

  const pintar = () => {
    cont.replaceChildren();
    cont.appendChild(h("div", { class: "head-flex" },
      h("div", {}, h("h2", { class: "titulo-vista", text: "Configurar el programa de " + col.nombre }),
        h("p", { class: "sub", text: "Todo lo que definas aquí aplica solo a esta persona. Puedes agregar, quitar o reescribir cualquier objetivo, meta o actividad." })),
      boton("Copiar programa de otro colaborador", () => copiarDeOtro(ctx, guardar), "ghost")));

    cont.appendChild(h("div", { class: "tabs" }, ...pestanas.map((p) =>
      h("button", { class: cls("tab", ui.pestanaConfig === p.id && "activo"), onclick: () => { ui.pestanaConfig = p.id; pintar(); } }, p.nombre))));

    const vistas = {
      plan: () => editorPlan(prog, guardar),
      competencias: () => editorCompetencias(prog, guardar),
      kpis: () => editorKpis(prog, guardar),
      criterios: () => editorCriterios(prog, col, guardar),
      visitas: () => editorPlanVisitas(prog, guardar),
      etapas: () => editorEtapas(prog, guardar),
      examen: () => editorExamen(prog, guardar),
      riesgos: () => editorRiesgos(prog, guardar),
    };
    cont.appendChild((vistas[ui.pestanaConfig] || vistas.plan)());
  };

  pintar();
  return cont;
}

/* --- editor de semanas ---------------------------------------------------- */

function editorPlan(prog, guardar) {
  const plan = JSON.parse(JSON.stringify(prog.plan));
  const cont = h("div", {});

  const render = () => {
    cont.replaceChildren();
    cont.appendChild(panel("Semanas del programa",
      "Cada semana tiene su objetivo, su contenido y su lista de verificación. Agrega las que necesites para este colaborador.",
      h("div", { class: "semanas" }, ...plan.map((s, i) => tarjetaSemana(s, i, plan, render, guardar)),
        h("div", { class: "acciones-fila" },
          boton("Agregar semana", () => {
            plan.push({
              id: "S" + uid(), mes: (plan[plan.length - 1] || { mes: 1 }).mes, titulo: "Nueva semana",
              objetivo: "", tema: "", cap: "", practica: "", real: "", kpi: "", evidencia: "", resp: "",
              tasks: [{ id: "t1", texto: "Nueva tarea" }],
            });
            render();
          }),
          boton("Guardar todas las semanas", () => guardar({ plan }, "Plan actualizado"), "principal")))));
  };
  render();
  return cont;
}

function tarjetaSemana(s, i, plan, render, guardar) {
  const cuerpo = h("div", { class: "semana-cuerpo", style: { display: "none" } });
  const art = h("article", { class: "semana" },
    h("header", { onclick: (e) => { if (e.target.tagName !== "BUTTON") cuerpo.style.display = cuerpo.style.display === "none" ? "" : "none"; } },
      h("div", {}, h("span", { class: "semana-id", text: `Semana ${i + 1} · Mes ${s.mes}` }), h("h4", { text: s.titulo })),
      h("div", { class: "semana-meta" },
        h("span", { class: "gris", text: (s.tasks || []).length + " tareas" }),
        boton("Quitar", () => { plan.splice(i, 1); render(); }, "ghost"),
        h("span", { class: "chev", text: "▾" }))),
    cuerpo);

  const campos = [
    ["titulo", "Título de la semana", 1], ["mes", "Mes", 0], ["objetivo", "Objetivo", 2], ["tema", "Tema", 2],
    ["cap", "Actividad de capacitación", 3], ["practica", "Práctica y role play", 3],
    ["real", "Actividad comercial real", 3], ["kpi", "Indicador de la semana", 2],
    ["evidencia", "Evidencia esperada", 2], ["resp", "Responsable", 1],
  ];
  cuerpo.appendChild(h("div", { class: "form-grid" }, ...campos.map(([k, label, filas]) =>
    campo(label,
      k === "mes" ? entrada(s.mes, (v) => { s.mes = Number(v) || 1; }, { type: "number", min: 1, max: 12 })
        : filas > 1 ? area(s[k] || "", (v) => { s[k] = v; }, filas)
          : entrada(s[k] || "", (v) => { s[k] = v; }),
      k === "mes" ? null : "full"))));

  const ul = h("ul", { class: "check editable" });
  const pintarTareas = () => {
    ul.replaceChildren();
    (s.tasks || []).forEach((t, j) => {
      ul.appendChild(h("li", { class: "tarea-edit" },
        entrada(t.texto, (v) => { t.texto = v; }),
        boton("Quitar", () => { s.tasks.splice(j, 1); pintarTareas(); }, "ghost")));
    });
    ul.appendChild(h("li", {}, boton("Agregar tarea", () => {
      s.tasks = s.tasks || []; s.tasks.push({ id: "t" + uid(), texto: "" }); pintarTareas();
    }, "ghost")));
  };
  pintarTareas();
  cuerpo.appendChild(h("h5", { text: "Lista de verificación de la semana" }));
  cuerpo.appendChild(ul);
  return art;
}

/* --- editor de competencias ---------------------------------------------- */

function editorCompetencias(prog, guardar) {
  const grupos = JSON.parse(JSON.stringify(prog.grupos));
  const comps = JSON.parse(JSON.stringify(prog.competencias));
  const cont = h("div", {});

  const render = () => {
    cont.replaceChildren();
    const sumaPesos = grupos.reduce((a, g) => a + (Number(g.peso) || 0), 0);

    cont.appendChild(panel("Grupos y ponderación",
      "La suma de los pesos debería dar 100. El scorecard usa estos pesos para calcular el promedio ponderado.",
      tabla(["Grupo", { t: "Peso %", num: true }, { t: "Competencias", num: true }, ""],
        [...grupos.map((g, i) => h("tr", {},
          h("td", {}, entrada(g.nombre, (v) => { g.nombre = v; })),
          h("td", { class: "num" }, entrada(g.peso, (v) => { g.peso = Number(v) || 0; render(); }, { type: "number", min: 0, max: 100 })),
          h("td", { class: "num", text: String(comps.filter((c) => c.grupo === g.id).length) }),
          h("td", { class: "acciones" }, boton("Quitar", () => {
            if (comps.some((c) => c.grupo === g.id)) { aviso("Primero mueve o quita las competencias de este grupo", "error"); return; }
            grupos.splice(i, 1); render();
          }, "ghost")))),
        h("tr", { class: "fila-total" },
          h("td", {}, h("b", { text: "Suma de pesos" })),
          h("td", { class: "num" }, h("b", { class: sumaPesos === 100 ? "verde-fuerte" : "rojo", text: sumaPesos + "%" })),
          h("td", { class: "num", text: String(comps.length) }), h("td", {}))]),
      h("div", { class: "acciones-fila" },
        boton("Agregar grupo", () => { grupos.push({ id: "g" + uid(), nombre: "Nuevo grupo", peso: 0 }); render(); }, "ghost"))));

    cont.appendChild(panel("Competencias",
      "El nivel requerido es el que debe alcanzar para graduarse. Las críticas bloquean el dictamen si quedan por debajo.",
      tabla(["Competencia", "Grupo", { t: "Inicial", num: true }, { t: "Requerido", num: true }, "Importancia", "Cómo se evalúa", ""],
        comps.map((c, i) => h("tr", {},
          h("td", {}, entrada(c.nombre, (v) => { c.nombre = v; })),
          h("td", {}, seleccion(c.grupo, grupos.map((g) => ({ id: g.id, nombre: g.nombre })), (v) => { c.grupo = v; })),
          h("td", { class: "num" }, entrada(c.ini, (v) => { c.ini = Number(v); }, { type: "number", min: 0, max: 5 })),
          h("td", { class: "num" }, entrada(c.req, (v) => { c.req = Number(v); }, { type: "number", min: 1, max: 5 })),
          h("td", {}, seleccion(c.imp, ["Crítica", "Alta", "Media"].map((x) => ({ id: x, nombre: x })), (v) => { c.imp = v; })),
          h("td", {}, entrada(c.evalua || "", (v) => { c.evalua = v; })),
          h("td", { class: "acciones" }, boton("Quitar", () => { comps.splice(i, 1); render(); }, "ghost")))),
        { scroll: true }),
      h("div", { class: "acciones-fila" },
        boton("Agregar competencia", () => {
          comps.push({ id: "c" + uid(), grupo: grupos[0] ? grupos[0].id : "g1", nombre: "Nueva competencia", ini: 1, req: 4, imp: "Alta", evalua: "" });
          render();
        }, "ghost"),
        boton("Guardar competencias", () => guardar({ grupos, competencias: comps }, "Competencias actualizadas")))));
  };
  render();
  return cont;
}

/* --- editor de KPIs ------------------------------------------------------- */

function editorKpis(prog, guardar) {
  const kpis = JSON.parse(JSON.stringify(prog.kpis));
  const cont = h("div", {});
  const meses = [1, 2, 3, 4, 5];

  const render = () => {
    cont.replaceChildren();
    cont.appendChild(panel("Indicadores y metas mensuales",
      "Define exactamente qué debe alcanzar esta persona cada mes. Puedes agregar indicadores propios de tu sucursal o de tu mercado.",
      tabla(["Indicador", "Tipo", "Unidad", ...meses.map((n) => ({ t: "Mes " + n, num: true })), "Lógica", ""],
        kpis.map((k, i) => h("tr", {},
          h("td", {}, entrada(k.nombre, (v) => { k.nombre = v; })),
          h("td", {}, seleccion(k.tipo, [{ id: "Leading", nombre: "Leading" }, { id: "Lagging", nombre: "Lagging" }], (v) => { k.tipo = v; })),
          h("td", {}, seleccion(k.unidad || "cantidad", [{ id: "cantidad", nombre: "Cantidad" }, { id: "dinero", nombre: "Dinero" }], (v) => { k.unidad = v; })),
          ...meses.map((n) => h("td", { class: "num" },
            entrada((k.metas || [])[n - 1] ?? 0, (v) => { k.metas = k.metas || []; k.metas[n - 1] = Number(v) || 0; }, { type: "number", min: 0 }))),
          h("td", {}, entrada(k.logica || "", (v) => { k.logica = v; })),
          h("td", { class: "acciones" }, boton("Quitar", () => { kpis.splice(i, 1); render(); }, "ghost")))),
        { scroll: true }),
      h("div", { class: "acciones-fila" },
        boton("Agregar indicador", () => {
          kpis.push({ id: "k" + uid(), nombre: "Nuevo indicador", tipo: "Leading", unidad: "cantidad", metas: [0, 0, 0, 0, 0], logica: "" });
          render();
        }, "ghost"),
        boton("Guardar indicadores", () => guardar({ kpis }, "Indicadores actualizados")))));
  };
  render();
  return cont;
}

/* --- editor de criterios -------------------------------------------------- */

function editorCriterios(prog, col, guardar) {
  const criterios = JSON.parse(JSON.stringify(prog.criterios));
  const juicio = JSON.parse(JSON.stringify(col.juicio || {}));
  const u = juicio.umbrales || { apto: 85, aptoPlan: 65, scoreApto: 4, scorePlan: 3.5 };
  const cont = h("div", {});

  const render = () => {
    cont.replaceChildren();
    const suma = criterios.reduce((a, c) => a + (Number(c.puntos) || 0), 0);

    cont.appendChild(panel("Criterios de graduación",
      "Cada criterio se compara automáticamente contra la evidencia cargada, salvo los de verificación manual. Los puntos se normalizan a 100.",
      tabla(["Criterio", "De dónde se toma el valor", { t: "Meta", num: true }, { t: "Puntos", num: true }, ""],
        [...criterios.map((c, i) => h("tr", {},
          h("td", {}, entrada(c.nombre, (v) => { c.nombre = v; })),
          h("td", {}, seleccion(c.fuente, FUENTES_CRITERIO.map((f) => ({ id: f.id, nombre: f.nombre })), (v) => { c.fuente = v; })),
          h("td", { class: "num" }, entrada(c.meta, (v) => { c.meta = Number(v); }, { type: "number", min: 0 })),
          h("td", { class: "num" }, entrada(c.puntos, (v) => { c.puntos = Number(v) || 0; render(); }, { type: "number", min: 0 })),
          h("td", { class: "acciones" }, boton("Quitar", () => { criterios.splice(i, 1); render(); }, "ghost")))),
        h("tr", { class: "fila-total" },
          h("td", {}, h("b", { text: "Suma de puntos" })), h("td", { class: "gris", text: "se normaliza a 100" }),
          h("td", {}), h("td", { class: "num" }, h("b", { text: String(suma) })), h("td", {}))]),
      h("div", { class: "acciones-fila" },
        boton("Agregar criterio", () => {
          criterios.push({ id: "x" + uid(), nombre: "Nuevo criterio", fuente: "manual", meta: 1, puntos: 5 });
          render();
        }, "ghost"))));

    cont.appendChild(panel("Umbrales del dictamen", null,
      h("div", { class: "form-grid" },
        campo("Puntos mínimos para APTO", entrada(u.apto, (v) => { u.apto = Number(v); }, { type: "number", min: 0, max: 100 })),
        campo("Puntos mínimos para APTO CON PLAN", entrada(u.aptoPlan, (v) => { u.aptoPlan = Number(v); }, { type: "number", min: 0, max: 100 })),
        campo("Scorecard mínimo para APTO", entrada(u.scoreApto, (v) => { u.scoreApto = Number(v); }, { type: "number", step: "0.1", min: 1, max: 5 })),
        campo("Scorecard mínimo para APTO CON PLAN", entrada(u.scorePlan, (v) => { u.scorePlan = Number(v); }, { type: "number", step: "0.1", min: 1, max: 5 }))),
      h("div", { class: "acciones-fila" },
        boton("Guardar criterios y umbrales", () => guardar({ criterios, juicio: { ...juicio, umbrales: u } }, "Criterios actualizados")))));
  };
  render();
  return cont;
}

/* --- editores menores ----------------------------------------------------- */

function editorPlanVisitas(prog, guardar) {
  const pv = JSON.parse(JSON.stringify(prog.planVisitas));
  const cont = h("div", {});
  const render = () => {
    cont.replaceChildren();
    cont.appendChild(panel("Plan de campo por mes",
      "Cuántas visitas debe observar, acompañar, liderar con apoyo y liderar solo en cada mes.",
      tabla([{ t: "Mes", num: true }, { t: "Observa", num: true }, { t: "Acompañado", num: true }, { t: "Lidera acompañado", num: true }, { t: "Lidera solo", num: true }, { t: "Total", num: true }, ""],
        pv.map((p, i) => h("tr", {},
          h("td", { class: "num" }, entrada(p.mes, (v) => { p.mes = Number(v); }, { type: "number", min: 1 })),
          ...["observa", "acompanado", "lidera", "autonoma"].map((k) =>
            h("td", { class: "num" }, entrada(p[k], (v) => { p[k] = Number(v) || 0; render(); }, { type: "number", min: 0 }))),
          h("td", { class: "num mono", text: String(p.observa + p.acompanado + p.lidera + p.autonoma) }),
          h("td", { class: "acciones" }, boton("Quitar", () => { pv.splice(i, 1); render(); }, "ghost"))))),
      h("div", { class: "acciones-fila" },
        boton("Agregar mes", () => { pv.push({ mes: pv.length + 1, observa: 0, acompanado: 0, lidera: 0, autonoma: 0 }); render(); }, "ghost"),
        boton("Guardar plan de campo", () => guardar({ plan_visitas: pv }, "Plan de campo actualizado")))));
  };
  render();
  return cont;
}

function editorEtapas(prog, guardar) {
  const etapas = JSON.parse(JSON.stringify(prog.etapas));
  const cont = h("div", {});
  const render = () => {
    cont.replaceChildren();
    cont.appendChild(panel("Etapas del embudo y criterios de avance",
      "Una oportunidad solo avanza cuando cumple todos los criterios de su etapa. Esto es lo que evita el pipeline inflado.",
      h("div", { class: "etapas" }, ...etapas.map((e, i) =>
        h("div", { class: "etapa-card" },
          h("header", {}, entrada(e.nombre, (v) => { e.nombre = v; }),
            entrada(e.prob, (v) => { e.prob = Number(v); }, { type: "number", min: 0, max: 100 })),
          h("ul", { class: "criterios-edit" }, ...(e.criterios || []).map((c, j) =>
            h("li", {}, entrada(c, (v) => { e.criterios[j] = v; }),
              boton("×", () => { e.criterios.splice(j, 1); render(); }, "ghost")))),
          h("footer", {},
            boton("Agregar criterio", () => { e.criterios = e.criterios || []; e.criterios.push(""); render(); }, "ghost"),
            boton("Quitar etapa", () => { etapas.splice(i, 1); render(); }, "ghost"))))),
      h("div", { class: "acciones-fila" },
        boton("Agregar etapa", () => { etapas.push({ id: "e" + uid(), nombre: "Nueva etapa", prob: 0, criterios: [] }); render(); }, "ghost"),
        boton("Guardar etapas", () => guardar({ etapas }, "Etapas actualizadas")))));
  };
  render();
  return cont;
}

function editorExamen(prog, guardar) {
  const examen = JSON.parse(JSON.stringify(prog.examen));
  const cont = h("div", {});
  const render = () => {
    cont.replaceChildren();
    const suma = examen.reduce((a, e) => a + (Number(e.peso) || 0), 0);
    cont.appendChild(panel("Componentes del examen final", "La suma de los pesos debería dar 100.",
      tabla(["Componente", { t: "Peso %", num: true }, ""],
        [...examen.map((e, i) => h("tr", {},
          h("td", {}, entrada(e.nombre, (v) => { e.nombre = v; })),
          h("td", { class: "num" }, entrada(e.peso, (v) => { e.peso = Number(v) || 0; render(); }, { type: "number", min: 0, max: 100 })),
          h("td", { class: "acciones" }, boton("Quitar", () => { examen.splice(i, 1); render(); }, "ghost")))),
        h("tr", { class: "fila-total" }, h("td", {}, h("b", { text: "Suma" })),
          h("td", { class: "num" }, h("b", { class: suma === 100 ? "verde-fuerte" : "rojo", text: suma + "%" })), h("td", {}))]),
      h("div", { class: "acciones-fila" },
        boton("Agregar componente", () => { examen.push({ id: "e" + uid(), nombre: "Nuevo componente", peso: 0 }); render(); }, "ghost"),
        boton("Guardar examen", () => guardar({ examen }, "Examen actualizado")))));
  };
  render();
  return cont;
}

function editorRiesgos(prog, guardar) {
  const riesgos = JSON.parse(JSON.stringify(prog.riesgos));
  const cont = h("div", {});
  const render = () => {
    cont.replaceChildren();
    cont.appendChild(panel("Riesgos del programa", "Agrega los riesgos propios de tu sucursal o de esta persona en particular.",
      tabla(["Riesgo", "Señal de alerta", "Acción preventiva", ""],
        riesgos.map((r, i) => h("tr", {},
          h("td", {}, entrada(r.riesgo, (v) => { r.riesgo = v; })),
          h("td", {}, area(r.senal, (v) => { r.senal = v; }, 2)),
          h("td", {}, area(r.accion, (v) => { r.accion = v; }, 2)),
          h("td", { class: "acciones" }, boton("Quitar", () => { riesgos.splice(i, 1); render(); }, "ghost")))),
        { scroll: true }),
      h("div", { class: "acciones-fila" },
        boton("Agregar riesgo", () => { riesgos.push({ id: "r" + uid(), riesgo: "", senal: "", accion: "" }); render(); }, "ghost"),
        boton("Guardar riesgos", () => guardar({ riesgos }, "Riesgos actualizados")))));
  };
  render();
  return cont;
}

function copiarDeOtro(ctx, guardar) {
  const otros = ctx.estado.colaboradores.filter((c) => c.id !== ctx.estado.col.id);
  if (!otros.length) { aviso("No hay otro colaborador de dónde copiar", "error"); return; }
  let elegido = otros[0].id;
  let que = "todo";
  modal("Copiar programa de otro colaborador",
    h("div", {},
      h("p", { class: "texto", text: "Se reemplaza la configuración de este colaborador. Su avance, sus visitas y sus calificaciones no se tocan." }),
      h("div", { class: "form-grid" },
        campo("Copiar de", seleccion(elegido, otros.map((c) => ({ id: c.id, nombre: c.nombre })), (v) => { elegido = v; })),
        campo("Qué copiar", seleccion(que, [
          { id: "todo", nombre: "Todo el programa" },
          { id: "plan", nombre: "Solo las semanas y tareas" },
          { id: "metas", nombre: "Solo indicadores y criterios" },
        ], (v) => { que = v; })))),
    [boton("Cancelar", cerrarModal, "ghost"), boton("Copiar", async () => {
      const c = await dbCol.leer(elegido);
      const campos = que === "plan" ? { plan: c.plan }
        : que === "metas" ? { kpis: c.kpis, criterios: c.criterios }
          : { plan: c.plan, grupos: c.grupos, competencias: c.competencias, kpis: c.kpis, criterios: c.criterios, plan_visitas: c.plan_visitas, etapas: c.etapas, riesgos: c.riesgos, examen: c.examen };
      cerrarModal();
      await guardar(campos, "Programa copiado");
    })]);
}
