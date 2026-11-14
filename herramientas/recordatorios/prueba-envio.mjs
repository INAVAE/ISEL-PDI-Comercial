/* ===========================================================================
   Prueba del envío de punta a punta, contra un Supabase de mentiras.

   Lo que se comprueba aquí no es el cálculo (eso lo hace prueba.mjs) sino
   las reglas que deciden A QUIÉN le llega: el colaborador sin renglón que
   recibe, el excluido que no, el perfil observador que sí y la cuenta
   suspendida que no. Son reglas con dos defaults distintos, exactamente el
   tipo de cosa que se cree entendida y se implementa al revés.

   Levanta un servidor HTTP local que habla como la API REST de Supabase y
   corre enviar.mjs de verdad contra él, en modo prueba. Sin red y sin
   dependencias.

       node herramientas/recordatorios/prueba-envio.mjs
   =========================================================================== */

import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { writeFileSync, readFileSync, unlinkSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { resumenDe, armarPanorama, armarCorreo, bloqueEquipo } from "./resumen.mjs";
import { enZona } from "../../js/agenda.js";

const aqui = dirname(fileURLToPath(import.meta.url));
let ok = 0, mal = 0;
const comprueba = (titulo, condicion, detalle = "") => {
  if (condicion) { ok++; console.log(`  ok   ${titulo}`); }
  else { mal++; console.log(`  MAL  ${titulo}${detalle ? "\n       " + detalle : ""}`); }
};

/* ----------------------------------------------------------- escenario --- */

/* Un plan corto con fecha de inicio vieja, para que haya atraso real */
const inicio = new Date(Date.now() - 20 * 86400000).toISOString().slice(0, 10);
const plan = [
  { id: "s1", tema: "Fundamentos", objetivo: "Conocer la cartera", tasks: [{ id: "t1", texto: "Leer el catálogo" }, { id: "t2", texto: "Mapear 10 cuentas" }] },
  { id: "s2", tema: "Prospección", objetivo: "Primeras llamadas", tasks: [{ id: "t1", texto: "20 llamadas" }, { id: "t2", texto: "Agendar 3 visitas" }] },
  { id: "s3", tema: "Campo", objetivo: "Salir a visitar", tasks: [{ id: "t1", texto: "3 visitas acompañadas" }] },
];

const col = (id, nombre, extra = {}) => ({
  id, nombre, estado: "activo", fecha_inicio: inicio, semana_actual: 2, plan,
  grupos: [], competencias: [], kpis: [], criterios: [], plan_visitas: [], etapas: [], riesgos: [], examen: [],
  ...extra,
});

const COLABORADORES = [
  /* Sin renglón en destinos: debe recibir. Y su correo debe salir de la
     cuenta vinculada, no del de la ficha. */
  col("c1", "Ana Ruiz", { user_id: "u1", email: "ficha-ana@isel.mx", mentor_id: "u-mentor" }),
  /* Excluida a mano: no debe recibir, pero sí debe aparecer en el panorama */
  col("c2", "Beto Lara", { email: "beto@isel.mx", mentor_id: "u-mentor" }),
  /* Sin correo en ningún lado: se salta */
  col("c3", "Caro Mendoza", { email: null, mentor_id: null }),
  /* Mentor y colaborador a la vez: debe recibir UN correo con su plan y su
     cartera dentro, no dos. */
  col("c4", "Mario Doble", { user_id: "u-mentor", email: "mario.h@isel.mx", mentor_id: "u-admin" }),
];

const PERFILES = [
  { id: "u1", nombre: "Ana Ruiz", email: "ana@isel.mx", activo: true },
  { id: "u2", nombre: "Mario Cruz", email: "mario.cruz@isel.mx", activo: true },
  { id: "u3", nombre: "Cuenta Suspendida", email: "susp@isel.mx", activo: false },
  { id: "u4", nombre: "Nunca Marcado", email: "nadie@isel.mx", activo: true },
  { id: "u-mentor", nombre: "Mario Doble", email: "mario.h@isel.mx", activo: true },
  { id: "u-otro", nombre: "Mentor Sin Nadie", email: "sinnadie@isel.mx", activo: true },
];

const DESTINOS = [
  { id: "d1", colaborador_id: "c2", perfil_id: null, recibe: false },  // excluido
  { id: "d2", colaborador_id: null, perfil_id: "u2", recibe: true, alcance: "todo" },
  { id: "d3", colaborador_id: null, perfil_id: "u3", recibe: true, alcance: "todo" },   // suspendido
  { id: "d4", colaborador_id: null, perfil_id: "u4", recibe: false, alcance: "todo" },  // marcado que no
  /* Mentor que además lleva plan: su cartera es Ana y Beto */
  { id: "d5", colaborador_id: null, perfil_id: "u-mentor", recibe: true, alcance: "propios" },
  /* Marcado, pero sin nadie a su cargo: no debe recibir una tabla vacía */
  { id: "d6", colaborador_id: null, perfil_id: "u-otro", recibe: true, alcance: "propios" },
];

/* El identificador es el que arma clave() en metricas.js, no uno inventado:
   con un separador distinto el avance no empata con ninguna tarea, los tres
   salen igual de mal y la prueba del orden deja de distinguir nada.
   Aquí van a propósito tres avances distintos: Beto al corriente, Ana a
   medias y Caro sin tocar nada. */
const AVANCE = [
  { colaborador_id: "c1", tarea_id: "s1:t1", hecho: true },
  { colaborador_id: "c2", tarea_id: "s1:t1", hecho: true },
  { colaborador_id: "c2", tarea_id: "s1:t2", hecho: true },
  { colaborador_id: "c2", tarea_id: "s2:t1", hecho: true },
  { colaborador_id: "c2", tarea_id: "s2:t2", hecho: true },
];

/* --------------------------------------------------- Supabase de mentiras */

/* La hora del envío se apunta a AHORA, no a una fija: con una fija la prueba
   pasa o falla según la hora a la que se corra, que es justo lo que la
   agenda tiene que saber distinguir. */
const ahoraLocal = enZona(new Date(), "America/Mexico_City");
let ajustes = {
  id: 1, activo: true, dias: [0, 1, 2, 3, 4, 5, 6],
  hora: Math.floor(ahoraLocal.minutos / 60), minuto: ahoraLocal.minutos % 60,
  zona: "America/Mexico_City", ultimo_envio: null,
};
let parches = [];

const servidor = createServer((req, res) => {
  const url = new URL(req.url, "http://local");
  const tabla = url.pathname.replace("/rest/v1/", "");

  if (req.method === "PATCH") {
    let cuerpo = "";
    req.on("data", (d) => (cuerpo += d));
    req.on("end", () => {
      parches.push({ tabla, cuerpo: JSON.parse(cuerpo || "{}") });
      res.writeHead(204).end();
    });
    return;
  }

  const datos = {
    pdc_recordatorios: [ajustes],
    pdc_colaboradores: COLABORADORES,
    pdc_recordatorio_destinos: DESTINOS,
    pdc_profiles: PERFILES,
    pdc_plan_avance: AVANCE,
  }[tabla];

  if (!datos) { res.writeHead(404).end(`sin tabla ${tabla}`); return; }
  res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify(datos));
});

