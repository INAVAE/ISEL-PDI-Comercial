/* ===========================================================================
   Vistas de actividad comercial: visitas de campo, pipeline, cuentas
   y sesiones de coaching.
   =========================================================================== */

import { visitas as dbVisitas, oportunidades as dbOpps, cuentas as dbCuentas, coaching as dbCoaching } from "./db.js";
import { TIPOS_VISITA, MADUREZ } from "./plantilla.js";
import {
  h, panel, tabla, boton, campo, entrada, area, seleccion, modal, cerrarModal, aviso, confirmar,
  lampara, barra, dinero, numero, pct, fecha, vacio, barras, barrasH, color, cls, tarjeta, uid,
} from "./ui.js";

/* ============================================================ VISITAS ===== */

export function vistaVisitas(ctx) {
  const { col, m, exp } = ctx.estado;
  const puede = ctx.permisos.captura(col);
  const esMentor = ctx.permisos.evalua(col);
  const lista = [...(exp.visitas || [])].sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));

  const progresion = m.prog.planVisitas.map((p) => m.visitas.filter((v) => Number(v.mes) === p.mes));

  return h("div", { class: "vista" },
    h("div", { class: "grid-4" },
      tarjeta("Visitas acumuladas", m.visitas.length, "Meta de graduación: " + metaDe(m, "visitas"), pct(m.visitas.length, metaDe(m, "visitas"))),
      tarjeta("Lideradas solo", m.visitasSolo, "Meta de graduación: " + metaDe(m, "visitas_solo"), pct(m.visitasSolo, metaDe(m, "visitas_solo"))),
      tarjeta("A cuentas nuevas", m.visitasNuevas, `${pct(m.visitasNuevas, m.visitas.length || 1)}% del total`, pct(m.visitasNuevas, (m.visitas.length || 1) * 0.3)),
      tarjeta("Visitas validadas", m.visitas.filter((v) => v.validada).length, "Revisadas por el mentor", pct(m.visitas.filter((v) => v.validada).length, m.visitas.length || 1))),

    panel("Progresión de campo", "De observar al mentor a liderar solo.",
      barras(m.prog.planVisitas.map((p) => "Mes " + p.mes),
        TIPOS_VISITA.map((t, i) => ({
          nombre: t.nombre, color: ["#C8CCC5", "#8FA0AC", "#3D5464", "#1D8A5F"][i],
          valores: progresion.map((r) => r.filter((v) => v.tipo === t.id).length),
        })), { apilado: true })),

    panel(null, null,
      h("div", { class: "head-flex" },
        h("div", {}, h("h3", { text: "Bitácora de visitas" }),
          h("p", { class: "sub", text: "Una visita sin formato levantado no cuenta para la graduación." })),
        puede ? boton("Registrar visita", () => formVisita(ctx, null)) : null),
      lista.length
        ? tabla(["Fecha", "Empresa", "Tipo", "Pains detectados", "Próxima acción", { t: "Calidad", num: true }, "Estado", ""],
          lista.map((v) => h("tr", {},
            h("td", { class: "mono" }, v.fecha ? fecha(v.fecha) : "—", h("br"), h("span", { class: "gris", text: "Mes " + v.mes })),
            h("td", {}, h("b", { text: v.empresa || "Sin nombre" }), h("br"),
              h("span", { class: "gris", text: (v.planta || "") + (v.cuenta_nueva ? " · cuenta nueva" : "") })),
            h("td", { text: (TIPOS_VISITA.find((t) => t.id === v.tipo) || {}).nombre || v.tipo }),
            h("td", { class: "gris", text: recortar(v.pains) }),
            h("td", {}, v.prox_accion || h("span", { class: "rojo", text: "Sin definir" }),
              h("br"), h("span", { class: "gris mono", text: v.fecha_prox ? fecha(v.fecha_prox) : "" })),
            h("td", { class: "num", text: v.calidad ? String(v.calidad) : "—" }),
            h("td", {}, v.validada ? lampara("run", "Validada") : lampara("off", "Por revisar")),
            h("td", { class: "acciones" },
              boton("Abrir", () => formVisita(ctx, v), "ghost"),
              puede ? boton("Borrar", () => confirmar("¿Borrar esta visita?", async () => {
                await dbVisitas.borrar(v.id); aviso("Visita borrada"); ctx.refrescar();
              }), "ghost") : null))), { scroll: true })
        : vacio("Todavía no hay visitas registradas",
          "Cada visita se documenta el mismo día con hallazgos, pains, impacto y siguiente paso.",
          puede ? boton("Registrar la primera", () => formVisita(ctx, null)) : null)));
}

