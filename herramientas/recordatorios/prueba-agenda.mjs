/* ===========================================================================
   Pruebas de la agenda. No necesitan datos reales ni red: por eso la agenda
   es un módulo aparte.

       node herramientas/recordatorios/prueba-agenda.mjs
   =========================================================================== */

import { toca, proximo, enZona, hhmm, TOLERANCIA_MIN } from "../../js/agenda.js";

let ok = 0, mal = 0;
const comprueba = (titulo, condicion, detalle = "") => {
  if (condicion) { ok++; console.log(`  ok   ${titulo}`); }
  else { mal++; console.log(`  MAL  ${titulo}${detalle ? " — " + detalle : ""}`); }
};

/* Lunes y jueves a las 7:35 de la mañana, hora de Ciudad de México */
const base = { activo: true, dias: [1, 4], hora: 7, minuto: 35, zona: "America/Mexico_City", ultimo_envio: null };
const cdmx = (iso) => new Date(iso);

console.log("\nLa hora local, no la del servidor");
{
  /* 2026-11-16 es lunes. CDMX está en UTC-6 todo el año desde 2022. */
  const l = enZona(cdmx("2026-11-16T13:35:00Z"), "America/Mexico_City");
  comprueba("13:35 UTC son las 07:35 en CDMX", l.minutos === 7 * 60 + 35, `dio ${hhmm(l.minutos)}`);
  comprueba("y es lunes", l.dow === 1, `dio dow=${l.dow}`);
  comprueba("con la fecha local correcta", l.fecha === "2026-11-16", l.fecha);
}
{
  /* La medianoche es el caso que rompe hour12:false: sale 24 y corre el día */
  const l = enZona(cdmx("2026-11-16T06:00:00Z"), "America/Mexico_City");
  comprueba("la medianoche local es el minuto 0, no 1440", l.minutos === 0, `dio ${l.minutos}`);
  comprueba("y sigue siendo el día 16", l.fecha === "2026-11-16", l.fecha);
}
{
  /* Lunes temprano en UTC es todavía domingo en México: si se tomara el día
     de la semana en UTC, el correo saldría un día antes. */
  const l = enZona(cdmx("2026-11-16T04:00:00Z"), "America/Mexico_City");
  comprueba("lunes 04:00 UTC es domingo en CDMX", l.dow === 0 && l.fecha === "2026-11-15",
    `dio dow=${l.dow} ${l.fecha}`);
  const r = toca({ ...base, dias: [1] }, cdmx("2026-11-16T04:00:00Z"));
  comprueba("y por eso no se envía", r.enviar === false, r.razon);
}

console.log("\nEl desplazamiento no está escrito a mano");
{
  /* Nueva York sí cambia de horario. Si el cálculo restara una cantidad
     fija, una de estas dos fallaría. */
  const ny = { ...base, zona: "America/New_York" };
  const verano = toca(ny, cdmx("2026-07-06T11:35:00Z"));   // lunes, EDT = UTC-4
  const invierno = toca(ny, cdmx("2026-01-05T12:35:00Z")); // lunes, EST = UTC-5
  comprueba("7:35 locales en verano (EDT) envían", verano.enviar === true, verano.razon);
  comprueba("7:35 locales en invierno (EST) envían", invierno.enviar === true, invierno.razon);
}

console.log("\nDías y hora elegidos");
{
  const r = toca(base, cdmx("2026-11-16T13:35:00Z"));
  comprueba("lunes a la hora exacta: envía", r.enviar === true, r.razon);
  comprueba("y devuelve la fecha local para marcarla", r.fecha === "2026-11-16", r.fecha);
}
comprueba("jueves también envía", toca(base, cdmx("2026-11-19T13:35:00Z")).enviar === true);
{
  const r = toca(base, cdmx("2026-11-17T13:35:00Z")); // martes
  comprueba("martes no envía", r.enviar === false);
  comprueba("y la razón nombra el día y los elegidos",
    /martes/.test(r.razon) && /lunes/.test(r.razon) && /jueves/.test(r.razon), r.razon);
}
{
  const r = toca(base, cdmx("2026-11-16T13:00:00Z")); // 07:00 local
  comprueba("antes de la hora no envía", r.enviar === false);
  comprueba("y dice qué hora es y a qué hora toca",
    r.razon.includes("07:00") && r.razon.includes("07:35"), r.razon);
}

