/* ===========================================================================
   Cálculo de indicadores. Una sola fuente de verdad para el panel individual,
   el dictamen de graduación y el resumen comparativo.
   =========================================================================== */

import { CORTES } from "./plantilla.js";

export function metricas(col, exp) {
  const prog = programa(col);
  const evals = indexEvals(exp.evals);
  const avance = exp.avance || [];
  const visitas = exp.visitas || [];
  const opps = exp.opps || [];
  const cuentas = exp.cuentas || [];

  /* -------------------------------------------------- avance del plan --- */
  const tareasTotales = prog.plan.reduce((a, s) => a + (s.tasks || []).length, 0);
  const hechas = new Set(avance.filter((a) => a.hecho).map((a) => a.tarea_id));
  const tareasHechas = prog.plan.reduce(
    (a, s) => a + (s.tasks || []).filter((t) => hechas.has(clave(s.id, t.id))).length, 0);

  /* ------------------------------------------------------- competencias -- */
  const nivel = (cid, corte) => evals[cid + "|" + corte] ?? 0;

  const promedioGrupo = (gid, corte) => {
    const comps = prog.competencias.filter((c) => c.grupo === gid);
    const v = comps.map((c) => nivel(c.id, corte)).filter((x) => x > 0);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
  };

  const scoreCorte = (corte) => {
    let suma = 0, peso = 0;
    prog.grupos.forEach((g) => {
      const p = promedioGrupo(g.id, corte);
      if (p > 0) { suma += p * g.peso; peso += g.peso; }
    });
    return peso ? suma / peso : 0;
  };

  const cortesConDatos = CORTES.filter((c) => prog.competencias.some((k) => nivel(k.id, c.id) > 0));
  const ultimoCorte = cortesConDatos.length ? cortesConDatos[cortesConDatos.length - 1].id : "ini";
  const score = scoreCorte(ultimoCorte);

  const criticasBajas = prog.competencias.filter(
    (c) => c.imp === "Crítica" && nivel(c.id, ultimoCorte) > 0 && nivel(c.id, ultimoCorte) < c.req);
  const criticasSinEvaluar = prog.competencias.filter(
    (c) => c.imp === "Crítica" && nivel(c.id, ultimoCorte) === 0);

  /* ------------------------------------------------------------ campo ---- */
  const visitasSolo = visitas.filter((v) => v.tipo === "autonoma").length;
  const visitasNuevas = visitas.filter((v) => v.cuenta_nueva).length;

  /* --------------------------------------------------------- pipeline ---- */
  const abiertas = opps.filter((o) => o.etapa !== "ganada" && o.etapa !== "perdida");
  const pipeline = suma(abiertas, "valor");
  const pipelineCal = suma(abiertas.filter((o) => o.etapa !== "nueva"), "valor");
  const ponderado = abiertas.reduce((a, o) => a + (Number(o.valor) || 0) * (Number(o.probabilidad) || 0) / 100, 0);
  const ganadas = opps.filter((o) => o.etapa === "ganada");
  const ventas = suma(ganadas, "valor");
  const cerradas = opps.filter((o) => o.etapa === "ganada" || o.etapa === "perdida").length;
  const tasaCierre = cerradas ? Math.round((ganadas.length / cerradas) * 100) : 0;
  const creadas = opps.filter((o) => o.origen === "creada").length;
  const sinProxima = abiertas.filter((o) => !o.prox_accion).length;

  /* ---------------------------------------------------------- cuentas ---- */
  const planesAprobados = cuentas.filter((c) => c.aprobado).length;

  /* ----------------------------------------------------------- examen ---- */
  const calif = (col.juicio && col.juicio.calificaciones) || {};
  const examenTotal = prog.examen.reduce((a, e) => a + ((Number(calif[e.id]) || 0) * e.peso) / 100, 0);
  const juicio = col.juicio || {};

  /* ------------------------------------------------------- graduación ---- */
  const valores = {
    scorecard: score,
    criticas: criticasBajas.length,
    visitas: visitas.length,
    visitas_solo: visitasSolo,
    opps: opps.length,
    pipeline, pipeline_cal: pipelineCal, ventas,
    cuentas: cuentas.length,
    planes: planesAprobados,
    ganadas: ganadas.length,
    roleplays: Number(juicio.rolePlays) || 0,
    evalgerente: Number(juicio.evalGerente) || 0,
    examen: examenTotal,
    tareas: pctSeguro(tareasHechas, tareasTotales),
  };

  const manuales = juicio.manuales || {};
  const criterios = prog.criterios.map((c) => {
    const real = c.fuente === "manual" ? (manuales[c.id] ? 1 : 0) : (valores[c.fuente] ?? 0);
    const cumple = c.fuente === "criticas" ? real <= Number(c.meta)
      : c.fuente === "manual" ? real === 1
        : real >= Number(c.meta);
    return { ...c, real, cumple };
  });

  const puntosPosibles = criterios.reduce((a, c) => a + (Number(c.puntos) || 0), 0) || 100;
  const puntosCrudos = criterios.filter((c) => c.cumple).reduce((a, c) => a + (Number(c.puntos) || 0), 0);
  const puntos = Math.round((puntosCrudos / puntosPosibles) * 100);

  const u = (juicio.umbrales) || { apto: 85, aptoPlan: 65, scoreApto: 4, scorePlan: 3.5 };
  let dictamen = "NO APTO AÚN", estado = "fault";
  if (puntos >= u.apto && score >= u.scoreApto && criticasBajas.length === 0) { dictamen = "APTO"; estado = "run"; }
  else if (puntos >= u.aptoPlan && score >= u.scorePlan) { dictamen = "APTO CON PLAN DE DESARROLLO"; estado = "signal"; }

  return {
    prog, evals, nivel, promedioGrupo, scoreCorte, cortesConDatos, ultimoCorte, score,
    criticasBajas, criticasSinEvaluar,
    tareasTotales, tareasHechas, avanceTareas: pctSeguro(tareasHechas, tareasTotales), tareaHecha: (s, t) => hechas.has(clave(s, t)),
    visitas, visitasSolo, visitasNuevas,
    opps, abiertas, pipeline, pipelineCal, ponderado, ganadas, ventas, tasaCierre, creadas, sinProxima,
    cuentas, planesAprobados,
    examenTotal, criterios, puntos, dictamen, estado, umbrales: u,
  };
}