function formVisita(ctx, v) {
  const { col } = ctx.estado;
  const puede = ctx.permisos.captura(col);
  const esMentor = ctx.permisos.evalua(col);
  const f = v ? { ...v } : {
    colaborador_id: col.id, fecha: new Date().toISOString().slice(0, 10), mes: mesSugerido(ctx),
    empresa: "", planta: "", tipo: "acompanado", cuenta_nueva: false, objetivo: "", contactos: "",
    hallazgos: "", pains: "", aplicaciones: "", impacto: "", stakeholders: "", competencia: "",
    oportunidades: "", prox_accion: "", fecha_prox: "", calidad: 0, validada: false, comentario_mentor: "",
  };
  const set = (k) => (val) => { f[k] = val; };
  const d = { disabled: !puede };

  const cuerpo = h("div", { class: "form-grid" },
    campo("Fecha", entrada(f.fecha, set("fecha"), { type: "date", ...d })),
    campo("Mes del programa", seleccion(f.mes, [1, 2, 3, 4, 5].map((n) => ({ id: n, nombre: "Mes " + n })), (x) => { f.mes = Number(x); }, d)),
    campo("Tipo de participación", seleccion(f.tipo, TIPOS_VISITA, set("tipo"), d)),
    campo("Empresa", entrada(f.empresa, set("empresa"), d)),
    campo("Planta o ubicación", entrada(f.planta, set("planta"), d)),
    campo("Calidad de la visita (1 a 5)", seleccion(f.calidad, [{ id: 0, nombre: "Sin evaluar" }, ...[1, 2, 3, 4, 5].map((n) => ({ id: n, nombre: String(n) }))], (x) => { f.calidad = Number(x); }, { disabled: !esMentor })),
    campo("Objetivo de la visita", entrada(f.objetivo, set("objetivo"), { placeholder: "Qué quería lograr y con qué hipótesis entró", ...d }), "full"),
    campo("Contactos y puestos", entrada(f.contactos, set("contactos"), d), "full"),
    campo("Información descubierta", area(f.hallazgos, set("hallazgos"), 2, { placeholder: "Procesos, turnos, proyectos, planes de inversión, obsolescencia", ...d }), "full"),
    campo("Pain points", area(f.pains, set("pains"), 2, { placeholder: "Qué le duele al cliente, en sus propias palabras", ...d }), "full"),
    campo("Aplicaciones identificadas", area(f.aplicaciones, set("aplicaciones"), 2, d), "full"),
    campo("Impacto estimado", area(f.impacto, set("impacto"), 2, { placeholder: "Frecuencia por duración por costo. Anota los supuestos y quién los validó", ...d }), "full"),
    campo("Stakeholders nuevos", entrada(f.stakeholders, set("stakeholders"), d), "full"),
    campo("Competencia presente", entrada(f.competencia, set("competencia"), d)),
    campo("Oportunidades generadas", entrada(f.oportunidades, set("oportunidades"), d)),
    campo("Próxima acción", entrada(f.prox_accion, set("prox_accion"), d)),
    campo("Fecha comprometida", entrada(f.fecha_prox, set("fecha_prox"), { type: "date", ...d })),
    (() => {
      const chk = h("input", { type: "checkbox", checked: f.cuenta_nueva, disabled: !puede });
      chk.addEventListener("change", () => { f.cuenta_nueva = chk.checked; });
      return h("label", { class: "check-inline" }, chk, "Es una cuenta nueva para ISEL");
    })(),
    esMentor ? campo("Comentario del mentor", area(f.comentario_mentor, set("comentario_mentor"), 2), "full") : null,
    esMentor ? (() => {
      const chk = h("input", { type: "checkbox", checked: f.validada });
      chk.addEventListener("change", () => { f.validada = chk.checked; });
      return h("label", { class: "check-inline" }, chk, "Visita revisada y validada por el mentor");
    })() : null);

  modal(v ? "Formato de revisión de visita" : "Nueva visita", cuerpo,
    puede || esMentor ? [boton("Cancelar", cerrarModal, "ghost"), boton("Guardar visita", async () => {
      try {
        const { colaborador_id, ...resto } = f;
        await dbVisitas.guardar(f.id ? f : { ...f, colaborador_id: col.id });
        cerrarModal(); aviso("Visita guardada"); ctx.refrescar();
      } catch (e) { aviso(e.message, "error"); }
    })] : [boton("Cerrar", cerrarModal, "ghost")], "ancho");
}