const puerto = await new Promise((r) => servidor.listen(0, "127.0.0.1", () => r(servidor.address().port)));

/* ------------------------------------------------------------- correr ---- */

const correr = (entorno = {}) => new Promise((resolver) => {
  const hijo = spawn(process.execPath, [join(aqui, "enviar.mjs")], {
    env: {
      ...process.env,
      SUPABASE_URL: `http://127.0.0.1:${puerto}`,
      SUPABASE_SERVICE_KEY: "llave-de-mentiras",
      APP_URL: "https://inavae.github.io/ISEL-PDI-Comercial/",
      SOLO_PRUEBA: "1",
      GMAIL_USER: "", GMAIL_APP_PASSWORD: "",
      FORZAR: "", MARCAR: "", SOLO_DECIDIR: "", SOLO_A: "",
      ...entorno,
    },
  });
  let salida = "";
  hijo.stdout.on("data", (d) => (salida += d));
  hijo.stderr.on("data", (d) => (salida += d));
  hijo.on("close", (codigo) => resolver({ salida, codigo }));
});

/* --------------------------------------------------------- quién recibe -- */

console.log("\nQuién recibe");
{
  const { salida, codigo } = await correr();
  comprueba("la corrida termina bien", codigo === 0, salida);
  comprueba("el colaborador sin renglón recibe", /Ana Ruiz <ana@isel\.mx>/.test(salida), salida);
  comprueba("y con el correo de su cuenta, no el de la ficha",
    !/ficha-ana/.test(salida), "usó el correo de la ficha");
  comprueba("el colaborador excluido no recibe",
    /Beto Lara: excluido en la configuración/.test(salida), salida);
  comprueba("el colaborador sin correo se salta",
    /Caro Mendoza: sin correo registrado/.test(salida), salida);
  comprueba("el perfil marcado recibe el panorama",
    /Mario Cruz <mario\.cruz@isel\.mx>/.test(salida), salida);
  comprueba("la cuenta suspendida no recibe", !/susp@isel\.mx/.test(salida), salida);
  comprueba("el perfil marcado que no, tampoco", !/nadie@isel\.mx/.test(salida), salida);
  comprueba("el asunto propio lleva el número de atrasadas",
    /asunto: Tu plan: \d+ tareas? atrasadas?/.test(salida), salida);
  comprueba("el asunto del panorama cuenta a los cuatro del equipo",
    /asunto: Panorama: \d+ de 4 con tareas atrasadas/.test(salida), salida);
}

