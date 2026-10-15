/* ===========================================================================
   Aplicación principal: sesión, permisos por rol, navegación y carga de datos.
   =========================================================================== */

import { auth, miPerfil, colaboradores, cargarExpediente, plantilla, perfiles,
  enlaceRecuperacion, errorEnlace } from "./db.js";
import { h, vaciar, boton, entrada, campo, aviso, lampara, cls, modal, cerrarModal, panel, dinero, botonTema, iniciarTema, fecha } from "./ui.js";
import { metricas } from "./metricas.js";
import { vistaResumen, vistaColaboradores, vistaUsuarios, vistaPlantilla, vistaCuenta } from "./vistas-gestion.js";
import { vistaPanel, vistaRuta, vistaCompetencias, vistaKpis, vistaGraduacion, vistaRiesgos, vistaConfiguracion } from "./vistas-programa.js";
import { vistaVisitas, vistaPipeline, vistaCuentas, vistaCoaching } from "./vistas-actividad.js";

const raiz = document.getElementById("app");

export const estado = {
  perfil: null,
  colaboradores: [],
  colId: null,
  col: null,
  exp: null,
  m: null,
  vista: "panel",
  plantillaGlobal: null,
  perfilesCache: [],
  /* Recuerda pestañas y filtros para que no se reinicien al guardar */
  /* semanasAbiertas: qué semanas de la ruta quedaron desplegadas. Vive aquí
     y no en el DOM porque cada refresco vuelve a pintar la vista. */
  ui: { corteCompetencias: null, mesRuta: null, pestanaConfig: "plan", semanasAbiertas: null },
};

/* ------------------------------------------------------------- PERMISOS -- */

export const permisos = {
  get rol() { return estado.perfil ? estado.perfil.rol : null; },
  get esAdmin() { return permisos.rol === "admin"; },
  get esMentor() { return permisos.rol === "mentor" || permisos.esAdmin; },
  get esColaborador() { return permisos.rol === "colaborador"; },
  get esLector() { return permisos.rol === "lector"; },
  /* El mentor solo edita el plan de los colaboradores que tiene asignados */
  editaPrograma(col) {
    if (permisos.esAdmin) return true;
    return permisos.rol === "mentor" && col && col.mentor_id === estado.perfil.id;
  },
  evalua(col) { return permisos.editaPrograma(col); },
  /* El colaborador captura su propia actividad; el mentor puede corregirla.
     El rol de solo lectura nunca escribe. */
  captura(col) {
    if (!col || permisos.esLector) return false;
    return permisos.editaPrograma(col) || col.user_id === estado.perfil.id;
  },
};

/* ---------------------------------------------------------------- MENÚ --- */

const TODOS = ["admin", "mentor", "colaborador", "lector"];
const GESTION = ["admin", "mentor", "lector"];

const MENU = [
  { id: "resumen", nombre: "Resumen general", roles: GESTION, grupo: "Gestión" },
  { id: "colaboradores", nombre: "Colaboradores", roles: GESTION, grupo: "Gestión" },
  { id: "panel", nombre: "Panel", roles: TODOS, grupo: "Desarrollo", requiereCol: true },
  { id: "ruta", nombre: "Ruta de 20 semanas", roles: TODOS, grupo: "Desarrollo", requiereCol: true },
  { id: "competencias", nombre: "Competencias", roles: TODOS, grupo: "Desarrollo", requiereCol: true },
  { id: "kpis", nombre: "KPIs", roles: TODOS, grupo: "Desarrollo", requiereCol: true },
  { id: "visitas", nombre: "Visitas de campo", roles: TODOS, grupo: "Actividad", requiereCol: true },
  { id: "pipeline", nombre: "Pipeline", roles: TODOS, grupo: "Actividad", requiereCol: true },
  { id: "cuentas", nombre: "Cuentas", roles: TODOS, grupo: "Actividad", requiereCol: true },
  { id: "coaching", nombre: "Coaching", roles: TODOS, grupo: "Actividad", requiereCol: true },
  { id: "graduacion", nombre: "Graduación", roles: TODOS, grupo: "Desarrollo", requiereCol: true },
  { id: "riesgos", nombre: "Riesgos", roles: GESTION, grupo: "Desarrollo", requiereCol: true },
  { id: "configuracion", nombre: "Configurar programa", roles: ["admin", "mentor"], grupo: "Administración", requiereCol: true },
  { id: "plantilla", nombre: "Plantilla base", roles: ["admin"], grupo: "Administración" },
  { id: "usuarios", nombre: "Usuarios y roles", roles: ["admin"], grupo: "Administración" },
  { id: "cuenta", nombre: "Mi cuenta", roles: TODOS, grupo: "Administración" },
];