/* =========================================================== PIPELINE ===== */

export function vistaPipeline(ctx) {
  const { col, m, exp } = ctx.estado;
  const puede = ctx.permisos.captura(col);
  const etapas = m.prog.etapas;
  const lista = exp.opps || [];

  return h("div", { class: "vista" },
    panel("Criterios de avance de etapa",
      "Una oportunidad solo avanza cuando cumple todos los criterios de su etapa.",
      h("div", { class: "etapas" }, ...etapas.map((e) =>
        h("div", { class: "etapa-card" },
          h("header", {}, h("b", { text: e.nombre }), h("span", { class: "mono", text: e.prob + "%" })),
          h("ul", {}, ...(e.criterios || []).map((c) => h("li", { text: c }))),
          h("footer", { text: `${lista.filter((o) => o.etapa === e.id).length} oportunidades · ${dinero(lista.filter((o) => o.etapa === e.id).reduce((a, o) => a + (Number(o.valor) || 0), 0))}` }))))),

    h("div", { class: "grid-4" },
      tarjeta("Pipeline abierto", dinero(m.pipeline), "Suma de oportunidades vivas", pct(m.pipeline, metaDe(m, "pipeline_cal") * 1.5 || 1)),
      tarjeta("Pipeline ponderado", dinero(m.ponderado), "Valor por probabilidad", pct(m.ponderado, metaDe(m, "pipeline_cal") || 1)),
      tarjeta("Creadas por el vendedor", `${m.creadas} de ${lista.length}`, "Meta: 60 % o más creadas, no reactivas", pct(m.creadas, Math.max(1, lista.length * 0.6))),
      tarjeta("Tasa de cierre", m.tasaCierre + "%", `${m.ganadas.length} oportunidades ganadas`, m.tasaCierre)),

    panel(null, null,
      h("div", { class: "head-flex" },
        h("div", {}, h("h3", { text: "Oportunidades" }),
          h("p", { class: "sub", text: "Cada oportunidad necesita decisor, presupuesto, timing y próxima acción con fecha." })),
        puede ? boton("Nueva oportunidad", () => formOpp(ctx, null)) : null),
      lista.length
        ? tabla(["Oportunidad", "Cuenta", "Etapa", { t: "Valor", num: true }, { t: "Prob.", num: true }, "Cierre", "Decisor", "Próxima acción", ""],
          lista.map((o) => {
            const et = etapas.find((e) => e.id === o.etapa) || { nombre: o.etapa, criterios: [] };
            const listo = (et.criterios || []).length && (et.criterios || []).every((_, i) => (o.checks || {})[et.id + i]);
            return h("tr", {},
              h("td", {}, h("b", { text: o.nombre || "Sin título" }), h("br"), h("span", { class: "gris", text: o.aplicacion || "" })),
              h("td", { text: o.cuenta || "—" }),
              h("td", {}, h("span", { class: cls("badge", "etapa-" + o.etapa), text: et.nombre }),
                listo && o.etapa !== "ganada" && o.etapa !== "perdida" ? h("div", { class: "verde", text: "Listo para avanzar" }) : null),
              h("td", { class: "num mono", text: dinero(o.valor) }),
              h("td", { class: "num mono", text: (o.probabilidad ?? 0) + "%" }),
              h("td", { class: "mono", text: o.cierre ? fecha(o.cierre) : "—" }),
              h("td", {}, o.decisor || h("span", { class: "rojo", text: "Falta" })),
              h("td", {}, o.prox_accion || h("span", { class: "rojo", text: "Falta" }),
                h("br"), h("span", { class: "gris mono", text: o.fecha_prox ? fecha(o.fecha_prox) : "" })),
              h("td", { class: "acciones" },
                boton("Abrir", () => formOpp(ctx, o), "ghost"),
                puede ? boton("Borrar", () => confirmar("¿Borrar esta oportunidad?", async () => {
                  await dbOpps.borrar(o.id); aviso("Oportunidad borrada"); ctx.refrescar();
                }), "ghost") : null));
          }), { scroll: true })
        : vacio("El pipeline está vacío",
          "Registra las oportunidades reales detectadas en campo, incluso las pequeñas.",
          puede ? boton("Cargar la primera", () => formOpp(ctx, null)) : null)));
}