console.log("\nAlcance: todo el equipo o solo la cartera");
{
  const { salida } = await correr();

  /* Mario Doble es mentor de Ana y Beto, y además lleva su propio plan */
  comprueba("quien es mentor y colaborador recibe UN solo correo",
    (salida.match(/mario\.h@isel\.mx/g) || []).length === 1, salida);
  comprueba("y ese correo lleva su cartera dentro",
    /Mario Doble <mario\.h@isel\.mx>[\s\S]*?con su cartera de 2/.test(salida), salida);
  comprueba("la cartera es la suya, no el equipo entero",
    /con su cartera de 2/.test(salida) && !/con su cartera de 4/.test(salida), salida);
  comprueba("no se le manda además un panorama suelto",
    !/su cartera: 2/.test(salida), salida);
  comprueba("al observador de alcance «todo» sí le llega el equipo entero",
    /Mario Cruz[\s\S]*?todo el equipo: 4/.test(salida), salida);
  comprueba("al mentor sin nadie asignado no se le manda nada",
    /Mentor Sin Nadie: sin colaboradores asignados/.test(salida), salida);
}

console.log("\nLa agenda manda");
{
  const hoy = new Date();
  const ayer = (hoy.getDay() + 6) % 7;
  ajustes = { ...ajustes, dias: [ayer] };   // cualquier día menos hoy
  const { salida, codigo } = await correr();
  comprueba("si hoy no es día elegido, no manda nada",
    codigo === 0 && /No se envía nada/.test(salida) && !/Ana Ruiz </.test(salida), salida);
  comprueba("y el registro dice por qué", /Agenda: hoy es \w+ y los días elegidos son/.test(salida), salida);
}
{
  ajustes = { ...ajustes, activo: false };
  const { salida } = await correr();
  comprueba("apagado: no manda y lo dice",
    /están apagados/.test(salida) && !/Ana Ruiz </.test(salida), salida);
}
{
  const { salida } = await correr({ FORZAR: "1" });
  comprueba("una corrida a mano omite la agenda incluso apagada",
    /se omite la agenda/.test(salida) && /Ana Ruiz </.test(salida), salida);
  ajustes = { ...ajustes, activo: true, dias: [0, 1, 2, 3, 4, 5, 6] };
}

console.log("\nLa decisión previa del flujo");
{
  const archivo = join(aqui, "salida-de-prueba.txt");
  writeFileSync(archivo, "");
  const { salida, codigo } = await correr({ SOLO_DECIDIR: "1", GITHUB_OUTPUT: archivo });
  const escrito = readFileSync(archivo, "utf8");
  comprueba("escribe la decisión para el flujo", /enviar=1/.test(escrito), escrito);
  comprueba("y no manda nada en ese paso", !/Ana Ruiz </.test(salida), salida);
  comprueba("sin necesitar la contraseña del correo", codigo === 0, salida);

  ajustes = { ...ajustes, activo: false };
  writeFileSync(archivo, "");
  await correr({ SOLO_DECIDIR: "1", GITHUB_OUTPUT: archivo });
  comprueba("si no toca, escribe enviar=0", /enviar=0/.test(readFileSync(archivo, "utf8")));
  ajustes = { ...ajustes, activo: true };
  if (existsSync(archivo)) unlinkSync(archivo);
}

