/* ===========================================================================
   Cálculo de indicadores. Una sola fuente de verdad para el panel individual,
   el dictamen de graduación y el resumen comparativo.
   =========================================================================== */

import { CORTES } from "./plantilla.js";

/* ===========================================================================
   Ritmo contra el calendario.

   Responde si el programa va en tiempo, con dos lecturas que conviene no
   confundir:

   · La semana declarada es el marcador que mueve el mentor a mano. Si se le
     olvida actualizarlo, la persona aparece atrasada sin estarlo.
   · El avance de tareas sale de la evidencia: cuántas tareas deberían estar
     completas a la fecha y cuántas lo están. Esa es la lectura honesta.

   Cuando las dos discrepan, lo que está atrasado es el seguimiento.
   =========================================================================== */

const DIA = 86400000;
const soloFecha = (d) => { const x = new Date(d); x.setHours(12, 0, 0, 0); return x; };
const aFecha = (s) => (s ? soloFecha(s + "T12:00:00") : null);
const sumarDias = (f, n) => soloFecha(new Date(f.getTime() + n * DIA));
const diasEntre = (a, b) => Math.round((soloFecha(b) - soloFecha(a)) / DIA);

/* ---------------------------------------------------------- días hábiles --
   El programa se cursa en días de trabajo. Contar sábados, domingos y
   festivos hacía aparecer atrasos que no existían.

   Son los días de descanso obligatorio de la Ley Federal del Trabajo. No
   incluye Semana Santa ni los puentes que cada empresa decide: si ISEL
   descansa otros días, se agregan a esta lista.
   -------------------------------------------------------------------------- */

const lunesN = (anio, mes, n) => {
  const primero = new Date(anio, mes, 1);
  const desplazo = (8 - primero.getDay()) % 7;
  return soloFecha(new Date(anio, mes, 1 + desplazo + (n - 1) * 7));
};

export const festivosMX = (anio) => [
  soloFecha(new Date(anio, 0, 1)),    // Año nuevo
  lunesN(anio, 1, 1),                 // Día de la Constitución
  lunesN(anio, 2, 3),                 // Natalicio de Benito Juárez
  soloFecha(new Date(anio, 4, 1)),    // Día del Trabajo
  soloFecha(new Date(anio, 8, 16)),   // Independencia
  lunesN(anio, 10, 3),                // Revolución Mexicana
  /* Transmisión del Poder Ejecutivo: 2018, 2024, 2030, 2036… */
  ...(anio % 6 === 2 ? [soloFecha(new Date(anio, 11, 1))] : []),
  soloFecha(new Date(anio, 11, 25)),  // Navidad
];

const esFinDeSemana = (f) => f.getDay() === 0 || f.getDay() === 6;

/* Días hábiles en [a, b): lunes a viernes, menos los festivos. */
const habilesEntre = (a, b) => {
  const d1 = soloFecha(a), d2 = soloFecha(b);
  const dias = Math.round((d2 - d1) / DIA);
  if (dias <= 0) return 0;

  let habiles = Math.floor(dias / 7) * 5;
  const sobran = dias % 7;
  for (let i = 0; i < sobran; i++) {
    const d = (d1.getDay() + i) % 7;
    if (d !== 0 && d !== 6) habiles++;
  }

  /* Un festivo en sábado o domingo no se resta: ya no contaba */
  for (let anio = d1.getFullYear(); anio <= d2.getFullYear(); anio++)
    for (const f of festivosMX(anio))
      if (f >= d1 && f < d2 && !esFinDeSemana(f)) habiles--;

  return Math.max(0, habiles);
};