function formOpp(ctx, o) {
  const { col, m } = ctx.estado;
  const puede = ctx.permisos.captura(col);
  const etapas = m.prog.etapas;
  const f = o ? { ...o, checks: { ...(o.checks || {}) } } : {
    colaborador_id: col.id, nombre: "", cuenta: "", aplicacion: "", valor: 0,
    etapa: etapas[0] ? etapas[0].id : "nueva", probabilidad: etapas[0] ? etapas[0].prob : 10,
    cierre: "", decisor: "", competencia: "", presupuesto: "", timing: "", riesgos: "",
    prox_accion: "", fecha_prox: "", origen: "creada", checks: {},
  };
  const set = (k) => (v) => { f[k] = v; };
  const d = { disabled: !puede };

  const zonaChecks = h("div", {});
  const pintarChecks = () => {
    const et = etapas.find((e) => e.id === f.etapa) || { id: f.etapa, nombre: f.etapa, criterios: [] };
    const cumplidos = (et.criterios || []).filter((_, i) => f.checks[et.id + i]).length;
    zonaChecks.replaceChildren(
      h("h5", { class: "sep", text: `Criterios de la etapa «${et.nombre}» · ${cumplidos} de ${(et.criterios || []).length}` }),
      h("ul", { class: "check" }, ...(et.criterios || []).map((c, i) => {
        const chk = h("input", { type: "checkbox", checked: !!f.checks[et.id + i], disabled: !puede });
        chk.addEventListener("change", () => { f.checks[et.id + i] = chk.checked; pintarChecks(); });
        return h("li", {}, h("label", {}, chk, h("span", { text: c })));
      })));
  };

  const cuerpo = h("div", {},
    h("div", { class: "form-grid" },
      campo("Nombre de la oportunidad", entrada(f.nombre, set("nombre"), { placeholder: "Ej. Resguardo de celda de soldadura línea 3", ...d }), "full"),
      campo("Cuenta", entrada(f.cuenta, set("cuenta"), d)),
      campo("Aplicación", entrada(f.aplicacion, set("aplicacion"), { placeholder: "Seguridad de máquina, visión, variadores…", ...d })),
      campo("Valor estimado (MXN)", entrada(f.valor, set("valor"), { type: "number", min: 0, ...d })),
      campo("Etapa", seleccion(f.etapa, etapas.map((e) => ({ id: e.id, nombre: e.nombre })), (v) => {
        f.etapa = v; const et = etapas.find((e) => e.id === v); if (et) f.probabilidad = et.prob;
        pintarChecks();
      }, d)),
      campo("Probabilidad (%)", entrada(f.probabilidad, set("probabilidad"), { type: "number", min: 0, max: 100, ...d })),
      campo("Fecha estimada de cierre", entrada(f.cierre, set("cierre"), { type: "date", ...d })),
      campo("Origen", seleccion(f.origen, [{ id: "creada", nombre: "Creada por el vendedor" }, { id: "reactiva", nombre: "Solicitud del cliente" }], set("origen"), d)),
      campo("Decisor", entrada(f.decisor, set("decisor"), { placeholder: "Nombre y puesto", ...d })),
      campo("Competencia", entrada(f.competencia, set("competencia"), d)),
      campo("Presupuesto", entrada(f.presupuesto, set("presupuesto"), { placeholder: "Confirmado, en gestión, sin presupuesto", ...d })),
      campo("Timing declarado por el cliente", entrada(f.timing, set("timing"), d)),
      campo("Riesgos", area(f.riesgos, set("riesgos"), 2, d), "full"),
      campo("Próxima acción", entrada(f.prox_accion, set("prox_accion"), d)),
      campo("Fecha de la próxima acción", entrada(f.fecha_prox, set("fecha_prox"), { type: "date", ...d }))),
    zonaChecks);
  pintarChecks();

  modal("Oportunidad", cuerpo,
    puede ? [boton("Cancelar", cerrarModal, "ghost"), boton("Guardar oportunidad", async () => {
      try {
        await dbOpps.guardar(f.id ? f : { ...f, colaborador_id: col.id });
        cerrarModal(); aviso("Oportunidad guardada"); ctx.refrescar();
      } catch (e) { aviso(e.message, "error"); }
    })] : [boton("Cerrar", cerrarModal, "ghost")], "ancho");
}