console.log("\nMarcar el día");
{
  parches = [];
  await correr({ MARCAR: "1" });
  comprueba("en modo prueba NO se marca el día", parches.length === 0,
    JSON.stringify(parches));

  parches = [];
  await correr({ MARCAR: "1", SOLO_PRUEBA: "", SOLO_A: "yo@isel.mx", GMAIL_USER: "x@gmail.com", GMAIL_APP_PASSWORD: "x" });
  comprueba("una prueba dirigida a una sola dirección tampoco marca el día",
    parches.length === 0, JSON.stringify(parches));
}

/* ------------------------------------------------------- el envío real --- */

/* El camino que de verdad corre los lunes, con un nodemailer de mentiras.
   Lo que se comprueba es que el día QUEDE MARCADO: si no se marcara, la
   corrida de la hora siguiente volvería a mandar todo, y con el margen de
   recuperación de seis horas eso son hasta seis correos repetidos a cada
   persona. Es el peor desenlace posible de este cambio. */
console.log("\nEl envío real");
{
  const paquete = join(aqui, "../../node_modules/nodemailer");
  const buzon = join(aqui, "buzon-de-prueba.json");
  const yaExistia = existsSync(paquete);

  if (yaExistia) {
    console.log("  --   se omite: ya hay un nodemailer instalado");
  } else {
    mkdirSync(paquete, { recursive: true });
    writeFileSync(join(paquete, "package.json"),
      JSON.stringify({ name: "nodemailer", version: "0.0.0-prueba", main: "index.js" }));
    /* Anota cada correo en un archivo en vez de mandarlo */
    writeFileSync(join(paquete, "index.js"), `
      const { appendFileSync } = require("node:fs");
      module.exports = {
        createTransport: () => ({
          sendMail: async (m) => {
            appendFileSync(process.env.BUZON_PRUEBA,
              JSON.stringify({ to: m.to, subject: m.subject }) + "\\n");
            return { messageId: "prueba" };
          },
        }),
      };
    `);

    writeFileSync(buzon, "");
    parches = [];
    const { salida, codigo } = await correr({
      SOLO_PRUEBA: "", MARCAR: "1", SOLO_A: "",
      GMAIL_USER: "isel@gmail.com", GMAIL_APP_PASSWORD: "x",
      BUZON_PRUEBA: buzon,
    });

    const mandados = readFileSync(buzon, "utf8").trim().split("\n").filter(Boolean).map(JSON.parse);

    comprueba("la corrida termina bien", codigo === 0, salida);
    comprueba("salieron tres correos: dos resúmenes y un panorama",
      mandados.length === 3, JSON.stringify(mandados));
    comprueba("el resumen fue a la colaboradora",
      mandados.some((m) => m.to === "ana@isel.mx" && /^Tu plan/.test(m.subject)),
      JSON.stringify(mandados));
    comprueba("el panorama fue al observador",
      mandados.some((m) => m.to === "mario.cruz@isel.mx" && /^Panorama/.test(m.subject)),
      JSON.stringify(mandados));
    /* Lo que de verdad se está probando aquí: que el que es las dos cosas
       recibe UN correo, y que el asunto avisa de su cartera sin tapar lo
       suyo, que es lo que tiene que hacer. */
    const doble = mandados.filter((m) => m.to === "mario.h@isel.mx");
    comprueba("el mentor que además lleva plan recibe uno solo", doble.length === 1,
      JSON.stringify(doble));
    comprueba("y su asunto empieza por lo suyo y termina en su cartera",
      doble[0] && /^Tu plan:.*· cartera: 1 con atraso$/.test(doble[0].subject),
      doble[0] && doble[0].subject);
    comprueba("y el día quedó marcado, para no repetirlo en una hora",
      parches.length === 1 && parches[0].tabla === "pdc_recordatorios"
      && /^\d{4}-\d{2}-\d{2}$/.test(parches[0].cuerpo.ultimo_envio || ""),
      JSON.stringify(parches));
    comprueba("con la fecha LOCAL, no la del servidor",
      parches[0] && parches[0].cuerpo.ultimo_envio === ahoraLocal.fecha,
      `marcó ${parches[0] && parches[0].cuerpo.ultimo_envio}, local es ${ahoraLocal.fecha}`);

    /* Y ahora, con el día ya marcado, la hora siguiente no debe repetir */
    ajustes = { ...ajustes, ultimo_envio: ahoraLocal.fecha };
    writeFileSync(buzon, "");
    const segunda = await correr({
      SOLO_PRUEBA: "", MARCAR: "1", SOLO_A: "",
      GMAIL_USER: "isel@gmail.com", GMAIL_APP_PASSWORD: "x",
      BUZON_PRUEBA: buzon,
    });
    comprueba("la corrida siguiente no manda nada",
      readFileSync(buzon, "utf8").trim() === "" && /ya se hizo/.test(segunda.salida),
      segunda.salida);

    rmSync(paquete, { recursive: true, force: true });
    unlinkSync(buzon);
  }
}