/* Normaliza el expediente del colaborador: si algún bloque viene vacío,
   se rellena para que la interfaz no se rompa. */
export function programa(col) {
  return {
    plan: arr(col.plan),
    grupos: arr(col.grupos),
    competencias: arr(col.competencias),
    kpis: arr(col.kpis),
    criterios: arr(col.criterios),
    planVisitas: arr(col.plan_visitas),
    etapas: arr(col.etapas),
    riesgos: arr(col.riesgos),
    examen: arr(col.examen),
  };
}

export const clave = (semanaId, tareaId) => semanaId + ":" + tareaId;

function arr(x) { return Array.isArray(x) ? x : []; }
function suma(lista, campo) { return lista.reduce((a, o) => a + (Number(o[campo]) || 0), 0); }
function pctSeguro(a, b) { return b > 0 ? Math.round((a / b) * 100) : 0; }

function indexEvals(lista) {
  const m = {};
  (lista || []).forEach((e) => { m[e.competencia_id + "|" + e.corte] = e.nivel; });
  return m;
}

/* ------------------------------------------------------------------------- */
/* Resumen ligero por colaborador para la vista comparativa                   */

export function resumenColaborador(col, datos) {
  const prog = programa(col);
  const evals = indexEvals(datos.evals.filter((e) => e.colaborador_id === col.id));
  const visitas = datos.visitas.filter((v) => v.colaborador_id === col.id);
  const opps = datos.opps.filter((o) => o.colaborador_id === col.id);
  const cuentas = datos.cuentas.filter((c) => c.colaborador_id === col.id);
  const avance = datos.avance.filter((a) => a.colaborador_id === col.id && a.hecho);

  const nivel = (cid, corte) => evals[cid + "|" + corte] ?? 0;
  const scoreCorte = (corte) => {
    let s = 0, p = 0;
    prog.grupos.forEach((g) => {
      const comps = prog.competencias.filter((c) => c.grupo === g.id);
      const v = comps.map((c) => nivel(c.id, corte)).filter((x) => x > 0);
      if (v.length) { s += (v.reduce((a, b) => a + b, 0) / v.length) * g.peso; p += g.peso; }
    });
    return p ? s / p : 0;
  };
  const cortes = CORTES.filter((c) => prog.competencias.some((k) => nivel(k.id, c.id) > 0));
  const ultimo = cortes.length ? cortes[cortes.length - 1].id : "ini";

  const tareasTotales = prog.plan.reduce((a, s) => a + (s.tasks || []).length, 0);
  const abiertas = opps.filter((o) => o.etapa !== "ganada" && o.etapa !== "perdida");

  return {
    col,
    score: scoreCorte(ultimo),
    serieScore: CORTES.map((c) => scoreCorte(c.id) || null),
    ultimoCorte: ultimo,
    avance: pctSeguro(avance.length, tareasTotales),
    visitas: visitas.length,
    visitasSolo: visitas.filter((v) => v.tipo === "autonoma").length,
    opps: opps.length,
    pipeline: suma(abiertas, "valor"),
    pipelineCal: suma(abiertas.filter((o) => o.etapa !== "nueva"), "valor"),
    ventas: suma(opps.filter((o) => o.etapa === "ganada"), "valor"),
    cuentas: cuentas.length,
    planes: cuentas.filter((c) => c.aprobado).length,
    promedioGrupo: (gid) => {
      const comps = prog.competencias.filter((c) => c.grupo === gid);
      const v = comps.map((c) => nivel(c.id, ultimo)).filter((x) => x > 0);
      return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
    },
    grupos: prog.grupos,
  };
}