/* ============================================================ CUENTAS ===== */

export function vistaCuentas(ctx) {
  const { col, m, exp } = ctx.estado;
  const puede = ctx.permisos.captura(col);
  const lista = exp.cuentas || [];

  return h("div", { class: "vista" },
    panel("Escalera de madurez de la cuenta",
      "El objetivo es mover cuentas hacia la derecha, no solo vender más veces.",
      h("div", { class: "escalera" }, ...MADUREZ.map((x) =>
        h("div", { class: "peldano" },
          h("b", { text: String(x.n) }), h("strong", { text: x.nombre }), h("p", { text: x.desc }),
          h("em", { text: `${lista.filter((c) => c.madurez === x.n).length} cuentas` }))))),

    panel(null, null,
      h("div", { class: "head-flex" },
        h("div", {}, h("h3", { text: "Account Plans" }),
          h("p", { class: "sub", text: "Una cuenta cuenta para la graduación cuando su plan está aprobado por el mentor." })),
        puede ? boton("Nueva cuenta", () => formCuenta(ctx, null)) : null),
      lista.length
        ? tabla(["Empresa", "Sector", { t: "Stakeholders", num: true }, "Madurez", { t: "Potencial anual", num: true }, "Estado", ""],
          lista.map((c) => h("tr", {},
            h("td", {}, h("b", { text: c.empresa || "Sin nombre" }), h("br"), h("span", { class: "gris", text: c.plantas || "" })),
            h("td", { text: c.sector || "—" }),
            h("td", { class: "num", text: String((c.stakeholders || []).length) }),
            h("td", {}, h("span", { class: "badge", text: (MADUREZ.find((x) => x.n === c.madurez) || {}).nombre || "—" })),
            h("td", { class: "num mono", text: dinero(c.potencial) }),
            h("td", {}, c.aprobado ? lampara("run", "Plan aprobado") : lampara("off", "En construcción")),
            h("td", { class: "acciones" },
              boton("Abrir", () => formCuenta(ctx, c), "ghost"),
              puede ? boton("Borrar", () => confirmar("¿Borrar esta cuenta?", async () => {
                await dbCuentas.borrar(c.id); aviso("Cuenta borrada"); ctx.refrescar();
              }), "ghost") : null))), { scroll: true })
        : vacio("Sin cuentas mapeadas",
          "Empieza por las cuentas A del territorio: procesos, tecnología instalada, contactos y huecos de oportunidad.",
          puede ? boton("Mapear la primera cuenta", () => formCuenta(ctx, null)) : null)));
}