const VISTAS = {
  resumen: vistaResumen, colaboradores: vistaColaboradores, usuarios: vistaUsuarios,
  plantilla: vistaPlantilla, cuenta: vistaCuenta,
  panel: vistaPanel, ruta: vistaRuta, competencias: vistaCompetencias, kpis: vistaKpis,
  graduacion: vistaGraduacion, riesgos: vistaRiesgos, configuracion: vistaConfiguracion,
  visitas: vistaVisitas, pipeline: vistaPipeline, cuentas: vistaCuentas, coaching: vistaCoaching,
};

/* ---------------------------------------------------------------- CARGA -- */

export async function recargarColaboradores() {
  estado.colaboradores = await colaboradores.listar();
  if (estado.colId && !estado.colaboradores.some((c) => c.id === estado.colId)) estado.colId = null;
  if (!estado.colId) {
    const propio = estado.colaboradores.find((c) => c.user_id === estado.perfil.id);
    const activos = estado.colaboradores.filter((c) => c.estado === "activo");
    estado.colId = (propio || activos[0] || estado.colaboradores[0] || {}).id || null;
  }
}

export async function recargarExpediente() {
  if (!estado.colId) { estado.col = null; estado.exp = null; estado.m = null; return; }
  estado.col = await colaboradores.leer(estado.colId);
  if (!estado.col) { estado.colId = null; estado.exp = null; estado.m = null; return; }
  estado.exp = await cargarExpediente(estado.colId);
  estado.m = metricas(estado.col, estado.exp);
}

/* pintar() reconstruye la página entera, así que el navegador pierde la
   posición del scroll. Al marcar una tarea eso mandaba al usuario hasta
   arriba. Se guarda y se repone en el mismo cuadro, antes de pintar nada. */
function conservandoScroll(fn) {
  const y = window.scrollY;
  fn();
  requestAnimationFrame(() => window.scrollTo(0, y));
}

export async function refrescar(vista) {
  if (vista) estado.vista = vista;
  await recargarExpediente();
  conservandoScroll(pintar);
}

export async function refrescarTodo(vista) {
  await recargarColaboradores();
  await recargarExpediente();
  if (vista) estado.vista = vista;
  conservandoScroll(pintar);
}

export const ir = (vista) => { estado.vista = vista; pintar(); window.scrollTo(0, 0); };

export async function elegirColaborador(id) {
  estado.colId = id;
  /* Otro colaborador va en otra semana: lo desplegado del anterior no aplica */
  estado.ui.semanasAbiertas = null;
  estado.ui.mesRuta = null;
  await recargarExpediente();
  pintar();
}

/* --------------------------------------------------------------- PINTAR -- */

