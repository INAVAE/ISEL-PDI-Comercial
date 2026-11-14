/* Prueba del resumen con los expedientes reales exportados de Supabase. */
import { readFileSync, writeFileSync } from "node:fs";
import { resumenDe, correoDe, armarCorreo } from "./resumen.mjs";

/* Los expedientes de prueba se exportan de Supabase a datos.json; no se
   versionan porque llevan nombres y correos reales. Para regenerarlo, ver el
   README de esta carpeta. */
const D = process.env.DATOS_DIR || new URL(".", import.meta.url).pathname;
const datos = JSON.parse(readFileSync(`${D}/datos.json`, "utf8"));
const perfiles = new Map(datos.perfiles.map((p) => [p.id, p]));
const HOY = new Date("2026-11-13T12:00:00");

const r = [];
const check = (n, esperado, obtenido) =>
  r.push({ n, esperado: String(esperado), obtenido: String(obtenido), ok: String(esperado) === String(obtenido) });

for (const col of datos.cols) {
  const exp = { avance: datos.avance.filter((a) => a.colaborador_id === col.id),
                evals: [], visitas: [], opps: [], cuentas: [] };
  const res = resumenDe(col, exp, HOY);
  const m = armarCorreo(col, res, "https://inavae.github.io/ISEL-PDI-Comercial/");
  writeFileSync(`${D}/correo-${col.nombre.split(" ")[0].toLowerCase()}.html`, m.html);

  console.log(`\n=== ${col.nombre} <${correoDe(col, perfiles)}> ===`);
  console.log(`  asunto: ${m.asunto}`);
  console.log(`  ritmo: ${res.cal.veredicto}  |  ${res.cal.detalle}`);
  console.log(`  semana marcada ${col.semana_actual} · calendario dice ${res.cal.esperada} · exigible ${res.cal.exigible}`);
  console.log(`  vencidas: ${res.nPendientes} en ${res.vencidas.length} semanas ${res.vencidas.map(v=>"S"+v.n).join(",")}`);
  console.log(`  esta semana (${res.estaSemana?.n}): ${res.estaSemana?.hechas}/${res.estaSemana?.total} hechas, faltan ${res.estaSemana?.faltan.length}`);
  console.log(`  total hecho: ${res.hechasTotales}/${res.totales}`);

  check(`${col.nombre}: tiene correo`, true, !!correoDe(col, perfiles));
  check(`${col.nombre}: el asunto trae la semana`, true, /semana \d+/.test(m.asunto));
  check(`${col.nombre}: el html no trae marcadores sin sustituir`, false, /undefined|NaN|\[object/.test(m.html));
  check(`${col.nombre}: el texto plano tampoco`, false, /undefined|NaN|\[object/.test(m.texto));
  check(`${col.nombre}: lo vencido excluye la semana en curso`, false,
        res.vencidas.some((v) => v.n === res.estaSemana?.n));
  check(`${col.nombre}: nada vencido más allá de lo exigible`, true,
        res.vencidas.every((v) => v.n <= res.cal.exigible));
  check(`${col.nombre}: las cuentas de hechas cuadran`, res.hechasTotales,
        exp.avance.filter((a) => a.hecho).length);
  /* Lo atrasado + lo de esta semana tiene que dar lo que el panel llama
     "sin hacer de las que ya tocaban": si no, el correo se contradice solo */
  check(`${col.nombre}: atrasado + esta semana = lo que dice el ritmo`,
        res.cal.pendientesVencidas,
        res.nPendientes + (res.estaSemana ? res.estaSemana.faltan.length : 0));
  check(`${col.nombre}: la semana en curso sigue al calendario`,
        res.cal.exigible, res.estaSemana?.n);
}

/* --- casos límite --- */
const base = datos.cols[0];

/* Alguien que acaba de empezar hoy: no puede deber nada */
const nuevo = { ...base, fecha_inicio: "2026-11-13", semana_actual: 1 };
const rn = resumenDe(nuevo, { avance: [], evals: [], visitas: [], opps: [], cuentas: [] }, HOY);
check("recién inscrito: no arrastra pendientes", 0, rn.nPendientes);
check("recién inscrito: le toca la semana 1", 1, rn.estaSemana.n);

/* Alguien al día: todo marcado */
const todas = [];
(base.plan || []).forEach((s) => (s.tasks || []).forEach((t) =>
  todas.push({ colaborador_id: base.id, tarea_id: s.id + ":" + t.id, hecho: true })));
const rc = resumenDe(base, { avance: todas, evals: [], visitas: [], opps: [], cuentas: [] }, HOY);
check("todo marcado: cero pendientes", 0, rc.nPendientes);
check("todo marcado: el asunto lo dice", true, armarCorreo(base, rc).asunto.includes("al día"));
check("todo marcado: hechas = totales", rc.totales, rc.hechasTotales);

/* Un plan vacío no debe reventar */
const vacio = { ...base, plan: [] };
let revento = false;
try { resumenDe(vacio, { avance: [], evals: [], visitas: [], opps: [], cuentas: [] }, HOY); }
catch { revento = true; }
check("un plan vacío no revienta", false, revento);

/* Sin correo en ninguna parte */
check("sin correo devuelve null", null, correoDe({ ...base, email: "", user_id: null }, perfiles));
check("la cuenta vinculada manda sobre el de la ficha",
  perfiles.get(base.user_id)?.email || "(sin cuenta)",
  correoDe({ ...base, email: "otro@ejemplo.com" }, perfiles) );

/* --- las reglas que exige el Outlook de escritorio ---
   Dibuja con el motor de Word: ignora max-width, los fondos de un div dentro
   de otro y los bordes redondeados. Si alguien vuelve a maquetar con divs,
   esto lo caza antes de que lo vea el equipo. */
const correo = armarCorreo(datos.cols[0], resumenDe(datos.cols[0],
  { avance: datos.avance, evals: [], visitas: [], opps: [], cuentas: [] }, HOY),
  "https://ejemplo.mx/");
const H = correo.html;

check("outlook: la estructura va en tablas", true, (H.match(/<table/g) || []).length >= 4);
check("outlook: el ancho también como atributo, no solo en el estilo",
  true, /<table[^>]*width="620"/.test(H));
check("outlook: el fondo también como bgcolor",
  true, /bgcolor="#FFFFFF"/.test(H) && /bgcolor="#E6E7E2"/.test(H));
check("outlook: lleva el bloque condicional de mso", true, H.includes("<!--[if mso]>"));
check("outlook: y lo cierra", true, H.includes("<![endif]-->"));
check("outlook: sin bordes redondeados, que los ignora", false, /border-radius/.test(H));
check("outlook: sin display:inline-block, que descuadra", false, /display:\s*inline-block/.test(H));
check("outlook: la franja de color es una celda, no un border-left de div",
  true, /<td width="3"/.test(H));
check("outlook: cada texto lleva su familia tipográfica",
  true, (H.match(/font-family:/g) || []).length >= 10);
check("outlook: las tablas no llevan espaciado heredado",
  true, (H.match(/cellspacing="0"/g) || []).length === (H.match(/<table/g) || []).length);
check("outlook: las tablas de maquetación se marcan como presentación",
  true, (H.match(/role="presentation"/g) || []).length === (H.match(/<table/g) || []).length);

/* Escapado: un nombre con < > no debe romper el html */
const malo = armarCorreo({ ...base, nombre: '<script>x</script> Pedro' }, rn);
check("escapa el html de los nombres", false, malo.html.includes("<script>"));

let fallas = 0;
console.log("");
for (const x of r) {
  if (!x.ok) fallas++;
  console.log(`${x.ok ? "PASA " : "FALLA"} ${x.n.padEnd(58)} ${x.ok ? "" : `esperaba ${x.esperado}, obtuvo ${x.obtenido}`}`);
}
console.log(`\n${r.length - fallas} de ${r.length} pruebas pasan`);
process.exit(fallas ? 1 : 0);
