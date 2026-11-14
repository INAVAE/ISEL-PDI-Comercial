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

/* El Outlook de escritorio dibuja el correo con el motor de Word, que
   ignora max-width, los fondos de un div dentro de otro y los bordes
   redondeados: la tarjeta blanca desaparecía y todo quedaba de borde a
   borde sobre el gris. Por eso la estructura va en TABLAS, que es lo único
   que todos los clientes respetan, con el ancho también como atributo y no
   solo en el estilo. El resto de los correos se ve igual que antes. */

const FUENTE = "-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

/* Recuadro con una franja de color a la izquierda. En Word un border-left
   sobre un div se pierde, así que la franja es una celda de 3 píxeles. */
const recuadro = (colorFranja, fondo, contenido) =>
  `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 14px">
     <tr>
       <td width="3" bgcolor="${colorFranja}" style="width:3px;background:${colorFranja};font-size:0;line-height:0">&nbsp;</td>
       <td bgcolor="${fondo}" style="background:${fondo};padding:12px 14px">${contenido}</td>
     </tr>
   </table>`;

export function armarCorreo(col, r, appUrl = "") {
  const { cal, vencidas, nPendientes, estaSemana, hechasTotales, totales } = r;
  const color = COLOR[cal.estado] || COLOR.off;
  const lista = (xs) => xs.map((t) => `<li style="margin:0 0 5px">${esc(t)}</li>`).join("");

  const bloqueVencidas = nPendientes
    ? `<h2 style="margin:0 0 4px;font-size:15px;color:#B3261E;font-family:${FUENTE}">Atrasado · ${nPendientes} ${nPendientes === 1 ? "tarea" : "tareas"}</h2>
       <p style="margin:0 0 12px;font-size:13px;color:#63707C;font-family:${FUENTE}">De semanas que ya pasaron. No desaparece al avanzar: se acumula.</p>
       ${vencidas.map((v) => recuadro("#B3261E", "#FBF4F3",
      `<div style="font-size:13px;font-weight:bold;color:#22303B;font-family:${FUENTE}">Semana ${v.n}${v.tema ? " · " + esc(v.tema) : ""}</div>
           <ul style="margin:8px 0 0;padding-left:18px;font-size:13px;color:#22303B;font-family:${FUENTE}">${lista(v.tareas)}</ul>`)).join("")}
       <div style="height:12px;line-height:12px;font-size:0">&nbsp;</div>`
    : recuadro("#1F7A4D", "#F2F8F4",
      `<div style="font-size:13px;color:#22303B;font-family:${FUENTE}"><b>No arrastras nada.</b> Las semanas anteriores están completas.</div>`)
      + `<div style="height:12px;line-height:12px;font-size:0">&nbsp;</div>`;

  const bloqueSemana = estaSemana
    ? `<h2 style="margin:0 0 4px;font-size:15px;color:#22303B;font-family:${FUENTE}">Esta semana · la ${estaSemana.n} de ${r.semanas}</h2>
       ${estaSemana.objetivo ? `<p style="margin:0 0 12px;font-size:13px;color:#63707C;font-family:${FUENTE}">${esc(estaSemana.objetivo)}</p>` : ""}
       ${estaSemana.faltan.length
      ? `<ul style="margin:0;padding-left:18px;font-size:13px;color:#22303B;font-family:${FUENTE}">${lista(estaSemana.faltan)}</ul>`
      : `<p style="margin:0;font-size:13px;color:#1F7A4D;font-family:${FUENTE}"><b>Ya la completaste.</b></p>`}
       <p style="margin:10px 0 24px;font-size:12px;color:#63707C;font-family:${FUENTE}">${estaSemana.hechas} de ${estaSemana.total} hechas.</p>`
    : "";

  /* El botón también va en tabla: un enlace con relleno se descuadra en
     Word, y así el área pulsable es la celda entera. */
  const boton = appUrl
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 4px">
         <tr><td bgcolor="#22303B" style="background:#22303B;padding:11px 20px">
           <a href="${esc(appUrl)}" style="color:#FFFFFF;text-decoration:none;font-size:14px;font-weight:bold;font-family:${FUENTE}">Abrir mi plan</a>
         </td></tr>
       </table>`
    : "";

  const html = `<!doctype html>
<html lang="es" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>Plan de desarrollo</title>
<!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#E6E7E2;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#E6E7E2" style="background-color:#E6E7E2">
  <tr><td align="center" style="padding:28px 16px">

    <!--[if mso]><table role="presentation" width="620" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
    <table role="presentation" width="620" cellpadding="0" cellspacing="0" border="0"
           style="width:100%;max-width:620px;border-collapse:collapse">
      <tr><td bgcolor="#FFFFFF" style="background-color:#FFFFFF;border:1px solid #D4D7D2;padding:26px 24px;font-family:${FUENTE}">

        <p style="margin:0 0 2px;font-size:11px;color:#63707C;letter-spacing:1px;text-transform:uppercase;font-family:${FUENTE}">ISEL · Plan de desarrollo comercial</p>
        <h1 style="margin:0 0 18px;font-size:21px;color:#22303B;font-family:${FUENTE}">Hola, ${esc(primerNombre(col.nombre))}</h1>

        ${recuadro(color, "#F4F5F2",
    `<div style="font-size:14px;font-weight:bold;color:#22303B;font-family:${FUENTE}">${esc(cal.veredicto || "")}</div>
             <div style="margin-top:6px;font-size:12px;color:#63707C;font-family:${FUENTE}">${esc(cal.detalle || "")}</div>`)}
        <div style="height:12px;line-height:12px;font-size:0">&nbsp;</div>

        ${bloqueVencidas}
        ${bloqueSemana}

        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr><td style="border-top:1px solid #E6E7E2;padding-top:18px;font-family:${FUENTE}">
            <h2 style="margin:0 0 8px;font-size:15px;color:#22303B;font-family:${FUENTE}">Lo que llevas hecho</h2>
            <p style="margin:0;font-size:13px;color:#22303B;font-family:${FUENTE}"><b>${hechasTotales}</b> de ${totales} tareas del programa completo.</p>
            <p style="margin:6px 0 20px;font-size:12px;color:#63707C;font-family:${FUENTE}">De las que ya tocaban, llevas ${cal.hechasVencidas ?? 0} de ${cal.tareasEsperadas ?? 0}.</p>
          </td></tr>
        </table>

        ${boton}

        <p style="margin:22px 0 0;font-size:11.5px;color:#767F88;line-height:1.5;font-family:${FUENTE}">
          Marcar una tarea toma diez segundos y es lo que sostiene tu expediente.
          Si algo de este resumen no cuadra con la realidad, díselo a tu mentor.
        </p>

      </td></tr>
    </table>

    <table role="presentation" width="620" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:620px">
      <tr><td align="center" style="padding:14px 0 0;font-size:11px;color:#767F88;font-family:${FUENTE}">
        Correo automático del plan de desarrollo. No hace falta responderlo.
      </td></tr>
    </table>
    <!--[if mso]></td></tr></table><![endif]-->

  </td></tr>
</table>
</body></html>`;

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

/* ------------------------------------------------- panorama del equipo --- */

/* El segundo correo. Va a quien observa el programa sin llevar un plan
   propio: la dirección, un rol de solo lectura. No le sirve «tus tareas»
   porque no tiene; le sirve ver de un golpe quién va bien y quién no.
   Es informativo y no pide nada: no trae botón de marcar ni reclamos. */

const SEVERIDAD = { run: 0, off: 1, signal: 2, fault: 3 };

export function armarPanorama(registros, appUrl = "", hoy = new Date()) {
  /* Lo malo arriba. Un panorama ordenado por nombre obliga a leerlo
     completo para encontrar lo que hay que atender. */
  const filas = registros.slice().sort((a, b) =>
    b.r.nPendientes - a.r.nPendientes ||
    (SEVERIDAD[b.r.cal.estado] || 0) - (SEVERIDAD[a.r.cal.estado] || 0) ||
    String(a.col.nombre).localeCompare(String(b.col.nombre), "es"));

  const conAtraso = filas.filter((f) => f.r.nPendientes > 0).length;
  const total = filas.length;
  const atrasoTotal = filas.reduce((a, f) => a + f.r.nPendientes, 0);

  const fechaLarga = new Intl.DateTimeFormat("es-MX", {
    weekday: "long", day: "numeric", month: "long", timeZone: "America/Mexico_City",
  }).format(hoy);

  const celda = (contenido, extra = "") =>
    `<td style="padding:9px 10px;border-bottom:1px solid #E6E7E2;font-size:13px;color:#22303B;font-family:${FUENTE};${extra}">${contenido}</td>`;

  const encabezado = (texto, extra = "") =>
    `<td style="padding:0 10px 7px;border-bottom:2px solid #D4D7D2;font-size:11px;color:#63707C;text-transform:uppercase;letter-spacing:.5px;font-family:${FUENTE};${extra}">${esc(texto)}</td>`;

  const renglones = filas.map(({ col, r }) => {
    const color = COLOR[r.cal.estado] || COLOR.off;
    const faltanHoy = r.estaSemana ? r.estaSemana.faltan.length : 0;
    return `<tr>
      ${celda(`<b>${esc(col.nombre || "Sin nombre")}</b>`
      + `<div style="margin-top:2px;font-size:11.5px;color:${color};font-family:${FUENTE}">${esc(r.cal.veredicto || "")}</div>`)}
      ${celda(r.estaSemana ? `${r.estaSemana.n} <span style="color:#63707C">de ${r.semanas}</span>` : "—", "white-space:nowrap")}
      ${celda(r.nPendientes
        ? `<b style="color:#B3261E">${r.nPendientes}</b>`
        : `<span style="color:#63707C">0</span>`, "text-align:center")}
      ${celda(faltanHoy ? String(faltanHoy) : `<span style="color:#1F7A4D">lista</span>`, "text-align:center")}
      ${celda(`${r.hechasTotales} <span style="color:#63707C">de ${r.totales}</span>`, "white-space:nowrap")}
    </tr>`;
  }).join("");

  const titular = total === 0
    ? "No hay nadie en desarrollo ahora mismo."
    : conAtraso === 0
      ? `Las ${total === 1 ? "única persona" : `${total} personas`} en desarrollo están al día con las semanas que ya pasaron.`
      : `${conAtraso} de ${total} ${conAtraso === 1 ? "arrastra" : "arrastran"} tareas de semanas anteriores: `
        + `${atrasoTotal} en total.`;

  const html = `<!doctype html>
<html lang="es" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>Panorama del plan de desarrollo</title>
<!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#E6E7E2;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#E6E7E2" style="background-color:#E6E7E2">
  <tr><td align="center" style="padding:28px 16px">

    <!--[if mso]><table role="presentation" width="680" cellpadding="0" cellspacing="0" border="0"><tr><td><![endif]-->
    <table role="presentation" width="680" cellpadding="0" cellspacing="0" border="0"
           style="width:100%;max-width:680px;border-collapse:collapse">
      <tr><td bgcolor="#FFFFFF" style="background-color:#FFFFFF;border:1px solid #D4D7D2;padding:26px 24px;font-family:${FUENTE}">

        <p style="margin:0 0 2px;font-size:11px;color:#63707C;letter-spacing:1px;text-transform:uppercase;font-family:${FUENTE}">ISEL · Plan de desarrollo comercial</p>
        <h1 style="margin:0 0 4px;font-size:21px;color:#22303B;font-family:${FUENTE}">Panorama del equipo</h1>
        <p style="margin:0 0 18px;font-size:12px;color:#63707C;font-family:${FUENTE}">${esc(fechaLarga)}</p>

        ${recuadro(conAtraso ? COLOR.signal : COLOR.run, "#F4F5F2",
    `<div style="font-size:14px;color:#22303B;font-family:${FUENTE}">${esc(titular)}</div>`)}
        <div style="height:10px;line-height:10px;font-size:0">&nbsp;</div>

        ${total ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse">
          <tr>
            ${encabezado("Persona")}
            ${encabezado("Semana")}
            ${encabezado("Atrasado", "text-align:center")}
            ${encabezado("Esta semana", "text-align:center")}
            ${encabezado("Avance")}
          </tr>
          ${renglones}
        </table>
        <p style="margin:14px 0 0;font-size:11.5px;color:#767F88;line-height:1.5;font-family:${FUENTE}">
          <b>Atrasado</b> son tareas de semanas que ya pasaron y siguen sin marcar; no desaparecen al avanzar.
          <b>Esta semana</b> es lo que falta de la semana en curso, que todavía está a tiempo.
        </p>` : ""}

        ${appUrl ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 4px">
             <tr><td bgcolor="#22303B" style="background:#22303B;padding:11px 20px">
               <a href="${esc(appUrl)}" style="color:#FFFFFF;text-decoration:none;font-size:14px;font-weight:bold;font-family:${FUENTE}">Ver el detalle</a>
             </td></tr>
           </table>` : ""}

        <p style="margin:22px 0 0;font-size:11.5px;color:#767F88;line-height:1.5;font-family:${FUENTE}">
          Este correo es informativo: llega a quien da seguimiento al programa.
          Cada persona en desarrollo recibe por su lado el detalle de sus propias tareas.
        </p>

      </td></tr>
    </table>

    <table role="presentation" width="680" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:680px">
      <tr><td align="center" style="padding:14px 0 0;font-size:11px;color:#767F88;font-family:${FUENTE}">
        Correo automático del plan de desarrollo. No hace falta responderlo.
      </td></tr>
    </table>
    <!--[if mso]></td></tr></table><![endif]-->

  </td></tr>
</table>
</body></html>`;

  const texto = [
    "PANORAMA DEL EQUIPO",
    fechaLarga,
    "",
    titular,
    "",
    ...filas.map(({ col, r }) => {
      const faltanHoy = r.estaSemana ? r.estaSemana.faltan.length : 0;
      return `  ${col.nombre}: semana ${r.estaSemana ? r.estaSemana.n : "—"} de ${r.semanas}`
        + ` · atrasado ${r.nPendientes} · esta semana faltan ${faltanHoy}`
        + ` · avance ${r.hechasTotales}/${r.totales} · ${r.cal.veredicto || ""}`;
    }),
    "",
    appUrl ? appUrl : "",
  ].join("\n");

  const asunto = total === 0
    ? "Panorama del equipo: nadie en desarrollo"
    : conAtraso
      ? `Panorama: ${conAtraso} de ${total} con tareas atrasadas`
      : `Panorama: los ${total} al día`;

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