export function pintar() {
  const menu = MENU.filter((x) => x.roles.includes(permisos.rol));
  const disponible = menu.filter((x) => !x.requiereCol || estado.col);
  if (!disponible.some((x) => x.id === estado.vista)) estado.vista = disponible[0] ? disponible[0].id : "cuenta";

  const grupos = [...new Set(menu.map((x) => x.grupo))];
  const rail = h("aside", { class: "rail" },
    h("div", { class: "rail-marca" }, h("strong", { text: "ISEL" }), h("span", { text: "Plan de desarrollo comercial" })),
    h("nav", {}, ...grupos.map((g) =>
      h("div", { class: "rail-grupo" },
        h("span", { class: "rail-grupo-tit", text: g }),
        ...menu.filter((x) => x.grupo === g).map((x) => {
          const bloqueado = x.requiereCol && !estado.col;
          return h("button", {
            class: cls("rail-btn", estado.vista === x.id && "activo", bloqueado && "inactivo"),
            disabled: bloqueado,
            onclick: () => ir(x.id),
          }, x.nombre);
        })))),
    h("div", { class: "rail-pie" },
      h("span", { class: "rail-quien", text: estado.perfil.nombre || estado.perfil.email }),
      h("span", { class: "rail-rol", text: etiquetaRol(permisos.rol) }),
      botonTema(),
      boton("Cerrar sesión", async () => { await auth.salir(); location.reload(); }, "ghost")));

  const individual = !!(menu.find((x) => x.id === estado.vista) || {}).requiereCol;
  const barraSuperior = cabecera(individual);
  const lienzo = h("div", { class: "lienzo" });

  vaciar(raiz).appendChild(h("div", { class: "app" }, rail,
    h("main", { class: "main" }, barraSuperior, lienzo)));

  try {
    const vista = VISTAS[estado.vista];
    lienzo.appendChild(vista({ estado, permisos, ir, refrescar, refrescarTodo, elegirColaborador }));
  } catch (err) {
    console.error(err);
    lienzo.appendChild(panel("No se pudo mostrar esta sección",
      "Revisa la consola del navegador para ver el detalle.", h("pre", { class: "error-detalle", text: String(err.message || err) })));
  }
}

function cabecera(individual) {
  const col = individual ? estado.col : null;
  const m = individual ? estado.m : null;
  const visibles = estado.colaboradores.filter((c) => c.estado !== "archivado" || c.id === estado.colId);

  const selector = individual && (permisos.esMentor || permisos.esLector) && visibles.length
    ? h("div", { class: "mini" }, h("span", { text: "Colaborador" }),
      (() => {
        const s = h("select", {}, ...visibles.map((c) =>
          h("option", { value: c.id, selected: c.id === estado.colId },
            c.nombre + (c.estado === "archivado" ? " (archivado)" : ""))));
        s.addEventListener("change", () => elegirColaborador(s.value));
        return s;
      })())
    : null;

  return h("header", { class: "barra-estado" },
    h("div", {},
      h("h1", { text: col ? col.nombre : "Plan de desarrollo comercial" }),
      h("p", {
        text: col
          ? `${col.puesto_actual || "Puesto actual sin definir"} → ${col.puesto_deseado || "Puesto objetivo sin definir"}${col.sucursal ? " · " + col.sucursal : ""}`
          : `${estado.colaboradores.filter((c) => c.estado === "activo").length} colaboradores en desarrollo · de vendedor interno a consultor comercial`
      })),
    h("div", { class: "barra-estado-der" },
      selector,
      col && h("div", { class: "mini" }, h("span", { text: "Semana" }),
        (() => {
          const total = (col.plan || []).length || 20;
          const actual = col.semana_actual || 1;
          /* No es un filtro: marca en qué semana del programa va la persona,
             y solo la mueve quien puede editar su plan. Para los demás se
             muestra como dato, no como control, para no invitar a tocarlo. */
          if (!permisos.editaPrograma(col))
            return h("b", { class: "mini-dato", title: "Semana en la que va el colaborador" },
              `${actual} de ${total}`);
          const s = h("select", { title: "Mueve al colaborador a otra semana del programa" },
            ...Array.from({ length: total }, (_, i) =>
              h("option", { value: i + 1, selected: actual === i + 1 }, `${i + 1} de ${total}`)));
          s.addEventListener("change", async () => {
            await colaboradores.actualizar(col.id, { semana_actual: Number(s.value) });
            aviso("Semana actualizada");
            refrescar();
          });
          return s;
        })()),
      m && m.cal && !m.cal.sinFecha && h("div", { class: "mini" },
        h("span", { text: "Programa" }),
        h("b", { class: "mini-dato", title: "Inicio y término previsto" },
          `${fecha(m.cal.inicio)} \u2192 ${fecha(m.cal.fin)}`)),
      m && m.cal && h("div", { class: "mini" }, h("span", { text: "Ritmo" }), lampara(m.cal.estado, m.cal.veredicto)),
      m && h("div", { class: "mini" }, h("span", { text: "Avance del plan" }), h("b", { text: m.avanceTareas + "%" })),
      m && h("div", { class: "mini" }, h("span", { text: "Scorecard" }), h("b", { text: m.score ? m.score.toFixed(2) : "—" })),
      m && h("div", { class: "mini" }, h("span", { text: "Dictamen" }), lampara(m.estado, m.dictamen))));
}