export function calendario(col, prog, hechasPorSemana, tareasTotales, hoy = new Date()) {
  const inicio = aFecha(col.fecha_inicio);
  const semanas = prog.plan.length || 20;
  const declarada = Math.max(1, Math.min(semanas, col.semana_actual || 1));
  const porSemana = hechasPorSemana || [];
  const tareasHechas = porSemana.reduce((a, n) => a + n, 0);

  if (!inicio) {
    return { sinFecha: true, semanas, declarada, exigible: declarada, estado: "off",
      veredicto: "Sin fecha de inicio",
      detalle: "Registra la fecha de inicio del programa para medir si va en tiempo." };
  }

  const fin = aFecha(col.fecha_fin_prevista) || sumarDias(inicio, semanas * 7);
  const finCalculado = !col.fecha_fin_prevista;
  const diasTotales = Math.max(1, diasEntre(inicio, fin));
  const transcurridos = diasEntre(inicio, hoy);
  const restantes = diasEntre(hoy, fin);

  /* Aún no arranca */
  if (transcurridos < 0) {
    return { inicio, fin, finCalculado, semanas, declarada, diasTotales,
      transcurridos, restantes, porArrancar: true, esperada: 0, exigible: 0, desviacion: 0,
      avanceCalendario: 0, estado: "off",
      veredicto: `Arranca en ${Math.abs(transcurridos)} días`,
      detalle: `Programado del ${fmt(inicio)} al ${fmt(fin)}.` };
  }

  /* Semana en la que debería ir según el calendario, contando días hábiles */
  const habilesTranscurridos = habilesEntre(inicio, hoy);
  const habilesRestantes = habilesEntre(hoy, fin);
  const esperada = Math.max(1, Math.min(semanas, Math.floor(habilesTranscurridos / 5) + 1));
  const desviacion = declarada - esperada;
  const avanceCalendario = Math.max(0, Math.min(1, transcurridos / diasTotales));

  /* Hasta qué semana se exigen las tareas. Es la más avanzada de las dos
     lecturas: si el mentor ya movió el marcador a la semana 9, las tareas de
     la 1 a la 9 están vencidas aunque el calendario fuera más lento, y al
     revés. Así el rezago se acumula en vez de reiniciarse cada semana. */
  const exigible = Math.max(declarada, esperada);
  const tareasEsperadas = prog.plan
    .slice(0, exigible)
    .reduce((a, s) => a + (s.tasks || []).length, 0);
  /* Solo cuentan las tareas hechas de semanas ya vencidas: adelantar trabajo
     de la semana 15 no tapa lo que quedó pendiente en la 2. */
  const hechasVencidas = porSemana.slice(0, exigible).reduce((a, n) => a + n, 0);
  const adelantadas = tareasHechas - hechasVencidas;
  const pendientesVencidas = Math.max(0, tareasEsperadas - hechasVencidas);
  const brechaTareas = -pendientesVencidas;
  const cumplimiento = tareasEsperadas > 0 ? hechasVencidas / tareasEsperadas : 1;

  const terminado = restantes < 0;
  let estadoPlazo, veredictoPlazo;
  if (terminado && desviacion >= 0) { estadoPlazo = "run"; veredictoPlazo = "Programa concluido"; }
  else if (terminado) { estadoPlazo = "fault"; veredictoPlazo = `Venció el plazo en la semana ${declarada}`; }
  else if (desviacion >= 1) { estadoPlazo = "run"; veredictoPlazo = `${desviacion} ${plural(desviacion, "semana")} adelante`; }
  else if (desviacion === 0) { estadoPlazo = "run"; veredictoPlazo = "En tiempo"; }
  else if (desviacion === -1) { estadoPlazo = "signal"; veredictoPlazo = "1 semana de retraso"; }
  else { estadoPlazo = "fault"; veredictoPlazo = `${-desviacion} semanas de retraso`; }

  const estadoTareas = cumplimiento >= 0.95 ? "run" : cumplimiento >= 0.7 ? "signal" : "fault";

  /* El semáforo toma la peor de las dos lecturas. Antes solo miraba el
     marcador de semana, así que bastaba moverlo para seguir en verde con
     las tareas sin hacer. */
  const estado = peor(estadoPlazo, estadoTareas);
  const veredicto = peso(estadoTareas) > peso(estadoPlazo)
    ? `${pendientesVencidas} ${plural(pendientesVencidas, "tarea")} sin hacer de las que ya tocaban`
    : veredictoPlazo;

  return {
    inicio, fin, finCalculado, semanas, declarada, esperada, exigible, desviacion,
    diasTotales, transcurridos, restantes, habilesTranscurridos, habilesRestantes,
    avanceCalendario, terminado,
    tareasEsperadas, tareasHechas, tareasTotales, hechasVencidas, adelantadas,
    pendientesVencidas, brechaTareas, cumplimiento,
    estadoPlazo, veredictoPlazo, estadoTareas, estado, veredicto,
    detalle: terminado
      ? `El plazo terminó el ${fmt(fin)}.`
      : `Semana ${esperada} según el calendario · quedan ${habilesRestantes} días hábiles`,
  };
}

/* Tareas completadas de cada semana, en el orden del plan. El calendario las
   necesita separadas por semana para distinguir el rezago del trabajo
   adelantado. */
export const hechasPorSemanaDe = (prog, hechas) =>
  prog.plan.map((s) => (s.tasks || []).filter((t) => hechas.has(clave(s.id, t.id))).length);

const ORDEN = { run: 0, off: 1, signal: 2, fault: 3 };
const peso = (e) => ORDEN[e] ?? 0;
const peor = (a, b) => (peso(a) >= peso(b) ? a : b);

const plural = (n, p) => (Math.abs(n) === 1 ? p : p + "s");
/* dd/mm/aaaa, el mismo formato que usa el resto de la aplicación */
const fmt = (f) => `${String(f.getDate()).padStart(2, "0")}/${String(f.getMonth() + 1).padStart(2, "0")}/${f.getFullYear()}`;

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
    cal: calendario(col, prog, hechasPorSemanaDe(prog, hechas), tareasTotales),
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
  const hechasSet = new Set(avance.map((a) => a.tarea_id));

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
    cal: calendario(col, prog, hechasPorSemanaDe(prog, hechasSet), tareasTotales),
    promedioGrupo: (gid) => {
      const comps = prog.competencias.filter((c) => c.grupo === gid);
      const v = comps.map((c) => nivel(c.id, ultimo)).filter((x) => x > 0);
      return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
    },
    grupos: prog.grupos,
  };
}
