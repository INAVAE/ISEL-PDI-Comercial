/* ===========================================================================
   El resumen de cada colaborador y el correo que lo lleva.

   Sin Supabase ni nodemailer a propósito: esto es lo que hay que poder
   probar —qué cuenta como vencido, qué toca esta semana, qué dice el
   asunto— y mezclarlo con el envío obligaría a levantar medio mundo para
   comprobar una resta. enviar.mjs se encarga de traer los datos y de
   mandarlos; aquí solo se decide qué dice el correo.

   Reutiliza el MISMO cálculo que la aplicación (js/metricas.js). Con una
   copia, a la primera corrección el correo y el panel dirían cosas
   distintas, y de las dos la persona creería la que le conviene.
   =========================================================================== */

import { metricas, programa, clave } from "../../js/metricas.js";

/* ------------------------------------------------------------ resumen ---- */

/* Las tareas de semanas ya vencidas que siguen sin marcarse, agrupadas por
   semana: "tienes 23 pendientes" no dice por dónde empezar. */
export function resumenDe(col, exp, hoy = new Date()) {
  const prog = programa(col);
  const m = metricas(col, exp, hoy);
  const hechas = new Set((exp.avance || []).filter((a) => a.hecho).map((a) => a.tarea_id));
  const exigible = m.cal.exigible || 0;
  /* La semana en curso es la MÁS AVANZADA entre el marcador del mentor y la
     que toca por calendario, igual que en el panel. Si se tomara solo el
     marcador, un mentor que no lo ha movido haría que una semana posterior
     saliera como "vencida" mientras una anterior seguía como "en curso", y
     el asunto del correo contradiría a la línea de ritmo que va debajo. */
  const semanaEnCurso = Math.max(1, Math.min(prog.plan.length || 1,
    exigible || col.semana_actual || 1));

  const vencidas = [];
  let estaSemana = null;
  let hechasTotales = 0;

  prog.plan.forEach((s, i) => {
    const n = i + 1;
    const tareas = s.tasks || [];
    const faltan = tareas.filter((t) => !hechas.has(clave(s.id, t.id)));
    hechasTotales += tareas.length - faltan.length;

    if (n === semanaEnCurso) {
      estaSemana = {
        n,
        objetivo: s.objetivo || s.tema || "",
        faltan: faltan.map((t) => t.texto),
        hechas: tareas.length - faltan.length,
        total: tareas.length,
      };
    }
    /* Vencida: ya se exigía y no es la que está en curso. La semana en curso
       va en su propio bloque, porque todavía hay tiempo de hacerla. */
    if (n <= exigible && n !== semanaEnCurso && faltan.length)
      vencidas.push({ n, tema: recorta(s.tema || s.objetivo || ""), tareas: faltan.map((t) => t.texto) });
  });

  const totales = prog.plan.reduce((a, s) => a + (s.tasks || []).length, 0);
  const nPendientes = vencidas.reduce((a, v) => a + v.tareas.length, 0);

  return { cal: m.cal, semanas: prog.plan.length, vencidas, nPendientes, estaSemana, hechasTotales, totales };
}

/* A quién le llega. La cuenta vinculada manda sobre el correo de la ficha:
   es la dirección con la que la persona entra a la herramienta. */
export const correoDe = (col, perfiles) => {
  const p = col.user_id && perfiles ? perfiles.get(col.user_id) : null;
  return (p && p.email) || col.email || null;
};

/* -------------------------------------------------------------- correo --- */