export const etiquetaRol = (r) =>
  r === "admin" ? "Administrador"
    : r === "mentor" ? "Mentor"
      : r === "lector" ? "Solo lectura"
        : r === "colaborador" ? "Colaborador en desarrollo"
          : "Sin acceso";

/* ---------------------------------------------- PANTALLAS INTERMEDIAS --- */

/* La persona tiene cuenta en ISEL pero nadie le ha dado acceso aquí todavía,
   o un administrador se lo retiró. */
function pantallaSinAcceso() {
  vaciar(raiz).appendChild(h("div", { class: "login" },
    h("div", { class: "login-caja" },
      h("div", { class: "login-marca" }, h("strong", { text: "ISEL" }),
        h("span", { text: "Plan de desarrollo comercial" })),
      h("h2", { class: "sin-acceso-tit", text: "Todavía no tienes acceso" }),
      h("p", { class: "login-intro", text: `Tu cuenta ${estado.perfil.email} existe, pero un administrador debe concederte acceso a esta herramienta. Pídeselo y vuelve a entrar.` }),
      h("div", { class: "login-pie" }, botonTema(),
        boton("Cerrar sesión", async () => { await auth.salir(); location.reload(); }, "ghost")))));
}

/* Dos caminos llegan aquí y hay que entrar eligiendo contraseña:
   "temporal"     · primer ingreso con la contraseña que dio el administrador
   "recuperacion" · la persona abrió el enlace del correo de restablecimiento */
function pantallaCambioObligado(motivo = "temporal") {
  const intro = motivo === "recuperacion"
    ? "Abriste el enlace para restablecer tu contraseña. Escribe la nueva para continuar."
    : "Entraste con una contraseña temporal. Cámbiala por una tuya para continuar.";
  const p1 = h("input", { type: "password", placeholder: "Nueva contraseña", autocomplete: "new-password" });
  const p2 = h("input", { type: "password", placeholder: "Repite la contraseña", autocomplete: "new-password" });
  const error = h("p", { class: "login-error" });
  const btn = boton("Guardar y entrar", async () => {
    error.textContent = "";
    if (p1.value.length < 8) { error.textContent = "Usa al menos 8 caracteres."; return; }
    if (p1.value !== p2.value) { error.textContent = "Las dos contraseñas no coinciden."; return; }
    btn.disabled = true; btn.textContent = "Guardando…";
    try {
      await auth.cambiarPassword(p1.value);
      await perfiles.actualizar(estado.perfil.id, { debe_cambiar: false });
      estado.perfil.debe_cambiar = false;
      aviso("Contraseña actualizada");
      await continuarArranque();
    } catch (e) {
      error.textContent = e.message;
      btn.disabled = false; btn.textContent = "Guardar y entrar";
    }
  });

  vaciar(raiz).appendChild(h("div", { class: "login" },
    h("div", { class: "login-caja" },
      h("div", { class: "login-marca" }, h("strong", { text: "ISEL" }),
        h("span", { text: "Plan de desarrollo comercial" })),
      h("h2", { class: "sin-acceso-tit", text: "Elige tu contraseña" }),
      h("p", { class: "login-intro", text: intro }),
      h("form", { class: "login-form", onsubmit: (e) => { e.preventDefault(); btn.click(); } },
        campo("Nueva contraseña", p1), campo("Repite la contraseña", p2), error, btn),
      h("div", { class: "login-pie" }, botonTema()))));
}

/* --------------------------------------------------------------- LOGIN --- */

