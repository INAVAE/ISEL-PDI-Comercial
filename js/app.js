/* ===========================================================================
   Aplicación principal: sesión, permisos por rol, navegación y carga de datos.
   =========================================================================== */

import { auth, miPerfil, colaboradores, cargarExpediente, plantilla, perfiles } from "./db.js";
import { h, vaciar, boton, entrada, campo, aviso, lampara, cls, modal, cerrarModal, panel, dinero } from "./ui.js";
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
  ui: { corteCompetencias: null, mesRuta: null, pestanaConfig: "plan" },
};

/* ------------------------------------------------------------- PERMISOS -- */

export const permisos = {
  get rol() { return estado.perfil ? estado.perfil.rol : "colaborador"; },
  get esAdmin() { return permisos.rol === "admin"; },
  get esMentor() { return permisos.rol === "mentor" || permisos.esAdmin; },
  get esColaborador() { return permisos.rol === "colaborador"; },
  /* El mentor solo edita el plan de los colaboradores que tiene asignados */
  editaPrograma(col) {
    if (permisos.esAdmin) return true;
    return permisos.rol === "mentor" && col && col.mentor_id === estado.perfil.id;
  },
  evalua(col) { return permisos.editaPrograma(col); },
  /* El colaborador captura su propia actividad; el mentor puede corregirla */
  captura(col) {
    if (!col) return false;
    return permisos.editaPrograma(col) || col.user_id === estado.perfil.id;
  },
};

/* ---------------------------------------------------------------- MENÚ --- */

const MENU = [
  { id: "resumen", nombre: "Resumen general", roles: ["admin", "mentor"], grupo: "Gestión" },
  { id: "colaboradores", nombre: "Colaboradores", roles: ["admin", "mentor"], grupo: "Gestión" },
  { id: "panel", nombre: "Panel", roles: ["admin", "mentor", "colaborador"], grupo: "Desarrollo", requiereCol: true },
  { id: "ruta", nombre: "Ruta de 20 semanas", roles: ["admin", "mentor", "colaborador"], grupo: "Desarrollo", requiereCol: true },
  { id: "competencias", nombre: "Competencias", roles: ["admin", "mentor", "colaborador"], grupo: "Desarrollo", requiereCol: true },
  { id: "kpis", nombre: "KPIs", roles: ["admin", "mentor", "colaborador"], grupo: "Desarrollo", requiereCol: true },
  { id: "visitas", nombre: "Visitas de campo", roles: ["admin", "mentor", "colaborador"], grupo: "Actividad", requiereCol: true },
  { id: "pipeline", nombre: "Pipeline", roles: ["admin", "mentor", "colaborador"], grupo: "Actividad", requiereCol: true },
  { id: "cuentas", nombre: "Cuentas", roles: ["admin", "mentor", "colaborador"], grupo: "Actividad", requiereCol: true },
  { id: "coaching", nombre: "Coaching", roles: ["admin", "mentor", "colaborador"], grupo: "Actividad", requiereCol: true },
  { id: "graduacion", nombre: "Graduación", roles: ["admin", "mentor", "colaborador"], grupo: "Desarrollo", requiereCol: true },
  { id: "riesgos", nombre: "Riesgos", roles: ["admin", "mentor"], grupo: "Desarrollo", requiereCol: true },
  { id: "configuracion", nombre: "Configurar programa", roles: ["admin", "mentor"], grupo: "Administración", requiereCol: true },
  { id: "plantilla", nombre: "Plantilla base", roles: ["admin"], grupo: "Administración" },
  { id: "usuarios", nombre: "Usuarios y roles", roles: ["admin"], grupo: "Administración" },
  { id: "cuenta", nombre: "Mi cuenta", roles: ["admin", "mentor", "colaborador"], grupo: "Administración" },
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

export async function refrescar(vista) {
  if (vista) estado.vista = vista;
  await recargarExpediente();
  pintar();
}

export async function refrescarTodo(vista) {
  await recargarColaboradores();
  await recargarExpediente();
  if (vista) estado.vista = vista;
  pintar();
}

export const ir = (vista) => { estado.vista = vista; pintar(); window.scrollTo(0, 0); };

export async function elegirColaborador(id) {
  estado.colId = id;
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

  const selector = individual && permisos.esMentor && visibles.length
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
          const s = h("select", { disabled: !permisos.editaPrograma(col) },
            ...Array.from({ length: total }, (_, i) =>
              h("option", { value: i + 1, selected: (col.semana_actual || 1) === i + 1 }, `${i + 1} de ${total}`)));
          s.addEventListener("change", async () => {
            await colaboradores.actualizar(col.id, { semana_actual: Number(s.value) });
            aviso("Semana actualizada");
            refrescar();
          });
          return s;
        })()),
      m && h("div", { class: "mini" }, h("span", { text: "Avance del plan" }), h("b", { text: m.avanceTareas + "%" })),
      m && h("div", { class: "mini" }, h("span", { text: "Scorecard" }), h("b", { text: m.score ? m.score.toFixed(2) : "—" })),
      m && h("div", { class: "mini" }, h("span", { text: "Dictamen" }), lampara(m.estado, m.dictamen))));
}

export const etiquetaRol = (r) =>
  r === "admin" ? "Administrador" : r === "mentor" ? "Mentor" : "Colaborador en desarrollo";

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
      form)));
}

const traducirError = (msg) =>
  /invalid login/i.test(msg) ? "Correo o contraseña incorrectos."
    : /email not confirmed/i.test(msg) ? "La cuenta todavía no está confirmada."
      : /fetch|network/i.test(msg) ? "No se pudo contactar al servidor. Revisa la configuración de Supabase."
        : msg;

/* ------------------------------------------------------------- ARRANQUE -- */

export async function arrancar() {
  const sesion = await auth.sesion();
  if (!sesion) { pantallaAcceso(); return; }
  vaciar(raiz).appendChild(h("div", { class: "cargando", text: "Cargando el programa…" }));
  try {
    estado.perfil = await miPerfil();
    if (estado.perfil && estado.perfil.activo === false) {
      await auth.salir();
      pantallaAcceso("Tu cuenta está desactivada. Contacta al administrador.");
      return;
    }
    estado.plantillaGlobal = await plantilla.leer();
    try { estado.perfilesCache = await perfiles.listar(); } catch { estado.perfilesCache = []; }
    await recargarColaboradores();
    await recargarExpediente();
    pintar();
  } catch (e) {
    console.error(e);
    vaciar(raiz).appendChild(h("div", { class: "login" },
      h("div", { class: "login-caja" },
        h("h2", { text: "No se pudo cargar la información" }),
        h("p", { class: "login-intro", text: traducirError(e.message) }),
        boton("Cerrar sesión", async () => { await auth.salir(); location.reload(); }, "ghost"))));
  }
}

auth.alCambiar((s) => { if (!s && estado.perfil) location.reload(); });
arrancar();