function formCuenta(ctx, c) {
  const { col } = ctx.estado;
  const puede = ctx.permisos.captura(col);
  const esMentor = ctx.permisos.evalua(col);
  const f = c ? { ...c, stakeholders: [...(c.stakeholders || [])] } : {
    colaborador_id: col.id, empresa: "", sector: "", plantas: "", procesos: "", tecnologias: "",
    competidores: "", relacion: "", proyectos: "", potencial: 0, riesgos: "", entrada: "",
    crecimiento: "", acciones: "", madurez: 1, aprobado: false, stakeholders: [],
  };
  const set = (k) => (v) => { f[k] = v; };
  const d = { disabled: !puede };

  const zona = h("div", {});
  const pintarStake = () => {
    zona.replaceChildren(
      h("div", { class: "head-flex sep" }, h("h5", { text: "Mapa de stakeholders" }),
        puede ? boton("Agregar contacto", () => {
          f.stakeholders.push({ id: uid(), nombre: "", puesto: "", area: "", rol: "Usuario", relacion: "Fría", influencia: 3, decision: 3 });
          pintarStake();
        }, "ghost") : null),
      !f.stakeholders.length ? h("p", { class: "gris", text: "Sin contactos registrados. Una cuenta con un solo contacto es una cuenta en riesgo." }) : null,
      ...f.stakeholders.map((s, i) => h("div", { class: "stake" },
        entrada(s.nombre, (v) => { s.nombre = v; }, { placeholder: "Nombre", ...d }),
        entrada(s.puesto, (v) => { s.puesto = v; }, { placeholder: "Puesto", ...d }),
        seleccion(s.area, ["", "Mantenimiento", "Ingeniería", "Producción", "Seguridad e higiene", "Calidad", "Compras", "Dirección", "Proyectos"]
          .map((a) => ({ id: a, nombre: a || "Área" })), (v) => { s.area = v; }, d),
        seleccion(s.rol, ["Usuario", "Técnico", "Champion", "Decisor económico", "Detractor", "Portero"]
          .map((a) => ({ id: a, nombre: a })), (v) => { s.rol = v; }, d),
        seleccion(s.relacion, ["Fría", "En construcción", "Sólida", "Aliado"].map((a) => ({ id: a, nombre: a })), (v) => { s.relacion = v; }, d),
        h("label", { class: "mini-num" }, "Influencia", entrada(s.influencia, (v) => { s.influencia = Number(v); }, { type: "number", min: 1, max: 5, ...d })),
        h("label", { class: "mini-num" }, "Decisión", entrada(s.decision, (v) => { s.decision = Number(v); }, { type: "number", min: 1, max: 5, ...d })),
        puede ? boton("Quitar", () => { f.stakeholders.splice(i, 1); pintarStake(); }, "ghost") : null)));
  };

  const cuerpo = h("div", {},
    h("div", { class: "form-grid" },
      campo("Empresa", entrada(f.empresa, set("empresa"), d)),
      campo("Sector", entrada(f.sector, set("sector"), { placeholder: "Automotriz, alimentos, acero, vidrio, empaque…", ...d })),
      campo("Plantas y ubicaciones", entrada(f.plantas, set("plantas"), d), "full"),
      campo("Procesos productivos", area(f.procesos, set("procesos"), 2, { placeholder: "Líneas, criticidad, turnos, cuellos de botella", ...d }), "full"),
      campo("Tecnología instalada", area(f.tecnologias, set("tecnologias"), 2, { placeholder: "Marcas de control, variadores, sensórica, estado de obsolescencia", ...d }), "full"),
      campo("Competidores instalados", entrada(f.competidores, set("competidores"), d), "full"),
      campo("Relación actual con ISEL", entrada(f.relacion, set("relacion"), d)),
      campo("Nivel de madurez", seleccion(f.madurez, MADUREZ.map((x) => ({ id: x.n, nombre: `${x.n} · ${x.nombre}` })), (v) => { f.madurez = Number(v); }, d)),
      campo("Proyectos conocidos", area(f.proyectos, set("proyectos"), 2, d), "full"),
      campo("Potencial de compra anual (MXN)", entrada(f.potencial, set("potencial"), { type: "number", min: 0, ...d })),
      campo("Riesgos", entrada(f.riesgos, set("riesgos"), d)),
      campo("Estrategia de entrada", area(f.entrada, set("entrada"), 2, d), "full"),
      campo("Estrategia de crecimiento a 12 meses", area(f.crecimiento, set("crecimiento"), 2, d), "full"),
      campo("Próximas acciones", area(f.acciones, set("acciones"), 2, d), "full"),
      (() => {
        const chk = h("input", { type: "checkbox", checked: f.aprobado, disabled: !esMentor });
        chk.addEventListener("change", () => { f.aprobado = chk.checked; });
        return h("label", { class: "check-inline" }, chk,
          esMentor ? "Plan revisado y aprobado por el mentor" : "Aprobación del mentor (solo el mentor puede marcarla)");
      })()),
    zona);
  pintarStake();

  modal("Account Plan", cuerpo,
    puede ? [boton("Cancelar", cerrarModal, "ghost"), boton("Guardar Account Plan", async () => {
      try {
        await dbCuentas.guardar(f.id ? f : { ...f, colaborador_id: col.id });
        cerrarModal(); aviso("Account Plan guardado"); ctx.refrescar();
      } catch (e) { aviso(e.message, "error"); }
    })] : [boton("Cerrar", cerrarModal, "ghost")], "ancho");
}

/* =========================================================== COACHING ===== */