console.log("\nRecuperación si GitHub se retrasó");
{
  const r = toca(base, cdmx("2026-11-16T15:00:00Z")); // 09:00 local, 85 min tarde
  comprueba("una hora y media tarde: todavía envía", r.enviar === true, r.razon);
  comprueba("y lo anota como retraso", /retraso/.test(r.razon), r.razon);
}
{
  const r = toca(base, cdmx("2026-11-17T02:00:00Z")); // lunes 20:00 local
  comprueba(`pasado el margen de ${TOLERANCIA_MIN / 60} h no envía`, r.enviar === false, r.razon);
  comprueba("y explica que se deja para el próximo día", /próximo día/.test(r.razon), r.razon);
}

console.log("\nNo se repite el envío del día");
{
  const r = toca({ ...base, ultimo_envio: "2026-11-16" }, cdmx("2026-11-16T15:00:00Z"));
  comprueba("si ya se envió hoy, no se repite", r.enviar === false, r.razon);
}
{
  /* Por si algún día la columna llega como marca de tiempo completa */
  const r = toca({ ...base, ultimo_envio: "2026-11-16T13:36:02.123Z" }, cdmx("2026-11-16T15:00:00Z"));
  comprueba("tolera una marca de tiempo completa", r.enviar === false, r.razon);
}
comprueba("el envío del lunes no bloquea el del jueves",
  toca({ ...base, ultimo_envio: "2026-11-16" }, cdmx("2026-11-19T13:35:00Z")).enviar === true);

console.log("\nApagadores");
comprueba("apagado: no envía", toca({ ...base, activo: false }, cdmx("2026-11-16T13:35:00Z")).enviar === false);
comprueba("sin días: no envía", toca({ ...base, dias: [] }, cdmx("2026-11-16T13:35:00Z")).enviar === false);
comprueba("sin ajustes: no envía", toca(null, cdmx("2026-11-16T13:35:00Z")).enviar === false);
comprueba("toda negativa trae una razón",
  [toca({ ...base, activo: false }, cdmx("2026-11-16T13:35:00Z")),
   toca({ ...base, dias: [] }, cdmx("2026-11-16T13:35:00Z")),
   toca(null, new Date())].every((r) => typeof r.razon === "string" && r.razon.length > 10));

console.log("\nLa hora elegida se respeta tal cual");
{
  /* Una hora cualquiera, no solo la mañana: la pantalla deja elegirla */
  const tarde = { ...base, hora: 16, minuto: 0 };
  comprueba("16:00 no envía a las 15:00", toca(tarde, cdmx("2026-11-16T21:00:00Z")).enviar === false);
  comprueba("16:00 sí envía a las 16:00", toca(tarde, cdmx("2026-11-16T22:00:00Z")).enviar === true);
}

console.log("\nEl próximo envío que anuncia la pantalla");
{
  /* Lo que diga aquí la pantalla tiene que coincidir con lo que hará el
     envío: por eso proximo() se apoya en toca() en vez de repetir la regla. */
  const viernes = cdmx("2026-11-13T20:00:00Z");  // viernes 14:00 en CDMX
  const p = proximo(base, viernes);
  comprueba("desde un viernes, el próximo es el lunes",
    p && p.inminente === false && p.fecha === "2026-11-16" && p.hora === "07:35",
    JSON.stringify(p));

  const lunesTemprano = proximo(base, cdmx("2026-11-16T12:00:00Z")); // 06:00 local
  comprueba("un lunes antes de la hora, el próximo es hoy mismo",
    lunesTemprano && lunesTemprano.fecha === "2026-11-16", JSON.stringify(lunesTemprano));

  const dentroDelMargen = proximo(base, cdmx("2026-11-16T15:00:00Z")); // 09:00 local
  comprueba("si ya toca, lo dice en vez de inventar una fecha futura",
    dentroDelMargen && dentroDelMargen.inminente === true, JSON.stringify(dentroDelMargen));

  const yaEnviado = proximo({ ...base, ultimo_envio: "2026-11-16" }, cdmx("2026-11-16T15:00:00Z"));
  comprueba("enviado el lunes, anuncia el jueves",
    yaEnviado && yaEnviado.fecha === "2026-11-19", JSON.stringify(yaEnviado));

  comprueba("apagado: no anuncia nada", proximo({ ...base, activo: false }, viernes) === null);
  comprueba("sin días: no anuncia nada", proximo({ ...base, dias: [] }, viernes) === null);

  /* Un solo día a la semana: el salto más largo que puede haber */
  const soloDomingo = proximo({ ...base, dias: [0] }, cdmx("2026-11-16T18:00:00Z"));
  comprueba("con un solo día a la semana lo encuentra igual",
    soloDomingo && soloDomingo.fecha === "2026-11-22", JSON.stringify(soloDomingo));
}

console.log(`\n${ok} correctas, ${mal} con problema\n`);
process.exit(mal ? 1 : 0);
