/* ===========================================================================
   ¿Hoy toca mandar los recordatorios?

   GitHub solo sabe de cron en UTC, y el cron de un repositorio no se puede
   cambiar desde una pantalla. Así que el flujo corre CADA HORA y la decisión
   de verdad se toma aquí, contra los ajustes que el administrador guardó: qué
   días, a qué hora y en qué zona.

   Vive en js/ y no junto al script de envío porque lo usan los dos: el envío
   para decidir, y la pantalla de configuración para decirle al administrador
   cuándo saldrá el próximo correo. Con una copia de cada lado, la pantalla
   acabaría prometiendo una cosa y el envío haciendo otra.

   Sin Supabase a propósito. Esto es puro cálculo de calendario —la clase de
   cosa que se rompe en el cambio de horario, el domingo o a medianoche— y
   tiene que poder probarse con una fecha inventada.
   =========================================================================== */

export const DIA = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

/* Si el disparador se retrasó, el correo todavía sirve: sale en la primera
   corrida que alcance. Pero no a cualquier hora: un recordatorio de las 7 de
   la mañana que llega a las once de la noche ya no es un recordatorio, es
   una molestia.

   El margen se abrió de seis horas al final de la jornada por lo que pasó el
   lunes 16 de noviembre. El cron de GitHub resultó no ser cada hora: ese día
   despertó tres veces en vez de veinticuatro, y la única corrida posterior a
   las 08:00 cayó a las 16:00, fuera del margen. Nadie recibió nada. Entre un
   correo que llega tarde y un correo que no llega, el que no llega es peor,
   y además no deja rastro de que faltó. */
export const TOLERANCIA_MIN = 6 * 60;
export const FIN_DE_JORNADA = 18 * 60;   // 18:00 locales

/* El más tarde que se acepta: el margen de seis horas o el fin de la
   jornada, lo que caiga después. Con un envío a las 8 de la mañana manda el
   límite de las 18:00; con uno de la tarde, el margen de seis horas. */
export const limiteDeEnvio = (objetivo) => Math.max(objetivo + TOLERANCIA_MIN, FIN_DE_JORNADA);

/* La hora de la zona configurada, no la del servidor. Se saca de Intl y no
   restando seis horas: México dejó el horario de verano en 2022, pero el
   código no debe dar eso por hecho ni quedarse atado a un solo país. */
export function enZona(cuando, zona = "America/Mexico_City") {
  const partes = {};
  for (const p of new Intl.DateTimeFormat("en-CA", {
    timeZone: zona,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit",
    /* hourCycle en vez de hour12:false: con el segundo, la medianoche sale
       como "24" en algunas versiones de ICU y el cálculo se corre un día. */
    hourCycle: "h23",
  }).formatToParts(cuando)) partes[p.type] = p.value;

  const año = Number(partes.year), mes = Number(partes.month), dia = Number(partes.day);
  const hora = Number(partes.hour) % 24, minuto = Number(partes.minute);

  return {
    fecha: `${partes.year}-${partes.month}-${partes.day}`,
    /* El día de la semana se calcula de la fecha local ya resuelta, no se lee
       del nombre que devuelve Intl: así no depende del idioma del formato. */
    dow: new Date(Date.UTC(año, mes - 1, dia)).getUTCDay(),
    minutos: hora * 60 + minuto,
  };
}

export const hhmm = (min) =>
  `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

const no = (razon) => ({ enviar: false, razon });

/* Devuelve si toca enviar y, siempre, por qué. El «por qué» no es decorado:
   es lo único que verá quien abra la corrida de GitHub y se pregunte por qué
   no llegó ningún correo. */
export function toca(aj, ahora = new Date()) {
  if (!aj) return no("no hay ajustes guardados; nadie ha configurado los recordatorios");
  if (!aj.activo) return no("los recordatorios están apagados en la configuración");

  const dias = (aj.dias || []).map(Number);
  if (!dias.length) return no("no hay ningún día elegido en la configuración");

  const l = enZona(ahora, aj.zona || "America/Mexico_City");
  const elegidos = dias.slice().sort().map((d) => DIA[d]).join(", ");

  if (!dias.includes(l.dow))
    return no(`hoy es ${DIA[l.dow]} y los días elegidos son: ${elegidos}`);

  if (aj.ultimo_envio && String(aj.ultimo_envio).slice(0, 10) === l.fecha)
    return no(`el envío de hoy (${l.fecha}) ya se hizo`);

  const objetivo = Number(aj.hora) * 60 + Number(aj.minuto);
  if (l.minutos < objetivo)
    return no(`son las ${hhmm(l.minutos)} y el envío es a las ${hhmm(objetivo)}`);

  const retraso = l.minutos - objetivo;
  if (l.minutos > limiteDeEnvio(objetivo))
    return no(`la hora del envío (${hhmm(objetivo)}) pasó hace ${Math.floor(retraso / 60)} horas `
      + `y ya son las ${hhmm(l.minutos)}, pasado el límite de las ${hhmm(limiteDeEnvio(objetivo))}; `
      + `se deja para el próximo día elegido`);

  return {
    enviar: true,
    fecha: l.fecha,
    razon: `${DIA[l.dow]} ${l.fecha}, son las ${hhmm(l.minutos)} y el envío es a las ${hhmm(objetivo)}`
      + (retraso ? ` (${retraso} min de retraso, dentro del margen)` : ""),
  };
}

/* Cuándo saldrá el próximo correo, para que la pantalla no obligue a nadie a
   calcularlo de cabeza. Se apoya en toca() en vez de repetir las reglas:
   si ya es momento, lo que corresponde decir no es una fecha futura. */
export function proximo(aj, ahora = new Date()) {
  if (!aj || !aj.activo) return null;
  const dias = (aj.dias || []).map(Number);
  if (!dias.length) return null;

  if (toca(aj, ahora).enviar) return { inminente: true };

  const objetivo = Number(aj.hora) * 60 + Number(aj.minuto);
  /* Catorce días bastan: con un solo día elegido, el próximo está a lo más
     a siete, y el doble deja margen para el que ya se envió hoy. */
  for (let i = 0; i < 14; i++) {
    const l = enZona(new Date(ahora.getTime() + i * 86400000), aj.zona || "America/Mexico_City");
    if (!dias.includes(l.dow)) continue;
    if (i === 0 && l.minutos >= objetivo) continue;
    if (aj.ultimo_envio && String(aj.ultimo_envio).slice(0, 10) === l.fecha) continue;
    return { inminente: false, fecha: l.fecha, dow: l.dow, hora: hhmm(objetivo) };
  }
  return null;
}
