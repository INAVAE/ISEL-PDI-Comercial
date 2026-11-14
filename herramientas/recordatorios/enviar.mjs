/* ===========================================================================
   RECORDATORIOS POR CORREO

   Corre desde GitHub Actions, lunes y jueves. A cada colaborador activo le
   manda el resumen de su semana: lo vencido, lo que toca ahora y lo ya hecho.

   Aquí solo está el ir por los datos y el mandarlos. Qué dice el correo vive
   en resumen.mjs, que no depende de nada externo y por eso sí se puede
   probar.

   Variables de entorno (secretos del repositorio):
     SUPABASE_URL           la del proyecto
     SUPABASE_SERVICE_KEY   llave de servicio: lee todos los expedientes
     GMAIL_USER             la cuenta desde la que sale el correo
     GMAIL_APP_PASSWORD     contraseña de aplicación de Google, no la normal
     APP_URL                dirección de la página, para la liga del correo
     SOLO_PRUEBA            "1" para no mandar nada, solo listar
     SOLO_A                 mandar todo a esa dirección, para probar
   =========================================================================== */

import { createClient } from "@supabase/supabase-js";
import nodemailer from "nodemailer";
import { resumenDe, correoDe, armarCorreo } from "./resumen.mjs";

const {
  SUPABASE_URL, SUPABASE_SERVICE_KEY,
  GMAIL_USER, GMAIL_APP_PASSWORD,
  APP_URL = "", SOLO_PRUEBA = "", SOLO_A = "",
} = process.env;

const prueba = SOLO_PRUEBA === "1" || SOLO_PRUEBA.toLowerCase() === "true";

for (const [k, v] of Object.entries({ SUPABASE_URL, SUPABASE_SERVICE_KEY })) {
  if (!v) { console.error(`Falta el secreto ${k}.`); process.exit(1); }
}
if (!prueba && (!GMAIL_USER || !GMAIL_APP_PASSWORD)) {
  console.error("Faltan GMAIL_USER o GMAIL_APP_PASSWORD. Para probar sin mandar, marca «solo prueba».");
  process.exit(1);
}

const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, { auth: { persistSession: false } });

async function cargar() {
  const { data: cols, error } = await sb
    .from("pdc_colaboradores").select("*").eq("estado", "activo");
  if (error) throw new Error("No se pudieron leer los colaboradores: " + error.message);
  if (!cols || !cols.length) return { registros: [], perfiles: new Map() };

  const ids = cols.map((c) => c.id);
  /* Para el correo basta el avance del plan; el expediente entero pesa. */
  const { data: avance, error: e2 } = await sb
    .from("pdc_plan_avance").select("colaborador_id,tarea_id,hecho").in("colaborador_id", ids);
  if (e2) throw new Error("No se pudo leer el avance: " + e2.message);

  const { data: perfilesRaw } = await sb.from("pdc_profiles").select("id,email");

  return {
    registros: cols.map((col) => ({
      col,
      exp: {
        avance: (avance || []).filter((a) => a.colaborador_id === col.id),
        evals: [], visitas: [], opps: [], cuentas: [], kpis: [], coaching: [],
      },
    })),
    perfiles: new Map((perfilesRaw || []).map((p) => [p.id, p])),
  };
}

async function main() {
  const { registros, perfiles } = await cargar();
  if (!registros.length) { console.log("No hay colaboradores activos. Nada que mandar."); return; }

  const correo = prueba ? null : nodemailer.createTransport({
    service: "gmail",
    auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
  });

  let enviados = 0, saltados = 0, fallos = 0;

  for (const { col, exp } of registros) {
    const para = SOLO_A || correoDe(col, perfiles);
    if (!para) {
      console.log(`· ${col.nombre}: sin correo registrado, se salta`);
      saltados++;
      continue;
    }

    let r, mensaje;
    try {
      r = resumenDe(col, exp);
      mensaje = armarCorreo(col, r, APP_URL);
    } catch (e) {
      console.error(`· ${col.nombre}: no se pudo armar el resumen — ${e.message}`);
      fallos++;
      continue;
    }

    if (prueba) {
      console.log(`· ${col.nombre} <${para}>`);
      console.log(`    asunto: ${mensaje.asunto}`);
      console.log(`    vencidas: ${r.nPendientes} · esta semana faltan: ${r.estaSemana ? r.estaSemana.faltan.length : "—"} · hechas: ${r.hechasTotales}/${r.totales}`);
      enviados++;
      continue;
    }

    try {
      await correo.sendMail({
        from: `"ISEL · Plan de desarrollo" <${GMAIL_USER}>`,
        to: para,
        subject: mensaje.asunto,
        text: mensaje.texto,
        html: mensaje.html,
      });
      console.log(`· ${col.nombre} <${para}> — enviado (${r.nPendientes} pendientes)`);
      enviados++;
    } catch (e) {
      /* Un correo que rebota no debe impedir los demás */
      console.error(`· ${col.nombre} <${para}> — FALLÓ: ${e.message}`);
      fallos++;
    }
  }

  console.log(`\n${prueba ? "Prueba" : "Envío"} terminado: ${enviados} ${prueba ? "listos" : "enviados"}, ${saltados} sin correo, ${fallos} con error.`);
  /* Que la corrida salga en rojo si algo falló, para que no pase inadvertido */
  if (fallos) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
