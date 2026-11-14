/* ===========================================================================
   RECORDATORIOS POR CORREO

   Corre desde GitHub Actions cada hora y casi siempre no hace nada: quién
   recibe, qué días y a qué hora los decide el administrador desde la
   pantalla, y eso vive en la base. El cron de un repositorio no se puede
   cambiar desde la aplicación; una corrida barata cada hora, sí.

   Manda dos correos distintos:
     · a cada colaborador, el resumen de SU plan;
     · a quien solo observa el programa, el panorama del equipo.

   Aquí solo está el ir por los datos y el mandarlos. Qué dice cada correo
   vive en resumen.mjs y cuándo toca enviarlos en agenda.mjs: los dos sin
   dependencias, para poder probarlos.

   Variables de entorno (secretos y variables del repositorio):
     SUPABASE_URL           la del proyecto
     SUPABASE_SERVICE_KEY   llave de servicio: lee todos los expedientes
     GMAIL_USER             la cuenta desde la que sale el correo
     GMAIL_APP_PASSWORD     contraseña de aplicación de Google, no la normal
     APP_URL                dirección de la página, para la liga del correo
     SOLO_PRUEBA            "1" para no mandar nada, solo listar
     SOLO_A                 mandar todo a esa dirección, para probar
     FORZAR                 "1" para omitir la agenda (corrida a mano)
     MARCAR                 "1" para anotar el envío del día al terminar
     SOLO_DECIDIR           "1" para solo consultar la agenda y salir
   =========================================================================== */

import { appendFileSync } from "node:fs";
import { resumenDe, correoDe, armarCorreo, armarPanorama, bloqueEquipo } from "./resumen.mjs";
import { toca } from "../../js/agenda.js";

const {
  SUPABASE_URL, SUPABASE_SERVICE_KEY,
  GMAIL_USER, GMAIL_APP_PASSWORD,
  APP_URL = "", SOLO_PRUEBA = "", SOLO_A = "",
  FORZAR = "", MARCAR = "", SOLO_DECIDIR = "",
} = process.env;

const bandera = (v) => v === "1" || String(v).toLowerCase() === "true";
const prueba = bandera(SOLO_PRUEBA);
const forzar = bandera(FORZAR);
const marcar = bandera(MARCAR);
const soloDecidir = bandera(SOLO_DECIDIR);

for (const [k, v] of Object.entries({ SUPABASE_URL, SUPABASE_SERVICE_KEY })) {
  if (!v) { console.error(`Falta el secreto ${k}.`); process.exit(1); }
}
if (!prueba && !soloDecidir && (!GMAIL_USER || !GMAIL_APP_PASSWORD)) {
  console.error("Faltan GMAIL_USER o GMAIL_APP_PASSWORD. Para probar sin mandar, marca «solo prueba».");
  process.exit(1);
}

/* Se consulta la API REST con fetch en vez de supabase-js: son unas cuantas
   lecturas sin sesión ni tiempo real, y la librería traía consigo un cliente
   de realtime que exige WebSocket nativo —en Node 20 eso tumbaba la corrida
   entera antes de leer un solo renglón—. Menos piezas de las que depender
   para una tarea programada que además carga una llave de servicio. */
const cabeceras = {
  apikey: SUPABASE_SERVICE_KEY,
  Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
  Accept: "application/json",
};

async function leer(tabla, parametros) {
  const url = `${SUPABASE_URL}/rest/v1/${tabla}?${new URLSearchParams(parametros)}`;
  const resp = await fetch(url, { headers: cabeceras });
  if (!resp.ok) {
    const detalle = await resp.text().catch(() => "");
    throw new Error(`${tabla}: ${resp.status} ${resp.statusText}${detalle ? " — " + detalle.slice(0, 300) : ""}`);
  }
  return resp.json();
}