export function vistaCoaching(ctx) {
  const { col, exp } = ctx.estado;
  const puede = ctx.permisos.evalua(col);
  const juicio = col.juicio || {};
  const lista = [...(exp.coaching || [])].sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));

  const f = { fecha: new Date().toISOString().slice(0, 10), tipo: "Sesión individual semanal", logros: "", brechas: "", acuerdos: "", siguiente: "", nota: 0 };

  const cont = h("div", { class: "vista" },
    panel("Quién hace qué", null,
      h("div", { class: "roles" }, ...((juicio.roles) || []).map((r) =>
        h("div", { class: "rol" }, h("h4", { text: r.rol }), h("ul", {}, ...(r.resp || []).map((x) => h("li", { text: x }))))))),

    panel("Cadencia de acompañamiento", null,
      tabla(["Actividad", "Frecuencia", "Vigencia"],
        ((juicio.cadencia) || []).map((c) =>
          h("tr", {}, h("td", {}, h("b", { text: c.actividad })), h("td", { text: c.frecuencia }), h("td", { class: "gris", text: c.mes }))))));

  if (puede) {
    const form = h("div", { class: "form-grid" },
      campo("Fecha", entrada(f.fecha, (v) => { f.fecha = v; }, { type: "date" })),
      campo("Tipo de sesión", seleccion(f.tipo, ["Sesión individual semanal", "Acompañamiento de campo", "Revisión de pipeline", "Revisión de grabación o role play", "Revisión de cuenta", "Evaluación mensual"].map((x) => ({ id: x, nombre: x })), (v) => { f.tipo = v; })),
      campo("Desempeño observado (1 a 5)", seleccion(f.nota, [{ id: 0, nombre: "Sin evaluar" }, ...[1, 2, 3, 4, 5].map((n) => ({ id: n, nombre: String(n) }))], (v) => { f.nota = Number(v); })),
      campo("Qué hizo bien", area(f.logros, (v) => { f.logros = v; }, 2), "full"),
      campo("Brecha principal a corregir", area(f.brechas, (v) => { f.brechas = v; }, 2), "full"),
      campo("Acuerdos concretos", area(f.acuerdos, (v) => { f.acuerdos = v; }, 2, { placeholder: "Qué hará distinto, con qué cliente y para cuándo" }), "full"),
      campo("Compromiso para la próxima sesión", entrada(f.siguiente, (v) => { f.siguiente = v; }), "full"));

    cont.appendChild(panel("Registrar sesión de coaching",
      "Una sesión sin acuerdo con fecha no es coaching, es plática.",
      form,
      boton("Guardar sesión", async () => {
        if (!f.acuerdos.trim()) { aviso("Escribe al menos un acuerdo concreto", "error"); return; }
        try {
          await dbCoaching.guardar({ ...f, colaborador_id: col.id, autor_id: ctx.estado.perfil.id });
          aviso("Sesión registrada"); ctx.refrescar();
        } catch (e) { aviso(e.message, "error"); }
      })));
  }

  cont.appendChild(panel("Historial de sesiones", null,
    lista.length
      ? tabla(["Fecha", "Tipo", "Brecha", "Acuerdos", { t: "Nota", num: true }, ""],
        lista.map((c) => h("tr", {},
          h("td", { class: "mono", text: c.fecha ? fecha(c.fecha) : "—" }),
          h("td", { text: c.tipo || "—" }),
          h("td", { class: "gris", text: recortar(c.brechas, 120) }),
          h("td", { text: recortar(c.acuerdos, 160) }),
          h("td", { class: "num", text: c.nota ? String(c.nota) : "—" }),
          h("td", { class: "acciones" }, puede ? boton("Borrar", () => confirmar("¿Borrar esta sesión?", async () => {
            await dbCoaching.borrar(c.id); aviso("Sesión borrada"); ctx.refrescar();
          }), "ghost") : null))), { scroll: true })
      : vacio("Sin sesiones registradas", "El acompañamiento constante es la mitad del programa.")));

  return cont;
}

/* ------------------------------------------------------------- APOYOS ---- */

const recortar = (t, n = 90) => (t ? (t.length > n ? t.slice(0, n) + "…" : t) : "—");

function metaDe(m, fuente) {
  const c = m.prog.criterios.find((x) => x.fuente === fuente);
  return c ? Number(c.meta) : 0;
}

function mesSugerido(ctx) {
  const col = ctx.estado.col;
  const plan = (col.plan || [])[(col.semana_actual || 1) - 1];
  return plan ? plan.mes : 1;
}