function pantallaAcceso(mensaje) {
  const email = h("input", { type: "email", placeholder: "correo@empresa.com", autocomplete: "username" });
  const pass = h("input", { type: "password", placeholder: "Contraseña", autocomplete: "current-password" });
  const error = h("p", { class: "login-error" });
  const btn = boton("Entrar", async () => {
    error.textContent = "";
    btn.disabled = true; btn.textContent = "Entrando…";
    try {
      await auth.entrar(email.value.trim(), pass.value);
      await arrancar();
    } catch (e) {
      error.textContent = traducirError(e.message);
      btn.disabled = false; btn.textContent = "Entrar";
    }
  });
  const form = h("form", { class: "login-form", onsubmit: (e) => { e.preventDefault(); btn.click(); } },
    campo("Correo", email), campo("Contraseña", pass), error, btn,
    h("button", {
      type: "button", class: "link", onclick: async () => {
        if (!email.value.trim()) { error.textContent = "Escribe tu correo para enviarte el enlace."; return; }
        try { await auth.recuperar(email.value.trim()); aviso("Te enviamos un correo para restablecer la contraseña"); }
        catch (e) { error.textContent = traducirError(e.message); }
      }
    }, "Olvidé mi contraseña"));

  vaciar(raiz).appendChild(h("div", { class: "login" },
    h("div", { class: "login-caja" },
      h("div", { class: "login-marca" }, h("strong", { text: "ISEL" }), h("span", { text: "Plan de desarrollo comercial" })),
      h("p", { class: "login-intro", text: "Entra con las credenciales que te dio el administrador del programa." }),
      mensaje && h("p", { class: "login-error", text: mensaje }),
      form,
      h("div", { class: "login-pie" }, botonTema()))));
}

const traducirError = (msg) =>
  /invalid login/i.test(msg) ? "Correo o contraseña incorrectos."
    : /email not confirmed/i.test(msg) ? "La cuenta todavía no está confirmada."
      : /(link|token).*(invalid|expired)|(invalid|expired).*(link|token)|otp_expired/i.test(msg)
        ? "El enlace del correo ya caducó o se usó antes. Pide otro con «Olvidé mi contraseña»."
        : /fetch|network/i.test(msg) ? "No se pudo contactar al servidor. Revisa la configuración de Supabase."
          : msg;

/* ------------------------------------------------------------- ARRANQUE -- */

export async function arrancar() {
  const sesion = await auth.sesion();
  // Un enlace caducado o ya usado regresa sin sesión y con el motivo en la URL
  if (!sesion) { pantallaAcceso(errorEnlace ? traducirError(errorEnlace) : undefined); return; }
  vaciar(raiz).appendChild(h("div", { class: "cargando", text: "Cargando el programa…" }));
  try {
    estado.perfil = await miPerfil();

    // Sin fila de perfil, o con el acceso desactivado, no se entra
    if (!estado.perfil || estado.perfil.sinAcceso || estado.perfil.activo === false) {
      pantallaSinAcceso();
      return;
    }
    // Llegó por el enlace de restablecimiento: la sesión sirve para elegir
    // contraseña, no para entrar de largo al programa
    if (enlaceRecuperacion) { pantallaCambioObligado("recuperacion"); return; }
    // Contraseña temporal pendiente de cambiar
    if (estado.perfil.debe_cambiar) { pantallaCambioObligado(); return; }

    await continuarArranque();
  } catch (e) {
    console.error(e);
    vaciar(raiz).appendChild(h("div", { class: "login" },
      h("div", { class: "login-caja" },
        h("h2", { text: "No se pudo cargar la información" }),
        h("p", { class: "login-intro", text: traducirError(e.message) }),
        boton("Cerrar sesión", async () => { await auth.salir(); location.reload(); }, "ghost"))));
  }
}

async function continuarArranque() {
  estado.plantillaGlobal = await plantilla.leer();
  try { estado.perfilesCache = await perfiles.listar(); } catch { estado.perfilesCache = []; }
  await recargarColaboradores();
  await recargarExpediente();
  pintar();
}

auth.alCambiar((s) => { if (!s && estado.perfil) location.reload(); });
iniciarTema();
arrancar();