async function parchar(tabla, filtro, cuerpo) {
  const url = `${SUPABASE_URL}/rest/v1/${tabla}?${new URLSearchParams(filtro)}`;
  const resp = await fetch(url, {
    method: "PATCH",
    headers: { ...cabeceras, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify(cuerpo),
  });
  if (!resp.ok) {
    const detalle = await resp.text().catch(() => "");
    throw new Error(`${tabla} (PATCH): ${resp.status} ${resp.statusText}${detalle ? " — " + detalle.slice(0, 300) : ""}`);
  }
}

/* ------------------------------------------------------------- datos ----- */

async function cargar() {
  const cols = await leer("pdc_colaboradores", { select: "*", estado: "eq.activo" });
  const destinos = await leer("pdc_recordatorio_destinos", { select: "*" });
  const perfiles = await leer("pdc_profiles", { select: "id,email,nombre,activo" });

  /* Para el correo basta el avance del plan; el expediente entero pesa. */
  const ids = cols.map((c) => c.id);
  const avance = ids.length
    ? await leer("pdc_plan_avance", {
      select: "colaborador_id,tarea_id,hecho",
      colaborador_id: `in.(${ids.join(",")})`,
    })
    : [];

  const registros = cols.map((col) => ({
    col,
    exp: {
      avance: avance.filter((a) => a.colaborador_id === col.id),
      evals: [], visitas: [], opps: [], cuentas: [], kpis: [], coaching: [],
    },
  }));

  /* Los dos defaults son distintos a propósito, y es la regla que hace que
     esto no sorprenda: un colaborador SIN renglón recibe —así un alta nueva
     no se queda muda porque nadie se acordó de encenderla— y un perfil SIN
     renglón no recibe, para no mandarle a toda la plantilla un correo que
     nadie pidió. */
  const colDice = new Map(destinos.filter((d) => d.colaborador_id).map((d) => [d.colaborador_id, d.recibe]));
  const perfilDestino = new Map(destinos.filter((d) => d.perfil_id).map((d) => [d.perfil_id, d]));

  return {
    registros,
    perfiles: new Map(perfiles.map((p) => [p.id, p])),
    /* Quiénes reciben el resumen de su propio plan */
    conPlan: registros.filter(({ col }) => colDice.get(col.id) !== false),
    /* Quiénes reciben el panorama: solo los marcados, y solo con acceso
       vigente. A una cuenta suspendida no se le sigue mandando nada. */
    observadores: perfiles
      .filter((p) => (perfilDestino.get(p.id) || {}).recibe === true && p.activo !== false)
      .map((p) => ({ perfil: p, alcance: (perfilDestino.get(p.id) || {}).alcance || "todo" })),
  };
}

/* A quién ve cada observador. «propios» se resuelve contra el mentor_id de
   cada colaborador, que es la misma asignación que muestra la aplicación: no
   hay una segunda lista de carteras que pudiera quedar desfasada. */
const loQueVe = (registros, { perfil, alcance }) =>
  alcance === "propios"
    ? registros.filter(({ col }) => col.mentor_id === perfil.id)
    : registros;

/* ------------------------------------------------------------- envío ----- */

async function main() {
  const ajustes = (await leer("pdc_recordatorios", { select: "*", id: "eq.1" }))[0] || null;

  const veredicto = forzar
    ? { enviar: true, fecha: null, razon: "corrida a mano: se omite la agenda" }
    : toca(ajustes);

  console.log(`Agenda: ${veredicto.razon}`);

  /* El flujo pregunta primero y solo instala nodemailer si la respuesta es
     que sí. Veintitrés de cada veinticuatro corridas terminan aquí. */
  if (soloDecidir) {
    if (process.env.GITHUB_OUTPUT)
      appendFileSync(process.env.GITHUB_OUTPUT, `enviar=${veredicto.enviar ? "1" : "0"}\n`);
    return;
  }

  if (!veredicto.enviar) { console.log("No se envía nada."); return; }

  const { registros, perfiles, conPlan, observadores } = await cargar();

  if (!conPlan.length && !observadores.length) {
    console.log("La configuración no tiene a nadie que reciba. Nada que mandar.");
    return;
  }

  /* nodemailer se carga solo si de verdad se va a mandar algo: así el modo
     prueba corre sin esa dependencia instalada y se puede comprobar todo el
     camino —agenda, lectura, destinatarios y asuntos— sin tocar el correo. */
  let correo = null;
  if (!prueba) {
    const { default: nodemailer } = await import("nodemailer");
    correo = nodemailer.createTransport({
      service: "gmail",
      auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
    });
  }

  let enviados = 0, saltados = 0, fallos = 0;

  const despachar = async (quien, para, mensaje, nota) => {
    if (prueba) {
      console.log(`· ${quien} <${para}>`);
      console.log(`    asunto: ${mensaje.asunto}`);
      if (nota) console.log(`    ${nota}`);
      enviados++;
      return;
    }
    try {
      await correo.sendMail({
        from: `"ISEL · Plan de desarrollo" <${GMAIL_USER}>`,
        to: para,
        subject: mensaje.asunto,
        text: mensaje.texto,
        html: mensaje.html,
      });
      console.log(`· ${quien} <${para}> — enviado${nota ? " · " + nota : ""}`);
      enviados++;
    } catch (e) {
      /* Un correo que rebota no debe impedir los demás */
      console.error(`· ${quien} <${para}> — FALLÓ: ${e.message}`);
      fallos++;
    }
  };

  /* Todos los resúmenes PRIMERO, sin mandar nada. Hay que saber quién es
     además observador antes de armarle el correo: si no, a un mentor que
     también lleva plan se le manda el suyo y después, por separado, el de su
     cartera, y acaba con dos o tres correos del mismo minuto. */
  const resumenes = [];
  for (const { col, exp } of registros) {
    try {
      resumenes.push({ col, r: resumenDe(col, exp) });
    } catch (e) {
      console.error(`· ${col.nombre}: no se pudo calcular el resumen — ${e.message}`);
      fallos++;
    }
  }

  /* Lo que le toca ver a cada observador, calculado una sola vez */
  const carteras = new Map(observadores.map((o) =>
    [o.perfil.id, { ...o, bloque: bloqueEquipo(loQueVe(resumenes, o), { propios: o.alcance === "propios" }) }]));
  const yaIncluidos = new Set();

  /* --- el resumen de cada quien, con su cartera debajo si la tiene --- */
  console.log(`\nResumen propio · ${conPlan.length} ${conPlan.length === 1 ? "persona" : "personas"}`);
  for (const { col, r } of resumenes) {
    if (!conPlan.some((c) => c.col.id === col.id)) {
      console.log(`· ${col.nombre}: excluido en la configuración`);
      continue;
    }
    const para = SOLO_A || correoDe(col, perfiles);
    if (!para) {
      console.log(`· ${col.nombre}: sin correo registrado, se salta`);
      saltados++;
      continue;
    }

    /* ¿Esta persona es además observadora? Entonces su cartera va aquí
       dentro y no en un correo aparte. */
    const suya = col.user_id ? carteras.get(col.user_id) : null;
    const cartera = suya && suya.bloque.total ? suya.bloque : null;
    if (suya) yaIncluidos.add(col.user_id);

    await despachar(col.nombre, para, armarCorreo(col, r, APP_URL, cartera),
      `${r.nPendientes} atrasadas, ${r.estaSemana ? r.estaSemana.faltan.length : 0} de esta semana`
      + (cartera ? ` · con su cartera de ${cartera.total}` : ""));
  }

  /* --- el panorama para quien solo observa --- */
  const sueltos = [...carteras.values()].filter((o) => !yaIncluidos.has(o.perfil.id));
  if (sueltos.length) {
    console.log(`\nPanorama · ${sueltos.length} ${sueltos.length === 1 ? "persona" : "personas"}`);
    for (const o of sueltos) {
      const para = SOLO_A || o.perfil.email;
      if (!para) {
        console.log(`· ${o.perfil.nombre || o.perfil.id}: sin correo en su cuenta, se salta`);
        saltados++;
        continue;
      }
      /* Una cartera vacía no genera correo: mandarle a un mentor una tabla
         sin nadie no le dice nada que no sepa, y enseña el programa como si
         estuviera roto. */
      if (!o.bloque.total && o.alcance === "propios") {
        console.log(`· ${o.perfil.nombre}: sin colaboradores asignados, no se le manda nada`);
        saltados++;
        continue;
      }
      await despachar(o.perfil.nombre || o.perfil.email, para,
        armarPanorama(loQueVe(resumenes, o), APP_URL, { propios: o.alcance === "propios" }),
        o.alcance === "propios" ? `su cartera: ${o.bloque.total}` : `todo el equipo: ${o.bloque.total}`);
    }
  }

  /* Se anota el día aunque algún correo haya rebotado. Si no se anotara, la
     corrida de la hora siguiente volvería a mandárselo a quien sí lo recibió:
     entre repetir un correo y perder un día, lo segundo se nota menos y queda
     en rojo en la corrida para que alguien lo vea. */
  if (marcar && !prueba && !SOLO_A && veredicto.fecha) {
    try {
      await parchar("pdc_recordatorios", { id: "eq.1" }, { ultimo_envio: veredicto.fecha });
      console.log(`\nDía anotado: ${veredicto.fecha}. No se repetirá hoy.`);
    } catch (e) {
      /* Esto sí importa: sin la marca, la próxima hora repite los correos */
      console.error(`\nNO se pudo anotar el día (${e.message}). `
        + "Riesgo de correos repetidos en la siguiente corrida.");
      fallos++;
    }
  }

  console.log(`\n${prueba ? "Prueba" : "Envío"} terminado: ${enviados} ${prueba ? "listos" : "enviados"}, ${saltados} sin correo, ${fallos} con error.`);
  if (fallos) process.exit(1);
}

main().catch((e) => {
  /* En el registro de la corrida lo que sirve es la línea, no el rastro de
     pila: quien la abre quiere saber si fue la llave, la red o un dato. */
  console.error("Falló el envío: " + (e && e.message ? e.message : e));
  if (process.env.RUNNER_DEBUG === "1" && e && e.stack) console.error(e.stack);
  process.exit(1);
});