export const esc = (s) => String(s ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const COLOR = { run: "#1F7A4D", signal: "#9A6B00", fault: "#B3261E", off: "#63707C" };

export function armarCorreo(col, r, appUrl = "") {
  const { cal, vencidas, nPendientes, estaSemana, hechasTotales, totales } = r;
  const color = COLOR[cal.estado] || COLOR.off;
  const lista = (xs) => xs.map((t) => `<li style="margin:0 0 5px">${esc(t)}</li>`).join("");

  const bloqueVencidas = nPendientes
    ? `<div style="margin:0 0 26px">
         <h2 style="margin:0 0 4px;font-size:15px;color:#B3261E">Atrasado · ${nPendientes} ${nPendientes === 1 ? "tarea" : "tareas"}</h2>
         <p style="margin:0 0 12px;font-size:13px;color:#63707C">De semanas que ya pasaron. No desaparece al avanzar: se acumula.</p>
         ${vencidas.map((v) => `
           <div style="margin:0 0 14px;padding:12px 14px;border-left:3px solid #B3261E;background:#FBF4F3">
             <div style="font-size:13px;font-weight:600;color:#22303B">Semana ${v.n}${v.tema ? " · " + esc(v.tema) : ""}</div>
             <ul style="margin:8px 0 0;padding-left:18px;font-size:13px;color:#22303B">${lista(v.tareas)}</ul>
           </div>`).join("")}
       </div>`
    : `<div style="margin:0 0 26px;padding:12px 14px;border-left:3px solid #1F7A4D;background:#F2F8F4">
         <div style="font-size:13px;color:#22303B"><b>No arrastras nada.</b> Las semanas anteriores están completas.</div>
       </div>`;

  const bloqueSemana = estaSemana
    ? `<div style="margin:0 0 26px">
         <h2 style="margin:0 0 4px;font-size:15px;color:#22303B">Esta semana · la ${estaSemana.n} de ${r.semanas}</h2>
         ${estaSemana.objetivo ? `<p style="margin:0 0 12px;font-size:13px;color:#63707C">${esc(estaSemana.objetivo)}</p>` : ""}
         ${estaSemana.faltan.length
      ? `<ul style="margin:0;padding-left:18px;font-size:13px;color:#22303B">${lista(estaSemana.faltan)}</ul>`
      : `<p style="margin:0;font-size:13px;color:#1F7A4D"><b>Ya la completaste.</b></p>`}
         <p style="margin:10px 0 0;font-size:12px;color:#63707C">${estaSemana.hechas} de ${estaSemana.total} hechas.</p>
       </div>`
    : "";

  const html = `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#E6E7E2">
<div style="max-width:620px;margin:0 auto;padding:28px 22px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif">
  <div style="background:#FFFFFF;border:1px solid #D4D7D2;border-radius:8px;padding:26px 24px">
    <p style="margin:0 0 2px;font-size:11px;color:#63707C;letter-spacing:.06em;text-transform:uppercase">ISEL · Plan de desarrollo comercial</p>
    <h1 style="margin:0 0 18px;font-size:21px;color:#22303B">Hola, ${esc(primerNombre(col.nombre))}</h1>

    <div style="margin:0 0 24px;padding:12px 14px;background:#F4F5F2;border-radius:6px">
      <span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:${color}"></span>
      <span style="font-size:14px;font-weight:600;color:#22303B;padding-left:7px">${esc(cal.veredicto || "")}</span>
      <div style="margin-top:6px;font-size:12px;color:#63707C">${esc(cal.detalle || "")}</div>
    </div>

    ${bloqueVencidas}
    ${bloqueSemana}

    <div style="margin:0 0 24px;padding-top:18px;border-top:1px solid #E6E7E2">
      <h2 style="margin:0 0 8px;font-size:15px;color:#22303B">Lo que llevas hecho</h2>
      <p style="margin:0;font-size:13px;color:#22303B"><b>${hechasTotales}</b> de ${totales} tareas del programa completo.</p>
      <p style="margin:6px 0 0;font-size:12px;color:#63707C">De las que ya tocaban, llevas ${cal.hechasVencidas ?? 0} de ${cal.tareasEsperadas ?? 0}.</p>
    </div>

    ${appUrl ? `<a href="${esc(appUrl)}" style="display:inline-block;padding:11px 20px;background:#22303B;color:#FFFFFF;text-decoration:none;border-radius:5px;font-size:14px;font-weight:600">Abrir mi plan</a>` : ""}

    <p style="margin:22px 0 0;font-size:11.5px;color:#767F88;line-height:1.5">
      Marcar una tarea toma diez segundos y es lo que sostiene tu expediente.
      Si algo de este resumen no cuadra con la realidad, díselo a tu mentor.
    </p>
  </div>
  <p style="margin:14px 0 0;text-align:center;font-size:11px;color:#767F88">
    Correo automático del plan de desarrollo. No hace falta responderlo.
  </p>
</div></body></html>`;

  const texto = [
    `Hola, ${col.nombre}`,
    "",
    cal.veredicto || "",
    cal.detalle || "",
    "",
    nPendientes
      ? `ATRASADO, DE SEMANAS ANTERIORES (${nPendientes}):`
      : "No arrastras nada de semanas anteriores.",
    ...vencidas.flatMap((v) => [`  Semana ${v.n}:`, ...v.tareas.map((t) => `    - ${t}`)]),
    "",
    estaSemana ? `ESTA SEMANA (la ${estaSemana.n} de ${r.semanas}): ${estaSemana.hechas} de ${estaSemana.total} hechas` : "",
    ...(estaSemana ? estaSemana.faltan.map((t) => `    - ${t}`) : []),
    "",
    `Llevas ${hechasTotales} de ${totales} tareas del programa.`,
    appUrl ? `\n${appUrl}` : "",
  ].join("\n");

  /* El asunto se lee en la lista del correo sin abrirlo: lleva el número que
     importa, no "Recordatorio del plan de desarrollo". */
  const nSem = estaSemana ? estaSemana.n : "—";
  const faltanHoy = estaSemana ? estaSemana.faltan.length : 0;
  /* "Al día" solo cuando no falta NADA. Decirlo con tareas de esta semana sin
     marcar sonaba a que ya no había que hacer nada. */
  const asunto = nPendientes
    ? `Tu plan: ${nPendientes} ${nPendientes === 1 ? "tarea atrasada" : "tareas atrasadas"} · semana ${nSem}`
    : faltanHoy
      ? `Tu plan: ${faltanHoy} ${faltanHoy === 1 ? "tarea" : "tareas"} de esta semana · semana ${nSem}`
      : `Tu plan al día · semana ${nSem}`;

  return { asunto, html, texto };
}

const primerNombre = (n) => String(n || "").trim().split(/\s+/)[0] || "";

/* El tema de algunas semanas encadena tres o cuatro asuntos y, como
   encabezado de un recuadro, se come el espacio de lo que importa: las
   tareas. Se corta por el primer separador y, si aun así es largo, por
   caracteres. */
const recorta = (t, max = 54) => {
  const uno = String(t).split(" · ")[0].trim();
  return uno.length > max ? uno.slice(0, max - 1).trimEnd() + "…" : uno;
};