/* ----------------------------------------------- el panorama por dentro -- */

console.log("\nEl panorama");
{
  const registros = COLABORADORES.map((c) => ({
    col: c,
    r: resumenDe(c, { avance: AVANCE.filter((a) => a.colaborador_id === c.id) }),
  }));
  const p = armarPanorama(registros, "https://ejemplo.mx");

  comprueba("incluye al excluido del correo propio", /Beto Lara/.test(p.html), "falta Beto");
  comprueba("incluye a los cuatro del equipo",
    ["Ana Ruiz", "Beto Lara", "Caro Mendoza", "Mario Doble"].every((n) => p.html.includes(n)));
  /* Caro no ha tocado nada, Ana va a medias y Beto está al corriente: el
     orden tiene que salir de eso y no del alfabeto. */
  const orden = ["Caro Mendoza", "Ana Ruiz", "Beto Lara"].map((n) => p.html.indexOf(n));
  comprueba("lo peor va primero, no el orden alfabético",
    orden[0] < orden[1] && orden[1] < orden[2],
    `posiciones Caro/Ana/Beto: ${orden.join(", ")}`);
  comprueba("y quien está al corriente aparece sin atraso",
    registros.find((x) => x.col.nombre === "Beto Lara").r.nPendientes === 0);

  /* Las reglas que el Outlook de escritorio ignora, y que ya costaron una
     corrección: si alguien vuelve a meter un div con fondo o un borde
     redondeado, esto lo detiene. */
  comprueba("la estructura va en tablas con ancho como atributo",
    /<table[^>]*width="680"/.test(p.html));
  comprueba("la tarjeta blanca lleva bgcolor", /bgcolor="#FFFFFF"/.test(p.html));
  comprueba("sin bordes redondeados", !/border-radius/.test(p.html));
  comprueba("sin inline-block", !/display:\s*inline-block/.test(p.html));
  comprueba("con el acondicionado de Outlook", /<!--\[if mso\]>/.test(p.html));
  comprueba("cada bloque de texto declara su tipografía",
    (p.html.match(/font-family:/g) || []).length >= 10);
  comprueba("trae versión de texto plano",
    p.texto.includes("PANORAMA DEL EQUIPO") && p.texto.includes("Ana Ruiz"));
  comprueba("el asunto dice de un golpe cómo va el equipo",
    /^Panorama: \d+ de 4 con tareas atrasadas$/.test(p.asunto), p.asunto);

  writeFileSync(join(aqui, "correo-panorama.html"), p.html);
  console.log("       (panorama escrito en correo-panorama.html para verlo)");

  /* El correo combinado: plan propio arriba, cartera abajo */
  const mentor = registros.find((x) => x.col.nombre === "Mario Doble");
  const suCartera = bloqueEquipo(
    registros.filter((x) => x.col.mentor_id === "u-mentor"), { propios: true });
  const combinado = armarCorreo(mentor.col, mentor.r, "https://ejemplo.mx", suCartera);

  comprueba("el combinado trae las dos partes",
    /Esta semana/.test(combinado.html) && /Tu cartera/.test(combinado.html), "falta una");
  comprueba("y en la cartera van sus dos colaboradores",
    combinado.html.includes("Ana Ruiz") && combinado.html.includes("Beto Lara"));
  comprueba("pero no los que no son suyos",
    !combinado.html.includes("Caro Mendoza"), "se coló alguien de fuera de su cartera");
  comprueba("la versión de texto también las trae",
    /TU CARTERA/.test(combinado.texto) && /Ana Ruiz/.test(combinado.texto));

  writeFileSync(join(aqui, "correo-mentor.html"), combinado.html);
  console.log("       (correo combinado escrito en correo-mentor.html)");
}

servidor.close();
console.log(`\n${ok} correctas, ${mal} con problema\n`);
process.exit(mal ? 1 : 0);
